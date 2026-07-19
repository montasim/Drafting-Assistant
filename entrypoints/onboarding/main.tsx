import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ProfileEditor } from '../../src/ui/ProfileEditor';
import { createDefaultProfile } from '../../src/ui/default-profile';
import {
  defaultSettings,
  type AppSettings,
  type EngagementProfile,
} from '../../src/domain/schemas';
import { sendRuntimeMessage } from '../../src/shared/protocol';
import { requestLinkedInPermission } from '../../src/infrastructure/linkedin-permission';
import '../../src/ui/tailwind.css';
import styles from '../../src/ui/styles';
import { DiscoverySettingsPanel } from '../../src/ui/DiscoverySettingsPanel';
import { controlClass } from '../../src/ui/control-styles';
import { ApiKeyGuide } from '../../src/ui/CredentialSetup';
import type { CredentialState } from '../../src/infrastructure/credential-vault';

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

const ONBOARDING_STEPS: OnboardingStep[] = [1, 2, 3, 4, 5, 6];

const SETUP_PHASES = [
  { label: 'Access', steps: [1, 2] as OnboardingStep[] },
  { label: 'Drafting', steps: [3, 4, 5] as OnboardingStep[] },
  { label: 'Ideas', steps: [6] as OnboardingStep[] },
] as const;

const STEP_LABELS: Record<OnboardingStep, string> = {
  1: 'Your boundaries',
  2: 'LinkedIn access',
  3: 'Gemini connection',
  4: 'Your writing voice',
  5: 'Draft preferences',
  6: 'Optional discovery',
};

