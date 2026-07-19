import { z } from 'zod';
import { AppError } from '../application/errors';
import {
  buildAssessmentPrompt,
  buildCombinedDiscoveryPrompt,
  buildPublicationPrompt,
  buildVoiceGuidePrompt,
} from '../application/discovery-prompt';
import type { EngagementProfile } from '../domain/schemas';
import {
  opportunityAssessmentSchema,
  publicationDraftSchema,
  type DiscoverySettings,
  type OpportunityAssessment,
  type PostOpportunity,
  type PublicationDraft,
  type SourceEvidence,
  type VoiceSettings,
} from '../domain/discovery';

const API_ROOT = 'https://api.groq.com/openai/v1';
export const GROQ_DISCOVERY_MODEL = 'openai/gpt-oss-120b';
const GROQ_FREE_TPM_REQUEST_BUDGET = 7_000;

const assessmentResponseSchema = z.object({
  assessments: z.array(opportunityAssessmentSchema).min(1).max(25),
});

const draftResponseSchema = z.object({
  drafts: z
    .array(
      z.object({
        candidateId: z.string().min(1).max(200),
        text: z.string().min(1).max(6000),
        language: z.string().min(1).max(80),
      }),
    )
    .min(1)
    .max(3),
});

const combinedResponseSchema = z.object({
  assessments: z.array(opportunityAssessmentSchema).min(1).max(25),
  drafts: z
    .array(
      z.object({
        candidateId: z.string().min(1).max(200),
        text: z.string().min(1).max(6000),
        language: z.string().min(1).max(80),
      }),
    )
    .max(3),
});

const voiceResponseSchema = z.object({ guide: z.string().min(1).max(3000) });

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  model: z.string().optional(),
});

