# Testing

npm run verify runs Prettier, ESLint, strict TypeScript, Vitest, build and Playwright. Integration tests bind a local server and validate cursor pages, assignments, transition discovery, comments, creation, 429 handling and partial bulk errors. E2E drives the dashboard and separately installs the built MV3 extension in a persistent Chromium context.

Security regressions cover unsafe URLs/settings, XSS-as-text, absent authentication, redacted error surfaces, oversized responses and mutation retry prevention. These are automated checks, not an independent security audit or proof of production readiness. Actual results are recorded in verification.md after execution. No real Jira requests are claimed.
