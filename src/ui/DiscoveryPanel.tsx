import React, { useCallback, useEffect, useState } from 'react';
import type {
  DiscoverySourceId,
  PostOpportunity,
  PublicationHistoryEntry,
} from '../domain/discovery';
import { sendRuntimeMessage, type DiscoverySnapshot } from '../shared/protocol';
import { controlClass } from './control-styles';
import styles from './styles';

const SOURCE_LABELS: Record<DiscoverySourceId, string> = {
  'hacker-news': 'Hacker News',
  dev: 'DEV',
  medium: 'Medium',
  lobsters: 'Lobsters',
  'stack-overflow': 'Stack Overflow',
};

export function DiscoveryPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot | null>(null);
  const [message, setMessage] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [failedDraftId, setFailedDraftId] = useState<string | null>(null);
  const [view, setView] = useState<'ideas' | 'history'>('ideas');

  const refresh = useCallback(async () => {
    const response = await sendRuntimeMessage({ type: 'discovery:get' });
    if (response.ok && 'discovery' in response) setSnapshot(response.discovery);
    else if (!response.ok) setMessage(response.message);
  }, []);

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);

  async function run(provider: 'groq' | 'gemini' = 'groq') {
    setMessage('');
    const response = await sendRuntimeMessage({ type: 'discovery:run', provider });
    if (!response.ok) setMessage(response.message);
    await refresh();
  }

  async function generate(
    opportunityId: string,
    alternative: boolean,
    provider: 'groq' | 'gemini' = 'groq',
  ) {
    setWorkingId(opportunityId);
    setMessage('');
    const response = await sendRuntimeMessage({
      type: 'discovery:generate',
      opportunityId,
      alternative,
      provider,
    });
    if (!response.ok) {
      setMessage(response.message);
      if (provider === 'groq') setFailedDraftId(opportunityId);
    } else setFailedDraftId(null);
    setWorkingId(null);
    await refresh();
  }

  if (!snapshot)
    return (
      <section className={`${styles.card} ${styles.loadingCard}`}>
        <div className={styles.spinner} aria-hidden="true" />
        <p>Preparing discovery…</p>
      </section>
    );

  if (!snapshot.settings.enabled)
    return (
      <section className={`${styles.card} ${styles.activeSurface}`}>
        <p className={styles.eyebrow}>Optional</p>
        <h2>Find post ideas from developer sources</h2>
        <p className={styles.leadCompact}>
          Review ideas from approved APIs and RSS. Discovery does not access or post on LinkedIn.
        </p>
        <div className={styles.cardActions}>
          <button className={controlClass()} type="button" onClick={onOpenSettings}>
            Configure discovery
          </button>
        </div>
      </section>
    );

  const isRunning = snapshot.state.status === 'running';
  const current = snapshot.current;
  const opportunities = current?.opportunities ?? [];
  const draftCount = opportunities.filter(({ draft }) => Boolean(draft)).length;
  const strongCount = opportunities.filter(
    ({ assessment }) => assessment.rating === 'strong',
  ).length;
  return (
    <>
      <section className={`${styles.card} ${styles.discoveryHero}`}>
        <div className={styles.between}>
          <div>
            <p className={styles.eyebrow}>Ideas on demand</p>
            <h2>Developer discovery</h2>
          </div>
          <span className={styles.scopeGranted}>Manual only</span>
        </div>
        <p className={styles.subtle}>
          The last completed results remain visible while a new run works in the extension
          background.
        </p>
        <div className={styles.buttonRow}>
          <button
            className={controlClass()}
            type="button"
            disabled={isRunning}
            onClick={() => void run()}
          >
            {isRunning ? 'Discovery running…' : 'Run discovery'}
          </button>
          {isRunning && (
            <button
              className={controlClass({ variant: 'secondary' })}
              type="button"
              onClick={() => void sendRuntimeMessage({ type: 'discovery:cancel' })}
            >
              Cancel discovery
            </button>
          )}
        </div>
        {snapshot.state.status === 'running' && (
          <div className={styles.progressStatus} role="status">
            <div className={styles.spinner} aria-hidden="true" />
            <span>{stageLabel(snapshot.state.stage)}</span>
          </div>
        )}
        {snapshot.state.status === 'error' && (
          <div className={styles.error}>
            <strong>Discovery stopped safely</strong>
            <p>{snapshot.state.message}</p>
            <small>No automatic provider switch or repeated retry occurred.</small>
            {snapshot.state.code.startsWith('provider-') && (
              <button
                className={controlClass({ variant: 'secondary' })}
                type="button"
                onClick={() => void run('gemini')}
              >
                Retry assessment batch with Gemini
              </button>
            )}
          </div>
        )}
        {message && (snapshot.state.status !== 'error' || message !== snapshot.state.message) && (
          <div className={styles.warning} role="status">
            {message}
          </div>
        )}
      </section>

      {current && Object.keys(current.sourceErrors).length > 0 && (
        <section className={styles.card}>
          <p className={styles.eyebrow}>Partial source status</p>
          <h3>Some sources could not contribute</h3>
          <ul className={styles.list}>
            {Object.entries(current.sourceErrors).map(([source, error]) => (
              <li key={source}>
                <b>{SOURCE_LABELS[source as DiscoverySourceId]}:</b> {error}
              </li>
            ))}
          </ul>
        </section>
      )}

      {current?.draftError && (
        <section className={styles.card}>
          <div className={styles.warning}>
            <strong>Automatic Groq drafting stopped</strong>
            <p>{current.draftError}</p>
            <small>
              Assessments were preserved. Use Generate post on one opportunity, or explicitly choose
              Gemini for that draft.
            </small>
          </div>
        </section>
      )}

      {(current !== null || snapshot.history.length > 0) && (
        <div className={styles.segmentedTabs} aria-label="Discovery content">
          <button type="button" data-active={view === 'ideas'} onClick={() => setView('ideas')}>
            Ideas <span>{opportunities.length}</span>
          </button>
          <button type="button" data-active={view === 'history'} onClick={() => setView('history')}>
            Publication history <span>{snapshot.history.length}</span>
          </button>
        </div>
      )}

      {view === 'ideas' && !current ? (
        <section className={`${styles.card} ${styles.empty}`}>
          <div className={styles.stateIcon} aria-hidden="true">
            ⌁
          </div>
          <p className={styles.eyebrow}>No discovery run yet</p>
          <h2>Find your next useful point</h2>
          <p className={styles.leadCompact}>
            Run discovery when you want ideas. Nothing is scheduled in the browser.
          </p>
        </section>
      ) : view === 'ideas' && current?.opportunities.length === 0 ? (
        <section className={`${styles.card} ${styles.empty}`}>
          <p className={styles.eyebrow}>Quality boundary applied</p>
          <h2>No relevant opportunities this time</h2>
          <p className={styles.leadCompact}>
            The extension did not pad the list with generic popular content. Try adjusting your
            Discovery Topics or source settings.
          </p>
        </section>
      ) : view === 'ideas' && current ? (
        <>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.eyebrow}>Profile-aware opportunities</p>
              <h2>{current.opportunities.length} ideas to review</h2>
            </div>
            <span className={styles.meta}>{new Date(current.completedAt).toLocaleString()}</span>
          </div>
          <div className={styles.discoveryStats} aria-label="Discovery summary">
            <span style={meterStyle(strongCount, opportunities.length)}>
              <b>{strongCount}</b> strong
              <i aria-hidden="true" />
            </span>
            <span style={meterStyle(draftCount, opportunities.length)}>
              <b>{draftCount}</b> drafted
              <i aria-hidden="true" />
            </span>
            <span style={meterStyle(opportunities.length - draftCount, opportunities.length)}>
              <b>{opportunities.length - draftCount}</b> to review
              <i aria-hidden="true" />
            </span>
          </div>
          <div className={styles.opportunityList}>
            {current.opportunities.map((opportunity, index) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                initiallyOpen={Boolean(opportunity.draft) || index === 0}
                working={workingId === opportunity.id}
                allowGeminiOverride={
                  failedDraftId === opportunity.id || Boolean(current.draftError)
                }
                onGenerate={generate}
              />
            ))}
          </div>
        </>
      ) : (
        <PublicationHistory entries={snapshot.history} onRefresh={refresh} />
      )}
    </>
  );
}

