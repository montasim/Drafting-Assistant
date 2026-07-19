# Encrypt persistent provider credentials automatically

Status: Accepted

## Decision

Gemini and Groq Provider Credentials remain in protected Chrome session storage by default. When a user enables device retention, the extension will automatically generate a non-exportable AES-256-GCM key, persist that key in the extension origin's IndexedDB, and store only an authenticated ciphertext envelope in trusted-context `chrome.storage.local`. The background worker restores plaintext only into protected session storage when the extension starts. Each encryption uses a random 96-bit IV and authenticates the provider purpose so Gemini and Groq envelopes cannot be exchanged.

Existing plaintext device credentials are encrypted during startup migration. Disabling device retention removes the persistent envelope without clearing an active session credential. No passphrase or additional user interaction is required.

This decision supersedes ADR 0003's acceptance of a plaintext persistent extension-local credential.

## Context

Hashing cannot be used because provider requests require the original API key. A user-held passphrase would provide a stronger independent secret but adds recurring setup and unlock work that is disproportionate for this extension's workflow. Chrome extensions do not expose a general operating-system keychain API.

## Consequences

- Provider credentials never appear as plaintext in persistent Chrome storage.
- The vault key cannot be exported through Web Crypto and is stored separately from ciphertext.
- Persistent credentials unlock without user interaction after a browser restart.
- This protects against accidental plaintext disclosure and casual storage inspection, but code executing with the extension's privileges can still ask the vault to decrypt a credential.
