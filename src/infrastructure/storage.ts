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
import {
  defaultDiscoverySettings,
  defaultVoiceSettings,
  discoveryResultSchema,
  discoverySettingsSchema,
  discoveryStateSchema,
  publicationHistoryEntrySchema,
  seenItemSchema,
  voiceSettingsSchema,
  type DiscoveryResult,
  type DiscoverySettings,
  type DiscoveryState,
  type PublicationHistoryEntry,
  type SeenItem,
  type VoiceSettings,
} from '../domain/discovery';
import {
  decryptCredential,
  encryptCredential,
  encryptedCredentialSchema,
  type CredentialPurpose,
  type CredentialState,
} from './credential-vault';
import { getOrCreateDeviceVaultKey } from './credential-key-store';

const KEYS = {
  settings: 'settings',
  profile: 'profile',
  history: 'history',
  credential: 'geminiCredential',
  legacyCredential: 'zaiCredential',
  providerMigration: 'geminiOnlyMigration',
  analysis: 'analysisState',
  diagnostics: 'diagnostics',
  discoverySettings: 'discoverySettings',
  discoveryCredential: 'groqCredential',
  discoveryState: 'discoveryState',
  discoveryCurrent: 'discoveryCurrent',
  publicationHistory: 'publicationHistory',
  voice: 'discoveryVoice',
  seenItems: 'discoverySeenItems',
} as const;

interface Diagnostic {
  at: string;
  event: string;
  code?: string;
}

export class ExtensionStorage {
  constructor(
    private readonly getDeviceVaultKey: () => Promise<CryptoKey> = getOrCreateDeviceVaultKey,
  ) {}

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

  async migratePlaintextCredentials(): Promise<void> {
    const [localValues, sessionValues] = await Promise.all([
      chrome.storage.local.get([KEYS.credential, KEYS.discoveryCredential]),
      chrome.storage.session.get([KEYS.credential, KEYS.discoveryCredential]),
    ]);
    const localUpdates: Record<string, unknown> = {};
    const sessionUpdates: Record<string, string> = {};
    let deviceKey: CryptoKey | null = null;
    const credentials: [string, CredentialPurpose][] = [
      [KEYS.credential, 'gemini'],
      [KEYS.discoveryCredential, 'groq'],
    ];
    for (const [key, purpose] of credentials) {
      const localValue: unknown = localValues[key];
      const sessionValue: unknown = sessionValues[key];
      if (typeof localValue === 'string' && localValue.length > 0) {
        deviceKey ??= await this.getDeviceVaultKey();
        localUpdates[key] = await encryptCredential(localValue, deviceKey, purpose);
        if (typeof sessionValue !== 'string' || sessionValue.length === 0)
          sessionUpdates[key] = localValue;
        continue;
      }
      const encrypted = encryptedCredentialSchema.safeParse(localValue);
      if (encrypted.success && (typeof sessionValue !== 'string' || sessionValue.length === 0)) {
        try {
          deviceKey ??= await this.getDeviceVaultKey();
          sessionUpdates[key] = await decryptCredential(encrypted.data, deviceKey, purpose);
        } catch {
          // Leave an unreadable envelope locked so the UI can offer clear/replace actions.
        }
      }
    }
    if (Object.keys(localUpdates).length > 0) await chrome.storage.local.set(localUpdates);
    if (Object.keys(sessionUpdates).length > 0) await chrome.storage.session.set(sessionUpdates);
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
    return null;
  }

  async getCredentialState(): Promise<CredentialState> {
    return this.getCredentialStateFor(KEYS.credential);
  }

  async saveCredential(apiKey: string, remember: boolean): Promise<void> {
    const encrypted = remember
      ? await encryptCredential(apiKey, await this.getDeviceVaultKey(), 'gemini')
      : null;
    await this.clearCredential();
    await chrome.storage.session.set({ [KEYS.credential]: apiKey });
    if (encrypted) await chrome.storage.local.set({ [KEYS.credential]: encrypted });
  }

  async clearCredential(): Promise<void> {
    await Promise.all([
      chrome.storage.local.remove(KEYS.credential),
      chrome.storage.session.remove(KEYS.credential),
    ]);
  }

  async forgetCredentialOnDevice(): Promise<void> {
    await chrome.storage.local.remove(KEYS.credential);
  }

  async getDiscoverySettings(): Promise<DiscoverySettings> {
    const value: unknown = (await chrome.storage.local.get(KEYS.discoverySettings))[
      KEYS.discoverySettings
    ];
    return discoverySettingsSchema.catch(defaultDiscoverySettings).parse(value);
  }

  async saveDiscoverySettings(settings: DiscoverySettings): Promise<void> {
    await chrome.storage.local.set({
      [KEYS.discoverySettings]: discoverySettingsSchema.parse(settings),
    });
  }

  async getDiscoveryCredential(): Promise<string | null> {
    const sessionValue: unknown = (await chrome.storage.session.get(KEYS.discoveryCredential))[
      KEYS.discoveryCredential
    ];
    if (typeof sessionValue === 'string' && sessionValue.length > 0) return sessionValue;
    return null;
  }

  async getDiscoveryCredentialState(): Promise<CredentialState> {
    return this.getCredentialStateFor(KEYS.discoveryCredential);
  }

  async saveDiscoveryCredential(apiKey: string, remember: boolean): Promise<void> {
    const encrypted = remember
      ? await encryptCredential(apiKey, await this.getDeviceVaultKey(), 'groq')
      : null;
    await this.clearDiscoveryCredential();
    await chrome.storage.session.set({ [KEYS.discoveryCredential]: apiKey });
    if (encrypted) await chrome.storage.local.set({ [KEYS.discoveryCredential]: encrypted });
  }

