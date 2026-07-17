# Privacy Policy

Last updated: July 17, 2026

Professional Drafting Assistant is a local-first, bring-your-own-key browser extension. It has no developer-operated backend, account system, advertising, or remote telemetry.

## Data processed

After the user right-clicks a LinkedIn post or comment and invokes the extension, it processes text already visible inside that selected post, aggregate reaction text, and already-rendered comments and replies. Names, profile links, LinkedIn identifiers, and reactor identities are removed or replaced with neutral labels before provider transmission.

The minimized context, the locally stored engagement profile, and drafting preferences are sent directly from the extension to the Google Gemini API using the user's API key. Google's terms and privacy practices apply. Google states that content submitted through the free tier may be used to improve its products; onboarding requires explicit acknowledgment of this before analysis is enabled.

If the user imports their own LinkedIn profile PDF, the raw PDF is sent to Gemini only to derive an editable engagement profile. The extension does not retain the raw PDF or raw provider response.

## Local storage

- Gemini API key: browser-session storage by default; optional persistent extension-local storage after a warning
- Engagement profile and settings: extension-local storage
- Output history: latest 20 entries containing creation time, response target type, short post excerpt, analysis summary, draft set, language, and model
- Diagnostics: up to 100 sanitized event timestamps and error codes

The complete post, visible discussion, raw prompt, profile snapshot used for a request, and browsing history are not retained.

Chrome sync storage is not used. Extension data can be removed from the settings UI or by uninstalling the extension.

## Permissions

- `linkedin.com` is an optional site permission requested during setup and can be revoked.
- `generativelanguage.googleapis.com` is used only for user-requested credential validation, profile derivation, and draft generation.
- `contextMenus`, `scripting`, `sidePanel`, and `storage` support the explicit right-click workflow and local settings.

The extension does not use LinkedIn APIs, submit LinkedIn actions, or fetch external links found in posts.

## Contact

This repository's issue tracker is the contact channel for privacy questions. Do not include API keys, private post content, profile PDFs, or personal data in an issue.
