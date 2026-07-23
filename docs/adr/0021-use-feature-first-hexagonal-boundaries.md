# Use feature-first hexagonal boundaries

Thoughtline will use thin WXT entrypoints around a framework-independent domain and application layer, with explicit ports implemented by Chrome, LinkedIn, provider, source, and storage adapters. UI code will be organized by product feature, shadcn primitives will remain in a dedicated local layer, and only genuinely repeated Thoughtline compositions will be shared; this preserves SOLID dependency direction and testability without forcing unrelated workflows through generic components.
