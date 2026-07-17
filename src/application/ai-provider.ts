import type {
  AnalysisResult,
  AppSettings,
  EngagementProfile,
  PostContext,
} from '../domain/schemas';

export interface AiProvider {
  validateCredential(apiKey: string): Promise<boolean>;
  analyze(
    apiKey: string,
    context: PostContext,
    profile: EngagementProfile | null,
    settings: AppSettings,
  ): Promise<AnalysisResult>;
  deriveProfile(apiKey: string, pdfDataUrl: string): Promise<EngagementProfile>;
}
