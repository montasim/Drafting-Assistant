import { z } from 'zod';

export const discoverySourceIdSchema = z.enum([
  'hacker-news',
  'dev',
  'medium',
  'lobsters',
  'stack-overflow',
]);
export type DiscoverySourceId = z.infer<typeof discoverySourceIdSchema>;

export const DISCOVERY_SOURCE_IDS = discoverySourceIdSchema.options;

export const sourcePreferenceSchema = z.object({
  enabled: z.boolean(),
  limit: z.number().int().min(1).max(5),
});
export type SourcePreference = z.infer<typeof sourcePreferenceSchema>;

const defaultSourcePreferences = Object.fromEntries(
  DISCOVERY_SOURCE_IDS.map((source) => [source, { enabled: true, limit: 3 }]),
) as Record<DiscoverySourceId, SourcePreference>;

export const publicationLengthSchema = z.enum(['short', 'standard', 'detailed']);
export type PublicationLength = z.infer<typeof publicationLengthSchema>;

export const discoverySettingsSchema = z.object({
  schemaVersion: z.literal(1),
  enabled: z.boolean(),
  consent: z.boolean(),
  rememberCredential: z.boolean(),
  sources: z.record(discoverySourceIdSchema, sourcePreferenceSchema),
  topics: z.array(z.string().trim().min(1).max(80)).max(10),
  topicsInitialized: z.boolean(),
  publicationLength: publicationLengthSchema,
  publicationLanguage: z.string().trim().max(80).optional(),
  allowEmoji: z.boolean(),
  allowHashtags: z.boolean(),
});
export type DiscoverySettings = z.infer<typeof discoverySettingsSchema>;

export const defaultDiscoverySettings: DiscoverySettings = {
  schemaVersion: 1,
  enabled: false,
  consent: false,
  rememberCredential: false,
  sources: defaultSourcePreferences,
  topics: [],
  topicsInitialized: false,
  publicationLength: 'standard',
  allowEmoji: false,
  allowHashtags: false,
};

export const voiceSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  enabled: z.boolean(),
  samples: z.array(z.string().trim().min(1).max(5000)).max(5),
  guide: z.string().trim().max(3000),
  updatedAt: z.iso.datetime().optional(),
});
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

export const defaultVoiceSettings: VoiceSettings = {
  schemaVersion: 1,
  enabled: true,
  samples: [],
  guide: '',
};

export const sourceReferenceSchema = z.object({
  source: discoverySourceIdSchema,
  title: z.string().min(1).max(500),
  url: z.url().max(2000),
});
export type SourceReference = z.infer<typeof sourceReferenceSchema>;

export const sourceEvidenceSchema = z.object({
  id: z.string().min(1).max(200),
  source: discoverySourceIdSchema,
  title: z.string().min(1).max(500),
  excerpt: z.string().max(1200),
  tags: z.array(z.string().min(1).max(80)).max(20),
  publishedAt: z.iso.datetime(),
  engagement: z.object({
    score: z.number().nonnegative().optional(),
    comments: z.number().int().nonnegative().optional(),
    reactions: z.number().int().nonnegative().optional(),
    views: z.number().int().nonnegative().optional(),
  }),
  reference: sourceReferenceSchema,
});
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;

export const opportunityRatingSchema = z.enum(['strong', 'consider', 'skip']);
export const opportunityTypeSchema = z.enum(['timely-trend', 'practical-learning', 'general-fit']);
export type OpportunityRating = z.infer<typeof opportunityRatingSchema>;
export type OpportunityType = z.infer<typeof opportunityTypeSchema>;

export const opportunityAssessmentSchema = z.object({
  candidateId: z.string().min(1).max(200),
  rating: opportunityRatingSchema,
  type: opportunityTypeSchema,
  sufficientEvidence: z.boolean(),
  relevance: z.string().min(1).max(500),
  audienceFit: z.string().min(1).max(500),
  discussionValue: z.string().min(1).max(500),
  credibilityRisk: z.string().min(1).max(500),
  uncertainty: z.string().max(500),
});
export type OpportunityAssessment = z.infer<typeof opportunityAssessmentSchema>;

export const publicationDraftSchema = z.object({
  text: z.string().min(1).max(6000),
  language: z.string().min(1).max(80),
  model: z.string().min(1).max(160),
  generatedAt: z.iso.datetime(),
});
export type PublicationDraft = z.infer<typeof publicationDraftSchema>;

export const postOpportunitySchema = z.object({
  id: z.string().min(1),
  reference: sourceReferenceSchema,
  publishedAt: z.iso.datetime(),
  tags: z.array(z.string().min(1).max(80)).max(20),
  assessment: opportunityAssessmentSchema,
  draft: publicationDraftSchema.optional(),
});
export type PostOpportunity = z.infer<typeof postOpportunitySchema>;

export const discoveryResultSchema = z.object({
  runId: z.string().min(1),
  completedAt: z.iso.datetime(),
  opportunities: z.array(postOpportunitySchema).max(25),
  sourceErrors: z.partialRecord(discoverySourceIdSchema, z.string().max(500)),
  draftError: z.string().max(1000).optional(),
});
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;

export const discoveryStageSchema = z.enum([
  'collecting',
  'deduplicating',
  'assessing',
  'drafting',
]);
export type DiscoveryStage = z.infer<typeof discoveryStageSchema>;
export const discoveryStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle') }),
  z.object({
    status: z.literal('running'),
    runId: z.string().min(1),
    stage: discoveryStageSchema,
    startedAt: z.iso.datetime(),
  }),
  z.object({
    status: z.literal('success'),
    runId: z.string().min(1),
    completedAt: z.iso.datetime(),
  }),
  z.object({
    status: z.literal('error'),
    runId: z.string().optional(),
    code: z.string().min(1),
    message: z.string().min(1).max(1000),
  }),
]);
export type DiscoveryState = z.infer<typeof discoveryStateSchema>;

export const publicationHistoryEntrySchema = z.object({
  id: z.string().min(1),
  opportunityId: z.string().min(1),
  reference: sourceReferenceSchema,
  assessment: opportunityAssessmentSchema,
  draft: publicationDraftSchema,
  createdAt: z.iso.datetime(),
});
export type PublicationHistoryEntry = z.infer<typeof publicationHistoryEntrySchema>;

export const seenItemSchema = z.object({
  fingerprint: z.string().min(1).max(200),
  seenAt: z.iso.datetime(),
});
export type SeenItem = z.infer<typeof seenItemSchema>;

export function deriveDiscoveryTopics(
  profile: {
    expertise: string[];
    industries: string[];
    role: string;
  } | null,
): string[] {
  if (!profile) return [];
  return [...profile.expertise, ...profile.industries, profile.role]
    .map((value) => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
    .slice(0, 10);
}
