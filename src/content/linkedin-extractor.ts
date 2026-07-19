import { AppError } from '../application/errors';
import {
  postContextSchema,
  type DiscussionItem,
  type PostContext,
  type SupportedSurface,
} from '../domain/schemas';

const EXTRACTION_VERSION = '2026.07.5';
const MIN_REPLY_INDENT_PX = 12;
const POST_SELECTORS = [
  '[data-urn^="urn:li:activity:"]',
  '[data-id^="urn:li:activity:"]',
  '.feed-shared-update-v2',
  '[data-view-name="feed-full-update"]',
  'article[data-id]',
  '[data-finite-scroll-hotkey-item]',
  '.occludable-update',
  '[id^="expanded"][id*="FeedType_"]',
  '[role="listitem"][componentkey^="expanded"]',
] as const;
const POST_TEXT_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '.update-components-text',
  '.feed-shared-text',
  '.attributed-text-segment-list__content',
  '.feed-shared-update-v2__description',
  '.feed-shared-update-v2__commentary',
  '.feed-shared-mini-update-v2__description',
  '.feed-shared-article__title',
  '.feed-shared-article__description',
  '.feed-shared-poll__option',
  '[data-test-id="main-feed-activity-card__commentary"]',
  '[data-view-name="feed-commentary"]',
] as const;
const COMMENT_SELECTORS = [
  '[id^="replaceableComment_urn:li:comment:"]',
  '.comments-comment-item',
  'article.comments-comment-entity',
  '[data-id^="urn:li:comment"]',
  '[data-view-name="comment-container"]',
] as const;
const COMMENT_TEXT_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '.comments-comment-item__main-content',
  '.comments-comment-item-content-body',
  '.comments-comment-item__inline-show-more-text',
  '.comments-comment-entity__content',
  '.comments-comment-entity__main-content',
  '[data-view-name="comment-text"]',
] as const;
const REACTION_SELECTORS = [
  '.social-details-social-counts__reactions-count',
  '[data-test-id="social-actions__reaction-count"]',
  '[data-view-name="reaction-count"]',
] as const;

export function extractLinkedInPost(
  target: Element,
  locationHref = window.location.href,
): PostContext {
  const postRoot = findUniquePostRoot(target);
  const visiblePostText = collectText(postRoot, POST_TEXT_SELECTORS, COMMENT_SELECTORS);
  if (!visiblePostText) throw unsupported('The selected post has no visible text to analyze.');

  const commentRoots = findTopLevelMatches(postRoot, COMMENT_SELECTORS);
  const targetComment = findTargetComment(target, commentRoots);
  const classifiedComments = classifyComments(commentRoots);
  const discussionComments = selectDiscussionComments(classifiedComments, targetComment);
  const labels = new Map<string, string>();
  const visibleDiscussion = discussionComments
    .map(({ root, depth }) => extractComment(root, depth, targetComment, labels))
    .filter((item): item is DiscussionItem => item !== null);
  const responseTarget = targetComment
    ? {
        type: 'reply' as const,
        participantLabel:
          visibleDiscussion.find(({ isTarget }) => isTarget)?.participantLabel ??
          'Target Commenter',
        text: visibleDiscussion.find(({ isTarget }) => isTarget)?.text ?? '',
      }
    : { type: 'post' as const, text: visiblePostText };
  if (!responseTarget.text)
    throw unsupported('The selected comment has no visible text to analyze.');

  const reactionSummary = collectText(postRoot, REACTION_SELECTORS);
  const candidate = {
    schemaVersion: 1 as const,
    extractionVersion: EXTRACTION_VERSION,
    surface: detectSurface(locationHref),
    visiblePostText,
    ...(reactionSummary ? { reactionSummary } : {}),
    visibleDiscussion,
    responseTarget,
    excerpt: visiblePostText.slice(0, 280),
    extractedAt: new Date().toISOString(),
  };
  return postContextSchema.parse(candidate);
}

function findUniquePostRoot(target: Element): Element {
  const matchingAncestors: Element[] = [];
  let current: Element | null = target;
  while (current) {
    if (POST_SELECTORS.some((selector) => current?.matches(selector))) {
      matchingAncestors.push(current);
    }
    current = current.parentElement;
  }
  if (matchingAncestors.length === 0)
    throw unsupported('Right-click inside a visible LinkedIn post or comment.');
  const outermost = matchingAncestors.at(-1);
  if (!outermost) throw unsupported('The selected post could not be identified uniquely.');
  return outermost;
}

function findTargetComment(target: Element, commentRoots: Element[]): Element | null {
  const matches = commentRoots.filter((root) => root === target || root.contains(target));
  if (matches.length === 0) return null;
  return (
    matches.find(
      (candidate) => !matches.some((other) => other !== candidate && candidate.contains(other)),
    ) ?? null
  );
}