function Onboarding() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [profile, setProfile] = useState<EngagementProfile>(createDefaultProfile());
  const [apiKey, setApiKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [permission, setPermission] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [credentialState, setCredentialState] = useState<CredentialState>('missing');
  const [ownProfilePdfConfirmed, setOwnProfilePdfConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<OnboardingStep>(1);

  useEffect(() => {
    void sendRuntimeMessage({ type: 'setup:get' }).then((response) => {
      if (response.ok && 'setup' in response) {
        setSettings(response.setup.settings);
        setPermission(response.setup.hasLinkedInPermission);
        setHasCredential(response.setup.hasCredential);
        setCredentialState(response.setup.credentialState);
        setRemember(response.setup.settings.rememberCredential);
        if (response.setup.profile) setProfile(response.setup.profile);
      }
    });
  }, []);

  async function grantPermission() {
    setBusy(true);
    setStatus('');
    try {
      const granted = await requestLinkedInPermission();
      setPermission(granted);
      setStatus(granted ? 'LinkedIn access granted.' : 'LinkedIn access was not granted.');
    } catch {
      setPermission(false);
      setStatus('Chrome could not request LinkedIn access. Click the button and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function continueSetup() {
    setStatus('');
    if (step === 1) {
      if (!settings.analysisConsent || !settings.riskAcknowledged) {
        setStatus('Complete both acknowledgements before continuing.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!permission) {
        setStatus('Grant LinkedIn access before continuing.');
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      setBusy(true);
      if (apiKey) {
        setStatus('Validating your Gemini API key…');
        if (!(await validateAndSaveKey())) {
          setBusy(false);
          return;
        }
      } else if (!hasCredential) {
        setStatus('Enter and validate your Gemini API key before continuing.');
        setBusy(false);
        return;
      }
      setBusy(false);
      setStatus('');
      setStep(4);
      return;
    }
    if (step === 4) {
      setBusy(true);
      const response = await sendRuntimeMessage({ type: 'profile:save', profile });
      setBusy(false);
      if (!response.ok) {
        setStatus(response.message);
        return;
      }
      setStatus('');
      setStep(5);
      return;
    }
    if (step === 5) {
      setStatus('');
      setStep(6);
    }
  }

  async function importPdf(file: File | undefined) {
    if (!file) return;
    if (!ownProfilePdfConfirmed) {
      setStatus('Confirm that this PDF is your own LinkedIn profile export.');
      return;
    }
    if (file.type !== 'application/pdf') {
      setStatus('Choose a PDF exported from your own LinkedIn profile.');
      return;
    }
    setBusy(true);
    if (apiKey) {
      const valid = await validateAndSaveKey();
      if (!valid) {
        setBusy(false);
        return;
      }
    } else if (!hasCredential) {
      setStatus('Enter and validate your Gemini API key before importing a PDF.');
      setBusy(false);
      return;
    }
    setStatus('Deriving an editable engagement profile…');
    const dataUrl = await readDataUrl(file);
    const response = await sendRuntimeMessage({
      type: 'profile:derive-pdf',
      dataUrl,
      confirmedOwnProfile: true,
    });
    if (response.ok && 'profile' in response) {
      setProfile(response.profile);
      setStatus('Profile derived. Review and edit it before saving.');
    } else if (!response.ok) setStatus(response.message);
    setBusy(false);
  }

  async function finish() {
    setBusy(true);
    setStatus('Validating your setup…');
    if (apiKey) {
      if (!(await validateAndSaveKey())) {
        setBusy(false);
        return;
      }
    }
    const completed: AppSettings = {
      ...settings,
      onboardingComplete: true,
      analysisConsent: true,
      riskAcknowledged: true,
      rememberCredential: remember,
    };
    const [settingsResponse, profileResponse] = await Promise.all([
      sendRuntimeMessage({ type: 'settings:save', settings: completed }),
      sendRuntimeMessage({ type: 'profile:save', profile }),
    ]);
    if (!settingsResponse.ok || !profileResponse.ok || !permission)
      setStatus(
        !permission ? 'Grant LinkedIn access before finishing.' : 'Could not save the setup.',
      );
    else {
      setSettings(completed);
      setStatus(
        'Setup complete. On LinkedIn, right-click a post or comment and choose “Analyze this post.”',
      );
    }
    setBusy(false);
  }

  async function validateAndSaveKey(): Promise<boolean> {
    const normalizedApiKey = apiKey.trim();
    const validation = await sendRuntimeMessage({
      type: 'credential:validate',
      apiKey: normalizedApiKey,
    });
    if (!validation.ok) {
      setStatus(validation.message);
      return false;
    }
    if (!('valid' in validation) || !validation.valid) {
      setStatus(
        'message' in validation
          ? (validation.message ?? 'The Gemini key was rejected.')
          : 'The Gemini key was rejected.',
      );
      return false;
    }
    const saved = await sendRuntimeMessage({
      type: 'credential:save',
      apiKey: normalizedApiKey,
      rememberOnDevice: remember,
    });
    if (!saved.ok) {
      setStatus(saved.message);
      return false;
    }
    setHasCredential(true);
    setCredentialState(remember ? 'unlocked' : 'session');
    setApiKey('');
    return true;
  }

  const canContinue =
    step === 1
      ? settings.analysisConsent && settings.riskAcknowledged
      : step === 2
        ? permission
        : step === 3
          ? Boolean(apiKey.trim() || hasCredential)
          : true;

  return (
    <main className={styles.wide}>
      <header className={`${styles.header} ${styles.onboardingHeader}`}>
        <div className={styles.brandLockup}>
          <div className={styles.markFrame}>
            <img className={styles.mark} src="/icon/logo-512.png" alt="" />
          </div>
          <div>
            <h1 className={styles.title}>Professional Drafting Assistant</h1>
            <p className={styles.headerPromise}>Private setup</p>
          </div>
        </div>
        <span className={styles.setupCount}>
          {step} of {ONBOARDING_STEPS.length}
        </span>
      </header>
      <div className={styles.setupLayout}>
        <nav className={styles.wizardStepper} aria-label="Setup steps">
          {SETUP_PHASES.map((phase) => (
            <div className={styles.wizardPhase} key={phase.label}>
              <p>{phase.label}</p>
              <ol>
                {phase.steps.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      aria-current={item === step ? 'step' : undefined}
                      data-current={item === step}
                      data-complete={item < step}
                      disabled={busy}
                      onClick={() => {
                        setStatus('');
                        setStep(item);
                      }}
                    >
                      <span className={styles.wizardStepNumber} aria-hidden="true">
                        {item < step ? '✓' : item}
                      </span>
                      <span className="sr-only">{item}</span>
                      <span className={styles.wizardStepLabel}>{STEP_LABELS[item]}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </nav>
        <div className={styles.setupMain}>
          {step === 1 && (
            <section className={`${styles.card} ${styles.wizardCard}`}>
              <p className={styles.eyebrow}>Trust starts with clear limits</p>
              <h2>1. Understand the boundary</h2>
              <p className={styles.leadCompact}>
                You choose the conversation. The extension reads only visible text around that one
                right-click, minimizes and de-identifies it, then asks Gemini for drafts you can
                edit.
              </p>
              <div className={styles.warning}>
                <strong>The promise:</strong> The extension never posts, clicks, expands comments,
                or takes LinkedIn actions for you. It is independent from LinkedIn, so you remain
                responsible for how you use each draft.
              </div>
              <div className={styles.choiceGroup}>
                <label className={`${styles.check} ${styles.checkCard}`}>
                  <input
                    type="checkbox"
                    checked={settings.analysisConsent}
                    onChange={(event) =>
                      setSettings({ ...settings, analysisConsent: event.target.checked })
                    }
                  />
                  I consent to sending selected visible text and my engagement profile to Google
                  Gemini. I understand Google states that free-tier content may be used to improve
                  its products.
                </label>
                <label className={`${styles.check} ${styles.checkCard}`}>
                  <input
                    type="checkbox"
                    checked={settings.riskAcknowledged}
                    onChange={(event) =>
                      setSettings({ ...settings, riskAcknowledged: event.target.checked })
                    }
                  />
                  I understand the extension cannot guarantee compliance or prevent LinkedIn account
                  action.
                </label>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className={`${styles.card} ${styles.wizardCard}`}>
              <p className={styles.eyebrow}>One permission. One purpose.</p>
              <h2>2. Grant site access</h2>
              <p className={styles.leadCompact}>
                LinkedIn access is limited to recognizing the post or comment you explicitly select.
                Nothing is read until you right-click.
              </p>
              <div className={styles.scopeCard}>
                <span className={styles.scopeIcon}>li</span>
                <div>
                  <b>linkedin.com</b>
                  <small>Visible text extraction after your action</small>
                </div>
                <span className={permission ? styles.scopeGranted : styles.scopePending}>
                  {permission ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <button
                className={controlClass()}
                onClick={grantPermission}
                disabled={permission || busy}
              >
                {permission ? 'LinkedIn access granted' : 'Grant LinkedIn access'}
              </button>
              <p className={styles.reassuranceLeft}>
                You can revoke this permission from Chrome at any time.
              </p>
            </section>
          )}

          {step === 3 && (
            <section className={`${styles.card} ${styles.wizardCard}`}>
              <p className={styles.eyebrow}>Your key. Your quota. Your control.</p>
              <h2>3. Connect Gemini</h2>
              <p className={styles.leadCompact}>
                Bring your own Google AI Studio key. The extension uses free-tier Gemini models and
                never routes you to a paid-only model.
              </p>
              {hasCredential && !apiKey && (
                <div className={styles.success}>
                  {credentialState === 'unlocked'
                    ? 'The encrypted Gemini key is unlocked for this browser session.'
                    : 'A Gemini key is available for this browser session.'}{' '}
                  Paste a replacement below to validate and update it.
                </div>
              )}
              {credentialState === 'locked' && !apiKey && (
                <div className={styles.warning}>
                  The encrypted Gemini key is unavailable. Paste a replacement key to restore the
                  connection.
                </div>
              )}
              <div className={styles.field}>
                <label htmlFor="api-key">Gemini API key</label>
                <input
                  id="api-key"
                  className={styles.input}
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    hasCredential
                      ? 'Paste a new key to replace the saved key'
                      : 'Paste your API key'
                  }
                />
                <small className={styles.fieldHint}>
                  Validated directly with Google. Never included in diagnostics.
                </small>
                <ApiKeyGuide provider="gemini" />
              </div>
              <label className={`${styles.check} ${styles.checkCard}`}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Keep an encrypted copy on this device. Encryption and future unlocking happen
                automatically inside the extension.
              </label>
            </section>
          )}

          {step === 4 && (
            <section className={`${styles.card} ${styles.wizardCard}`}>
              <div className={styles.between}>
                <div>
                  <p className={styles.eyebrow}>Context makes the difference</p>
                  <h2>4. Engagement profile</h2>
                  <p className={styles.leadCompact}>
                    Teach the assistant how you think so the first draft needs less rewriting.
                  </p>
                </div>
                <label className={controlClass({ variant: 'secondary' })}>
                  Import my PDF
                  <input
                    hidden
                    type="file"
                    accept="application/pdf"
                    disabled={!ownProfilePdfConfirmed || busy}
                    onChange={(event) => void importPdf(event.target.files?.[0])}
                  />
                </label>
              </div>
              <label className={`${styles.check} ${styles.checkCard}`}>
                <input
                  type="checkbox"
                  checked={ownProfilePdfConfirmed}
                  onChange={(event) => setOwnProfilePdfConfirmed(event.target.checked)}
                />
                I confirm this PDF was exported from my own LinkedIn profile.
              </label>
              <ProfileEditor profile={profile} onChange={setProfile} />
            </section>
          )}

          {step === 5 && (
            <section className={`${styles.card} ${styles.wizardCard}`}>
              <p className={styles.eyebrow}>A reliable starting point, never a constraint</p>
              <h2>5. Draft preferences</h2>
              <p className={styles.leadCompact}>
                Choose the rhythm that suits most conversations. Every draft remains fully editable.
              </p>
              <div className={styles.field}>
                <label htmlFor="length-mode">Default length</label>
                <select
                  id="length-mode"
                  className={styles.select}
                  value={settings.lengthMode}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      lengthMode: event.target.value as AppSettings['lengthMode'],
                    })
                  }
                >
                  <option value="concise">Concise</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="language">Language override (optional)</label>
                <input
                  id="language"
                  className={styles.input}
                  value={settings.preferredLanguage ?? ''}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      preferredLanguage: event.target.value || undefined,
                    })
                  }
                  placeholder="Leave blank to mirror the selected post or comment"
                />
              </div>
              <p className={styles.subtle}>
                With no override, English content produces English drafts, Bangla content produces
                Bangla drafts, and mixed content produces naturally mixed drafts.
              </p>
              <p className={styles.subtle}>
                Drafts use free-tier Gemini 3.5 Flash. If Google explicitly reports a quota or
                rate-limit error, the extension tries free-tier Gemini 3.1 Flash-Lite once. It never
                retries after an ambiguous timeout.
              </p>
            </section>
          )}
          {step === 6 && <DiscoverySettingsPanel profile={profile} onboarding />}
          {status && (
            <div
              role="status"
              aria-live="polite"
              className={
                status.includes('complete') ||
                status.includes('derived') ||
                status.includes('granted')
                  ? styles.success
                  : styles.warning
              }
            >
              {status}
            </div>
          )}
          <div className={styles.wizardActions}>
            {step > 1 && (
              <button
                className={controlClass({ variant: 'secondary' })}
                disabled={busy}
                onClick={() => {
                  setStatus('');
                  setStep((step - 1) as OnboardingStep);
                }}
              >
                Back
              </button>
            )}
            {step < 6 ? (
              <button
                className={controlClass()}
                disabled={busy || !canContinue}
                onClick={() => void continueSetup()}
              >
                {busy ? 'Working…' : 'Continue'}
              </button>
            ) : (
              <button
                className={controlClass()}
                disabled={
                  busy ||
                  !permission ||
                  !settings.analysisConsent ||
                  !settings.riskAcknowledged ||
                  (!apiKey && !hasCredential)
                }
                onClick={() => void finish()}
              >
                {busy ? 'Working…' : 'Finish setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('The PDF could not be read as data.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('The PDF could not be read.'));
    reader.readAsDataURL(file);
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Onboarding root was not found.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Onboarding />
  </React.StrictMode>,
);
