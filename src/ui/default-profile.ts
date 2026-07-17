import type { EngagementProfile } from '../domain/schemas';

export function createDefaultProfile(): EngagementProfile {
  return {
    schemaVersion: 1,
    role: '',
    industries: [],
    expertise: [],
    audience: '',
    goals: [],
    tone: 'Professional, specific, constructive, and natural',
    topicsToAvoid: [],
    allowEmoji: false,
    allowHashtags: false,
    source: 'manual',
    updatedAt: new Date().toISOString(),
  };
}