function extractComment(
  root: Element,
  depth: number,
  target: Element | null,
  labels: Map<string, string>,
): DiscussionItem | null {
  const text = collectText(root, COMMENT_TEXT_SELECTORS);
  if (!text) {
    throw unsupported('A visible comment used an unsupported layout, so no text was sent.');
  }
  const identityKey = extractIdentityKey(root) ?? `anonymous-${String(labels.size)}`;
  const isTarget = root === target;
  const participantLabel = isTarget ? 'Target Commenter' : getParticipantLabel(identityKey, labels);
  return {
    participantLabel,
    text,
    depth,
    isTarget,
  };
}

interface ClassifiedComment {
  root: Element;
  depth: 0 | 1;
}

function classifyComments(roots: Element[]): ClassifiedComment[] {
  const visualDepths = inferVisualDepths(roots);
  return roots.map((root, index) => ({
    root,
    depth: semanticDepth(root) ?? visualDepths?.[index] ?? 0,
  }));
}

function selectDiscussionComments(
  comments: ClassifiedComment[],
  target: Element | null,
): ClassifiedComment[] {
  if (!target) return comments;

  const targetIndex = comments.findIndex(({ root }) => root === target);
  if (targetIndex < 0)
    throw unsupported('The selected comment could not be matched to the visible discussion.');

  let threadStart = targetIndex;
  if (comments[targetIndex]?.depth === 1) {
    while (threadStart >= 0 && comments[threadStart]?.depth !== 0) threadStart -= 1;
    if (threadStart < 0)
      throw unsupported('The selected reply had no visible parent comment, so no text was sent.');
  }

  let threadEnd = threadStart + 1;
  while (threadEnd < comments.length && comments[threadEnd]?.depth === 1) threadEnd += 1;
  return comments.slice(threadStart, threadEnd);
}

function getParticipantLabel(identityKey: string, labels: Map<string, string>): string {
  const existing = labels.get(identityKey);
  if (existing) return existing;
  const label = `Commenter ${toLetters(labels.size)}`;
  labels.set(identityKey, label);
  return label;
}

function extractIdentityKey(root: Element): string | null {
  const profileLink = root.querySelector<HTMLAnchorElement>('a[href*="/in/"]');
  return profileLink?.getAttribute('href') ?? root.getAttribute('data-id');
}

function collectText(
  root: Element,
  selectors: readonly string[],
  excludedAncestors: readonly string[] = [],
): string {
  const candidates = selectors
    .flatMap((selector) => [...root.querySelectorAll(selector)])
    .filter(
      (candidate) =>
        !excludedAncestors.some((selector) => candidate.closest(selector)?.matches(selector)),
    );
  const topLevel = candidates.filter(
    (candidate) => !candidates.some((other) => other !== candidate && other.contains(candidate)),
  );
  return normalize(
    topLevel
      .map((element) => visibleText(element))
      .filter(Boolean)
      .join('\n'),
  );
}

function visibleText(element: Element): string {
  const htmlElement = element as HTMLElement;
  if (htmlElement.hidden || htmlElement.getAttribute('aria-hidden') === 'true') return '';
  if (typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(htmlElement);
    if (style.display === 'none' || style.visibility === 'hidden') return '';
  }
  return normalize(htmlElement.innerText || htmlElement.textContent || '');
}

function findTopLevelMatches(root: Element, selectors: readonly string[]): Element[] {
  return [...root.querySelectorAll(selectors.join(','))];
}

function semanticDepth(root: Element): 0 | 1 | null {
  const explicit = root.getAttribute('data-depth') ?? root.getAttribute('aria-level');
  const numeric = explicit ? Number(explicit) : Number.NaN;
  if (Number.isInteger(numeric) && numeric >= 0)
    return numeric - (root.hasAttribute('aria-level') ? 1 : 0) > 0 ? 1 : 0;
  if (root.closest('.comments-comment-item__replies-list, [data-view-name="comment-replies"]'))
    return 1;
  return null;
}

function inferVisualDepths(roots: Element[]): (0 | 1)[] | null {
  if (roots.length < 2) return null;
  const inlineStarts = roots.map(commentInlineStart);
  if (inlineStarts.some((value) => value === null)) return null;

  const measuredStarts = inlineStarts as number[];
  const topLevelStart = Math.min(...measuredStarts);
  return measuredStarts.map((start) => (start - topLevelStart >= MIN_REPLY_INDENT_PX ? 1 : 0));
}

function commentInlineStart(root: Element): number | null {
  const authorLink = root.querySelector<HTMLAnchorElement>('a[href*="/in/"]');
  if (!authorLink) return null;

  const rect = authorLink.getBoundingClientRect();
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.right) ||
    (rect.width <= 0 && rect.height <= 0)
  )
    return null;

  return window.getComputedStyle(root).direction === 'rtl'
    ? window.innerWidth - rect.right
    : rect.left;
}

function detectSurface(href: string): SupportedSurface {
  return href.includes('/feed/update/') || href.includes('/posts/') ? 'post-detail' : 'feed';
}

function normalize(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toLetters(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function unsupported(message: string): AppError {
  return new AppError('unsupported-layout', message);
}
