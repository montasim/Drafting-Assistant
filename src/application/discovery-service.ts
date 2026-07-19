import { AppError, toAppError } from './errors';
import { chooseDraftOpportunities, sortAssessments } from './discovery-prompt';
import {
  discoveryResultSchema,
  publicationHistoryEntrySchema,
  type DiscoveryResult,
  type DiscoverySettings,
  type DiscoveryStage,
  type OpportunityAssessment,
  type PostOpportunity,
  type PublicationDraft,
  type SourceEvidence,
} from '../domain/discovery';
import { collectDiscoveryEvidence, fingerprintUrl } from '../infrastructure/discovery-sources';
import type { ExtensionStorage } from '../infrastructure/storage';
import { getDiscoveryPermissions } from '../infrastructure/discovery-permission';
import type { DiscoveryProvider, VoiceProvider } from './discovery-provider';

type StageUpdater = (stage: DiscoveryStage) => Promise<void>;

export async function runDiscovery(
  runId: string,
  storage: ExtensionStorage,
  provider: DiscoveryProvider,
  signal: AbortSignal,
  updateStage: StageUpdater,
  overrideApiKey?: string,
  skipAutomaticDrafts = false,
): Promise<DiscoveryResult> {
  const [settings, profile, voice, apiKey, seenItems] = await Promise.all([
    storage.getDiscoverySettings(),
    storage.getProfile(),
    storage.getVoiceSettings(),
    storage.getDiscoveryCredential(),
    storage.listSeenItems(),
  ]);
  const providerApiKey = overrideApiKey ?? apiKey;
  validateSetup(settings, providerApiKey);
  const permissions = await getDiscoveryPermissions();
  if (!permissions.groq)
    throw new AppError('permission-missing', 'Grant Groq access in Discovery Settings.');
  const missingPermissionErrors: DiscoveryResult['sourceErrors'] = {};
  const effectiveSettings: DiscoverySettings = {
    ...settings,
    sources: { ...settings.sources },
  };
  for (const [source, preference] of Object.entries(settings.sources)) {
    const sourceId = source as keyof DiscoverySettings['sources'];
    if (preference.enabled && !permissions[sourceId]) {
      effectiveSettings.sources[sourceId] = { ...preference, enabled: false };
      missingPermissionErrors[sourceId] = 'Chrome access has not been granted for this source.';
    }
  }
  if (!Object.values(effectiveSettings.sources).some(({ enabled }) => enabled))
    throw new AppError(
      'permission-missing',
      'Grant access to at least one enabled discovery source.',
    );
  await updateStage('collecting');
  const collection = await collectDiscoveryEvidence(effectiveSettings, seenItems, signal);
  collection.errors = { ...missingPermissionErrors, ...collection.errors };
  throwIfAborted(signal);
  await updateStage('deduplicating');

  if (collection.evidence.length === 0) {
    return discoveryResultSchema.parse({
      runId,
      completedAt: new Date().toISOString(),
      opportunities: [],
      sourceErrors: collection.errors,
    });
  }

  await updateStage('assessing');
  let combinedDrafts: Map<string, PublicationDraft> | null = null;
  let assessments: Map<string, OpportunityAssessment>;
  if (!skipAutomaticDrafts && provider.assessAndCreateDrafts) {
    const combined = await provider.assessAndCreateDrafts(
      providerApiKey,
      collection.evidence,
      profile,
      settings,
      voice,
      signal,
    );
    assessments = combined.assessments;
    combinedDrafts = combined.drafts;
  } else {
    assessments = await provider.assess(
      providerApiKey,
      collection.evidence,
      profile,
      settings,
      signal,
    );
  }
  throwIfAborted(signal);
  const assessed = collection.evidence.map((evidence) => {
    const assessment = assessments.get(evidence.id);
    if (!assessment)
      throw new AppError('provider-response-invalid', 'A discovery assessment was missing.');
    const ageDays = (Date.now() - Date.parse(evidence.publishedAt)) / 86_400_000;
    const locallyConstrained =
      assessment.type === 'timely-trend' && ageDays > 7
        ? {
            ...assessment,
            rating: 'skip' as const,
            sufficientEvidence: false,
            uncertainty: 'This trend is older than the seven-day freshness boundary.',
          }
        : assessment;
    return { evidence, assessment: locallyConstrained };
  });
  const opportunities: PostOpportunity[] = sortAssessments(assessed).map(
    ({ evidence, assessment }) => ({
      id: evidence.id,
      reference: evidence.reference,
      publishedAt: evidence.publishedAt,
      tags: evidence.tags,
      assessment,
    }),
  );

  if (combinedDrafts) {
    await updateStage('drafting');
    for (const opportunity of opportunities) {
      if (opportunity.assessment.rating === 'skip' || !opportunity.assessment.sufficientEvidence)
        continue;
      const draft = combinedDrafts.get(opportunity.id);
      if (draft) opportunity.draft = draft;
    }
  }

  const selected =
    skipAutomaticDrafts || combinedDrafts ? [] : chooseDraftOpportunities(opportunities);
  let draftError: string | undefined;
  if (selected.length > 0) {
    await updateStage('drafting');
    const evidenceById = new Map<string, SourceEvidence>(
      collection.evidence.map((item) => [item.id, item]),
    );
    try {
      const drafts = await provider.createDrafts(
        providerApiKey,
        selected,
        profile,
        settings,
        voice,
        signal,
        undefined,
        evidenceById,
      );
      for (const opportunity of opportunities) {
        const draft = drafts.get(opportunity.id);
        if (draft) opportunity.draft = draft;
      }
    } catch (error) {
      if (signal.aborted) throw error;
      draftError = toAppError(error).message;
    }
  }

  return discoveryResultSchema.parse({
    runId,
    completedAt: new Date().toISOString(),
    opportunities,
    sourceErrors: collection.errors,
    ...(draftError ? { draftError } : {}),
  });
}