function OpportunityCard({
  opportunity,
  initiallyOpen,
  working,
  allowGeminiOverride,
  onGenerate,
}: {
  opportunity: PostOpportunity;
  initiallyOpen: boolean;
  working: boolean;
  allowGeminiOverride: boolean;
  onGenerate: (id: string, alternative: boolean, provider?: 'groq' | 'gemini') => Promise<void>;
}) {
  const [text, setText] = useState(opportunity.draft?.text ?? '');
  const [expanded, setExpanded] = useState(initiallyOpen);
  const canDraft =
    opportunity.assessment.rating !== 'skip' && opportunity.assessment.sufficientEvidence;

  useEffect(() => setText(opportunity.draft?.text ?? ''), [opportunity.draft?.text]);

  return (
    <section className={`${styles.card} ${styles.opportunityCard}`}>
      <div className={styles.between}>
        <div className={styles.badgeRow}>
          <span className={`${styles.badge} ${ratingClass(opportunity.assessment.rating)}`}>
            {ratingLabel(opportunity.assessment.rating)}
          </span>
          <span className={styles.badge}>{typeLabel(opportunity.assessment.type)}</span>
        </div>
        <span className={styles.meta}>{SOURCE_LABELS[opportunity.reference.source]}</span>
      </div>
      <h3 className={styles.opportunityTitle}>{opportunity.reference.title}</h3>
      <p className={styles.opportunitySummary}>{opportunity.assessment.relevance}</p>
      <button
        className={styles.disclosureButton}
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? 'Hide details' : opportunity.draft ? 'Review draft' : 'Review opportunity'}
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className={styles.opportunityDetails}>
          <dl className={styles.assessmentGrid}>
            <div>
              <dt>Audience</dt>
              <dd>{opportunity.assessment.audienceFit}</dd>
            </div>
            <div>
              <dt>Discussion value</dt>
              <dd>{opportunity.assessment.discussionValue}</dd>
            </div>
            <div>
              <dt>Credibility check</dt>
              <dd>{opportunity.assessment.credibilityRisk}</dd>
            </div>
          </dl>
          {opportunity.assessment.uncertainty && (
            <p className={styles.subtle}>
              <b>Uncertainty:</b> {opportunity.assessment.uncertainty}
            </p>
          )}
          <a
            className={controlClass({ variant: 'secondary', link: true })}
            href={opportunity.reference.url}
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>

          {opportunity.draft ? (
            <div className={styles.publicationDraft}>
              <div className={styles.draftHeading}>
                <div>
                  <b>Ready-to-edit post</b>
                  <small>Edits save locally when you leave the field.</small>
                </div>
                <span className={styles.meta}>
                  {wordCount(text)} words · {opportunity.draft.model}
                </span>
              </div>
              <textarea
                className={`${styles.textarea} ${styles.publicationTextarea}`}
                value={text}
                aria-label={`Publication draft for ${opportunity.reference.title}`}
                onChange={(event) => setText(event.target.value)}
                onBlur={() =>
                  void sendRuntimeMessage({
                    type: 'discovery:update-draft',
                    opportunityId: opportunity.id,
                    text,
                  })
                }
              />
              <div className={styles.publicationActions}>
                <CopyButton text={text} />
                <button
                  className={controlClass({ variant: 'secondary' })}
                  type="button"
                  disabled={working}
                  onClick={() => void onGenerate(opportunity.id, true)}
                >
                  {working ? 'Generating…' : 'New alternative'}
                </button>
                {allowGeminiOverride && (
                  <button
                    className={controlClass({ variant: 'secondary' })}
                    type="button"
                    disabled={working}
                    onClick={() => void onGenerate(opportunity.id, true, 'gemini')}
                  >
                    Retry with Gemini
                  </button>
                )}
              </div>
            </div>
          ) : canDraft ? (
            <div className={styles.generateActions}>
              <button
                className={controlClass()}
                type="button"
                disabled={working}
                onClick={() => void onGenerate(opportunity.id, false)}
              >
                {working ? 'Generating…' : 'Generate post'}
              </button>
              {allowGeminiOverride && (
                <button
                  className={controlClass({ variant: 'secondary' })}
                  type="button"
                  disabled={working}
                  onClick={() => void onGenerate(opportunity.id, false, 'gemini')}
                >
                  Retry once with Gemini
                </button>
              )}
            </div>
          ) : (
            <p className={styles.evidenceBoundary}>
              No draft is available because this idea did not meet the evidence boundary.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function PublicationHistory({
  entries,
  onRefresh,
}: {
  entries: PublicationHistoryEntry[];
  onRefresh: () => Promise<void>;
}) {
  if (entries.length === 0)
    return (
      <section className={`${styles.card} ${styles.empty}`}>
        <p className={styles.eyebrow}>Publication history</p>
        <h2>No saved posts yet</h2>
        <p className={styles.leadCompact}>
          Generated posts will appear here after you review or edit them.
        </p>
      </section>
    );
  return (
    <section className={`${styles.card} ${styles.historyLibrary}`}>
      <div className={styles.historyHeader}>
        <div>
          <p className={styles.eyebrow}>Latest 20</p>
          <h2>Publication history</h2>
          <p className={styles.subtle}>Open only the post you want to edit or copy.</p>
        </div>
        <button
          className={controlClass({ variant: 'danger', size: 'compact' })}
          type="button"
          onClick={async () => {
            await sendRuntimeMessage({ type: 'publication-history:clear' });
            await onRefresh();
          }}
        >
          Clear all
        </button>
      </div>
      <div className={styles.historyList}>
        {entries.map((entry, index) => (
          <PublicationHistoryItem
            entry={entry}
            initiallyOpen={index === 0}
            onRefresh={onRefresh}
            key={entry.id}
          />
        ))}
      </div>
    </section>
  );
}

function PublicationHistoryItem({
  entry,
  initiallyOpen,
  onRefresh,
}: {
  entry: PublicationHistoryEntry;
  initiallyOpen: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [text, setText] = useState(entry.draft.text);
  return (
    <details className={styles.publicationHistoryItem} open={initiallyOpen || undefined}>
      <summary>
        <span>
          <b>{entry.reference.title}</b>
          <small>
            {SOURCE_LABELS[entry.reference.source]} ·{' '}
            {new Date(entry.createdAt).toLocaleDateString()}
          </small>
        </span>
        <span className={styles.disclosureIcon} aria-hidden="true" />
      </summary>
      <div className={styles.historyItemBody}>
        <textarea
          className={styles.textarea}
          value={text}
          aria-label={`Saved publication draft for ${entry.reference.title}`}
          onChange={(event) => setText(event.target.value)}
          onBlur={() =>
            void sendRuntimeMessage({
              type: 'publication-history:update-draft',
              entryId: entry.id,
              text,
            })
          }
        />
        <div className={styles.historyActions}>
          <CopyButton text={text} />
          <a
            className={controlClass({ variant: 'secondary', link: true })}
            href={entry.reference.url}
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
          <button
            className={controlClass({ variant: 'danger' })}
            type="button"
            onClick={async () => {
              await sendRuntimeMessage({ type: 'publication-history:delete', entryId: entry.id });
              await onRefresh();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </details>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={controlClass({ variant: 'secondary', copied })}
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied ✓' : 'Copy post'}
    </button>
  );
}

function ratingLabel(rating: PostOpportunity['assessment']['rating']): string {
  return rating === 'strong' ? 'Strong opportunity' : rating === 'consider' ? 'Consider' : 'Skip';
}

function ratingClass(rating: PostOpportunity['assessment']['rating']): string {
  return rating === 'strong' ? styles.ratingStrong : rating === 'skip' ? styles.ratingSkip : '';
}

function typeLabel(type: PostOpportunity['assessment']['type']): string {
  return type === 'timely-trend'
    ? 'Timely trend'
    : type === 'practical-learning'
      ? 'Practical learning'
      : 'General fit';
}

function stageLabel(stage: string): string {
  if (stage === 'collecting') return 'Collecting approved API and RSS items…';
  if (stage === 'deduplicating') return 'Removing repeats and seen items…';
  if (stage === 'assessing') return 'Assessing relevance and credibility with Groq…';
  return 'Drafting up to three evidence-supported posts…';
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function meterStyle(value: number, total: number): React.CSSProperties {
  const percentage = total === 0 ? 0 : Math.round((value / total) * 100);
  return { '--meter': `${percentage}%` } as React.CSSProperties;
}
