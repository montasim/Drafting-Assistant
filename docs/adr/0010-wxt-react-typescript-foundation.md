---
status: accepted
---

# Use WXT, React, and strict TypeScript

The extension will use WXT for Manifest V3 packaging and entrypoints, React for onboarding, settings, history, and side-panel interfaces, and strict TypeScript throughout. Radix Primitives will provide complex accessible UI behavior while CSS Modules and local design tokens own appearance, with no remote fonts or styles. Domain entities and application use cases will remain framework-independent behind explicit ports, while thin adapters own LinkedIn DOM access, Gemini HTTP calls, Chrome APIs, storage, and runtime messaging; this adds framework dependencies in exchange for reliable multi-entrypoint builds, accessible interfaces, and independently testable product logic.
