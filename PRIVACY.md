# Privacy Policy

Last updated: July 19, 2026

Professional Drafting Assistant is a local-first, bring-your-own-key browser extension. It has no developer-operated backend, account system, advertising, or remote telemetry.

## Data processed

After the user right-clicks a LinkedIn post or comment and invokes the extension, it processes text already visible inside that selected post, aggregate reaction text, and already-rendered comments and replies. Names, profile links, LinkedIn identifiers, and reactor identities are removed or replaced with neutral labels before provider transmission.

The minimized context, the locally stored engagement profile, and drafting preferences are sent directly from the extension to the Google Gemini API using the user's API key. Google's terms and privacy practices apply. Google states that content submitted through the free tier may be used to improve its products; onboarding requires explicit acknowledgment of this before analysis is enabled.

If the user imports their own LinkedIn profile PDF, the raw PDF is sent to Gemini only to derive an editable engagement profile. The extension does not retain the raw PDF or raw provider response.

If the user separately opts into Discovery and clicks **Run discovery**, the extension retrieves recent items from enabled developer APIs or RSS feeds. It locally filters and deduplicates them, then sends minimized source evidence, Discovery Topics, the Engagement Profile, and the enabled Voice Guide directly to Groq using the user's Groq key. Minimized evidence can include a source name, title, permitted excerpt, tags, age, and aggregate engagement counts. It excludes source URLs, source IDs, author identities, profile links, and full discussions. Stack Overflow question bodies, answers, and code are not collected.

Discovery never crawls linked articles. Source and voice text are treated as untrusted data and cannot enable provider tools, access credentials, or alter extension rules. Groq's terms and privacy practices apply. The extension performs no scheduled discovery; every run is user initiated.

Users may provide up to five posts they authored and click **Analyze and save voice**. Only that explicit action sends all nonempty samples together to Groq to derive an editable Voice Guide. Samples and the guide are stored locally. Samples are not sent during ordinary discovery runs and are not used for model fine-tuning by the extension.

## Local storage

- Gemini API key: protected browser-session storage by default; when device retention is enabled, only AES-256-GCM ciphertext is persisted in extension-local storage and it is unlocked automatically with a separate non-exportable extension-origin key
- Engagement profile and settings: extension-local storage
- Output history: latest 20 entries containing creation time, response target type, short post excerpt, analysis summary, draft set, language, and model
- Diagnostics: up to 100 sanitized event timestamps and error codes
- Groq API key: separate protected browser-session storage by default; optional automatic encrypted device retention using the same vault design as Gemini
- Discovery settings, topics, source preferences, Voice Samples, and Voice Guide: extension-local storage
- Current discovery results: source reference, publication time, tags, assessment, and optional draft until the next completed run
- Publication history: latest 20 source references, assessment summaries, edited drafts, creation times, and model IDs
- Seen-item memory: canonical-URL fingerprints and timestamps for 30 days; no article text

The complete post, visible discussion, raw prompt, raw discovery evidence, profile snapshot used for a request, and browsing history are not retained.

Chrome sync storage is not used. Extension data can be removed from the settings UI or by uninstalling the extension.

The device vault prevents API keys from appearing as plaintext in Chrome extension-local storage. Chrome does not expose an operating-system keychain to extensions, so this design does not protect against malicious code already running with this extension's privileges or a fully compromised browser profile.

## Permissions

- `linkedin.com` is an optional site permission requested during setup and can be revoked.
- `generativelanguage.googleapis.com` is used only for user-requested credential validation, profile derivation, and draft generation.
- `api.groq.com` is optional and used for user-requested Groq key validation, discovery assessment, publication drafting, and Voice Guide analysis.
- Hacker News, DEV, Medium, Lobsters, and Stack Exchange API/RSS origins are optional and requested only for enabled Discovery Sources. Disabling a source removes its origin permission.
- `contextMenus`, `scripting`, `sidePanel`, and `storage` support the explicit right-click workflow and local settings.

Discovery sources receive no content scripts. The extension does not use LinkedIn APIs, submit LinkedIn actions, insert text into LinkedIn, or fetch external links found in LinkedIn posts or discovery items.

## Contact

This repository's issue tracker is the contact channel for privacy questions. Do not include API keys, private post content, profile PDFs, or personal data in an issue.
