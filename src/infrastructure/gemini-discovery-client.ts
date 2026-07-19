import { z } from 'zod';
import type { DiscoveryProvider } from '../application/discovery-provider';
import { buildAssessmentPrompt, buildPublicationPrompt } from '../application/discovery-prompt';
import { AppError } from '../application/errors';
import { MODEL_REGISTRY } from '../application/models';
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

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = MODEL_REGISTRY.drafting.primary;

const assessmentSchema = z.object({
  assessments: z.array(opportunityAssessmentSchema).min(1).max(25),
});
const draftSchema = z.object({
  drafts: z
    .array(
      z.object({
        candidateId: z.string().min(1),
        text: z.string().min(1).max(6000),
        language: z.string().min(1).max(80),
      }),
    )
    .min(1)
    .max(3),
});
const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).min(1) }),
        finishReason: z.string().optional(),
      }),
    )
    .min(1),
});

export class GeminiDiscoveryClient implements DiscoveryProvider {
  async assess(
    apiKey: string,
    evidence: SourceEvidence[],
    profile: EngagementProfile | null,
    settings: DiscoverySettings,
    signal: AbortSignal,
  ): Promise<Map<string, OpportunityAssessment>> {
    const prompt = buildAssessmentPrompt(evidence, profile, settings);
    const value = assessmentSchema.parse(
      await this.generate(apiKey, prompt.system, prompt.user, assessmentJsonSchema, signal, 8_000),
    );
    const labels = new Map(prompt.candidates.map(({ label, evidence: item }) => [label, item.id]));
    const result = new Map<string, OpportunityAssessment>();
    for (const assessment of value.assessments) {
      const id = labels.get(assessment.candidateId);
      if (id && !result.has(id)) result.set(id, { ...assessment, candidateId: id });
    }
    if (result.size !== evidence.length)
      throw new AppError(
        'provider-response-invalid',
        'Gemini did not assess every discovery candidate.',
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
    const value = draftSchema.parse(
      await this.generate(apiKey, prompt.system, prompt.user, draftJsonSchema, signal, 6_000),
    );
    const labels = new Map(
      prompt.candidates.map(({ label, opportunity }) => [label, opportunity.id]),
    );
    const result = new Map<string, PublicationDraft>();
    const now = new Date().toISOString();
    for (const item of value.drafts) {
      const id = labels.get(item.candidateId);
      if (!id || result.has(id)) continue;
      result.set(
        id,
        publicationDraftSchema.parse({
          text: normalizeDraftText(item.text, settings),
          language: item.language,
          model: MODEL,
          generatedAt: now,
        }),
      );
    }
    if (result.size !== opportunities.length)
      throw new AppError(
        'provider-response-invalid',
        'Gemini did not return every requested draft.',
      );
    return result;
  }

  private async generate(
    apiKey: string,
    system: string,
    user: string,
    jsonSchema: Record<string, unknown>,
    externalSignal: AbortSignal,
    maxOutputTokens: number,
  ): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    externalSignal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 120_000);
    try {
      const response = await fetch(`${API_ROOT}/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: jsonSchema,
            maxOutputTokens,
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
        }),
        signal: controller.signal,
      });
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok) throw mapError(response.status, raw, response.headers);
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success)
        throw new AppError('provider-response-invalid', 'Gemini returned an unreadable response.');
      const candidate = parsed.data.candidates[0];
      if (!candidate || candidate.finishReason === 'MAX_TOKENS')
        throw new AppError(
          'provider-response-invalid',
          'Gemini could not complete the discovery response.',
        );
      const content = candidate.content.parts
        .map((part) => part.text ?? '')
        .join('')
        .trim();
      if (!content)
        throw new AppError('provider-response-invalid', 'Gemini returned no discovery result.');
      try {
        return JSON.parse(content);
      } catch {
        throw new AppError('provider-response-invalid', 'Gemini returned invalid discovery JSON.');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (externalSignal.aborted) throw new DOMException('Discovery cancelled.', 'AbortError');
      throw new AppError(
        'provider-unavailable',
        'Gemini could not be reached for the manual override.',
        true,
      );
    } finally {
      clearTimeout(timeout);
      externalSignal.removeEventListener('abort', abort);
    }
  }
}

const assessmentProperties = {
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
  properties: {
    assessments: {
      type: 'array',
      minItems: 1,
      maxItems: 25,
      items: {
        type: 'object',
        properties: assessmentProperties,
        required: Object.keys(assessmentProperties),
      },
    },
  },
  required: ['assessments'],
} as const;

const draftJsonSchema = {
  type: 'object',
  properties: {
    drafts: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
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

function normalizeDraftText(text: string, settings: DiscoverySettings): string {
  let value = text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  if (!settings.allowHashtags) value = value.replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, '$1').trim();
  if (!settings.allowEmoji) value = value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
  return value;
}

function mapError(status: number, payload: unknown, headers: Headers): AppError {
  if (status === 401 || status === 403)
    return new AppError('provider-auth', 'Gemini rejected the saved key.');
  if (status === 429) {
    const retryAfter = headers.get('retry-after');
    return new AppError(
      'provider-rate-limit',
      `Gemini's quota limit was reached.${retryAfter ? ` Retry after ${retryAfter} seconds.` : ''}`,
      true,
    );
  }
  if (status >= 500)
    return new AppError('provider-unavailable', 'Gemini is temporarily unavailable.', true);
  return new AppError(
    'provider-response-invalid',
    providerMessage(payload) || 'Gemini rejected the discovery override.',
  );
}

function providerMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== 'object') return '';
  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' ? message.slice(0, 240) : '';
}
