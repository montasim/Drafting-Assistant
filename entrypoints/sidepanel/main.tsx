import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Tabs } from 'radix-ui';
import type { AnalysisResult, AnalysisState, HistoryEntry } from '../../src/domain/schemas';
import { sendRuntimeMessage } from '../../src/shared/protocol';
import '../../src/ui/base.css';
import styles from '../../src/ui/app.module.css';

const DEVELOPER = {
  name: 'Mohammad Montasim Al Mamun Shuvo',
  github: 'https://github.com/montasim',
  linkedIn: 'https://www.linkedin.com/in/montasim/',
} as const;

function SidePanel() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [tab, setTab] = useState('current');

  const refresh = useCallback(async () => {
    const [stateResponse, historyResponse, setupResponse] = await Promise.all([
      sendRuntimeMessage({ type: 'analysis:get-state' }),
      sendRuntimeMessage({ type: 'history:list' }),
      sendRuntimeMessage({ type: 'setup:get' }),
    ]);
    if (stateResponse.ok && 'state' in stateResponse) setState(stateResponse.state);
    if (historyResponse.ok && 'history' in historyResponse) setHistory(historyResponse.history);
    if (setupResponse.ok && 'setup' in setupResponse)
      setConfigured(
        setupResponse.setup.settings.onboardingComplete &&
          setupResponse.setup.hasCredential &&
          setupResponse.setup.hasLinkedInPermission,
      );
  }, []);

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandLockup}>
          <div className={styles.markFrame}>
            <img className={styles.mark} src="/icon/logo-512.png" alt="" />
          </div>
          <div>
            <p className={styles.eyebrow}>Thoughtful by design</p>
            <h1 className={styles.title}>Drafting Assistant</h1>
            <p className={styles.headerPromise}>Sound like yourself—only sharper.</p>
          </div>
        </div>
        <span className={styles.privacyPill} title="Your drafts and settings stay on this device">
          <span className={styles.statusDot} />
          Local-first
        </span>
      </header>
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className={styles.tabs}>
          <Tabs.Trigger className={styles.tab} value="current">
            Current
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="history">
            History
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="settings">
            Settings
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content className={styles.tabContent} value="current">
          <Current state={state} configured={configured} onOpenSetup={() => openSetup()} />
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="history">
          <History entries={history} onChange={setHistory} />
        </Tabs.Content>
        <Tabs.Content className={styles.tabContent} value="settings">
          <Settings onOpenSetup={() => openSetup()} />
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
      <section className={`${styles.card} ${styles.loadingCard}`} aria-live="polite">
        <div className={styles.spinner} aria-hidden="true" />
        <div>
          <p className={styles.eyebrow}>Preparing your workspace</p>
          <h2>Getting everything ready</h2>
          <p className={styles.subtle}>Checking your private setup and recent work…</p>
        </div>
      </section>
    );
  if (!configured)
    return (
      <section className={`${styles.card} ${styles.heroCard}`}>
        <p className={styles.eyebrow}>A few thoughtful choices</p>
        <h2>Make every reply feel considered</h2>
        <p className={styles.lead}>
          Set your voice, connect Gemini, and choose exactly what the extension can access.
        </p>
        <div className={styles.setupPreview} aria-label="Setup includes three private choices">
          <span>
            <b>1</b> Choose your privacy boundary
          </span>
          <span>
            <b>2</b> Connect your free Gemini key
          </span>
          <span>
            <b>3</b> Shape your writing voice
          </span>
        </div>
        <button className={`${styles.button} ${styles.buttonWide}`} onClick={onOpenSetup}>
          Complete private setup <span aria-hidden="true">→</span>
        </button>
        <p className={styles.reassurance}>About 2 minutes · Nothing is ever posted for you</p>
      </section>
    );
  if (state.status === 'running')
    return (
      <section className={`${styles.card} ${styles.loadingCard}`} aria-live="polite">
        <div className={styles.spinner} aria-hidden="true" />
        <div>
          <p className={styles.eyebrow}>One conversation, three angles</p>
          <h2>Finding the strongest response</h2>
          <p className={styles.subtle}>Reading only the visible context around:</p>
          <p className={styles.runningExcerpt}>“{state.excerpt}”</p>
        </div>
      </section>
    );
  if (state.status === 'error')
    return (
      <section className={styles.card}>
        <div className={styles.stateIconError} aria-hidden="true">
          !
        </div>
        <p className={styles.eyebrow}>Your activity stayed untouched</p>
        <h2>Your draft wasn’t created</h2>
        <div className={styles.error}>
          <strong>What happened</strong>
          <p>{state.message}</p>
        </div>
        <p className={styles.reassuranceLeft}>
          No post, click, or LinkedIn action happened. Review your connection and try again when
          you’re ready.
        </p>
        <button className={`${styles.button} ${styles.secondary}`} onClick={onOpenSetup}>
          Review connection
        </button>
      </section>
    );
  if (state.status === 'success') return <Result key={state.requestId} state={state} />;
  return (
    <section className={`${styles.card} ${styles.empty}`}>
      <div className={styles.stateIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 4h14v12H8l-3 3V4Z" />
          <path d="M8 8h8M8 12h5" />
        </svg>
      </div>
      <p className={styles.eyebrow}>Ready when you are</p>
      <h2>Start with a conversation worth joining</h2>
      <p className={styles.leadCompact}>
        On LinkedIn, right-click one visible post or comment and choose{' '}
        <strong>Analyze this post</strong>.
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
  return (
    <>
      <section className={`${styles.card} ${styles.analysisCard}`}>
        <div className={styles.between}>
          <div>
            <p className={styles.eyebrow}>Conversation brief</p>
            <h2>What matters here</h2>
          </div>
          <span className={styles.badge}>{state.context.responseTarget.type}</span>
        </div>
        <p className={styles.analysisOverview}>{state.result.summary.overview}</p>
        <strong className={styles.label}>Signals worth responding to</strong>
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
          <p className={styles.eyebrow}>Three credible directions</p>
          <h2>Choose the one that feels like you</h2>
        </div>
        <span className={styles.meta}>Edits save locally</span>
      </div>
      {state.result.drafts.map((draft, index) => (
        <section className={`${styles.card} ${styles.draftCard}`} key={draft.strategy}>
          <div className={styles.between}>
            <div>
              <span className={styles.badge}>{labelStrategy(draft.strategy)}</span>
              <p className={styles.strategyPromise}>{strategyPromise(draft.strategy)}</p>
            </div>
            <span className={styles.meta}>{wordCount(drafts[index] ?? '')} words</span>
          </div>
          <textarea
            className={styles.textarea}
            aria-label={`${labelStrategy(draft.strategy)} draft`}
            value={drafts[index] ?? ''}
            onChange={(event) => {
              const next = [...drafts];
              next[index] = event.target.value;
              setDrafts(next);
            }}
            onBlur={(event) =>
              void sendRuntimeMessage({
                type: 'history:update-draft',
                entryId: state.requestId,
                draftIndex: index,
                text: event.target.value,
              })
            }
          />
          <div className={styles.draftActions}>
            <span className={styles.reassuranceLeft}>
              Review, refine, then copy when it’s yours.
            </span>
            <CopyButton text={drafts[index] ?? ''} label="Copy draft" />
          </div>
        </section>
      ))}
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
          className={`${styles.button} ${styles.danger} ${styles.compact}`}
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
            className={`${styles.button} ${styles.danger}`}
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
    <div className={styles.draft}>
      <div className={styles.between}>
        <span className={styles.badge}>{labelStrategy(draft.strategy)}</span>
        <span className={styles.meta}>{wordCount(text)} words</span>
      </div>
      <textarea
        className={styles.textarea}
        aria-label={`${labelStrategy(draft.strategy)} saved draft`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => void save()}
      />
      <CopyButton text={text} label="Copy" />
    </div>
  );
}

function Settings({ onOpenSetup }: { onOpenSetup: () => void }) {
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
      <section className={`${styles.card} ${styles.heroCardSoft}`}>
        <p className={styles.eyebrow}>Tune the experience</p>
        <h2>Settings & privacy</h2>
        <p className={styles.leadCompact}>
          Refine your voice, language, Gemini connection, and access choices whenever your needs
          change.
        </p>
        <button className={styles.button} onClick={onOpenSetup}>
          Open settings <span aria-hidden="true">→</span>
        </button>
      </section>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Built around restraint</p>
        <h2>Your control is the feature</h2>
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
      </section>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Useful when something feels off</p>
        <h3>Local diagnostics</h3>
        <p className={styles.subtle}>
          Copy a privacy-safe technical snapshot for troubleshooting. It never includes keys, post
          content, drafts, your profile, or browsing history.
        </p>
        <button
          className={`${styles.button} ${styles.secondary}`}
          onClick={() => void exportDiagnostics()}
        >
          Copy safe diagnostics
        </button>
        {message && (
          <p className={styles.success} role="status">
            {message}
          </p>
        )}
      </section>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Independent and transparent</p>
        <h2>Developer</h2>
        <p className={styles.developerName}>{DEVELOPER.name}</p>
        <p className={styles.subtle}>
          Built for thoughtful professionals who value their own voice.
        </p>
        <div className={styles.externalLinks}>
          <a
            className={`${styles.button} ${styles.secondary} ${styles.linkButton}`}
            href={DEVELOPER.github}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            className={`${styles.button} ${styles.secondary} ${styles.linkButton}`}
            href={DEVELOPER.linkedIn}
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn
          </a>
        </div>
      </section>
      <SupportKoriWidget />
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
      className={`${styles.button} ${styles.secondary} ${copyState === 'copied' ? styles.copied : ''}`}
      onClick={() => void handleCopy()}
      type="button"
    >
      <span aria-live="polite">
        {copyState === 'copied' ? 'Copied ✓' : copyState === 'error' ? 'Try again' : label}
      </span>
    </button>
  );
}

function SupportKoriWidget() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function closeWidget(event: MessageEvent) {
      if (event.origin === 'https://www.supportkori.com' && event.data === 'close-sk-widget') {
        setIsOpen(false);
      }
    }

    window.addEventListener('message', closeWidget);
    return () => window.removeEventListener('message', closeWidget);
  }, []);

  return (
    <div>
      <div
        id="supportkori-panel"
        className={`${styles.supportPanel} ${isOpen ? styles.supportPanelOpen : ''}`}
        aria-hidden={!isOpen}
      >
        <iframe
          className={styles.supportFrame}
          src="https://www.supportkori.com/widget/montasim"
          title="Support montasim"
          allow="payment"
        />
      </div>
      <button
        type="button"
        className={styles.supportButton}
        aria-controls="supportkori-panel"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
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
        <span>Support montasim</span>
      </button>
    </div>
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
  return 'Build on the idea with care';
}

const root = document.getElementById('root');
if (!root) throw new Error('Side panel root was not found.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