export async function persistCompletedDiscovery(
  storage: ExtensionStorage,
  result: DiscoveryResult,
): Promise<void> {
  await storage.saveDiscoveryResult(result);
  for (const opportunity of result.opportunities) {
    if (!opportunity.draft) continue;
    await storage.addPublicationHistory(
      publicationHistoryEntrySchema.parse({
        id: crypto.randomUUID(),
        opportunityId: opportunity.id,
        reference: opportunity.reference,
        assessment: opportunity.assessment,
        draft: opportunity.draft,
        createdAt: opportunity.draft.generatedAt,
      }),
    );
  }
  const fingerprints = await Promise.all(
    result.opportunities.map(({ reference }) => fingerprintUrl(reference.url)),
  );
  await storage.addSeenItems(fingerprints);
}

export async function generateOpportunityDraft(
  opportunityId: string,
  alternative: boolean,
  storage: ExtensionStorage,
  provider: DiscoveryProvider,
  signal: AbortSignal,
  overrideApiKey?: string,
): Promise<void> {
  const [result, settings, profile, voice, apiKey] = await Promise.all([
    storage.getDiscoveryResult(),
    storage.getDiscoverySettings(),
    storage.getProfile(),
    storage.getVoiceSettings(),
    storage.getDiscoveryCredential(),
  ]);
  const providerApiKey = overrideApiKey ?? apiKey;
  validateSetup(settings, providerApiKey);
  const opportunity = result?.opportunities.find(({ id }) => id === opportunityId);
  if (!result || !opportunity)
    throw new AppError('unknown', 'This discovery opportunity is no longer available.');
  if (opportunity.assessment.rating === 'skip' || !opportunity.assessment.sufficientEvidence)
    throw new AppError('provider-response-invalid', 'This opportunity lacks sufficient evidence.');
  const previousDraft = alternative ? opportunity.draft?.text : undefined;
  const drafts = await provider.createDrafts(
    providerApiKey,
    [opportunity],
    profile,
    settings,
    voice,
    signal,
    previousDraft,
  );
  const draft = drafts.get(opportunity.id);
  if (!draft) throw new AppError('provider-response-invalid', 'The publication draft was missing.');
  const next: DiscoveryResult = {
    ...result,
    opportunities: result.opportunities.map((item) =>
      item.id === opportunity.id ? { ...item, draft } : item,
    ),
  };
  await storage.saveDiscoveryResult(next);
  await storage.addPublicationHistory(
    publicationHistoryEntrySchema.parse({
      id: crypto.randomUUID(),
      opportunityId: opportunity.id,
      reference: opportunity.reference,
      assessment: opportunity.assessment,
      draft,
      createdAt: draft.generatedAt,
    }),
  );
}

export async function analyzeAndSaveVoice(
  samples: string[],
  storage: ExtensionStorage,
  provider: VoiceProvider,
  signal: AbortSignal,
): Promise<string> {
  const normalized = samples
    .map((sample) => sample.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (normalized.length === 0)
    throw new AppError('provider-response-invalid', 'Add at least one voice sample first.');
  const apiKey = await storage.getDiscoveryCredential();
  if (!apiKey) throw new AppError('credential-missing', 'Save a Groq API key first.');
  const guide = await provider.analyzeVoice(apiKey, normalized, signal);
  const previous = await storage.getVoiceSettings();
  await storage.saveVoiceSettings({
    ...previous,
    samples: normalized,
    guide,
    enabled: true,
    updatedAt: new Date().toISOString(),
  });
  return guide;
}

export function discoveryFailure(error: unknown): { code: string; message: string } {
  const appError = toAppError(error);
  return { code: appError.code, message: appError.message };
}

function validateSetup(
  settings: DiscoverySettings,
  apiKey: string | null | undefined,
): asserts apiKey is string {
  if (!settings.enabled || !settings.consent)
    throw new AppError(
      'permission-missing',
      'Enable discovery and accept its consent in Settings.',
    );
  if (!apiKey) throw new AppError('credential-missing', 'Save a Groq API key in Settings.');
  if (!Object.values(settings.sources).some(({ enabled }) => enabled))
    throw new AppError('permission-missing', 'Enable at least one discovery source.');
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Discovery cancelled.', 'AbortError');
}
