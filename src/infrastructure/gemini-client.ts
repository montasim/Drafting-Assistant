import { z } from 'zod';
import type { AiProvider } from '../application/ai-provider';
import { AppError } from '../application/errors';
import { MODEL_REGISTRY, type ModelRoute } from '../application/models';
import { buildDraftPrompt, buildProfilePrompt } from '../application/prompt';
import {
  analysisResultSchema,
  currentDraftSetSchema,
  engagementProfileSchema,
  type AnalysisResult,
  type AppSettings,
  type EngagementProfile,
  type PostContext,
} from '../domain/schemas';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const outputSchema = analysisResultSchema
  .omit({ model: true, generatedAt: true })
  .extend({ drafts: currentDraftSetSchema });
const profileOutputSchema = engagementProfileSchema.omit({
  schemaVersion: true,
  source: true,
  updatedAt: true,
  allowEmoji: true,
  allowHashtags: true,
});

const draftResponseSchema = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'integer', minimum: 1, maximum: 1 },
    summary: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        themes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
        intent: { type: 'string' },
        uncertainties: { type: 'array', items: { type: 'string' }, maxItems: 8 },
        risks: {
          type: 'array',
          maxItems: 8,
          items: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['professional', 'privacy', 'safety', 'credibility', 'regulated-claim'],
              },
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              description: { type: 'string' },
            },
            required: ['category', 'severity', 'description'],
          },
        },
      },
      required: ['overview', 'themes', 'intent', 'uncertainties', 'risks'],
    },
    drafts: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          strategy: {
            type: 'string',
            enum: [
              'professional-insight',
              'specific-question',
              'support-and-extend',
              'constructive-challenge',
            ],
          },
          text: { type: 'string' },
        },
        required: ['strategy', 'text'],
      },
    },
    language: { type: 'string' },
  },
  required: ['schemaVersion', 'summary', 'drafts', 'language'],
} as const;

const profileResponseSchema = {
  type: 'object',
  properties: {
    role: { type: 'string' },
    industries: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    expertise: { type: 'array', items: { type: 'string' }, maxItems: 24 },
    audience: { type: 'string' },
    goals: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    tone: { type: 'string' },
    preferredLanguage: { type: 'string' },
    topicsToAvoid: { type: 'array', items: { type: 'string' }, maxItems: 24 },
  },
  required: [
    'role',
    'industries',
    'expertise',
    'audience',
    'goals',
    'tone',
    'preferredLanguage',
    'topicsToAvoid',
  ],
} as const;

const generateResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })).min(1),
        }),
        finishReason: z.string().optional(),
      }),
    )
    .min(1),
});

