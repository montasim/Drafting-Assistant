import { vi } from 'vitest';
import { ExtensionStorage } from '../src/infrastructure/storage';

function storageArea(values: Record<string, unknown>) {
  return {
    get: vi.fn((keys: string | string[]) => {
      const selected = Array.isArray(keys) ? keys : [keys];
      return Promise.resolve(Object.fromEntries(selected.map((key) => [key, values[key]])));
    }),
    set: vi.fn((items: Record<string, unknown>) => Promise.resolve(Object.assign(values, items))),
    remove: vi.fn((keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) Reflect.deleteProperty(values, key);
      return Promise.resolve();
    }),
  };
}

describe('Gemini storage migration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('removes the legacy credential and requires fresh provider consent', async () => {
    const localValues: Record<string, unknown> = {
      settings: {
        schemaVersion: 1,
        onboardingComplete: true,
        analysisConsent: true,
        riskAcknowledged: true,
        rememberCredential: true,
        qualityMode: true,
        paidModelConsent: true,
        preferredLanguage: 'English',
        lengthMode: 'detailed',
      },
      zaiCredential: 'legacy-secret',
    };
    const sessionValues: Record<string, unknown> = { zaiCredential: 'legacy-session-secret' };
    const local = storageArea(localValues);
    const session = storageArea(sessionValues);
    vi.stubGlobal('chrome', { storage: { local, session } });

    await new ExtensionStorage().migrateToGemini();

    expect(localValues.zaiCredential).toBeUndefined();
    expect(sessionValues.zaiCredential).toBeUndefined();
    expect(localValues.geminiOnlyMigration).toBe(1);
    expect(localValues.settings).toMatchObject({
      schemaVersion: 2,
      onboardingComplete: false,
      analysisConsent: false,
      riskAcknowledged: true,
      rememberCredential: false,
      preferredLanguage: 'English',
      lengthMode: 'detailed',
    });
    expect(localValues.settings).not.toHaveProperty('qualityMode');
    expect(localValues.settings).not.toHaveProperty('paidModelConsent');
  });

  it('migrates persistent plaintext credentials to encrypted device storage', async () => {
    const localValues: Record<string, unknown> = {
      geminiOnlyMigration: 1,
      geminiCredential: 'old-gemini-secret',
      groqCredential: 'old-groq-secret',
      settings: { ...defaultSettingsForTest(), rememberCredential: true },
    };
    const sessionValues: Record<string, unknown> = {};
    const local = storageArea(localValues);
    const session = storageArea(sessionValues);
    vi.stubGlobal('chrome', { storage: { local, session } });
    const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);

    await new ExtensionStorage(() => Promise.resolve(deviceKey)).migratePlaintextCredentials();

    expect(sessionValues).toMatchObject({
      geminiCredential: 'old-gemini-secret',
      groqCredential: 'old-groq-secret',
    });
    expect(JSON.stringify(localValues.geminiCredential)).not.toContain('old-gemini-secret');
    expect(JSON.stringify(localValues.groqCredential)).not.toContain('old-groq-secret');
    expect(localValues.geminiCredential).toMatchObject({ cipher: 'AES-256-GCM' });
    expect(localValues.groqCredential).toMatchObject({ cipher: 'AES-256-GCM' });
    expect(localValues.settings).toMatchObject({ rememberCredential: true });
  });

  it('persists only encrypted credential envelopes and requires an unlock after session loss', async () => {
    const localValues: Record<string, unknown> = {};
    const sessionValues: Record<string, unknown> = {};
    const local = storageArea(localValues);
    const session = storageArea(sessionValues);
    vi.stubGlobal('chrome', { storage: { local, session } });
    const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    const storage = new ExtensionStorage(() => Promise.resolve(deviceKey));

    await storage.saveCredential('current-gemini-secret', true);

    expect(sessionValues.geminiCredential).toBe('current-gemini-secret');
    expect(JSON.stringify(localValues.geminiCredential)).not.toContain('current-gemini-secret');
    expect(await storage.getCredentialState()).toBe('unlocked');

    Reflect.deleteProperty(sessionValues, 'geminiCredential');
    expect(await storage.getCredential()).toBeNull();
    expect(await storage.getCredentialState()).toBe('locked');
    await storage.migratePlaintextCredentials();
    expect(await storage.getCredential()).toBe('current-gemini-secret');
  });

  it('keeps legacy three-draft history readable after adding constructive challenge', async () => {
    const localValues: Record<string, unknown> = {
      history: [
        {
          id: 'legacy-analysis',
          createdAt: new Date().toISOString(),
          responseTargetType: 'post',
          postExcerpt: 'A legacy analysis.',
          summary: {
            overview: 'Legacy summary',
            themes: ['Compatibility'],
            intent: 'Share an observation',
            uncertainties: [],
            risks: [],
          },
          drafts: [
            { strategy: 'professional-insight', text: 'Insight' },
            { strategy: 'specific-question', text: 'Question' },
            { strategy: 'support-and-extend', text: 'Extension' },
          ],
          language: 'English',
          model: 'legacy-model',
        },
      ],
    };
    const local = {
      get: vi.fn((key: string) => Promise.resolve({ [key]: localValues[key] })),
    };
    vi.stubGlobal('chrome', { storage: { local } });

    const history = await new ExtensionStorage().listHistory();

    expect(history).toHaveLength(1);
    expect(history[0]?.drafts).toHaveLength(3);
  });
});

function defaultSettingsForTest() {
  return {
    schemaVersion: 2 as const,
    onboardingComplete: true,
    analysisConsent: true,
    riskAcknowledged: true,
    rememberCredential: false,
    lengthMode: 'standard' as const,
  };
}
