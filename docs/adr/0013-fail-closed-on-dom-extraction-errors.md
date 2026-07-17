---
status: accepted
---

# Fail closed when post extraction cannot be validated

Before contacting Gemini, the LinkedIn adapter must uniquely identify and validate a Supported Post Surface, its Visible Post Text, Response Target, and discussion structure. Any missing, ambiguous, or changed structure is an Unsupported Post Layout and stops the request rather than sending partial or whole-page text, accepting reduced availability when LinkedIn changes its DOM in exchange for preventing wrong-target drafts and unrelated data transmission.
