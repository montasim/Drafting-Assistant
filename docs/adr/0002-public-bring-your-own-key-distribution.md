---
status: accepted
---

# Distribute publicly with user-owned provider credentials

The initial public extension will use a bring-your-own-key model and call the Google Gemini API directly from its extension service worker using each user's Provider Credential. It will not embed a shared key or require a managed backend, avoiding centralized authentication, billing, and custody of provider credentials; users remain responsible for their Gemini access, quota, costs, and submitted content. A future managed service would require a new architectural decision rather than silently changing this trust boundary.
