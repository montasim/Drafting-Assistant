export const MODEL_REGISTRY = {
  drafting: {
    primary: 'gemini-2.5-flash',
    fallback: 'gemini-2.5-flash-lite',
    contextTokens: 1_048_576,
  },
  profile: {
    primary: 'gemini-2.5-flash',
    fallback: 'gemini-2.5-flash-lite',
    contextTokens: 1_048_576,
  },
} as const;

export type ModelRoute = typeof MODEL_REGISTRY.drafting | typeof MODEL_REGISTRY.profile;
