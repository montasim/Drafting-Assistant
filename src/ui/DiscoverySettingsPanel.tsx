import React, { useEffect, useState } from 'react';
import type { EngagementProfile } from '../domain/schemas';
import {
  DISCOVERY_SOURCE_IDS,
  defaultDiscoverySettings,
  deriveDiscoveryTopics,
  type DiscoverySettings,
  type DiscoverySourceId,
  type VoiceSettings,
} from '../domain/discovery';
import {
  getDiscoveryPermissions,
  removeSourcePermission,
  requestDiscoveryPermissions,
} from '../infrastructure/discovery-permission';
import { sendRuntimeMessage, type DiscoverySnapshot } from '../shared/protocol';
import { controlClass } from './control-styles';
import styles from './styles';
import { ApiKeyGuide } from './CredentialSetup';

const SOURCE_LABELS: Record<DiscoverySourceId, string> = {
  'hacker-news': 'Hacker News',
  dev: 'DEV',
  medium: 'Medium',
  lobsters: 'Lobsters',
  'stack-overflow': 'Stack Overflow',
};

export function DiscoverySettingsPanel({
  profile,
  onboarding = false,
  onEnabledChange,
}: {
  profile: EngagementProfile | null;
  onboarding?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot | null>(null);
  const [settings, setSettings] = useState<DiscoverySettings>(defaultDiscoverySettings);
  const [voice, setVoice] = useState<VoiceSettings>({
    schemaVersion: 1,
    enabled: true,
    samples: [],
    guide: '',
  });
  const [samples, setSamples] = useState<string[]>(['']);
  const [topicsText, setTopicsText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [wantsDiscovery, setWantsDiscovery] = useState(!onboarding);

  async function refresh() {
    const response = await sendRuntimeMessage({ type: 'discovery:get' });
    if (!response.ok || !('discovery' in response)) {
      if (!response.ok) setMessage(response.message);
      return;
    }
    const next = response.discovery;
    const nextSettings =
      next.settings.topicsInitialized || next.settings.topics.length > 0
        ? next.settings
        : {
            ...next.settings,
            topics: deriveDiscoveryTopics(profile),
            topicsInitialized: true,
            publicationLanguage:
              (next.settings.publicationLanguage?.trim()
                ? next.settings.publicationLanguage
                : profile?.preferredLanguage) ?? undefined,
          };
    setSnapshot(next);
    setSettings(nextSettings);
    setTopicsText(nextSettings.topics.join('\n'));
    setVoice(next.voice);
    setSamples(next.voice.samples.length > 0 ? next.voice.samples : ['']);
    setWantsDiscovery(!onboarding || next.settings.enabled);
    onEnabledChange?.(next.settings.enabled);
  }

  useEffect(() => {
    void refresh();
    // This panel owns editable local state, so storage changes are refreshed after its own actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function validateAndSaveKey(): Promise<boolean> {
    const normalized = apiKey.trim();
    if (!normalized) return snapshot?.hasCredential ?? false;
    setMessage('Validating the Groq key…');
    const validation = await sendRuntimeMessage({
      type: 'discovery:credential-validate',
      apiKey: normalized,
    });
    if (!validation.ok || !('valid' in validation) || !validation.valid) {
      setMessage(validation.ok ? 'Groq rejected this API key.' : validation.message);
      return false;
    }
    const saved = await sendRuntimeMessage({
      type: 'discovery:credential-save',
      apiKey: normalized,
      rememberOnDevice: settings.rememberCredential,
    });
    if (!saved.ok) {
      setMessage(saved.message);
      return false;
    }
    setApiKey('');
    setSnapshot((current) =>
      current
        ? {
            ...current,
            hasCredential: true,
            credentialState: settings.rememberCredential ? 'unlocked' : 'session',
          }
        : current,
    );
    return true;
  }

  async function grantPermissions() {
    setBusy(true);
    setMessage('');
    try {
      const selected = DISCOVERY_SOURCE_IDS.filter((source) => settings.sources[source].enabled);
      const granted = await requestDiscoveryPermissions(selected);
      setMessage(
        granted
          ? 'Discovery network access granted. No source receives a content script.'
          : 'Chrome did not grant every selected discovery permission.',
      );
      const permissions = await getDiscoveryPermissions();
      setSnapshot((current) => (current ? { ...current, permissions } : current));
    } catch {
      setMessage('Chrome could not request discovery access. Click the button and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    setBusy(true);
    setMessage('');
    const currentSnapshot = snapshot;
    if (!currentSnapshot) {
      setMessage('Discovery settings are still loading.');
      setBusy(false);
      return;
    }
    const selected = DISCOVERY_SOURCE_IDS.filter((source) => settings.sources[source].enabled);
    if (
      !currentSnapshot.permissions.groq ||
      selected.every((source) => !currentSnapshot.permissions[source])
    ) {
      setMessage(
        'Grant Groq and at least one enabled source permission before enabling discovery.',
      );
      setBusy(false);
      return;
    }
    const hasKey = await validateAndSaveKey();
    if (!hasKey) {
      setMessage('Validate and save a Groq API key before enabling discovery.');
      setBusy(false);
      return;
    }
    const permissionResponse = await sendRuntimeMessage({ type: 'discovery:get' });
    if (!permissionResponse.ok || !('discovery' in permissionResponse)) {
      setMessage(
        permissionResponse.ok
          ? 'Could not verify discovery permissions.'
          : permissionResponse.message,
      );
      setBusy(false);
      return;
    }
    const permissions = permissionResponse.discovery.permissions;
    if (!permissions.groq || selected.every((source) => !permissions[source])) {
      setMessage(
        'Grant Groq and at least one enabled source permission before enabling discovery.',
      );
      setBusy(false);
      return;
    }
    if (!settings.consent) {
      setMessage('Accept the discovery data consent before enabling discovery.');
      setBusy(false);
      return;
    }
    const next = {
      ...settings,
      enabled: true,
      topicsInitialized: true,
      topics: topicsText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10),
    };
    const response = await sendRuntimeMessage({ type: 'discovery:settings-save', settings: next });
    if (response.ok) {
      setSettings(next);
      setMessage('Discovery settings saved. Runs remain manual.');
      onEnabledChange?.(true);
      await refresh();
    } else setMessage(response.message);
    setBusy(false);
  }

  async function disableDiscovery() {
    setBusy(true);
    const response = await sendRuntimeMessage({ type: 'discovery:disable' });
    setMessage(
      response.ok
        ? 'Discovery disabled. Its network permissions and Groq key were removed.'
        : response.message,
    );
    if (response.ok) {
      onEnabledChange?.(false);
      await refresh();
    }
    setBusy(false);
  }

  async function analyzeVoice() {
    const nonempty = samples.map((sample) => sample.trim()).filter(Boolean);
    if (nonempty.length === 0) {
      setMessage('Add at least one post written by you.');
      return;
    }
    setBusy(true);
    setMessage('Analyzing all voice samples together…');
    const response = await sendRuntimeMessage({ type: 'voice:analyze', samples: nonempty });
    if (response.ok && 'guide' in response) {
      setVoice({
        ...voice,
        samples: nonempty,
        guide: response.guide,
        enabled: true,
        updatedAt: new Date().toISOString(),
      });
      setSamples(nonempty);
      setMessage('Voice Guide created and saved locally. Review it below.');
    } else if (!response.ok) setMessage(response.message);
    setBusy(false);
  }

  async function saveVoice() {
    const normalized = samples
      .map((sample) => sample.trim())
      .filter(Boolean)
      .slice(0, 5);
    const next = { ...voice, samples: normalized, guide: voice.guide.trim() };
    const response = await sendRuntimeMessage({ type: 'voice:save', voice: next });
    setMessage(response.ok ? 'Voice settings saved locally.' : response.message);
    if (response.ok) setVoice(next);
  }

  if (!snapshot)
    return (
      <section className={`${styles.card} ${styles.loadingCard}`}>
        <div className={styles.spinner} aria-hidden="true" />
        <p>Loading discovery settings…</p>
      </section>
    );

  if (onboarding && !wantsDiscovery && !settings.enabled)
    return (
      <section className={`${styles.card} ${styles.wizardCard}`}>
        <p className={styles.eyebrow}>Optional idea discovery</p>
        <h2>Would you like help finding post ideas?</h2>
        <p className={styles.leadCompact}>
          Discovery reads developer APIs and RSS only after you click Run discovery. It never reads
          or changes the LinkedIn page.
        </p>
        <div className={styles.cardActions}>
          <button className={controlClass()} type="button" onClick={() => setWantsDiscovery(true)}>
            Yes, configure discovery
          </button>
        </div>
        <p className={styles.reassuranceLeft}>
          You can skip it now and enable it later only from the extension Settings tab.
        </p>
      </section>
    );

  return (
    <div className={styles.discoverySettings}>
      <section className={styles.card}>
        <div className={styles.between}>
          <div>
            <p className={styles.eyebrow}>Manual developer discovery</p>
            <h2>Discovery connection</h2>
          </div>
          <span className={settings.enabled ? styles.scopeGranted : styles.scopePending}>
            {settings.enabled ? 'Enabled' : 'Not enabled'}
          </span>
        </div>
        <p className={styles.subtle}>
          Groq GPT-OSS 120B assesses opportunities and writes posts. No paid model is selected by
          the extension.
        </p>
        <div className={styles.field}>
          <label htmlFor="groq-key">Groq API key</label>
          <input
            id="groq-key"
            className={styles.input}
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              snapshot.hasCredential
                ? 'Paste a replacement key'
                : snapshot.credentialState === 'locked'
                  ? 'Paste a replacement key to restore the connection'
                  : 'Paste a Groq key'
            }
          />
          <small className={styles.fieldHint}>
            Session-only by default. Never paste credentials into a webpage or voice sample.
          </small>
          <ApiKeyGuide provider="groq" />
          <div className={styles.credentialActions}>
            {(snapshot.hasCredential || snapshot.credentialState === 'locked') && (
              <button
                className={`${styles.textButton} ${styles.textDanger}`}
                type="button"
                onClick={async () => {
                  const response = await sendRuntimeMessage({
                    type: 'discovery:credential-clear',
                  });
                  setMessage(response.ok ? 'Groq key cleared.' : response.message);
                  if (response.ok)
                    setSnapshot((current) =>
                      current
                        ? { ...current, hasCredential: false, credentialState: 'missing' }
                        : current,
                    );
                }}
              >
                Clear saved key
              </button>
            )}
          </div>
          <small className={styles.fieldHint}>
            Keep the Groq project on its Free plan. The extension cannot inspect or control your
            provider billing settings.
          </small>
        </div>
        {snapshot.credentialState === 'locked' && !apiKey.trim() && (
          <div className={styles.warning}>
            The encrypted Groq key is unavailable. Paste a replacement key to restore the
            connection.
          </div>
        )}
        <label className={`${styles.check} ${styles.checkCard}`}>
          <input
            type="checkbox"
            checked={settings.rememberCredential}
            onChange={(event) =>
              setSettings({ ...settings, rememberCredential: event.target.checked })
            }
          />
          Keep an encrypted copy on this device. Encryption and future unlocking happen
          automatically inside the extension.
        </label>
        <label className={`${styles.check} ${styles.checkCard}`}>
          <input
            type="checkbox"
            checked={settings.consent}
            onChange={(event) => setSettings({ ...settings, consent: event.target.checked })}
          />
          I consent to sending minimized source evidence, my Engagement Profile, Discovery Topics,
          and Voice Guide to Groq when I manually run discovery. Raw voice samples are sent only
          when I click Analyze and save voice.
        </label>
      </section>

      <details
        className={`${styles.card} ${styles.settingsDisclosure}`}
        open={onboarding || undefined}
      >
        <summary>
          <div>
            <p className={styles.eyebrow}>Approved machine-readable sources</p>
            <h3>Sources and result targets</h3>
            <small>Choose sources and set 1–5 results for each.</small>
          </div>
          <span className={styles.disclosureIcon} aria-hidden="true" />
        </summary>
        <div className={styles.settingsDisclosureBody}>
          <div className={styles.sourceList}>
            {DISCOVERY_SOURCE_IDS.map((source) => (
              <div className={styles.sourceRow} key={source}>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.sources[source].enabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setSettings({
                        ...settings,
                        sources: {
                          ...settings.sources,
                          [source]: { ...settings.sources[source], enabled },
                        },
                      });
                      if (!enabled)
                        void removeSourcePermission(source).then(() =>
                          setSnapshot((current) =>
                            current
                              ? {
                                  ...current,
                                  permissions: { ...current.permissions, [source]: false },
                                }
                              : current,
                          ),
                        );
                    }}
                  />
                  <span>
                    <b>{SOURCE_LABELS[source]}</b>
                    <small>
                      {snapshot.permissions[source]
                        ? 'Chrome access granted'
                        : 'Access not granted'}
                    </small>
                  </span>
                </label>
                <select
                  className={styles.smallSelect}
                  aria-label={`${SOURCE_LABELS[source]} result target`}
                  disabled={!settings.sources[source].enabled}
                  value={settings.sources[source].limit}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      sources: {
                        ...settings.sources,
                        [source]: {
                          ...settings.sources[source],
                          limit: Number(event.target.value),
                        },
                      },
                    })
                  }
                >
                  {[1, 2, 3, 4, 5].map((limit) => (
                    <option value={limit} key={limit}>
                      {limit}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            className={controlClass({ variant: 'secondary' })}
            type="button"
            onClick={() => void grantPermissions()}
            disabled={busy}
          >
            Grant access for enabled sources
          </button>
          <p className={`${styles.fieldHint} ${styles.actionNote}`}>
            Chrome asks only for these API/RSS origins. No discovery source receives a content
            script.
          </p>
        </div>
      </details>

      <details className={`${styles.card} ${styles.settingsDisclosure}`}>
        <summary>
          <div>
            <p className={styles.eyebrow}>Profile-aware focus</p>
            <h3>Discovery Topics</h3>
            <small>{topicsText.split('\n').filter(Boolean).length} topics configured</small>
          </div>
          <span className={styles.disclosureIcon} aria-hidden="true" />
        </summary>
        <div className={styles.settingsDisclosureBody}>
          <div className={styles.field}>
            <label htmlFor="discovery-topics">Up to 10 topics, one per line</label>
            <textarea
              id="discovery-topics"
              className={styles.textarea}
              value={topicsText}
              onChange={(event) => setTopicsText(event.target.value)}
            />
          </div>
          <div className={styles.cardActions}>
            <button
              className={controlClass({ variant: 'secondary' })}
              type="button"
              onClick={() => {
                const topics = deriveDiscoveryTopics(profile);
                setSettings({ ...settings, topics, topicsInitialized: true });
                setTopicsText(topics.join('\n'));
              }}
            >
              Regenerate from profile
            </button>
          </div>
        </div>
      </details>

      <details className={`${styles.card} ${styles.settingsDisclosure}`}>
        <summary>
          <div>
            <p className={styles.eyebrow}>Standalone post defaults</p>
            <h3>Publication preferences</h3>
            <small>
              {settings.publicationLength} · {settings.publicationLanguage ?? 'Profile language'}
            </small>
          </div>
          <span className={styles.disclosureIcon} aria-hidden="true" />
        </summary>
        <div className={styles.settingsDisclosureBody}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="publication-length">Length</label>
              <select
                id="publication-length"
                className={styles.select}
                value={settings.publicationLength}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    publicationLength: event.target.value as DiscoverySettings['publicationLength'],
                  })
                }
              >
                <option value="short">Short · 80–150 words</option>
                <option value="standard">Standard · 150–250 words</option>
                <option value="detailed">Detailed · 250–400 words</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="publication-language">Language</label>
              <input
                id="publication-language"
                className={styles.input}
                value={settings.publicationLanguage ?? ''}
                onChange={(event) =>
                  setSettings({ ...settings, publicationLanguage: event.target.value || undefined })
                }
                placeholder="English"
              />
            </div>
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.allowEmoji}
              onChange={(event) => setSettings({ ...settings, allowEmoji: event.target.checked })}
            />
            Allow occasional emoji
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.allowHashtags}
              onChange={(event) =>
                setSettings({ ...settings, allowHashtags: event.target.checked })
              }
            />
            Allow up to three hashtags
          </label>
        </div>
      </details>

      <details className={`${styles.card} ${styles.settingsDisclosure}`}>
        <summary>
          <div>
            <p className={styles.eyebrow}>Teach the assistant your voice</p>
            <h3>Train your voice</h3>
            <small>
              {voice.guide
                ? 'Voice Guide ready'
                : `${samples.filter(Boolean).length} samples added`}
            </small>
          </div>
          <span className={styles.disclosureIcon} aria-hidden="true" />
        </summary>
        <div className={styles.settingsDisclosureBody}>
          <div className={styles.voiceHeaderRow}>
            <p className={styles.subtle}>
              Add only posts written by you. This creates prompt guidance, not model training.
            </p>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={voice.enabled}
                onChange={(event) => setVoice({ ...voice, enabled: event.target.checked })}
              />
              Use guide
            </label>
          </div>
          {samples.map((sample, index) => (
            <div className={styles.voiceSample} key={index}>
              <textarea
                className={styles.textarea}
                aria-label={`Voice sample ${index + 1}`}
                value={sample}
                onChange={(event) => {
                  const next = [...samples];
                  next[index] = event.target.value;
                  setSamples(next);
                }}
                placeholder="Paste one of your own LinkedIn posts"
              />
              {samples.length > 1 && (
                <button
                  className={controlClass({ variant: 'danger', size: 'compact' })}
                  type="button"
                  onClick={() => setSamples(samples.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove sample
                </button>
              )}
            </div>
          ))}
          <div className={styles.buttonRow}>
            {samples.length < 5 && (
              <button
                className={controlClass({ variant: 'secondary' })}
                type="button"
                onClick={() => setSamples([...samples, ''])}
              >
                Add another sample
              </button>
            )}
            <button
              className={controlClass()}
              type="button"
              disabled={busy || !snapshot.hasCredential}
              onClick={() => void analyzeVoice()}
            >
              Analyze and save voice
            </button>
          </div>
          <div className={styles.field}>
            <label htmlFor="voice-guide">Editable Voice Guide</label>
            <textarea
              id="voice-guide"
              className={styles.textarea}
              value={voice.guide}
              onChange={(event) => setVoice({ ...voice, guide: event.target.value })}
              placeholder="Analyze samples or write your style guidance directly."
            />
          </div>
          <div className={styles.cardActions}>
            <button
              className={controlClass({ variant: 'secondary' })}
              type="button"
              onClick={() => void saveVoice()}
            >
              Save voice locally
            </button>
          </div>
        </div>
      </details>

      <section className={`${styles.card} ${styles.discoveryActionCard}`}>
        <div className={styles.actionCardMain}>
          <div>
            <h3>{settings.enabled ? 'Save your changes' : 'Ready to enable discovery?'}</h3>
            <p className={styles.subtle}>Discovery runs only when you press Run discovery.</p>
          </div>
          <div className={styles.buttonRow}>
            <button
              className={controlClass()}
              type="button"
              disabled={busy}
              onClick={() => void saveSettings()}
            >
              {busy
                ? 'Working…'
                : settings.enabled
                  ? 'Save discovery settings'
                  : 'Enable discovery'}
            </button>
            {settings.enabled && (
              <button
                className={controlClass({ variant: 'danger' })}
                type="button"
                disabled={busy}
                onClick={() => void disableDiscovery()}
              >
                Disable discovery
              </button>
            )}
          </div>
        </div>
        <button
          className={styles.textButton}
          type="button"
          onClick={async () => {
            const response = await sendRuntimeMessage({ type: 'discovery:clear-seen' });
            setMessage(response.ok ? 'Seen-item memory cleared.' : response.message);
          }}
        >
          Clear seen items
        </button>
        {message && (
          <div
            className={
              message.includes('saved') ||
              message.includes('granted') ||
              message.includes('created') ||
              message.includes('cleared')
                ? styles.success
                : styles.warning
            }
            role="status"
          >
            {message}
          </div>
        )}
      </section>
    </div>
  );
}
