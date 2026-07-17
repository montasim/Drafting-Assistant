import {
  analysisStateSchema,
  appSettingsSchema,
  defaultSettings,
  engagementProfileSchema,
  historyEntrySchema,
  type AnalysisState,
  type AppSettings,
  type EngagementProfile,
  type HistoryEntry,
} from '../domain/schemas';

const KEYS = {
  settings: 'settings',
  profile: 'profile',
  history: 'history',
  credential: 'geminiCredential',
  legacyCredential: 'zaiCredential',
  providerMigration: 'geminiOnlyMigration',
  analysis: 'analysisState',
  diagnostics: 'diagnostics',
} as const;

interface Diagnostic {
  at: string;
  event: string;
  code?: string;
}

export class ExtensionStorage {
  async migrateToGemini(): Promise<void> {
    const migration = await chrome.storage.local.get(KEYS.providerMigration);
    if (migration[KEYS.providerMigration] === 1) return;

    const current = await chrome.storage.local.get(KEYS.settings);
    const previous = readLegacySettings(current[KEYS.settings]);
    await Promise.all([
      chrome.storage.local.set({
        [KEYS.settings]: {
          ...previous,
          schemaVersion: 2,
          onboardingComplete: false,
          analysisConsent: false,
          rememberCredential: false,
        } satisfies AppSettings,
        [KEYS.providerMigration]: 1,
      }),
      chrome.storage.local.remove(KEYS.legacyCredential),
      chrome.storage.session.remove(KEYS.legacyCredential),
    ]);
  }

  async restrictAccess(): Promise<void> {
    await Promise.all([
      chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
      chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
    ]);
  }

  async getSettings(): Promise<AppSettings> {
    const value: unknown = (await chrome.storage.local.get(KEYS.settings))[KEYS.settings];
    return appSettingsSchema.catch(defaultSettings).parse(value);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await chrome.storage.local.set({ [KEYS.settings]: appSettingsSchema.parse(settings) });
  }

  async getProfile(): Promise<EngagementProfile | null> {
    const value: unknown = (await chrome.storage.local.get(KEYS.profile))[KEYS.profile];
    const parsed = engagementProfileSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  async saveProfile(profile: EngagementProfile): Promise<void> {
    await chrome.storage.local.set({ [KEYS.profile]: engagementProfileSchema.parse(profile) });
  }

  async getCredential(): Promise<string | null> {
    const sessionValue: unknown = (await chrome.storage.session.get(KEYS.credential))[
      KEYS.credential
    ];
    if (typeof sessionValue === 'string' && sessionValue.length > 0) return sessionValue;
    const localValue: unknown = (await chrome.storage.local.get(KEYS.credential))[KEYS.credential];
    return typeof localValue === 'string' && localValue.length > 0 ? localValue : null;
  }

  async saveCredential(apiKey: string, remember: boolean): Promise<void> {
    await this.clearCredential();
    const area = remember ? chrome.storage.local : chrome.storage.session;
    await area.set({ [KEYS.credential]: apiKey });
  }

  async clearCredential(): Promise<void> {
    await Promise.all([
      chrome.storage.local.remove(KEYS.credential),
      chrome.storage.session.remove(KEYS.credential),
    ]);
  }

  async getAnalysisState(): Promise<AnalysisState> {
    const value: unknown = (await chrome.storage.session.get(KEYS.analysis))[KEYS.analysis];
    return analysisStateSchema.catch({ status: 'idle' }).parse(value);
  }

  async saveAnalysisState(state: AnalysisState): Promise<void> {
    await chrome.storage.session.set({ [KEYS.analysis]: analysisStateSchema.parse(state) });
  }

  async listHistory(): Promise<HistoryEntry[]> {
    const value: unknown = (await chrome.storage.local.get(KEYS.history))[KEYS.history];
    return historyEntrySchema.array().catch([]).parse(value);
  }

  async addHistory(entry: HistoryEntry): Promise<void> {
    const entries = await this.listHistory();
    await chrome.storage.local.set({
      [KEYS.history]: [historyEntrySchema.parse(entry), ...entries].slice(0, 20),
    });
  }

  async updateHistoryDraft(entryId: string, draftIndex: number, text: string): Promise<void> {
    const entries = await this.listHistory();
    const updated = entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const drafts = entry.drafts.map((draft, index) =>
        index === draftIndex ? { ...draft, text } : draft,
      );
      return { ...entry, drafts };
    });
    await chrome.storage.local.set({ [KEYS.history]: updated });
  }

  async deleteHistory(entryId: string): Promise<void> {
    const entries = await this.listHistory();
    await chrome.storage.local.set({ [KEYS.history]: entries.filter(({ id }) => id !== entryId) });
  }

  async clearHistory(): Promise<void> {
    await chrome.storage.local.remove(KEYS.history);
  }

  async recordDiagnostic(event: string, code?: string): Promise<void> {
    const value: unknown = (await chrome.storage.local.get(KEYS.diagnostics))[KEYS.diagnostics];
    const previous = Array.isArray(value) ? (value as Diagnostic[]) : [];
    const item: Diagnostic = code
      ? { at: new Date().toISOString(), event, code }
      : { at: new Date().toISOString(), event };
    await chrome.storage.local.set({ [KEYS.diagnostics]: [...previous, item].slice(-100) });
  }

  async exportDiagnostics(): Promise<string> {
    const value: unknown = (await chrome.storage.local.get(KEYS.diagnostics))[KEYS.diagnostics];
    return JSON.stringify(
      {
        schemaVersion: 1,
        extensionVersion: chrome.runtime.getManifest().version,
        exportedAt: new Date().toISOString(),
        events: Array.isArray(value) ? value : [],
      },
      null,
      2,
    );
  }
}

function readLegacySettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return defaultSettings;
  const record = value as Record<string, unknown>;
  return {
    ...defaultSettings,
    riskAcknowledged:
      typeof record.riskAcknowledged === 'boolean' ? record.riskAcknowledged : false,
    preferredLanguage:
      typeof record.preferredLanguage === 'string' ? record.preferredLanguage : undefined,
    lengthMode:
      record.lengthMode === 'concise' ||
      record.lengthMode === 'standard' ||
      record.lengthMode === 'detailed'
        ? record.lengthMode
        : 'standard',
  };
}
