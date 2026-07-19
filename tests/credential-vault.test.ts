import { decryptCredential, encryptCredential } from '../src/infrastructure/credential-vault';

describe('credential vault', () => {
  const credential = 'provider-secret-that-must-not-be-persisted';

  async function createKey() {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
  }

  it('round-trips a credential without persisting the plaintext', async () => {
    const key = await createKey();
    const encrypted = await encryptCredential(credential, key, 'gemini');
    const serialized = JSON.stringify(encrypted);

    expect(serialized).not.toContain(credential);
    expect(encrypted).toMatchObject({
      schemaVersion: 1,
      cipher: 'AES-256-GCM',
      keyStore: 'NON-EXPORTABLE-INDEXEDDB',
      keyId: 'device-aes-gcm-v1',
    });
    expect(key.extractable).toBe(false);
    await expect(decryptCredential(encrypted, key, 'gemini')).resolves.toBe(credential);
  });

  it('rejects a different key and cross-provider decryption', async () => {
    const key = await createKey();
    const differentKey = await createKey();
    const encrypted = await encryptCredential(credential, key, 'gemini');

    await expect(decryptCredential(encrypted, differentKey, 'gemini')).rejects.toThrow();
    await expect(decryptCredential(encrypted, key, 'groq')).rejects.toThrow();
  });

  it('uses a fresh IV for every encryption', async () => {
    const key = await createKey();
    const first = await encryptCredential(credential, key, 'groq');
    const second = await encryptCredential(credential, key, 'groq');

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
