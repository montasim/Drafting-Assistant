# Security Policy

Please report suspected vulnerabilities privately to the repository maintainer when a private reporting channel is available. Otherwise, open a minimal issue that contains no secrets, personal data, LinkedIn content, or exploitable detail and ask for a private contact channel.

Particularly relevant reports include credential exposure, permission-scope expansion, unauthorized provider or discovery-source requests, retained raw content, identity de-identification failures, prompt-boundary bypasses that expose extension data, and unintended LinkedIn actions.

Never include a live Gemini or Groq API key in logs, screenshots, fixtures, issues, voice samples, or pull requests. Revoke any key that may have been exposed.

Provider keys use `chrome.storage.session` by default. Optional device retention stores only AES-256-GCM ciphertext in trusted-context `chrome.storage.local`; an automatically generated, non-exportable 256-bit key is stored separately in the extension origin's IndexedDB and used to restore the session credential at startup. IVs are random per encryption and provider purpose is authenticated as additional data. Legacy plaintext device credentials are encrypted during startup migration.

This is defense in depth against plaintext storage leakage, not an operating-system keychain. A compromised extension runtime or browser profile may still invoke the vault. Reports should not claim that the ciphertext alone proves a credential is unrecoverable.

Discovery evidence and Voice Samples are hostile-input boundaries. They must remain data-only, must not gain browsing or tool access, and must never be able to reach provider credentials, extension storage, LinkedIn content, or runtime capabilities. Discovery-origin permission changes must not trigger LinkedIn content-script registration or reinjection.
