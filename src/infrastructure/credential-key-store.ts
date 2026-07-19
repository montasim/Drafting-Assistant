const DATABASE_NAME = 'professional-drafting-assistant-vault';
const DATABASE_VERSION = 1;
const KEY_STORE = 'device-keys';
const DEVICE_KEY_ID = 'device-aes-gcm-v1';

export async function getOrCreateDeviceVaultKey(): Promise<CryptoKey> {
  const database = await openVaultDatabase();
  try {
    const existing = await readKey(database);
    if (isDeviceVaultKey(existing)) return existing;

    const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    await writeKey(database, generated);
    return generated;
  } finally {
    database.close();
  }
}

function openVaultDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(KEY_STORE))
        request.result.createObjectStore(KEY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open credential vault.'));
    request.onblocked = () => reject(new Error('Credential vault upgrade is blocked.'));
  });
}

function readKey(database: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, 'readonly');
    const request = transaction.objectStore(KEY_STORE).get(DEVICE_KEY_ID);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not read credential key.'));
  });
}

function writeKey(database: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, 'readwrite');
    transaction.objectStore(KEY_STORE).put(key, DEVICE_KEY_ID);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Could not save credential key.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Saving the credential key was aborted.'));
  });
}

function isDeviceVaultKey(value: unknown): value is CryptoKey {
  return (
    value instanceof CryptoKey &&
    value.type === 'secret' &&
    value.algorithm.name === 'AES-GCM' &&
    !value.extractable &&
    value.usages.includes('encrypt') &&
    value.usages.includes('decrypt')
  );
}
