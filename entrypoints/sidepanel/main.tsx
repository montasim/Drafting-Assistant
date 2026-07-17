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
        <img className={styles.mark} src="/icon/logo-512.png" alt="" />
        <div>
          <h1 className={styles.title}>Drafting Assistant</h1>
          <p className={styles.subtle}>Review before you copy</p>
        </div>
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
        <Tabs.Content value="current">
          <Current state={state} configured={configured} onOpenSetup={() => openSetup()} />
        </Tabs.Content>
        <Tabs.Content value="history">
          <History entries={history} onChange={setHistory} />
        </Tabs.Content>
        <Tabs.Content value="settings">
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
  if (configured === false)
    return (
      <section className={styles.card}>
        <h2>Finish setup</h2>
        <p>
          Connect Gemini, grant LinkedIn access, and review the privacy consent before analyzing a
          post.
        </p>
        <button className={styles.button} onClick={onOpenSetup}>
          Open setup
        </button>
      </section>
    );
  if (state.status === 'running')
    return (
      <section className={styles.card}>
        <div className={styles.row}>
          <div className={styles.spinner} />
          <div>
            <h2>Creating drafts</h2>
            <p className={styles.subtle}>{state.excerpt}</p>
          </div>
        </div>
      </section>
    );
  if (state.status === 'error')
    return (
      <section className={styles.card}>
        <div className={styles.error}>
          <strong>Analysis failed</strong>
          <p>{state.message}</p>
        </div>
        <p className={styles.subtle}>No LinkedIn action was taken.</p>
      </section>
    );
  if (state.status === 'success') return <Result key={state.requestId} state={state} />;
  return (
    <section className={`${styles.card} ${styles.empty}`}>
      <h2>Choose a conversation</h2>
      <p>
        On LinkedIn, right-click inside one visible post or comment and choose{' '}
        <strong>Analyze this post</strong>.
      </p>
      <p className={styles.subtle}>
        Only the selected post's visible text is processed. You always submit responses manually.
      </p>
    </section>
  );
}

function Result({ state }: { state: Extract<AnalysisState, { status: 'success' }> }) {
  const [drafts, setDrafts] = useState(() => state.result.drafts.map(({ text }) => text));
  return (
    <>
      <section className={styles.card}>
        <div className={styles.between}>
          <span className={styles.badge}>{state.context.responseTarget.type}</span>
          <span className={styles.meta}>
            {state.result.language} · {state.result.model}
          </span>
        </div>
        <h2 style={{ marginTop: 12 }}>Analysis</h2>
        <p>{state.result.summary.overview}</p>
        <strong className={styles.label}>Themes</strong>
        <ul className={styles.list}>
          {state.result.summary.themes.map((theme) => (
            <li key={theme}>{theme}</li>
          ))}
        </ul>
        {state.result.summary.uncertainties.length > 0 && (
          <>
            <strong className={styles.label}>Uncertainties</strong>
            <ul className={styles.list}>
              {state.result.summary.uncertainties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
        {state.result.summary.risks.length > 0 && (
          <div className={styles.warning} style={{ marginTop: 12 }}>
            {state.result.summary.risks.map((risk) => (
              <div key={`${risk.category}-${risk.description}`}>
                <strong>
                  {risk.severity} {risk.category}:
                </strong>{' '}
                {risk.description}
              </div>
            ))}
          </div>
        )}
      </section>
      <section className={styles.card}>
        <h2>Draft set</h2>
        {state.result.drafts.map((draft, index) => (
          <div className={styles.draft} key={draft.strategy}>
            <div className={styles.between}>
              <span className={styles.badge}>{labelStrategy(draft.strategy)}</span>
              <span className={styles.meta}>{wordCount(drafts[index] ?? '')} words</span>
            </div>
            <textarea
              className={styles.textarea}
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
            <button
              className={`${styles.button} ${styles.secondary}`}
              onClick={() => void copyText(drafts[index] ?? '')}
            >
              Copy draft
            </button>
          </div>
        ))}
      </section>
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
        <h2>No saved outputs</h2>
        <p>The latest 20 analyses appear here without complete post text or discussion.</p>
      </section>
    );
  return (
    <>
      <div className={styles.between} style={{ marginBottom: 12 }}>
        <span className={styles.meta}>{entries.length} locally stored outputs</span>
        <button className={`${styles.button} ${styles.danger}`} onClick={() => void clear()}>
          Clear all
        </button>
      </div>
      {entries.map((entry) => (
        <section className={styles.card} key={entry.id}>
          <div className={styles.between}>
            <span className={styles.badge}>{entry.responseTargetType}</span>
            <span className={styles.meta}>{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
          <p>
            <strong>{entry.postExcerpt}</strong>
          </p>
          <p>{entry.summary.overview}</p>
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
            Delete
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
      <span className={styles.badge}>{labelStrategy(draft.strategy)}</span>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => void save()}
      />
      <button
        className={`${styles.button} ${styles.secondary}`}
        onClick={() => void copyText(text)}
      >
        Copy
      </button>
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
      <section className={styles.card}>
        <h2>Settings & privacy</h2>
        <p>
          Update the Gemini key, preferred language, engagement profile, consent, or LinkedIn access
          from setup.
        </p>
        <button className={styles.button} onClick={onOpenSetup}>
          Open settings
        </button>
        <hr style={{ border: 0, borderTop: '1px solid #e5eaee', margin: '20px 0' }} />
        <h3>Local diagnostics</h3>
        <p className={styles.subtle}>
          Exports timestamps and error codes only—never keys, post content, drafts, profile, or
          browsing history.
        </p>
        <button
          className={`${styles.button} ${styles.secondary}`}
          onClick={() => void exportDiagnostics()}
        >
          Copy sanitized diagnostics
        </button>
        {message && <p className={styles.success}>{message}</p>}
      </section>
      <section className={styles.card}>
        <h2>Developer</h2>
        <p className={styles.developerName}>{DEVELOPER.name}</p>
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

const root = document.getElementById('root');
if (!root) throw new Error('Side panel root was not found.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
