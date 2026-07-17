---
status: accepted
---

# Migrate the Gemini route to stable Gemini 3 models

The extension will use free-tier stable `gemini-3.5-flash` for drafting and Profile PDF processing, with one attempt on free-tier stable `gemini-3.1-flash-lite` only after an explicit quota or rate-limit response. It will not route users to a paid-only model. Requests use minimal Gemini 3 thinking and default sampling parameters; ambiguous timeouts, network failures, authentication failures, and invalid responses still do not trigger another generation. This replaces the deprecated Gemini 2.5 route while preserving the backend-free bring-your-own-key boundary and a cost-efficient fallback.
