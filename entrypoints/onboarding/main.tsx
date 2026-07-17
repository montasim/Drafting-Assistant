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
import '../../src/ui/base.css';
import styles from '../../src/ui/app.module.css';

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

function Onboarding() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [profile, setProfile] = useState<EngagementProfile>(createDefaultProfile());
  const [apiKey, setApiKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [permission, setPermission] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
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
        setRemember(response.setup.settings.rememberCredential);
        if (response.setup.profile) setProfile(response.setup.profile);
      }
    });
  }, []);

  async function grantPermission() {
    const response = await sendRuntimeMessage({ type: 'permission:request-linkedin' });
    setPermission(response.ok);
    setStatus(response.ok ? 'LinkedIn access granted.' : response.message);
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
      <header className={styles.header}>
        <img className={styles.mark} src="/icon/logo-512.png" alt="" />
        <div>
          <h1 className={styles.title}>Professional Drafting Assistant</h1>
          <p className={styles.subtle}>Private-by-design LinkedIn response drafting</p>
        </div>
      </header>
      <div className={styles.wizardMeta}>
        <span>Step {step} of 5</span>
        <span>{step * 20}%</span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={step}
      >
        <div className={styles.progressBar} style={{ width: `${step * 20}%` }} />
      </div>

      {step === 1 && (
        <section className={styles.card}>
          <h2>1. Understand the boundary</h2>
          <p>
            This independent extension reads only text already visible in the exact LinkedIn post or
            comment you right-click. It sends minimized, de-identified text to the Google Gemini API
            and returns drafts for you to review and copy.
          </p>
          <div className={styles.warning}>
            <strong>Important:</strong> This is not affiliated with LinkedIn. Browser extensions and
            AI-assisted engagement may create policy or account risk. The extension never posts,
            clicks, expands comments, or takes LinkedIn actions for you.
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.analysisConsent}
              onChange={(event) =>
                setSettings({ ...settings, analysisConsent: event.target.checked })
              }
            />
            I consent to sending selected visible text and my engagement profile to Google Gemini. I
            understand Google states that free-tier content may be used to improve its products.
          </label>
          <label className={styles.check}>
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
        </section>
      )}

      {step === 2 && (
        <section className={styles.card}>
          <h2>2. Grant site access</h2>
          <p>
            Access is optional and limited to <code>linkedin.com</code>. It is required for
            right-click extraction.
          </p>
          <button className={styles.button} onClick={grantPermission} disabled={permission || busy}>
            {permission ? 'LinkedIn access granted' : 'Grant LinkedIn access'}
          </button>
        </section>
      )}

      {step === 3 && (
        <section className={styles.card}>
          <h2>3. Connect Gemini</h2>
          {hasCredential && !apiKey && (
            <div className={styles.success}>A Gemini API key is already saved.</div>
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
              placeholder={hasCredential ? 'Enter a new key to replace the saved key' : 'Enter key'}
            />
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember on this device. This stores the key in extension-local storage until you clear
            it.
          </label>
        </section>
      )}

      {step === 4 && (
        <section className={styles.card}>
          <div className={styles.between}>
            <div>
              <h2>4. Engagement profile</h2>
              <p className={styles.subtle}>
                Optionally upload your own LinkedIn Save-to-PDF, or edit the fields manually.
              </p>
            </div>
            <label className={`${styles.button} ${styles.secondary}`}>
              Import PDF
              <input
                hidden
                type="file"
                accept="application/pdf"
                disabled={!ownProfilePdfConfirmed || busy}
                onChange={(event) => void importPdf(event.target.files?.[0])}
              />
            </label>
          </div>
          <label className={styles.check}>
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
        <section className={styles.card}>
          <h2>5. Draft preferences</h2>
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
            Drafts use Gemini 2.5 Flash. If Google explicitly reports a quota or rate-limit error,
            the extension retries once with Gemini 2.5 Flash-Lite. It never retries after an
            ambiguous timeout.
          </p>
        </section>
      )}
      {status && (
        <div
          className={
            status.includes('complete') || status.includes('derived') || status.includes('granted')
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
            className={`${styles.button} ${styles.secondary}`}
            disabled={busy}
            onClick={() => {
              setStatus('');
              setStep((step - 1) as OnboardingStep);
            }}
          >
            Back
          </button>
        )}
        {step < 5 ? (
          <button
            className={styles.button}
            disabled={busy || !canContinue}
            onClick={() => void continueSetup()}
          >
            {busy ? 'Working…' : 'Continue'}
          </button>
        ) : (
          <button
            className={styles.button}
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
