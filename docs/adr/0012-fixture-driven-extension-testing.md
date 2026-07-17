---
status: accepted
---

# Test the extension with controlled fixtures

Automated verification will use Vitest for domain and application logic, React Testing Library for interfaces, sanitized LinkedIn-like HTML fixtures for DOM-adapter contracts, and Playwright to load the built Manifest V3 extension against controlled pages and mocked Gemini responses. A pnpm-based GitHub Actions pipeline will enforce formatting, linting, strict type checking, tests, and the production build, then retain the exact packed artifact it tested. Live LinkedIn verification is limited to a documented manual smoke test, accepting fixture-maintenance work in exchange for deterministic tests and no automated activity against a real account.
