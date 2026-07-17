---
status: accepted
---

# Isolate LinkedIn content from provider instructions

All extracted LinkedIn text will be normalized into plain structured data, explicitly delimited as Untrusted Post Content, and kept separate from fixed provider instructions. Gemini receives no tools, credentials, or executable capabilities; its response must satisfy a versioned JSON schema before entering the application, and malformed or instruction-following output is rejected, trading some tolerance of provider output for prompt-injection resistance and predictable boundaries.