  async clearDiscoveryCredential(): Promise<void> {
    await Promise.all([
      chrome.storage.local.remove(KEYS.discoveryCredential),
      chrome.storage.session.remove(KEYS.discoveryCredential),
    ]);
  }

  async forgetDiscoveryCredentialOnDevice(): Promise<void> {
    await chrome.storage.local.remove(KEYS.discoveryCredential);
  }

  async getVoiceSettings(): Promise<VoiceSettings> {
    const value: unknown = (await chrome.storage.local.get(KEYS.voice))[KEYS.voice];
    return voiceSettingsSchema.catch(defaultVoiceSettings).parse(value);
  }

  async saveVoiceSettings(settings: VoiceSettings): Promise<void> {
    await chrome.storage.local.set({ [KEYS.voice]: voiceSettingsSchema.parse(settings) });
  }

  async getDiscoveryState(): Promise<DiscoveryState> {
    const value: unknown = (await chrome.storage.session.get(KEYS.discoveryState))[
      KEYS.discoveryState
    ];
    return discoveryStateSchema.catch({ status: 'idle' }).parse(value);
  }

  async saveDiscoveryState(state: DiscoveryState): Promise<void> {
    await chrome.storage.session.set({
      [KEYS.discoveryState]: discoveryStateSchema.parse(state),
    });
  }

  async getDiscoveryResult(): Promise<DiscoveryResult | null> {
    const value: unknown = (await chrome.storage.local.get(KEYS.discoveryCurrent))[
      KEYS.discoveryCurrent
    ];
    const parsed = discoveryResultSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  async saveDiscoveryResult(result: DiscoveryResult): Promise<void> {
    await chrome.storage.local.set({
      [KEYS.discoveryCurrent]: discoveryResultSchema.parse(result),
    });
  }

  async clearDiscoveryCurrent(): Promise<void> {
    await Promise.all([
      chrome.storage.local.remove(KEYS.discoveryCurrent),
      chrome.storage.session.remove(KEYS.discoveryState),
    ]);
  }

  async listPublicationHistory(): Promise<PublicationHistoryEntry[]> {
    const value: unknown = (await chrome.storage.local.get(KEYS.publicationHistory))[
      KEYS.publicationHistory
    ];
    return publicationHistoryEntrySchema.array().catch([]).parse(value);
  }

  async addPublicationHistory(entry: PublicationHistoryEntry): Promise<void> {
    const entries = await this.listPublicationHistory();
    const next = [
      publicationHistoryEntrySchema.parse(entry),
      ...entries.filter((item) => item.id !== entry.id),
    ].slice(0, 20);
    await chrome.storage.local.set({ [KEYS.publicationHistory]: next });
  }

  async updatePublicationDraft(opportunityId: string, text: string): Promise<void> {
    const [result, entries] = await Promise.all([
      this.getDiscoveryResult(),
      this.listPublicationHistory(),
    ]);
    const nextResult = result
      ? {
          ...result,
          opportunities: result.opportunities.map((opportunity) =>
            opportunity.id === opportunityId && opportunity.draft
              ? { ...opportunity, draft: { ...opportunity.draft, text } }
              : opportunity,
          ),
        }
      : null;
    let historyUpdated = false;
    const nextEntries = entries.map((entry) => {
      if (historyUpdated || entry.opportunityId !== opportunityId) return entry;
      historyUpdated = true;
      return { ...entry, draft: { ...entry.draft, text } };
    });
    await Promise.all([
      nextResult ? this.saveDiscoveryResult(nextResult) : Promise.resolve(),
      chrome.storage.local.set({ [KEYS.publicationHistory]: nextEntries }),
    ]);
  }

  async deletePublicationHistory(entryId: string): Promise<void> {
    const entries = await this.listPublicationHistory();
    await chrome.storage.local.set({
      [KEYS.publicationHistory]: entries.filter((entry) => entry.id !== entryId),
    });
  }

  async updatePublicationHistoryDraft(entryId: string, text: string): Promise<void> {
    const entries = await this.listPublicationHistory();
    await chrome.storage.local.set({
      [KEYS.publicationHistory]: entries.map((entry) =>
        entry.id === entryId ? { ...entry, draft: { ...entry.draft, text } } : entry,
      ),
    });
  }

  async clearPublicationHistory(): Promise<void> {
    await chrome.storage.local.remove(KEYS.publicationHistory);
  }

  async listSeenItems(): Promise<SeenItem[]> {
    const value: unknown = (await chrome.storage.local.get(KEYS.seenItems))[KEYS.seenItems];
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return seenItemSchema
      .array()
      .catch([])
      .parse(value)
      .filter((item) => Date.parse(item.seenAt) >= cutoff);
  }

  async addSeenItems(fingerprints: string[]): Promise<void> {
    const previous = await this.listSeenItems();
    const now = new Date().toISOString();
    const next = new Map(previous.map((item) => [item.fingerprint, item]));
    for (const fingerprint of fingerprints) next.set(fingerprint, { fingerprint, seenAt: now });
    await chrome.storage.local.set({ [KEYS.seenItems]: [...next.values()] });
  }

  async clearSeenItems(): Promise<void> {
    await chrome.storage.local.remove(KEYS.seenItems);
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

  private async getCredentialStateFor(key: string): Promise<CredentialState> {
    const [sessionValues, localValues] = await Promise.all([
      chrome.storage.session.get(key),
      chrome.storage.local.get(key),
    ]);
    const sessionValue: unknown = sessionValues[key];
    const encrypted = encryptedCredentialSchema.safeParse(localValues[key]).success;
    if (typeof sessionValue === 'string' && sessionValue.length > 0)
      return encrypted ? 'unlocked' : 'session';
    return encrypted ? 'locked' : 'missing';
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
