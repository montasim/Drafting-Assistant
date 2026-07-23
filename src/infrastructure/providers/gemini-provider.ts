import { z } from 'zod';
import type {
  DraftingProvider,
  StructuredGenerationRequest,
} from '../../application/ports/drafting-provider';
import { modelRegistry } from '../../application/model-registry';
import { AppError } from '../../application/errors';
import {
  fetchWithTimeout,
  jsonSchemaForProvider,
  parseJsonText,
  readJsonResponse,
} from './provider-utils';

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string() })),
        }),
        finishReason: z.string().optional(),
      }),
    )
    .min(1),
});

export class GeminiProvider implements DraftingProvider {
  readonly name = 'gemini' as const;
  readonly model = modelRegistry.gemini.model;

  async validateConnection(apiKey: string, signal?: AbortSignal): Promise<void> {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}`,
      {
        method: 'GET',
        headers: { 'x-goog-api-key': apiKey },
        ...(signal ? { signal } : {}),
      },
    );
    await readJsonResponse(response);
  }

  async generateStructured<T>(apiKey: string, request: StructuredGenerationRequest<T>): Promise<T> {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.systemInstruction }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `UNTRUSTED_CONTENT_JSON\n${JSON.stringify(request.untrustedEnvelope)}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseFormat: {
              text: {
                mimeType: 'application/json',
                schema: jsonSchemaForProvider(z.toJSONSchema(request.schema)),
              },
            },
            maxOutputTokens: request.maxOutputTokens,
          },
        }),
        ...(request.signal ? { signal: request.signal } : {}),
      },
    );
    const payload = geminiResponseSchema.safeParse(await readJsonResponse(response));
    if (!payload.success) {
      throw new AppError('provider-response-invalid', 'Gemini returned an incomplete response.');
    }
    const text = payload.data.candidates[0]?.content.parts.map((part) => part.text).join('');
    if (!text) throw new AppError('provider-response-invalid', 'Gemini returned no output.');
    const parsed = request.schema.safeParse(parseJsonText(text));
    if (!parsed.success) {
      throw new AppError('provider-response-invalid', 'Gemini output failed local validation.');
    }
    return parsed.data;
  }
}
