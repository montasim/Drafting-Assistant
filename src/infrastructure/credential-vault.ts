import { z } from 'zod';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
type OwnedBytes = Uint8Array<ArrayBuffer>;

export const credentialPurposeSchema = z.enum(['gemini', 'groq']);
export type CredentialPurpose = z.infer<typeof credentialPurposeSchema>;

export const credentialStateSchema = z.enum(['missing', 'session', 'locked', 'unlocked']);
export type CredentialState = z.infer<typeof credentialStateSchema>;

export const encryptedCredentialSchema = z.object({
  schemaVersion: z.literal(1),
  cipher: z.literal('AES-256-GCM'),
  keyStore: z.literal('NON-EXPORTABLE-INDEXEDDB'),
  keyId: z.literal('device-aes-gcm-v1'),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
});
export type EncryptedCredential = z.infer<typeof encryptedCredentialSchema>;

export async function encryptCredential(
  credential: string,
  key: CryptoKey,
  purpose: CredentialPurpose,
): Promise<EncryptedCredential> {
  assertDeviceKey(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(purpose) },
    key,
    encoder.encode(credential),
  );
  return {
    schemaVersion: 1,
    cipher: 'AES-256-GCM',
    keyStore: 'NON-EXPORTABLE-INDEXEDDB',
    keyId: 'device-aes-gcm-v1',
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptCredential(
  encrypted: EncryptedCredential,
  key: CryptoKey,
  purpose: CredentialPurpose,
): Promise<string> {
  assertDeviceKey(key);
  const parsed = encryptedCredentialSchema.parse(encrypted);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(parsed.iv),
      additionalData: additionalData(purpose),
    },
    key,
    fromBase64(parsed.ciphertext),
  );
  return decoder.decode(plaintext);
}

function assertDeviceKey(key: CryptoKey): void {
  if (key.type !== 'secret' || key.algorithm.name !== 'AES-GCM' || key.extractable)
    throw new Error('The credential vault key is invalid.');
}

function additionalData(purpose: CredentialPurpose): OwnedBytes {
  return encoder.encode(`professional-drafting-assistant:${purpose}:credential:v1`);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): OwnedBytes {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
