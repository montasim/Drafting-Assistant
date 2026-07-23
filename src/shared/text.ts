import { AppError } from '../application/errors';

const BIDI_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export function normalizeUntrustedText(value: string): string {
  return value
    .normalize('NFKC')
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return (
        character === '\n' || character === '\t' || (code >= 32 && !(code >= 127 && code <= 159))
      );
    })
    .join('')
    .replace(BIDI_CONTROLS, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function assertContextBudget(parts: readonly string[], maximumCharacters = 80_000): void {
  const size = parts.reduce((total, part) => total + part.length, 0);
  if (size > maximumCharacters) {
    throw new AppError(
      'context-overflow',
      'This content is too large for the selected model. Reduce the visible discussion and try again.',
    );
  }
}

export function countWords(value: string): number {
  return value.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

export function hasSubstantialEdit(generated: string, edited: string): boolean {
  const cleanGenerated = tokenize(generated);
  const cleanEdited = tokenize(edited);
  const threshold = Math.max(3, Math.ceil(cleanGenerated.length * 0.1));
  return editDistance(cleanGenerated, cleanEdited) >= threshold;
}

function tokenize(value: string): string[] {
  return (
    normalizeUntrustedText(value)
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

function editDistance(left: readonly string[], right: readonly string[]): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? 0;
}