export class GroqClient {
  async validateCredential(apiKey: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${API_ROOT}/models/${GROQ_DISCOVERY_MODEL}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      if (response.ok) return true;
      if (response.status === 400 || response.status === 401 || response.status === 403)
        return false;
      throw providerError(
        response.status,
        await response.json().catch(() => null),
        response.headers,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailableError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async assessAndCreateDrafts(
    apiKey: string,
    evidence: SourceEvidence[],
    profile: EngagementProfile | null,
    settings: DiscoverySettings,
    voice: VoiceSettings,
    signal: AbortSignal,
  ): Promise<{
    assessments: Map<string, OpportunityAssessment>;
    drafts: Map<string, PublicationDraft>;
  }> {
    const prompt = buildCombinedDiscoveryPrompt(evidence, profile, settings, voice);
    const payload = await this.chat(
      apiKey,
      prompt.system,
      prompt.user,
      'discovery_assessments_and_drafts',
      combinedJsonSchema,
      signal,
      4_000,
    );
    const parsed = combinedResponseSchema.safeParse(payload.content);
    if (!parsed.success)
      throw new AppError(
        'provider-response-invalid',
        'Groq returned combined discovery results that failed local validation.',
      );
    const labels = new Map(prompt.candidates.map(({ label, evidence: item }) => [label, item.id]));
    const assessments = new Map<string, OpportunityAssessment>();
    for (const assessment of parsed.data.assessments) {
      const evidenceId = labels.get(assessment.candidateId);
      if (!evidenceId || assessments.has(evidenceId)) continue;
      assessments.set(evidenceId, { ...assessment, candidateId: evidenceId });
    }
    if (assessments.size !== evidence.length)
      throw new AppError(
        'provider-response-invalid',
        'Groq did not assess every discovery candidate. No partial result was saved.',
      );
    const drafts = new Map<string, PublicationDraft>();
    const now = new Date().toISOString();
    for (const draft of parsed.data.drafts) {
      const evidenceId = labels.get(draft.candidateId);
      const assessment = evidenceId ? assessments.get(evidenceId) : undefined;
      if (
        !evidenceId ||
        !assessment ||
        assessment.rating === 'skip' ||
        !assessment.sufficientEvidence ||
        drafts.has(evidenceId)
      )
        continue;
      drafts.set(
        evidenceId,
        publicationDraftSchema.parse({
          text: normalizeDraftText(draft.text, settings),
          language: draft.language,
          model: payload.model,
          generatedAt: now,
        }),
      );
    }
    return { assessments, drafts };
  }

  async assess(
    apiKey: string,
    evidence: SourceEvidence[],
    profile: EngagementProfile | null,
    settings: DiscoverySettings,
    signal: AbortSignal,
  ): Promise<Map<string, OpportunityAssessment>> {
    const prompt = buildAssessmentPrompt(evidence, profile, settings);
    const payload = await this.chat(
      apiKey,
      prompt.system,
      prompt.user,
      'post_opportunity_assessments',
      assessmentJsonSchema,
      signal,
      2_400,
    );
    const parsed = assessmentResponseSchema.safeParse(payload.content);
    if (!parsed.success)
      throw new AppError(
        'provider-response-invalid',
        'Groq returned assessments that failed local validation.',
      );
    const labelToEvidence = new Map(
      prompt.candidates.map(({ label, evidence: item }) => [label, item.id]),
    );
    const result = new Map<string, OpportunityAssessment>();
    for (const assessment of parsed.data.assessments) {
      const evidenceId = labelToEvidence.get(assessment.candidateId);
      if (!evidenceId || result.has(evidenceId)) continue;
      result.set(evidenceId, { ...assessment, candidateId: evidenceId });
    }
    if (result.size !== evidence.length)
      throw new AppError(
        'provider-response-invalid',
        'Groq did not assess every discovery candidate. No partial assessment was saved.',
      );
    return result;
  }

  async createDrafts(
    apiKey: string,
    opportunities: PostOpportunity[],
    profile: EngagementProfile | null,
    settings: DiscoverySettings,
    voice: VoiceSettings,
    signal: AbortSignal,
    previousDraft?: string,
    evidenceById?: Map<string, SourceEvidence>,
  ): Promise<Map<string, PublicationDraft>> {
    const prompt = buildPublicationPrompt(
      opportunities,
      profile,
      settings,
      voice,
      previousDraft,
      evidenceById,
    );
    const payload = await this.chat(
      apiKey,
      prompt.system,
      prompt.user,
      'publication_drafts',
      publicationJsonSchema,
      signal,
      2_600,
    );
    const parsed = draftResponseSchema.safeParse(payload.content);
    if (!parsed.success)
      throw new AppError(
        'provider-response-invalid',
        'Groq returned publication drafts that failed local validation.',
      );
    const labels = new Map(
      prompt.candidates.map(({ label, opportunity }) => [label, opportunity.id]),
    );
    const now = new Date().toISOString();
    const result = new Map<string, PublicationDraft>();
    for (const draft of parsed.data.drafts) {
      const opportunityId = labels.get(draft.candidateId);
      if (!opportunityId || result.has(opportunityId)) continue;
      result.set(
        opportunityId,
        publicationDraftSchema.parse({
          text: normalizeDraftText(draft.text, settings),
          language: draft.language,
          model: payload.model,
          generatedAt: now,
        }),
      );
    }
    if (result.size !== opportunities.length)
      throw new AppError(
        'provider-response-invalid',
        'Groq did not return every requested publication draft.',
      );
    return result;
  }

  async analyzeVoice(apiKey: string, samples: string[], signal: AbortSignal): Promise<string> {
    const prompt = buildVoiceGuidePrompt(samples);
    const payload = await this.chat(
      apiKey,
      prompt.system,
      prompt.user,
      'voice_guide',
      voiceGuideJsonSchema,
      signal,
      1_200,
    );
    const parsed = voiceResponseSchema.safeParse(payload.content);
    if (!parsed.success)
      throw new AppError('provider-response-invalid', 'Groq returned an invalid Voice Guide.');
    return parsed.data.guide.trim();
  }

  private async chat(
    apiKey: string,
    system: string,
    user: string,
    schemaName: string,
    schema: Record<string, unknown>,
    externalSignal: AbortSignal,
    maxCompletionTokens: number,
  ): Promise<{ content: unknown; model: string }> {
    const estimatedInputTokens = estimateTokens(system, user);
    const availableCompletionTokens = GROQ_FREE_TPM_REQUEST_BUDGET - estimatedInputTokens;
    if (availableCompletionTokens < 1_000)
      throw new AppError(
        'context-overflow',
        'This discovery request is too large for Groq’s free 8,000 TPM limit. Lower the per-source result targets or shorten the Voice Guide, then run it again.',
      );
    const budgetedCompletionTokens = Math.min(maxCompletionTokens, availableCompletionTokens);
    const controller = new AbortController();
    const abort = () => controller.abort();
    externalSignal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 120_000);
    try {
      const response = await fetch(`${API_ROOT}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_DISCOVERY_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.35,
          max_completion_tokens: budgetedCompletionTokens,
          response_format: {
            type: 'json_schema',
            json_schema: { name: schemaName, strict: true, schema },
          },
        }),
        signal: controller.signal,
      });
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok) throw providerError(response.status, raw, response.headers);
      const parsed = chatResponseSchema.safeParse(raw);
      if (!parsed.success)
        throw new AppError('provider-response-invalid', 'Groq returned an unreadable response.');
      const choice = parsed.data.choices[0];
      if (!choice || choice.finish_reason === 'length' || !choice.message.content)
        throw new AppError(
          'provider-response-invalid',
          'Groq could not complete the structured response.',
        );
      return {
        content: parseJson(choice.message.content),
        model: parsed.data.model?.trim() ? parsed.data.model : GROQ_DISCOVERY_MODEL,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (externalSignal.aborted) throw new DOMException('Discovery cancelled.', 'AbortError');
      throw unavailableError(error);
    } finally {
      clearTimeout(timeout);
      externalSignal.removeEventListener('abort', abort);
    }
  }
}

const assessmentItemProperties = {
  candidateId: { type: 'string' },
  rating: { type: 'string', enum: ['strong', 'consider', 'skip'] },
  type: { type: 'string', enum: ['timely-trend', 'practical-learning', 'general-fit'] },
  sufficientEvidence: { type: 'boolean' },
  relevance: { type: 'string' },
  audienceFit: { type: 'string' },
  discussionValue: { type: 'string' },
  credibilityRisk: { type: 'string' },
  uncertainty: { type: 'string' },
} as const;

const assessmentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assessments: {
      type: 'array',
      minItems: 1,
      maxItems: 25,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: assessmentItemProperties,
        required: Object.keys(assessmentItemProperties),
      },
    },
  },
  required: ['assessments'],
} as const;

const publicationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    drafts: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          candidateId: { type: 'string' },
          text: { type: 'string' },
          language: { type: 'string' },
        },
        required: ['candidateId', 'text', 'language'],
      },
    },
  },
  required: ['drafts'],
} as const;

const combinedJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assessments: assessmentJsonSchema.properties.assessments,
    drafts: {
      ...publicationJsonSchema.properties.drafts,
      minItems: 0,
    },
  },
  required: ['assessments', 'drafts'],
} as const;

const voiceGuideJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { guide: { type: 'string' } },
  required: ['guide'],
} as const;

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError('provider-response-invalid', 'Groq returned invalid JSON.');
  }
}

function normalizeDraftText(text: string, settings: DiscoverySettings): string {
  let value = text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  if (!settings.allowHashtags)
    value = value
      .replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, '$1')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  if (!settings.allowEmoji)
    value = value
      .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
      .replace(/ {2,}/g, ' ')
      .trim();
  return value;
}

function providerError(status: number, payload: unknown, headers: Headers): AppError {
  const message = providerMessage(payload);
  if (/request too large|tokens per minute|\btpm\b/i.test(message))
    return new AppError(
      'context-overflow',
      'The request exceeded Groq’s free 8,000 TPM ceiling. The extension did not retry it. Lower the per-source result targets or shorten the Voice Guide, then try again.',
    );
  if (status === 401 || status === 403)
    return new AppError('provider-auth', 'Groq rejected the API key. Update it in Settings.');
  if (status === 429) {
    const retryAfter = headers.get('retry-after');
    return new AppError(
      'provider-rate-limit',
      `Groq's free-tier limit was reached.${retryAfter ? ` Try again after ${retryAfter} seconds.` : ' Try again after the quota resets.'}`,
      true,
    );
  }
  if (status >= 500)
    return new AppError('provider-unavailable', 'Groq is temporarily unavailable.', true);
  return new AppError(
    'provider-response-invalid',
    message ? `Groq rejected the request: ${message}` : 'Groq rejected the discovery request.',
  );
}

function estimateTokens(...parts: string[]): number {
  return Math.ceil(parts.reduce((total, part) => total + part.length, 0) / 3);
}

function providerMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== 'object') return '';
  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' ? message.slice(0, 240) : '';
}

function unavailableError(error: unknown): AppError {
  const timedOut = error instanceof DOMException && error.name === 'AbortError';
  return new AppError(
    'provider-unavailable',
    timedOut ? 'Groq did not respond before the request timed out.' : 'Groq could not be reached.',
    true,
  );
}
