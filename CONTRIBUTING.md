# Contributing

Use Node 24+, npm ci, npm run mock and npm run dev. Run npm run verify and npm audit before proposing changes. Use Conventional Commits.

Add health rules in packages/core/features.ts with deterministic unit tests. Add templates there, then test rendering. Palette navigation lives in apps/extension/main.tsx; do not add inactive buttons. Extend mock fixtures with synthetic data only. Endpoint changes require HTTP integration tests. Preserve the explicit mock/production distinction.

Good first changes: a Waiting for User comment template, a tested stale JQL preset, a configurable description threshold, keyboard focus trapping, a branch-name length preference or a synthetic QA workflow. Open an issue describing behavior and tests first.
