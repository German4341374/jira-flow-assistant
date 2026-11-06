# Architecture and requirements

The first milestone is an honest local extension workflow: connect to a synthetic API, load a task, show health, assign it, discover transitions, change status and comment. Supporting screens must use the same HTTP client.

- apps/extension: React pages, popup and MV3 worker.
- apps/mock-jira: loopback-only Node server with independent mutable synthetic state.
- packages/jira-client: bounded HTTP transport and normalized API methods.
- packages/core: domain schemas, deterministic rules, queries, similarity and standup formatting.
- packages/storage: schema-validated IndexedDB preferences only.
- packages/test-fixtures: PAY fixtures.
- tests: unit, HTTP integration and Playwright browser/extension checks.
- scripts: repeatable extension packaging.

The mock is intentionally in-memory and resets at restart. Settings are local to each browser/extension origin. Runtime issue data stays in React memory. Mutations await server success; failed writes do not become successful UI state. Bulk updates are individually committed by Jira and cannot be made atomic by the extension.

No content script scrapes Jira. An explicit keyboard action reads only the active tab URL. Browser-side API integration must remain behind an authentication boundary until the production connector is implemented.

A 0.1 preview is useful for evaluating the interaction model, not for handling confidential production work.
