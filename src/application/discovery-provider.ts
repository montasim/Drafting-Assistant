import type { EngagementProfile } from '../domain/schemas';
import type {
  DiscoverySettings,
  OpportunityAssessment,
  PostOpportunity,
  PublicationDraft,
  SourceEvidence,
  VoiceSettings,
} from '../domain/discovery';

export interface DiscoveryProvider {
  assessAndCreateDrafts?(
    apiKey: string,
    evidence: SourceEvidence[],
    profile: EngagementProfile | null,
    settings: DiscoverySettings,
    voice: VoiceSettings,
    signal: AbortSignal,
  ): Promise<{
    assessments: Map<string, OpportunityAssessment>;
    drafts: Map<string, PublicationDraft>;
  }>;
  assess(
    apiKey: string,
    evidence: SourceEvidence[],
    profile: EngagementProfile | null,
    settings: DiscoverySettings,
    signal: AbortSignal,
  ): Promise<Map<string, OpportunityAssessment>>;
  createDrafts(
    apiKey: string,
    opportunities: PostOpportunity[],
    profile: EngagementProfile | null,
    settings: DiscoverySettings,
    voice: VoiceSettings,
    signal: AbortSignal,
    previousDraft?: string,
    evidenceById?: Map<string, SourceEvidence>,
  ): Promise<Map<string, PublicationDraft>>;
}

export interface VoiceProvider {
  analyzeVoice(apiKey: string, samples: string[], signal: AbortSignal): Promise<string>;
}
