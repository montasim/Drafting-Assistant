import { z } from 'zod';

export const responseTargetTypeSchema = z.enum(['post', 'reply']);
export type ResponseTargetType = z.infer<typeof responseTargetTypeSchema>;

export const supportedSurfaceSchema = z.enum(['feed', 'post-detail']);
export type SupportedSurface = z.infer<typeof supportedSurfaceSchema>;

export const discussionItemSchema = z.object({
  participantLabel: z.string().min(1),
  text: z.string().min(1),
  depth: z.number().int().min(0),
  isTarget: z.boolean(),
});
export type DiscussionItem = z.infer<typeof discussionItemSchema>;

export const postContextSchema = z.object({
  schemaVersion: z.literal(1),
  extractionVersion: z.string().min(1),
  surface: supportedSurfaceSchema,
  visiblePostText: z.string().min(1),
  reactionSummary: z.string().optional(),
  visibleDiscussion: z.array(discussionItemSchema),
  responseTarget: z.object({
    type: responseTargetTypeSchema,
    participantLabel: z.string().min(1).optional(),
    text: z.string().min(1),
  }),
  excerpt: z.string().min(1).max(280),
  extractedAt: z.iso.datetime(),
});
export type PostContext = z.infer<typeof postContextSchema>;

export const engagementProfileSchema = z.object({
  schemaVersion: z.literal(1),
  role: z.string().max(160),
  industries: z.array(z.string().min(1).max(80)).max(12),
  expertise: z.array(z.string().min(1).max(120)).max(24),
  audience: z.string().max(400),
  goals: z.array(z.string().min(1).max(200)).max(12),
  tone: z.string().max(240),
  preferredLanguage: z.string().max(80).optional(),
  topicsToAvoid: z.array(z.string().min(1).max(160)).max(24),
  allowEmoji: z.boolean(),
  allowHashtags: z.boolean(),
  source: z.enum(['manual', 'profile-pdf']),
  updatedAt: z.iso.datetime(),
});
export type EngagementProfile = z.infer<typeof engagementProfileSchema>;

export const draftStrategySchema = z.enum([
  'professional-insight',
  'specific-question',
  'support-and-extend',
  'constructive-challenge',
]);
export type DraftStrategy = z.infer<typeof draftStrategySchema>;

const responseDraftTextSchema = z.string().min(1).max(1200);
const responseDraftSchema = z.object({
  strategy: draftStrategySchema,
  text: responseDraftTextSchema,
});

export const currentDraftSetSchema = z.tuple([
  z.object({ strategy: z.literal('professional-insight'), text: responseDraftTextSchema }),
  z.object({ strategy: z.literal('specific-question'), text: responseDraftTextSchema }),
  z.object({ strategy: z.literal('support-and-extend'), text: responseDraftTextSchema }),
  z.object({ strategy: z.literal('constructive-challenge'), text: responseDraftTextSchema }),
]);

const compatibleDraftSetSchema = z.union([
  currentDraftSetSchema,
  responseDraftSchema.array().length(3),
]);

export const engagementRiskSchema = z.object({
  category: z.enum(['professional', 'privacy', 'safety', 'credibility', 'regulated-claim']),
  severity: z.enum(['low', 'medium', 'high']),
  description: z.string().min(1).max(400),
});
export type EngagementRisk = z.infer<typeof engagementRiskSchema>;

export const analysisResultSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.object({
    overview: z.string().min(1).max(800),
    themes: z.array(z.string().min(1).max(160)).min(1).max(8),
    intent: z.string().min(1).max(400),
    uncertainties: z.array(z.string().min(1).max(300)).max(8),
    risks: z.array(engagementRiskSchema).max(8),
  }),
  drafts: compatibleDraftSetSchema,
  language: z.string().min(1).max(80),
  model: z.string().min(1),
  generatedAt: z.iso.datetime(),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const historyEntrySchema = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  responseTargetType: responseTargetTypeSchema,
  postExcerpt: z.string().min(1).max(280),
  summary: analysisResultSchema.shape.summary,
  drafts: analysisResultSchema.shape.drafts,
  language: z.string().min(1).max(80),
  model: z.string().min(1),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const lengthModeSchema = z.enum(['concise', 'standard', 'detailed']);
export type LengthMode = z.infer<typeof lengthModeSchema>;

export const appSettingsSchema = z.object({
  schemaVersion: z.literal(2),
  onboardingComplete: z.boolean(),
  analysisConsent: z.boolean(),
  riskAcknowledged: z.boolean(),
  rememberCredential: z.boolean(),
  preferredLanguage: z.string().max(80).optional(),
  lengthMode: lengthModeSchema,
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultSettings: AppSettings = {
  schemaVersion: 2,
  onboardingComplete: false,
  analysisConsent: false,
  riskAcknowledged: false,
  rememberCredential: false,
  lengthMode: 'standard',
};

export const analysisErrorCodeSchema = z.enum([
  'busy',
  'context-overflow',
  'credential-missing',
  'permission-missing',
  'provider-auth',
  'provider-balance',
  'provider-rate-limit',
  'provider-response-invalid',
  'provider-unavailable',
  'unsupported-layout',
  'unknown',
]);
export type AnalysisErrorCode = z.infer<typeof analysisErrorCodeSchema>;

export const analysisStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle') }),
  z.object({
    status: z.literal('running'),
    requestId: z.string(),
    targetType: responseTargetTypeSchema,
    excerpt: z.string().max(280),
    startedAt: z.iso.datetime(),
  }),
  z.object({
    status: z.literal('success'),
    requestId: z.string(),
    context: postContextSchema,
    result: analysisResultSchema,
  }),
  z.object({
    status: z.literal('error'),
    requestId: z.string().optional(),
    code: analysisErrorCodeSchema,
    message: z.string(),
  }),
]);
export type AnalysisState = z.infer<typeof analysisStateSchema>;
