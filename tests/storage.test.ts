import { vi } from 'vitest';
import { ExtensionStorage } from '../src/infrastructure/storage';

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
    const area = (values: Record<string, unknown>) => ({
      get: vi.fn((key: string) => Promise.resolve({ [key]: values[key] })),
      set: vi.fn((items: Record<string, unknown>) => Promise.resolve(Object.assign(values, items))),
      remove: vi.fn((key: string) => Promise.resolve(Reflect.deleteProperty(values, key))),
    });
    const local = area(localValues);
    const session = area(sessionValues);
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
});