interface GenerationBody {
  contents: { role?: string; parts: Record<string, unknown>[] }[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig: {
    responseMimeType: 'application/json';
    maxOutputTokens: number;
    thinkingConfig: { thinkingLevel: 'minimal' };
    responseSchema: Record<string, unknown>;
  };
}

export class GeminiClient implements AiProvider {
  async validateCredential(apiKey: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${API_ROOT}/models/${MODEL_REGISTRY.drafting.primary}`, {
        headers: { 'x-goog-api-key': apiKey },
        signal: controller.signal,
      });
      if (response.ok) return true;
      const payload: unknown = await response.json().catch(() => null);
      const error = mapProviderError(response.status, payload);
      if (response.status === 400 || response.status === 401) return false;
      throw error;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailableError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async analyze(
    apiKey: string,
    context: PostContext,
    profile: EngagementProfile | null,
    settings: AppSettings,
  ): Promise<AnalysisResult> {
    const prompt = buildDraftPrompt(context, profile, settings);
    const inputSize = prompt.system.length + prompt.user.length;
    if (Math.ceil(inputSize / 3) + 4_000 > MODEL_REGISTRY.drafting.contextTokens) {
      throw new AppError(
        'context-overflow',
        'The visible discussion is too large for Gemini. Nothing was sent.',
      );
    }

    const body: GenerationBody = {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: jsonGenerationConfig(2_400, draftResponseSchema),
    };
    const { content, model } = await this.generateWithFallback(
      apiKey,
      MODEL_REGISTRY.drafting,
      body,
      120_000,
    );
    const parsed = outputSchema.safeParse(parseJson(content));
    if (!parsed.success) {
      throw new AppError(
        'provider-response-invalid',
        'Gemini returned a response that did not match the required draft format.',
      );
    }
    return analysisResultSchema.parse({
      ...parsed.data,
      model,
      generatedAt: new Date().toISOString(),
    });
  }

  async deriveProfile(apiKey: string, pdfDataUrl: string): Promise<EngagementProfile> {
    const pdf = parsePdfDataUrl(pdfDataUrl);
    const body: GenerationBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: pdf } },
            { text: buildProfilePrompt() },
          ],
        },
      ],
      generationConfig: jsonGenerationConfig(1_200, profileResponseSchema),
    };
    const { content } = await this.generateWithFallback(
      apiKey,
      MODEL_REGISTRY.profile,
      body,
      180_000,
    );
    const parsed = profileOutputSchema.safeParse(normalizeProfileOutput(parseJson(content)));
    if (!parsed.success) {
      throw new AppError(
        'provider-response-invalid',
        'Gemini returned an invalid engagement profile.',
      );
    }
    return engagementProfileSchema.parse({
      ...parsed.data,
      schemaVersion: 1,
      source: 'profile-pdf',
      allowEmoji: false,
      allowHashtags: false,
      updatedAt: new Date().toISOString(),
    });
  }

  private async generateWithFallback(
    apiKey: string,
    route: ModelRoute,
    body: GenerationBody,
    timeoutMs: number,
  ): Promise<{ content: string; model: string }> {
    try {
      return {
        content: await this.generate(apiKey, route.primary, body, timeoutMs),
        model: route.primary,
      };
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'provider-rate-limit') throw error;
      return {
        content: await this.generate(apiKey, route.fallback, body, timeoutMs),
        model: route.fallback,
      };
    }
  }

  private async generate(
    apiKey: string,
    model: string,
    body: GenerationBody,
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_ROOT}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw mapProviderError(response.status, payload);
      const parsed = generateResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new AppError('provider-response-invalid', 'Gemini returned an unreadable response.');
      }
      const candidate = parsed.data.candidates[0];
      if (!candidate || candidate.finishReason === 'MAX_TOKENS') {
        throw new AppError(
          'context-overflow',
          'Gemini could not complete the response within the output limit.',
        );
      }
      const content = candidate.content.parts
        .map((part) => part.text ?? '')
        .join('')
        .trim();
      if (!content) {
        throw new AppError('provider-response-invalid', 'Gemini returned no text result.');
      }
      return content;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailableError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function jsonGenerationConfig(
  maxOutputTokens: number,
  responseSchema: Record<string, unknown>,
): GenerationBody['generationConfig'] {
  return {
    responseMimeType: 'application/json',
    maxOutputTokens,
    thinkingConfig: { thinkingLevel: 'minimal' },
    responseSchema,
  };
}

function normalizeProfileOutput(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const preferredLanguage = cleanString(record.preferredLanguage, 80);
  return {
    role: cleanString(record.role, 160),
    industries: cleanStringList(record.industries, 12, 80),
    expertise: cleanStringList(record.expertise, 24, 120),
    audience: cleanString(record.audience, 400),
    goals: cleanStringList(record.goals, 12, 200),
    tone: cleanString(record.tone, 240),
    ...(preferredLanguage ? { preferredLanguage } : {}),
    topicsToAvoid: cleanStringList(record.topicsToAvoid, 24, 160),
  };
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return [
    ...new Set(
      values
        .filter((item): item is string => typeof item === 'string')
        .map((item) => cleanString(item, maxLength))
        .filter(Boolean),
    ),
  ].slice(0, maxItems);
}

function parsePdfDataUrl(value: string): string {
  const prefix = 'data:application/pdf;base64,';
  if (!value.startsWith(prefix)) {
    throw new AppError('provider-response-invalid', 'Choose a valid PDF file.');
  }
  if (value.length > 20_000_000) {
    throw new AppError('context-overflow', 'The profile PDF is too large. Use a PDF under 15 MB.');
  }
  return value.slice(prefix.length);
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new AppError('provider-response-invalid', 'Gemini did not return valid JSON.');
  }
}

function mapProviderError(status: number, payload: unknown): AppError {
  const message = extractProviderMessage(payload);
  const providerStatus = extractProviderStatus(payload);
  if (status === 400 && /api key/i.test(message)) {
    return invalidCredentialError();
  }
  if (status === 401) {
    return invalidCredentialError();
  }
  if (status === 403 || providerStatus === 'PERMISSION_DENIED') {
    return new AppError(
      'provider-auth',
      'The key is recognized, but its Google project or API restrictions do not allow Gemini 3.5 Flash. Create a Gemini API key in Google AI Studio or allow the Generative Language API for that key.',
    );
  }
  if (status === 429 || providerStatus === 'RESOURCE_EXHAUSTED') {
    return new AppError(
      'provider-rate-limit',
      'Gemini free-tier quota is temporarily exhausted. Try again later.',
    );
  }
  if (status >= 500) {
    return new AppError('provider-unavailable', 'Gemini is temporarily unavailable.');
  }
  return new AppError(
    'provider-response-invalid',
    message || `Gemini rejected the request (${String(status)}).`,
  );
}

function invalidCredentialError(): AppError {
  return new AppError(
    'provider-auth',
    'The Gemini API key is invalid or revoked. Create a replacement in Google AI Studio.',
  );
}

function extractProviderMessage(payload: unknown): string {
  const error = extractErrorRecord(payload);
  return typeof error?.message === 'string' ? error.message : '';
}

function extractProviderStatus(payload: unknown): string {
  const error = extractErrorRecord(payload);
  return typeof error?.status === 'string' ? error.status : '';
}

function extractErrorRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const error = (payload as Record<string, unknown>).error;
  return error && typeof error === 'object' ? (error as Record<string, unknown>) : null;
}

function unavailableError(error: unknown): AppError {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AppError(
      'provider-unavailable',
      'The Gemini request timed out. It was not retried to avoid duplicate processing.',
    );
  }
  return new AppError(
    'provider-unavailable',
    'Could not reach Gemini. Check your connection and try again.',
  );
}
