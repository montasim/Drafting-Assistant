---
status: accepted
---

# Use a narrow Gemini-only model route

The extension will use stable `gemini-2.5-flash` for drafting and Profile PDF processing. It may try `gemini-2.5-flash-lite` once only when the primary request receives an explicit quota or rate-limit response. It will not retry after an ambiguous timeout, network failure, authentication failure, or invalid response. No other AI provider or paid-model route is included. Model availability and pricing remain controlled by Google, so the documented registry and consent copy must be reviewed when the route changes.
