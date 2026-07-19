import {
  DISCOVERY_SOURCE_IDS,
  sourceEvidenceSchema,
  type DiscoverySettings,
  type DiscoverySourceId,
  type SeenItem,
  type SourceEvidence,
} from '../domain/discovery';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface CollectionResult {
  evidence: SourceEvidence[];
  errors: Partial<Record<DiscoverySourceId, string>>;
}

export async function collectDiscoveryEvidence(
  settings: DiscoverySettings,
  seenItems: SeenItem[],
  signal: AbortSignal,
): Promise<CollectionResult> {
  const seen = new Set(seenItems.map((item) => item.fingerprint));
  const enabled = DISCOVERY_SOURCE_IDS.filter((source) => settings.sources[source].enabled);
  const settled = await Promise.allSettled(
    enabled.map(async (source) => {
      const limit = settings.sources[source].limit;
      const candidates = await fetchSource(source, settings.topics, limit, signal);
      const filtered = candidates
        .filter(isRecent)
        .filter((item) => isTopicRelevant(item, settings.topics))
        .sort((a, b) => popularity(b) - popularity(a));
      const unique: SourceEvidence[] = [];
      for (const item of filtered) {
        const fingerprint = await fingerprintUrl(item.reference.url);
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        unique.push(item);
        if (unique.length >= limit) break;
      }
      return { source, evidence: unique };
    }),
  );

  const evidence: SourceEvidence[] = [];
  const errors: Partial<Record<DiscoverySourceId, string>> = {};
  settled.forEach((result, index) => {
    const source = enabled[index];
    if (!source) return;
    if (result.status === 'fulfilled') evidence.push(...result.value.evidence);
    else if (!isAbortError(result.reason)) errors[source] = safeError(result.reason);
  });
  return { evidence: deduplicateByCanonicalUrl(evidence), errors };
}

async function fetchSource(
  source: DiscoverySourceId,
  topics: string[],
  limit: number,
  signal: AbortSignal,
): Promise<SourceEvidence[]> {
  switch (source) {
    case 'hacker-news':
      return fetchHackerNews(limit, signal);
    case 'dev':
      return fetchDev(signal);
    case 'medium':
      return fetchMedium(topics, signal);
    case 'lobsters':
      return fetchLobsters(signal);
    case 'stack-overflow':
      return fetchStackOverflow(signal);
  }
}

async function fetchHackerNews(limit: number, signal: AbortSignal): Promise<SourceEvidence[]> {
  const ids = await fetchJson<unknown>(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
    signal,
  );
  if (!Array.isArray(ids)) throw new Error('Hacker News returned an invalid story list.');
  const storyIds = ids.filter((id): id is number => Number.isInteger(id)).slice(0, limit * 8 + 20);
  const stories = await Promise.all(
    storyIds.map((id) =>
      fetchJson<Record<string, unknown>>(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
        signal,
      ),
    ),
  );
  return stories.flatMap((story) => {
    const id = numberValue(story.id);
    const title = stringValue(story.title);
    const timestamp = numberValue(story.time);
    if (!id || !title || !timestamp) return [];
    const url = validUrl(story.url) ?? `https://news.ycombinator.com/item?id=${id}`;
    return [
      parseEvidence({
        id: `hn:${id}`,
        source: 'hacker-news',
        title,
        excerpt: stripMarkup(stringValue(story.text) ?? '').slice(0, 1000),
        tags: [],
        publishedAt: new Date(timestamp * 1000).toISOString(),
        engagement: {
          score: numberValue(story.score),
          comments: numberValue(story.descendants),
        },
        reference: { source: 'hacker-news', title, url },
      }),
    ];
  });
}

async function fetchDev(signal: AbortSignal): Promise<SourceEvidence[]> {
  const payload = await fetchJson<unknown>(
    'https://dev.to/api/articles?top=30&per_page=30',
    signal,
  );
  if (!Array.isArray(payload)) throw new Error('DEV returned an invalid article list.');
  return payload.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    const id = numberValue(item.id);
    const title = stringValue(item.title);
    const url = validUrl(item.canonical_url) ?? validUrl(item.url);
    const publishedAt = isoDate(item.published_at);
    if (!id || !title || !url || !publishedAt) return [];
    return [
      parseEvidence({
        id: `dev:${id}`,
        source: 'dev',
        title,
        excerpt: (stringValue(item.description) ?? '').slice(0, 1000),
        tags: stringList(item.tag_list),
        publishedAt,
        engagement: {
          reactions: numberValue(item.public_reactions_count),
          comments: numberValue(item.comments_count),
        },
        reference: { source: 'dev', title, url },
      }),
    ];
  });
}

