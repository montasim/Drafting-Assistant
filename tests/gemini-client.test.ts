import { vi } from 'vitest';
import { GeminiClient } from '../src/infrastructure/gemini-client';
import { defaultSettings, type PostContext } from '../src/domain/schemas';

const context: PostContext = {
  schemaVersion: 1,
  extractionVersion: 'test',
  surface: 'feed',
  visiblePostText: 'Documentation improves decisions.',
  visibleDiscussion: [],
  responseTarget: { type: 'post', text: 'Documentation improves decisions.' },
  excerpt: 'Documentation improves decisions.',
  extractedAt: new Date().toISOString(),
};
const validOutput = {
  schemaVersion: 1,
  summary: {
    overview: 'A post about documentation.',
    themes: ['Documentation'],
    intent: 'Share an insight',
    uncertainties: [],
    risks: [],
  },
  drafts: [
    {
      strategy: 'professional-insight',
      text: 'Clear decision records make good practice easier to repeat.',
    },
    {
      strategy: 'specific-question',
      text: 'Which habit helped your team keep those records current?',
    },
    {
      strategy: 'support-and-extend',
      text: 'A lightweight review cadence can extend this by catching stale assumptions early.',
    },
  ],
  language: 'English',
};

function generationResponse(output: unknown = validOutput): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify(output) }] },
          finishReason: 'STOP',
        },
      ],
    }),
    { status: 200 },
  );
}

describe('GeminiClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('validates credentials without generating content', async () => {
    let requestedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      capturedInit = init;
      return Promise.resolve(new Response(JSON.stringify({ models: [] }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(new GeminiClient().validateCredential('secret')).resolves.toBe(true);
    expect(requestedUrl).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1');
    expect(new Headers(capturedInit?.headers).get('x-goog-api-key')).toBe('secret');
    expect(capturedInit?.method).toBeUndefined();
  });

  it('reports a rejected credential without generation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 401, message: 'API key not valid', status: 'UNAUTHENTICATED' },
        }),
        { status: 401 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(new GeminiClient().validateCredential('bad')).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses Gemini JSON mode and validates the draft result', async () => {
    let requestedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      capturedInit = init;
      return Promise.resolve(generationResponse());
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new GeminiClient().analyze('secret', context, null, defaultSettings);
    expect(result.drafts).toHaveLength(3);
    expect(result.model).toBe('gemini-2.5-flash');
    expect(requestedUrl).toContain('/models/gemini-2.5-flash:generateContent');
    if (typeof capturedInit?.body !== 'string') throw new Error('Request body was not captured.');
    const request = JSON.parse(capturedInit.body) as Record<string, unknown>;
    expect(request.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        type: 'object',
        required: ['schemaVersion', 'summary', 'drafts', 'language'],
        properties: {
          schemaVersion: { type: 'integer', minimum: 1, maximum: 1 },
        },
      },
    });
    expect(JSON.stringify(request.generationConfig)).not.toContain('"enum":[1]');
    expect(new Headers(capturedInit.headers).get('x-goog-api-key')).toBe('secret');
  });

  it('falls back to Flash-Lite only after an explicit quota response', async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (urls.length === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' },
            }),
            { status: 429 },
          ),
        );
      }
      return Promise.resolve(generationResponse());
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new GeminiClient().analyze('secret', context, null, defaultSettings);
    expect(result.model).toBe('gemini-2.5-flash-lite');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urls[0]).toContain('/models/gemini-2.5-flash:generateContent');
    expect(urls[1]).toContain('/models/gemini-2.5-flash-lite:generateContent');
  });

  it('does not fall back on authentication failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 403, message: 'Permission denied', status: 'PERMISSION_DENIED' },
        }),
        { status: 403 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new GeminiClient().analyze('bad', context, null, defaultSettings),
    ).rejects.toMatchObject({ code: 'provider-auth' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests a structured profile and normalizes harmless model variations', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return Promise.resolve(
        generationResponse({
          role: '  Software Engineer  ',
          industries: ['Technology', null, '', 'Technology'],
          expertise: 'System architecture',
          audience: null,
          tone: 'Professional and practical',
          preferredLanguage: null,
          topicsToAvoid: ['Private client information'],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new GeminiClient().deriveProfile(
      'secret',
      'data:application/pdf;base64,JVBERi0xLjQ=',
    );

    expect(result).toMatchObject({
      role: 'Software Engineer',
      industries: ['Technology'],
      expertise: ['System architecture'],
      audience: '',
      goals: [],
      tone: 'Professional and practical',
      topicsToAvoid: ['Private client information'],
      source: 'profile-pdf',
    });
    expect(result.preferredLanguage).toBeUndefined();
    if (typeof capturedInit?.body !== 'string') throw new Error('Request body was not captured.');
    const request = JSON.parse(capturedInit.body) as {
      contents: { parts: { inlineData?: { mimeType: string; data: string } }[] }[];
      generationConfig: Record<string, unknown>;
    };
    expect(request.contents[0]?.parts[0]?.inlineData).toEqual({
      mimeType: 'application/pdf',
      data: 'JVBERi0xLjQ=',
    });
    expect(request.generationConfig.responseMimeType).toBe('application/json');
    const responseSchema = request.generationConfig.responseSchema as Record<string, unknown>;
    expect(responseSchema.type).toBe('object');
    expect(responseSchema.required).toEqual(
      expect.arrayContaining(['role', 'industries', 'expertise', 'topicsToAvoid']),
    );
  });
});
