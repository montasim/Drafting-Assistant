# Professional Drafting Assistant

A local-first Chrome extension that creates professional, evidence-bound LinkedIn response drafts and manually requested standalone post ideas.

The extension is intentionally manual: it never posts, replies, reacts, clicks, scrolls, expands discussions, or calls LinkedIn APIs. On LinkedIn, the user right-clicks inside one post or comment and chooses **Analyze this post**. Only already-rendered text from that post and its visible discussion is minimized, de-identified, and sent to Google Gemini using the user's own API key. The user reviews, edits, copies, and submits any response themselves.

> This independent project is not affiliated with LinkedIn. Its design reduces automation and data exposure, but does not guarantee compliance with LinkedIn's terms or eliminate account risk.

## Current scope

- Chrome 120+, Manifest V3
- LinkedIn feed and post-detail pages
- Text only; images, video, external pages, hidden comments, and collapsed content are skipped
- Post comment and comment-reply drafts
- All visible, already-rendered comments and replies included in one provider request
- Four strategies: professional insight, specific question, support-and-extend, and constructive challenge
- Gemini bring-your-own-key with session-only storage by default and automatic encrypted device retention when requested
- Gemini 3.5 Flash with a rate-limit-only Gemini 3.1 Flash-Lite fallback
- Optional engagement-profile import from the user's own LinkedIn Save-to-PDF
- Latest 20 minimized outputs stored locally
- Manual developer-content discovery from Hacker News, DEV, Medium, Lobsters, and Stack Overflow APIs/RSS
- Per-source enable/disable controls and one-to-five result targets
- Profile-aware opportunity assessments and up to three ready-to-edit standalone posts
- Groq `openai/gpt-oss-120b` bring-your-own-key for discovery, with no automatic provider fallback
- Optional local Voice Guide derived from up to five user-authored examples
- Separate latest-20 publication history and 30-day seen-item suppression
- No accounts, backend, analytics, advertisements, or remote telemetry

## Architecture

```text
right-click target
      │
      ▼
isolated LinkedIn script ── validates one post ── de-identifies visible text
      │
      ▼
background service worker ── consent/key/model policy ── Gemini API
      │
      ▼
side panel ── analysis + 3 editable drafts ── manual copy

manual Run discovery
      │
      ▼
background service worker ── approved APIs/RSS ── local filtering/deduplication
      │
      ▼
Groq structured assessment + up to 3 drafts ── review/edit/source link ── manual copy
```

The content script is built as an unlisted WXT script and registered only after the optional `linkedin.com` permission is granted. Discovery adds no LinkedIn content script, DOM operation, navigation, composer insertion, or submission. Discovery origin permissions are optional and requested per enabled source; changing them does not resynchronize the LinkedIn integration. Credentials, profiles, voice settings, history, and request state are restricted to trusted extension contexts. Domain schemas validate every storage, runtime-message, source, extraction, and provider boundary.

Key decisions are recorded in [`CONTEXT.md`](./CONTEXT.md) and [`docs/adr`](./docs/adr).

## Install from GitHub

Download the `chrome-unpacked.zip` file from the [latest GitHub release](https://github.com/montasim/Drafting-Assistant/releases/latest), then:

1. Extract the ZIP to a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
5. Complete onboarding, then reload LinkedIn tabs that were already open.

Chrome loads the extension from that folder, so keep it after installation. GitHub-installed unpacked extensions do not update automatically; download and load each newer release manually.

## Local development

Requirements: Node.js 24+, pnpm 11.7+.

```bash
pnpm install
pnpm dev
```

For a production build:

```bash
pnpm check
```

Load `.output` from `chrome://extensions` with Developer mode enabled. Complete onboarding, then reload any LinkedIn tabs that were open before installation if necessary.

Useful commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm zip
```

The unit and contract fixtures are synthetic and contain no scraped LinkedIn data. Browser tests mock neither LinkedIn nor Gemini; they smoke-test only the packaged extension shell. Live LinkedIn and live Gemini checks are manual private-beta steps and should use a test account and low-risk content.

## Gemini configuration

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey), then paste it into the Gemini connection step. The in-product **How to get a Gemini API key** guide provides the same short path without requiring users to leave setup first.

The model registry lives in `src/application/models.ts`:

| Purpose     | Primary model      | Quota fallback          |
| ----------- | ------------------ | ----------------------- |
| Drafting    | `gemini-3.5-flash` | `gemini-3.1-flash-lite` |
| Profile PDF | `gemini-3.5-flash` | `gemini-3.1-flash-lite` |

Both configured models support free-tier input and output usage; the extension does not route users to a paid-only model. Credential checks list one model without generating content. Draft and profile generation call the Gemini `generateContent` REST endpoint directly and request JSON output with minimal thinking. Provider output is validated locally before it is shown or stored. Gemini 3.1 Flash-Lite is attempted only after Gemini explicitly returns a quota or rate-limit response; network errors, timeouts, authentication failures, and malformed responses never trigger a second generation.

## Discovery configuration

Create a project-scoped Groq API key in the [GroqCloud API Keys console](https://console.groq.com/keys), then paste it into Discovery connection. The in-product **How to get a Groq API key** guide explains the flow at the credential field.

Discovery is disabled by default and runs only after the user presses **Run discovery**. A valid Groq key and explicit discovery consent are required. Groq uses `openai/gpt-oss-120b`; a normal run assesses candidates and creates up to three automatic drafts in one compact, structured request with a conservative preflight budget below the free 8,000 TPM ceiling. A free-tier rate limit stops the operation without repeated retry or paid-model selection.

The extension fetches only machine-readable data returned directly by approved source APIs or RSS feeds. It does not crawl linked articles. Source titles, permitted excerpts, tags, age, and aggregate engagement are minimized before Groq transmission; source IDs, URLs, authors, profiles, and full discussions stay out of provider prompts. Stack Overflow contributes question titles, tags, and aggregate metrics only—not bodies, answers, or code.

If a Groq assessment step fails, the user may explicitly retry that assessment batch with the already-configured Gemini provider. If Groq drafting fails, assessments are preserved and the user may explicitly retry one selected draft with Gemini. No provider switch happens automatically.

## Privacy and security

See [PRIVACY.md](./PRIVACY.md) for the data inventory and [SECURITY.md](./SECURITY.md) for responsible disclosure.

Important implementation boundaries:

- No complete post or visible discussion is retained after an analysis.
- Participant names, profile URLs, and IDs are not sent to Gemini.
- The API key is never exposed to the LinkedIn content script or logs.
- Groq and Gemini credentials are stored separately and never sent to source sites or content scripts.
- Credentials remain in protected browser-session storage by default. If device retention is enabled, the extension stores only AES-256-GCM ciphertext in `chrome.storage.local`; the automatically generated, non-exportable encryption key is held separately in the extension origin's IndexedDB vault.
- Raw profile PDFs and provider profile responses are discarded after an editable profile is derived.
- Raw discovery evidence is discarded after assessment/drafting; current results retain only source references, tags, assessments, and drafts.
- Voice samples stay local and are sent to Groq only after the user clicks **Analyze and save voice**.
- Diagnostic export contains timestamps, event names, and error codes only.
- LinkedIn text, source evidence, and voice samples are delimited as untrusted data and cannot enable tools or access secrets.

## Contributing

Keep changes inside the documented product boundary. Add or update an ADR when changing a meaningful architectural, privacy, permission, retention, provider, or automation decision. Run `pnpm check` before opening a pull request.

Released under the [MIT License](./LICENSE).
