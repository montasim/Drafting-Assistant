# Professional Drafting Assistant

A local-first Chrome extension that creates professional, evidence-bound response drafts from a LinkedIn post or comment selected by the user.

The extension is intentionally manual: it never posts, replies, reacts, clicks, scrolls, expands discussions, or calls LinkedIn APIs. On LinkedIn, the user right-clicks inside one post or comment and chooses **Analyze this post**. Only already-rendered text from that post and its visible discussion is minimized, de-identified, and sent to Google Gemini using the user's own API key. The user reviews, edits, copies, and submits any response themselves.

> This independent project is not affiliated with LinkedIn. Its design reduces automation and data exposure, but does not guarantee compliance with LinkedIn's terms or eliminate account risk.

## Current scope

- Chrome 120+, Manifest V3
- LinkedIn feed and post-detail pages
- Text only; images, video, external pages, hidden comments, and collapsed content are skipped
- Post comment and comment-reply drafts
- All visible, already-rendered comments and replies included in one provider request
- Three strategies: professional insight, specific question, and support-and-extend
- Gemini bring-your-own-key with session-only storage by default
- Gemini 2.5 Flash with a rate-limit-only Flash-Lite fallback
- Optional engagement-profile import from the user's own LinkedIn Save-to-PDF
- Latest 20 minimized outputs stored locally
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
```

The content script is built as an unlisted WXT script and registered only after the optional `linkedin.com` permission is granted. Credentials, profiles, history, and analysis state are restricted to trusted extension contexts. Domain schemas validate every storage, runtime-message, extraction, and provider boundary.

Key decisions are recorded in [`CONTEXT.md`](./CONTEXT.md) and [`docs/adr`](./docs/adr).

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

Load `.output/chrome-mv3` from `chrome://extensions` with Developer mode enabled. Complete onboarding, then reload any LinkedIn tabs that were open before installation if necessary.

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

The model registry lives in `src/application/models.ts`:

| Purpose     | Primary model      | Quota fallback          |
| ----------- | ------------------ | ----------------------- |
| Drafting    | `gemini-2.5-flash` | `gemini-2.5-flash-lite` |
| Profile PDF | `gemini-2.5-flash` | `gemini-2.5-flash-lite` |

Credential checks list one model without generating content. Draft and profile generation call the Gemini `generateContent` REST endpoint directly and request JSON output. Provider output is validated locally before it is shown or stored. Flash-Lite is attempted only after Gemini explicitly returns a quota or rate-limit response; network errors, timeouts, authentication failures, and malformed responses never trigger a second generation.

## Privacy and security

See [PRIVACY.md](./PRIVACY.md) for the data inventory and [SECURITY.md](./SECURITY.md) for responsible disclosure.

Important implementation boundaries:

- No complete post or visible discussion is retained after an analysis.
- Participant names, profile URLs, and IDs are not sent to Gemini.
- The API key is never exposed to the LinkedIn content script or logs.
- Raw profile PDFs and provider profile responses are discarded after an editable profile is derived.
- Diagnostic export contains timestamps, event names, and error codes only.
- LinkedIn text is delimited as untrusted data and cannot enable tools or access secrets.

## Contributing

Keep changes inside the documented product boundary. Add or update an ADR when changing a meaningful architectural, privacy, permission, retention, provider, or automation decision. Run `pnpm check` before opening a pull request.

Released under the [MIT License](./LICENSE).
