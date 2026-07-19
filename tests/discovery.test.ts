import {
  buildAssessmentPrompt,
  buildPublicationPrompt,
  chooseDraftOpportunities,
} from '../src/application/discovery-prompt';
import {
  DISCOVERY_SOURCE_IDS,
  defaultDiscoverySettings,
  sourceEvidenceSchema,
  type PostOpportunity,
} from '../src/domain/discovery';

const evidence = sourceEvidenceSchema.parse({
  id: 'private-source-id-123',
  source: 'dev',
  title: 'Practical TypeScript boundaries',
  excerpt: 'A short explanation of boundary validation.',
  tags: ['typescript', 'architecture'],
  publishedAt: new Date().toISOString(),
  engagement: { reactions: 42, comments: 8 },
  reference: {
    source: 'dev',
    title: 'Practical TypeScript boundaries',
    url: 'https://dev.to/private-author/practical-typescript?utm_source=test',
  },
});

const profile = {
  schemaVersion: 1 as const,
  role: 'Software engineer',
  industries: ['Software'],
  expertise: ['TypeScript'],
  audience: 'Developers',
  goals: ['Share practical knowledge'],
  tone: 'Direct and reflective',
  topicsToAvoid: [],
  allowEmoji: false,
  allowHashtags: false,
  source: 'manual' as const,
  updatedAt: new Date().toISOString(),
};

describe('discovery defaults and prompt minimization', () => {
  it('starts every launch source enabled with a three-result target', () => {
    expect(DISCOVERY_SOURCE_IDS).toHaveLength(5);
    for (const source of DISCOVERY_SOURCE_IDS) {
      expect(defaultDiscoverySettings.sources[source]).toEqual({ enabled: true, limit: 3 });
    }
  });

  it('uses ephemeral labels and excludes source IDs and URLs from assessment requests', () => {
    const prompt = buildAssessmentPrompt([evidence], profile, {
      ...defaultDiscoverySettings,
      topics: ['TypeScript'],
    });
    expect(prompt.user).toContain('candidate-1');
    expect(prompt.user).not.toContain(evidence.id);
    expect(prompt.user).not.toContain(evidence.reference.url);
    expect(prompt.user).not.toContain('private-author');
  });

  it('uses ephemeral labels and keeps attribution out of the publication instruction', () => {
    const opportunity = makeOpportunity('private-source-id-123', 'practical-learning');
    const prompt = buildPublicationPrompt(
      [opportunity],
      profile,
      defaultDiscoverySettings,
      { schemaVersion: 1, enabled: true, samples: [], guide: 'Use compact paragraphs.' },
      undefined,
      new Map([[opportunity.id, evidence]]),
    );
    expect(prompt.user).toContain('opportunity-1');
    expect(prompt.user).not.toContain(opportunity.id);
    expect(prompt.user).not.toContain(opportunity.reference.url);
    expect(prompt.system).toContain('Never add source links, citations, attribution lines');
  });
});

describe('balanced draft selection', () => {
  it('selects one trend, one practical item, and one general fit when available', () => {
    const values = [
      makeOpportunity('trend', 'timely-trend'),
      makeOpportunity('practical', 'practical-learning'),
      makeOpportunity('general', 'general-fit'),
      makeOpportunity('extra', 'timely-trend'),
    ];
    expect(chooseDraftOpportunities(values).map(({ id }) => id)).toEqual([
      'trend',
      'practical',
      'general',
    ]);
  });

  it('never selects skipped or evidence-insufficient opportunities', () => {
    const skipped = makeOpportunity('skip', 'timely-trend');
    skipped.assessment.rating = 'skip';
    const insufficient = makeOpportunity('insufficient', 'practical-learning');
    insufficient.assessment.sufficientEvidence = false;
    expect(chooseDraftOpportunities([skipped, insufficient])).toEqual([]);
  });
});

function makeOpportunity(id: string, type: PostOpportunity['assessment']['type']): PostOpportunity {
  return {
    id,
    reference: evidence.reference,
    publishedAt: evidence.publishedAt,
    tags: evidence.tags,
    assessment: {
      candidateId: id,
      rating: 'strong',
      type,
      sufficientEvidence: true,
      relevance: 'Relevant to the profile.',
      audienceFit: 'Useful to developers.',
      discussionValue: 'Supports a practical discussion.',
      credibilityRisk: 'Low with careful framing.',
      uncertainty: '',
    },
  };
}
