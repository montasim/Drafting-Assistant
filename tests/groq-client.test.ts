import { vi } from 'vitest';
import { AppError } from '../src/application/errors';
import { defaultDiscoverySettings, sourceEvidenceSchema } from '../src/domain/discovery';
import { GroqClient } from '../src/infrastructure/groq-client';

const evidence = sourceEvidenceSchema.parse({
  id: 'dev:private-123',
  source: 'dev',
  title: 'Smaller AI requests are more reliable',
  excerpt: 'A practical explanation of keeping structured AI requests within provider limits.',
  tags: ['ai', 'engineering'],
  publishedAt: new Date().toISOString(),
  engagement: { reactions: 30, comments: 7 },
  reference: {
    source: 'dev',
    title: 'Smaller AI requests are more reliable',
    url: 'https://dev.to/private-author/smaller-requests',
  },
});

const assessment = {
  candidateId: 'candidate-1',
  rating: 'strong',
  type: 'practical-learning',
  sufficientEvidence: true,
  relevance: 'Matches an engineering audience.',
  audienceFit: 'Useful to developers using AI APIs.',
  discussionValue: 'Offers a concrete reliability lesson.',
  credibilityRisk: 'Low when framed without unsupported claims.',
  uncertainty: '',
};

describe('Groq discovery budgeting', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('assesses and drafts in one compact, schema-constrained request', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'openai/gpt-oss-120b',
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: JSON.stringify({
                    assessments: [assessment],
                    drafts: [
                      {
                        candidateId: 'candidate-1',
                        text: 'Smaller request budgets are a reliability feature, not merely an optimization.',
                        language: 'English',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new GroqClient().assessAndCreateDrafts(
      'secret',
      [evidence],
      null,
      { ...defaultDiscoverySettings, topics: ['AI engineering'] },
      { schemaVersion: 1, enabled: true, samples: [], guide: 'Use compact paragraphs.' },
      new AbortController().signal,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.assessments.get(evidence.id)?.rating).toBe('strong');
    expect(result.drafts.get(evidence.id)?.model).toBe('openai/gpt-oss-120b');
    if (typeof capturedInit?.body !== 'string') throw new Error('Request body was not captured.');
    const body = JSON.parse(capturedInit.body) as {
      max_completion_tokens: number;
      messages: { content: string }[];
      response_format: { json_schema: { schema: { required: string[] } } };
    };
    expect(body.max_completion_tokens).toBeLessThanOrEqual(4_000);
    expect(body.max_completion_tokens).toBeLessThan(8_000);
    expect(body.response_format.json_schema.schema.required).toEqual(['assessments', 'drafts']);
    expect(JSON.stringify(body.messages)).not.toContain(evidence.id);
    expect(JSON.stringify(body.messages)).not.toContain(evidence.reference.url);
  });

  it('turns Groq TPM-size errors into concise local guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message:
                'Request too large for model on tokens per minute (TPM): Limit 8000, Requested 9630',
            },
          }),
          { status: 413 },
        ),
      ),
    );

    const error = await new GroqClient()
      .assess('secret', [evidence], null, defaultDiscoverySettings, new AbortController().signal)
      .then(() => null)
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AppError);
    if (!(error instanceof AppError)) throw new Error('Expected an AppError.');
    expect(error.code).toBe('context-overflow');
    expect(error.message).toContain('8,000 TPM');
  });
});
