---
status: accepted
---

# Default to session-only credential retention

Provider Credentials will be held in Chrome session storage by default and cleared when the browser restarts, the extension updates, or it is disabled. Users may explicitly opt into “Remember on this device” after seeing that persistent extension storage is not a dedicated secret vault; credentials will never be synchronized, exposed to content scripts, committed with the extension, or included in logs and diagnostics.

The plaintext persistent-storage portion of this decision is superseded by ADR 0023. Device retention now stores only encrypted credential envelopes and unlocks them automatically with a non-exportable extension-origin key.