async function fetchMedium(topics: string[], signal: AbortSignal): Promise<SourceEvidence[]> {
  const feedTopics = (topics.length > 0 ? topics : ['software development'])
    .slice(0, 3)
    .map((topic) =>
      topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    )
    .filter(Boolean);
  const feeds = await Promise.all(
    feedTopics.map(async (topic) => {
      const response = await fetch(`https://medium.com/feed/tag/${encodeURIComponent(topic)}`, {
        signal,
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      });
      if (!response.ok) throw new Error(`Medium feed request failed (${response.status}).`);
      return parseRss(await response.text(), 'medium');
    }),
  );
  return deduplicateByCanonicalUrl(feeds.flat());
}

async function fetchLobsters(signal: AbortSignal): Promise<SourceEvidence[]> {
  const response = await fetch('https://lobste.rs/rss', {
    signal,
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
  });
  if (!response.ok) throw new Error(`Lobsters feed request failed (${response.status}).`);
  return parseRss(await response.text(), 'lobsters');
}

async function fetchStackOverflow(signal: AbortSignal): Promise<SourceEvidence[]> {
  const endpoint =
    'https://api.stackexchange.com/2.3/questions?site=stackoverflow&sort=hot&order=desc&pagesize=30&filter=default';
  const payload = await fetchJson<Record<string, unknown>>(endpoint, signal);
  if (!Array.isArray(payload.items)) throw new Error('Stack Overflow returned invalid questions.');
  return payload.items.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    const id = numberValue(item.question_id);
    const title = decodeEntities(stringValue(item.title) ?? '');
    const url = validUrl(item.link);
    const timestamp = numberValue(item.creation_date);
    if (!id || !title || !url || !timestamp) return [];
    return [
      parseEvidence({
        id: `so:${id}`,
        source: 'stack-overflow',
        title,
        excerpt: '',
        tags: stringList(item.tags),
        publishedAt: new Date(timestamp * 1000).toISOString(),
        engagement: {
          score: numberValue(item.score),
          comments: numberValue(item.answer_count),
          views: numberValue(item.view_count),
        },
        reference: { source: 'stack-overflow', title, url },
      }),
    ];
  });
}

function parseRss(xml: string, source: 'medium' | 'lobsters'): SourceEvidence[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item, index) => {
    const title = decodeEntities(xmlValue(item, 'title'));
    const url = validUrl(decodeEntities(xmlValue(item, 'link')));
    const publishedAt = isoDate(xmlValue(item, 'pubDate'));
    if (!title || !url || !publishedAt) return [];
    const categories = [...item.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)]
      .map((match) => decodeEntities(stripCdata(match[1] ?? '')))
      .filter(Boolean)
      .slice(0, 20);
    const description = stripMarkup(
      stripCdata(xmlValue(item, 'description') || xmlValue(item, 'content:encoded')),
    ).slice(0, 1000);
    return [
      parseEvidence({
        id: `${source}:${simpleStableId(url)}:${index}`,
        source,
        title,
        excerpt: description,
        tags: categories,
        publishedAt,
        engagement: {},
        reference: { source, title, url },
      }),
    ];
  });
}

function parseEvidence(value: SourceEvidence): SourceEvidence {
  return sourceEvidenceSchema.parse(value);
}

function isRecent(item: SourceEvidence): boolean {
  const age = Date.now() - Date.parse(item.publishedAt);
  return age >= -24 * 60 * 60 * 1000 && age <= THIRTY_DAYS_MS;
}

function isTopicRelevant(item: SourceEvidence, topics: string[]): boolean {
  if (topics.length === 0) return true;
  const haystack = normalize(`${item.title} ${item.excerpt} ${item.tags.join(' ')}`);
  return topics.some((topic) => {
    const normalized = normalize(topic);
    if (normalized.length < 3) return false;
    if (haystack.includes(normalized)) return true;
    const tokens = normalized.split(' ').filter((token) => token.length >= 4);
    return tokens.length > 0 && tokens.some((token) => haystack.includes(token));
  });
}

function popularity(item: SourceEvidence): number {
  return (
    (item.engagement.score ?? 0) * 3 +
    (item.engagement.reactions ?? 0) * 2 +
    (item.engagement.comments ?? 0) * 4 +
    Math.log10((item.engagement.views ?? 0) + 1) * 10
  );
}

export function deduplicateByCanonicalUrl(items: SourceEvidence[]): SourceEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const canonical = canonicalUrl(item.reference.url);
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  });
}

export async function fingerprintUrl(url: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalUrl(url)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'ref' || key === 'source') url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  return url.toString().replace(/\/$/, '');
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Source request failed (${response.status}).`);
  return (await response.json()) as T;
}

function xmlValue(item: string, tag: string): string {
  const escaped = tag.replace(':', '\\:');
  const match = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i').exec(item);
  return stripCdata(match?.[1] ?? '');
}

function stripCdata(value: string): string {
  return value
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

function stripMarkup(value: string): string {
  return decodeEntities(
    value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    '#39': "'",
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === 'string').slice(0, 20);
  return typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];
}

function validUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function simpleStableId(value: string): string {
  let hash = 0;
  for (const character of value) hash = Math.imul(31, hash) + character.charCodeAt(0);
  return Math.abs(hash).toString(36);
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'The source could not be reached.';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
