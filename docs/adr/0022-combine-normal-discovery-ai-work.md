# Combine normal discovery assessment and drafting

Status: Accepted

## Decision

A normal Groq-backed Discovery Run will assess locally filtered candidates and create up to three balanced Publication Drafts in one compact, schema-constrained request. The client estimates input size conservatively, caps evidence fields, and reduces the requested completion allowance so the complete request remains below a 7,000-token safety budget for Groq free projects with an 8,000 tokens-per-minute ceiling. Voice analysis, manual selected-opportunity generation, alternatives, and explicit Gemini overrides remain separate user-triggered operations.

## Context

The original two-request design reserved 8,000 completion tokens for assessment alone. Groq includes the input prompt when checking its tokens-per-minute limit, so a real request was rejected as 9,630 requested tokens against an 8,000-token ceiling before generation began. Merely lowering that first allowance would still make an immediate second drafting request compete for the same minute-level budget.

## Consequences

- A normal run uses one Groq request instead of two and stays compatible with the observed free-tier TPM ceiling.
- Source evidence appears only once in the provider prompt, reducing both exposure and token consumption.
- Assessments and automatic drafts share one failure boundary; malformed combined output is rejected without saving a partial new run.
- The extension can still preserve completed assessments when a later, explicitly requested manual draft operation fails.
- A local preflight rejects oversized configurations before sending them and recommends lowering per-source targets or shortening the Voice Guide.
