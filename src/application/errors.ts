import type { AnalysisErrorCode } from '../domain/schemas';

export class AppError extends Error {
  constructor(
    public readonly code: AnalysisErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(
    'unknown',
    error instanceof Error ? error.message : 'An unexpected error occurred.',
  );
}
