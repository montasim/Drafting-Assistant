import { z } from 'zod';
import {
  appSettingsSchema,
  engagementProfileSchema,
  type AnalysisState,
  type EngagementProfile,
  type HistoryEntry,
  type PostContext,
} from '../domain/schemas';

export const runtimeRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setup:get') }),
  z.object({ type: z.literal('permission:request-linkedin') }),
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
    draftIndex: z.number().int().min(0).max(2),
    text: z.string().min(1).max(1200),
  }),
  z.object({ type: z.literal('history:delete'), entryId: z.string() }),
  z.object({ type: z.literal('history:clear') }),
  z.object({ type: z.literal('diagnostics:export') }),
  z.object({ type: z.literal('content:extract-selected-post') }),
]);
export type RuntimeRequest = z.infer<typeof runtimeRequestSchema>;

export const setupSnapshotSchema = z.object({
  settings: appSettingsSchema,
  profile: engagementProfileSchema.nullable(),
  hasCredential: z.boolean(),
  hasLinkedInPermission: z.boolean(),
});
export type SetupSnapshot = z.infer<typeof setupSnapshotSchema>;

export type RuntimeResponse =
  | { ok: true }
  | { ok: true; setup: SetupSnapshot }
  | { ok: true; valid: boolean; message?: string }
  | { ok: true; profile: EngagementProfile }
  | { ok: true; state: AnalysisState }
  | { ok: true; history: HistoryEntry[] }
  | { ok: true; context: PostContext }
  | { ok: true; diagnosticJson: string }
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
