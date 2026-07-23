# Validate all boundaries with Zod

Thoughtline will use shared Zod schemas as the runtime contracts for user input, React forms, extension messages, Chrome storage, LinkedIn extraction, public-source evidence, provider responses, imported profile data, diagnostics, and the future scheduling API. TypeScript types will be inferred from those schemas where practical, and no untrusted data may enter the domain or be persisted merely through a type assertion; shadcn forms will integrate the same schemas through React Hook Form rather than duplicating validation rules.
