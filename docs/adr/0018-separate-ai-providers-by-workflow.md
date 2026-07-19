---
status: accepted
---

# Separate AI providers by workflow

The extension will keep Gemini 3.5 Flash for existing Response Drafts and use Groq-hosted `openai/gpt-oss-120b` for discovery evaluation and Publication Drafts, with separate user-owned credentials. This prevents browser-local discovery from silently consuming the Gemini quota reserved for LinkedIn responses; Gemini may be used for discovery only through an explicit manual override, never an automatic fallback, and neither route may select a paid model.
