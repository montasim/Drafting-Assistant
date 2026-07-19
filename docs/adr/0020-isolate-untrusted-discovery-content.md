---
status: accepted
---

# Isolate discovery and voice content from provider instructions

All Source Evidence and Voice Samples will be normalized into plain structured Untrusted Discovery Content and kept separate from fixed provider instructions. Groq receives no browser-search, code-execution, credential, LinkedIn, or extension-storage capability; every response must satisfy a versioned JSON schema and local semantic validation, and malformed or suspicious results are rejected rather than partially displayed, accepting reduced availability for stronger prompt-injection resistance.
