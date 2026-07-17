import { MODEL_REGISTRY } from '../src/application/models';

describe('Gemini model policy', () => {
  it('uses stable Flash with Flash-Lite as its explicit fallback', () => {
    expect(MODEL_REGISTRY.drafting.primary).toBe('gemini-3.5-flash');
    expect(MODEL_REGISTRY.drafting.fallback).toBe('gemini-3.1-flash-lite');
    expect(MODEL_REGISTRY.profile.primary).toBe('gemini-3.5-flash');
  });
});
