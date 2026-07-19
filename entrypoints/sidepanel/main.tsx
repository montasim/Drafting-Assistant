import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Tabs } from 'radix-ui';
import type {
  AnalysisResult,
  AnalysisState,
  EngagementProfile,
  HistoryEntry,
} from '../../src/domain/schemas';
import { sendRuntimeMessage } from '../../src/shared/protocol';
import { DiscoveryPanel } from '../../src/ui/DiscoveryPanel';
import { DiscoverySettingsPanel } from '../../src/ui/DiscoverySettingsPanel';
import { controlClass } from '../../src/ui/control-styles';
import '../../src/ui/tailwind.css';
import styles from '../../src/ui/styles';

const DEVELOPER = {
  name: 'Mohammad Montasim Al Mamun Shuvo',
  github: 'https://github.com/montasim',
  linkedIn: 'https://www.linkedin.com/in/montasim/',
  support: 'https://www.supportkori.com/montasim',
} as const;

function SidePanel() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<EngagementProfile | null>(null);
  const [tab, setTab] = useState('draft');
  const [draftView, setDraftView] = useState<'current' | 'saved'>('current');

  const refresh = useCallback(async () => {
    const [stateResponse, historyResponse, setupResponse] = await Promise.all([
      sendRuntimeMessage({ type: 'analysis:get-state' }),
      sendRuntimeMessage({ type: 'history:list' }),
      sendRuntimeMessage({ type: 'setup:get' }),
    ]);
    if (stateResponse.ok && 'state' in stateResponse) setState(stateResponse.state);
    if (historyResponse.ok && 'history' in historyResponse) setHistory(historyResponse.history);
    if (setupResponse.ok && 'setup' in setupResponse) {
      setConfigured(
        setupResponse.setup.settings.onboardingComplete &&
          setupResponse.setup.hasCredential &&
          setupResponse.setup.hasLinkedInPermission,
      );
      setProfile(setupResponse.setup.profile);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);

  return (
    <main className={styles.shell}>
      <header className={`${styles.header} ${styles.sidePanelHeader}`}>
        <div className={styles.brandLockup}>
          <div className={styles.markFrame}>
            <img className={styles.mark} src="/icon/logo-512.png" alt="" />
          </div>
          <div>
            <h1 className={styles.title}>Drafting Assistant</h1>
            <p className={styles.headerPromise}>
              Private writing workspace <span aria-hidden="true">·</span> Local
            </p>
          </div>
        </div>
        <SupportKoriLink />
      </header>
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className={styles.tabs}>
          <Tabs.Trigger className={styles.tab} value="draft">
            Draft
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="discover">
            Discover
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="settings">
            Settings
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content className={styles.tabContent} value="draft">
          <div className={styles.segmentedTabs} aria-label="Draft workspace">
            <button
              type="button"
              data-active={draftView === 'current'}
              onClick={() => setDraftView('current')}
            >
              Current
            </button>
            <button
              type="button"
              data-active={draftView === 'saved'}
              onClick={() => setDraftView('saved')}
            >
              Saved <span>{history.length}</span>
            </button>
          </div>
          {draftView === 'current' ? (
            <Current state={state} configured={configured} onOpenSetup={() => openSetup()} />
          ) : (
            <History entries={history} onChange={setHistory} />
          )}
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="discover">
          <DiscoveryPanel onOpenSettings={() => setTab('settings')} />
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="settings">
          <Settings profile={profile} onOpenSetup={() => openSetup()} />
        </Tabs.Content>
      </Tabs.Root>
    </main>
  );
}

function Current({
  state,
  configured,
  onOpenSetup,
}: {
  state: AnalysisState;
  configured: boolean | null;
  onOpenSetup: () => void;
}) {
  if (configured === null)
    return (
      <section
        className={`${styles.card} ${styles.loadingCard} ${styles.activeSurface}`}
        aria-live="polite"
      >
        <div className={styles.spinner} aria-hidden="true" />
        <div>
          <h2>Loading your workspace</h2>
          <p className={styles.subtle}>Checking setup and recent drafts…</p>
        </div>
      </section>
    );
  if (!configured)
    return (
      <section className={`${styles.card} ${styles.activeSurface}`}>
        <p className={styles.eyebrow}>Setup required</p>
        <h2>Finish setup to create drafts</h2>
        <p className={styles.lead}>
          Connect Gemini, allow selected LinkedIn access, and set your writing context.
        </p>
        <div className={styles.cardActions}>
          <button className={controlClass({ block: true })} onClick={onOpenSetup}>
            Complete setup
          </button>
        </div>
        <p className={styles.reassurance}>About 2 minutes. The extension never posts for you.</p>
      </section>
    );
  if (state.status === 'running')
    return (
      <section
        className={`${styles.card} ${styles.loadingCard} ${styles.activeSurface}`}
        aria-live="polite"
      >
        <div className={styles.spinner} aria-hidden="true" />
        <div>
          <p className={styles.eyebrow}>Analyzing selected context</p>
          <h2>Creating four draft directions</h2>
          <p className={styles.runningExcerpt}>“{state.excerpt}”</p>
        </div>
      </section>
    );
  if (state.status === 'error')
    return (
      <section className={`${styles.card} ${styles.activeSurface}`}>
        <div className={styles.stateIconError} aria-hidden="true">
          !
        </div>
        <p className={styles.eyebrow}>Draft not created</p>
        <h2>Check the connection and try again</h2>
        <div className={styles.error}>
          <strong>What happened</strong>
          <p>{state.message}</p>
        </div>
        <p className={styles.reassuranceLeft}>No LinkedIn action was taken.</p>
        <div className={styles.cardActions}>
          <button className={controlClass({ variant: 'secondary' })} onClick={onOpenSetup}>
            Review connection
          </button>
        </div>
      </section>
    );
  if (state.status === 'success') return <Result key={state.requestId} state={state} />;
  return (
    <section className={`${styles.card} ${styles.empty} ${styles.activeSurface}`}>
      <div className={styles.stateIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 4h14v12H8l-3 3V4Z" />
          <path d="M8 8h8M8 12h5" />
        </svg>
      </div>
      <p className={styles.eyebrow}>Ready</p>
      <h2>Select a LinkedIn conversation</h2>
      <p className={styles.leadCompact}>
        Right-click a visible post or comment, then choose <strong>Analyze this post</strong>.
      </p>
      <div className={styles.trustRow}>
        <span>Visible text only</span>
        <span>You approve every word</span>
      </div>
    </section>
  );
}

function Result({ state }: { state: Extract<AnalysisState, { status: 'success' }> }) {
  const [drafts, setDrafts] = useState(() => state.result.drafts.map(({ text }) => text));
  const [selectedDraft, setSelectedDraft] = useState(0);
  const draft = state.result.drafts[selectedDraft];
  const draftText = drafts[selectedDraft] ?? '';
  return (
    <>
      <section className={`${styles.card} ${styles.analysisCard} ${styles.activeSurface}`}>
        <div className={styles.between}>
          <div>
            <p className={styles.eyebrow}>Conversation brief</p>
            <h2>{state.result.summary.overview}</h2>
          </div>
          <span className={styles.badge}>{state.context.responseTarget.type}</span>
        </div>
        <strong className={styles.label}>Key themes</strong>
        <ul className={styles.list}>
          {state.result.summary.themes.map((theme) => (
            <li key={theme}>{theme}</li>
          ))}
        </ul>
        {state.result.summary.uncertainties.length > 0 && (
          <div className={styles.insightBlock}>
            <strong className={styles.label}>Keep in mind</strong>
            <ul className={styles.list}>
              {state.result.summary.uncertainties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {state.result.summary.risks.length > 0 && (
          <div className={styles.warning}>
            <strong>Before you respond</strong>
            {state.result.summary.risks.map((risk) => (
              <p key={`${risk.category}-${risk.description}`}>
                <b>{risk.severity}:</b> {risk.description}
              </p>
            ))}
          </div>
        )}
        <p className={styles.modelMeta}>
          {state.result.language} · {state.result.model}
        </p>
      </section>
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.eyebrow}>Draft directions</p>
          <h2>Choose one, then make it yours</h2>
        </div>
        <span className={styles.meta}>{wordCount(draftText)} words</span>
      </div>
      <div className={styles.draftStrategyTabs} aria-label="Draft directions">
        {state.result.drafts.map((item, index) => (
          <button
            type="button"
            key={item.strategy}
            data-active={index === selectedDraft}
            onClick={() => setSelectedDraft(index)}
          >
            {strategyTabLabel(item.strategy)}
          </button>
        ))}
      </div>
      {draft && (
        <section className={`${styles.card} ${styles.draftCard} ${styles.activeSurface}`}>
          <p className={styles.strategyPromise}>{strategyPromise(draft.strategy)}</p>
          <textarea
            className={styles.textarea}
            aria-label={`${labelStrategy(draft.strategy)} draft`}
            value={draftText}
            onChange={(event) => {
              const next = [...drafts];
              next[selectedDraft] = event.target.value;
              setDrafts(next);
            }}
            onBlur={(event) =>
              void sendRuntimeMessage({
                type: 'history:update-draft',
                entryId: state.requestId,
                draftIndex: selectedDraft,
                text: event.target.value,
              })
            }
          />
          <div className={styles.draftActions}>
            <span className={styles.supportingNote}>Edits save on this device.</span>
            <CopyButton text={draftText} label="Copy draft" />
          </div>
        </section>
      )}
    </>
  );
}

function History({
  entries,
  onChange,
}: {
  entries: HistoryEntry[];
  onChange: (entries: HistoryEntry[]) => void;
}) {
  async function clear() {
    await sendRuntimeMessage({ type: 'history:clear' });
    onChange([]);
  }
  if (entries.length === 0)
    return (
      <section className={`${styles.card} ${styles.empty}`}>
        <div className={styles.stateIcon} aria-hidden="true">
          ↺
        </div>
        <p className={styles.eyebrow}>A private record of useful work</p>
        <h2>Your draft library starts here</h2>
        <p className={styles.leadCompact}>
          Your latest 20 outputs appear here—without storing the full post or discussion.
        </p>
      </section>
    );
  return (
    <>
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.eyebrow}>Your private draft library</p>
          <h2>
            {entries.length} saved {entries.length === 1 ? 'conversation' : 'conversations'}
          </h2>
        </div>
        <button
          className={controlClass({ variant: 'danger', size: 'compact' })}
          onClick={() => void clear()}
        >
          Clear all
        </button>
      </div>
      {entries.map((entry) => (
        <section className={`${styles.card} ${styles.historyCard}`} key={entry.id}>
          <div className={styles.between}>
            <span className={styles.badge}>{entry.responseTargetType}</span>
            <span className={styles.meta}>{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
          <p className={styles.historyExcerpt}>“{entry.postExcerpt}”</p>
          <p className={styles.historySummary}>{entry.summary.overview}</p>
          {entry.drafts.map((draft, index) => (
            <HistoryDraft entry={entry} draft={draft} index={index} key={draft.strategy} />
          ))}
          <button
            className={controlClass({ variant: 'danger' })}
            onClick={async () => {
              await sendRuntimeMessage({ type: 'history:delete', entryId: entry.id });
              onChange(entries.filter(({ id }) => id !== entry.id));
            }}
          >
            Remove from library
          </button>
        </section>
      ))}
    </>
  );
}

function HistoryDraft({
  entry,
  draft,
  index,
}: {
  entry: HistoryEntry;
  draft: AnalysisResult['drafts'][number];
  index: number;
}) {
  const [text, setText] = useState(draft.text);
  async function save() {
    await sendRuntimeMessage({
      type: 'history:update-draft',
      entryId: entry.id,
      draftIndex: index,
      text,
    });
  }
  return (
    <details className={styles.publicationHistoryItem}>
      <summary>
        <span>
          <b>{labelStrategy(draft.strategy)}</b>
          <small>{wordCount(text)} words</small>
        </span>
        <span className={styles.disclosureIcon} aria-hidden="true" />
      </summary>
      <div className={styles.historyItemBody}>
        <textarea
          className={styles.textarea}
          aria-label={`${labelStrategy(draft.strategy)} saved draft`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => void save()}
        />
        <CopyButton text={text} label="Copy draft" />
      </div>
    </details>
  );
}

function Settings({
  profile,
  onOpenSetup,
}: {
  profile: EngagementProfile | null;
  onOpenSetup: () => void;
}) {
  const [message, setMessage] = useState('');
  async function exportDiagnostics() {
    const response = await sendRuntimeMessage({ type: 'diagnostics:export' });
    if (response.ok && 'diagnosticJson' in response) {
      await copyText(response.diagnosticJson);
      setMessage('Sanitized diagnostics copied.');
    }
  }
  return (
    <>
      <section className={`${styles.card} ${styles.activeSurface}`}>
        <p className={styles.eyebrow}>Core settings</p>
        <h2>Draft settings</h2>
        <p className={styles.leadCompact}>
          Manage LinkedIn access, your Gemini connection, writing profile, and draft defaults.
        </p>
        <div className={styles.cardActions}>
          <button className={controlClass()} onClick={onOpenSetup}>
            Edit draft settings
          </button>
        </div>
      </section>
      <DiscoverySettingsPanel profile={profile} />
      <details className={`${styles.card} ${styles.settingsDisclosure}`}>
        <summary>
          <div>
            <h3>Privacy boundaries</h3>
            <small>Selected context, local drafts, manual publishing</small>
          </div>
          <span className={styles.disclosureIcon} aria-hidden="true" />
        </summary>
        <div className={styles.settingsDisclosureBody}>
          <div className={styles.privacyList}>
            <span>
              <b>Selected context only</b>
              <small>Only visible text around your right-click</small>
            </span>
            <span>
              <b>Local by default</b>
              <small>Preferences and recent drafts stay on your device</small>
            </span>
            <span>
              <b>Manual by design</b>
              <small>You review, copy, and publish every response</small>
            </span>
          </div>
        </div>
      </details>
      <details className={`${styles.card} ${styles.settingsDisclosure}`}>
        <summary>
          <div>
            <h3>Local diagnostics</h3>
            <small>Copy a privacy-safe troubleshooting snapshot</small>
          </div>
          <span className={styles.disclosureIcon} aria-hidden="true" />
        </summary>
        <div className={styles.settingsDisclosureBody}>
          <p className={styles.subtle}>
            Excludes keys, post content, drafts, your profile, and browsing history.
          </p>
          <div className={styles.cardActions}>
            <button
              className={controlClass({ variant: 'secondary' })}
              onClick={() => void exportDiagnostics()}
            >
              Copy diagnostics
            </button>
          </div>
          {message && (
            <p className={styles.success} role="status">
              {message}
            </p>
          )}
        </div>
      </details>
      <details className={`${styles.card} ${styles.settingsDisclosure}`}>
        <summary>
          <div>
            <h2>Developer</h2>
            <small>Project links</small>
          </div>
          <span className={styles.disclosureIcon} aria-hidden="true" />
        </summary>
        <div className={styles.settingsDisclosureBody}>
          <p className={styles.developerName}>{DEVELOPER.name}</p>
          <div className={styles.externalLinks}>
            <a
              className={controlClass({ variant: 'secondary', link: true })}
              href={DEVELOPER.github}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className={controlClass({ variant: 'secondary', link: true })}
              href={DEVELOPER.linkedIn}
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </details>
    </>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function handleCopy() {
    try {
      await copyText(text);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1_800);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 1_800);
    }
  }

  return (
    <button
      className={controlClass({
        variant: 'secondary',
        copied: copyState === 'copied',
      })}
      onClick={() => void handleCopy()}
      type="button"
    >
      <span aria-live="polite">
        {copyState === 'copied' ? 'Copied ✓' : copyState === 'error' ? 'Try again' : label}
      </span>
    </button>
  );
}

function SupportKoriLink() {
  return (
    <a
      className={styles.headerSupportLink}
      href={DEVELOPER.support}
      target="_blank"
      rel="noreferrer"
      aria-label="Support montasim"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
      <span>Support</span>
    </a>
  );
}

function openSetup() {
  void chrome.tabs.create({ url: chrome.runtime.getURL('/onboarding.html') });
}
async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
function labelStrategy(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
function strategyPromise(value: string) {
  if (value === 'professional-insight') return 'Add a credible perspective';
  if (value === 'specific-question') return 'Invite a meaningful reply';
  if (value === 'constructive-challenge') return 'Test the central assumption professionally';
  return 'Build on the idea with care';
}
function strategyTabLabel(value: string) {
  if (value === 'professional-insight') return 'Add insight';
  if (value === 'specific-question') return 'Ask a question';
  if (value === 'constructive-challenge') return 'Challenge it';
  return 'Build on it';
}

const root = document.getElementById('root');
if (!root) throw new Error('Side panel root was not found.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
