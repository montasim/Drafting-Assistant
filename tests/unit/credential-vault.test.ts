import { beforeEach, describe, expect, it } from 'vitest';
import { CredentialVault } from '../../src/infrastructure/storage/credential-vault';
import { installChromeMock } from '../helpers/chrome';

const memory = installChromeMock();

describe('device-bound provider credentials', () => {
  beforeEach(async () => {
    memory.reset();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('thoughtline-vault');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Could not reset test vault'));
    });
  });

  it('stores ciphertext locally and restores plaintext through the non-exportable device key', async () => {
    const vault = new CredentialVault();
    await vault.save('gemini', 'gemini-secret-key-123');

    const persisted = JSON.stringify(memory.local.get('thoughtline.provider-credentials'));
    expect(persisted).not.toContain('gemini-secret-key-123');
    memory.session.clear();
    await expect(vault.get('gemini')).resolves.toBe('gemini-secret-key-123');
  });

  it('removes the encrypted and session copies together', async () => {
    const vault = new CredentialVault();
    await vault.save('groq', 'groq-secret-key-12345');
    await vault.remove('groq');
    await expect(vault.get('groq')).resolves.toBeNull();
  });
});
