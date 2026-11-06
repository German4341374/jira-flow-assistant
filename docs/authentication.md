# Authentication

## Current boundary

The preview's only UI connection is to the unauthenticated synthetic loopback server. There is no token input, no token persistence and no production Login button that silently connects to mocks. The Cloud client accepts an injected asynchronous token provider; without one it fails with AUTH_REQUIRED.

## Production decision

Reviewed 6 November 2026: Atlassian's [OAuth 2.0 authorization-code 3LO documentation](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/) includes client_secret in token exchange and refresh requests. An extension is a public client and cannot protect that secret.

A production implementation therefore needs a trusted confidential-client token broker, a registered app/callback, state binding with expiry, one-time callback handling and explicit resource selection. The broker must encrypt retained refresh tokens using a separately managed key, serialize token rotation and support disconnect/revocation. A broker is not implemented in this preview. Do not put client_secret into Vite variables, the manifest, source code or extension storage.

Classic scopes to review for the proposed operations: read:jira-work, write:jira-work and read:jira-user. offline_access is only needed if refresh tokens are used. Confirm endpoint-specific scopes before deployment. Requests would use api.atlassian.com/ex/jira/{cloudId}/rest/api/3, not a fabricated session-cookie integration.

Tests currently establish missing-auth rejection and safe error reporting, not a successful production OAuth handshake. Real Jira validation requires an app registration and user consent; no credentials are requested in this repository.
