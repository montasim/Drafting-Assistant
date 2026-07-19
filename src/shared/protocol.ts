import { z } from 'zod';
import {
  appSettingsSchema,
  engagementProfileSchema,
  type AnalysisState,
  type EngagementProfile,
  type HistoryEntry,
  type PostContext,
} from '../domain/schemas';
import {
  discoveryResultSchema,
  discoverySettingsSchema,
  discoverySourceIdSchema,
  discoveryStateSchema,
  publicationHistoryEntrySchema,
  voiceSettingsSchema,
  type DiscoveryResult,
  type DiscoverySettings,
  type DiscoveryState,
  type PublicationHistoryEntry,
  type VoiceSettings,
} from '../domain/discovery';
import { credentialStateSchema } from '../infrastructure/credential-vault';

export const runtimeRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setup:get') }),
  z.object({ type: z.literal('permission:remove-linkedin') }),
  z.object({ type: z.literal('credential:validate'), apiKey: z.string().min(1) }),
  z.object({
    type: z.literal('credential:save'),
    apiKey: z.string().min(1),
    rememberOnDevice: z.boolean(),
  }),
  z.object({ type: z.literal('credential:clear') }),
  z.object({ type: z.literal('settings:save'), settings: appSettingsSchema }),
  z.object({ type: z.literal('profile:save'), profile: engagementProfileSchema }),
  z.object({
    type: z.literal('profile:derive-pdf'),
    dataUrl: z.string().min(1),
    confirmedOwnProfile: z.literal(true),
  }),
  z.object({ type: z.literal('analysis:get-state') }),
  z.object({ type: z.literal('analysis:extract-selected') }),
  z.object({ type: z.literal('analysis:cancel') }),
  z.object({ type: z.literal('history:list') }),
  z.object({
    type: z.literal('history:update-draft'),
    entryId: z.string(),
    draftIndex: z.number().int().min(0).max(3),
    text: z.string().min(1).max(1200),
  }),
  z.object({ type: z.literal('history:delete'), entryId: z.string() }),
  z.object({ type: z.literal('history:clear') }),
  z.object({ type: z.literal('diagnostics:export') }),
  z.object({ type: z.literal('discovery:get') }),
  z.object({ type: z.literal('discovery:credential-validate'), apiKey: z.string().min(1) }),
  z.object({
    type: z.literal('discovery:credential-save'),
    apiKey: z.string().min(1),
    rememberOnDevice: z.boolean(),
  }),
  z.object({ type: z.literal('discovery:credential-clear') }),
  z.object({ type: z.literal('discovery:settings-save'), settings: discoverySettingsSchema }),
  z.object({ type: z.literal('discovery:disable') }),
  z.object({ type: z.literal('discovery:run'), provider: z.enum(['groq', 'gemini']) }),
  z.object({ type: z.literal('discovery:cancel') }),
  z.object({
    type: z.literal('discovery:generate'),
    opportunityId: z.string().min(1),
    alternative: z.boolean(),
    provider: z.enum(['groq', 'gemini']),
  }),
  z.object({
    type: z.literal('discovery:update-draft'),
    opportunityId: z.string().min(1),
    text: z.string().min(1).max(6000),
  }),
  z.object({ type: z.literal('discovery:clear-seen') }),
  z.object({ type: z.literal('voice:save'), voice: voiceSettingsSchema }),
  z.object({
    type: z.literal('voice:analyze'),
    samples: z.array(z.string().trim().min(1).max(5000)).min(1).max(5),
  }),
  z.object({ type: z.literal('publication-history:delete'), entryId: z.string().min(1) }),
  z.object({
    type: z.literal('publication-history:update-draft'),
    entryId: z.string().min(1),
    text: z.string().min(1).max(6000),
  }),
  z.object({ type: z.literal('publication-history:clear') }),
  z.object({ type: z.literal('content:extract-selected-post') }),
]);
export type RuntimeRequest = z.infer<typeof runtimeRequestSchema>;

export const setupSnapshotSchema = z.object({
  settings: appSettingsSchema,
  profile: engagementProfileSchema.nullable(),
  hasCredential: z.boolean(),
  credentialState: credentialStateSchema,
  hasLinkedInPermission: z.boolean(),
});
export type SetupSnapshot = z.infer<typeof setupSnapshotSchema>;

const discoveryPermissionSnapshotSchema = z.intersection(
  z.record(discoverySourceIdSchema, z.boolean()),
  z.object({ groq: z.boolean() }),
);

export const discoverySnapshotSchema = z.object({
  settings: discoverySettingsSchema,
  voice: voiceSettingsSchema,
  state: discoveryStateSchema,
  current: discoveryResultSchema.nullable(),
  history: publicationHistoryEntrySchema.array(),
  hasCredential: z.boolean(),
  credentialState: credentialStateSchema,
  permissions: discoveryPermissionSnapshotSchema,
});
export interface DiscoverySnapshot {
  settings: DiscoverySettings;
  voice: VoiceSettings;
  state: DiscoveryState;
  current: DiscoveryResult | null;
  history: PublicationHistoryEntry[];
  hasCredential: boolean;
  credentialState: z.infer<typeof credentialStateSchema>;
  permissions: Record<z.infer<typeof discoverySourceIdSchema>, boolean> & { groq: boolean };
}

export type RuntimeResponse =
  | { ok: true }
  | { ok: true; setup: SetupSnapshot }
  | { ok: true; valid: boolean; message?: string }
  | { ok: true; profile: EngagementProfile }
  | { ok: true; state: AnalysisState }
  | { ok: true; history: HistoryEntry[] }
  | { ok: true; context: PostContext }
  | { ok: true; diagnosticJson: string }
  | { ok: true; discovery: DiscoverySnapshot }
  | { ok: true; guide: string }
  | { ok: false; code: string; message: string };

export async function sendRuntimeMessage(request: RuntimeRequest): Promise<RuntimeResponse> {
  const response: unknown = await chrome.runtime.sendMessage(request);
  if (!response || typeof response !== 'object' || !('ok' in response)) {
    return {
      ok: false,
      code: 'invalid-runtime-response',
      message: 'The extension returned an invalid response.',
    };
  }
  return response as RuntimeResponse;
}
