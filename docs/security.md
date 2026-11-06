# Security boundaries

The package is a local preview, not approved for production Jira credentials.

Trust boundaries: browser page URL → extension context; mock/Cloud JSON → typed client → React; imported JSON → strict settings schema → IndexedDB; confirmed bulk plan → API mutations.

Controls:

- No eval, remote scripts, broad all_urls permission or DOM scraping.
- activeTab only for an explicit shortcut; sidePanel for the contextual view.
- Loopback host permission is required by the mock. Chrome host permissions do not narrow by port, while CSP connect-src limits requests to port 4318.
- No raw HTML rendering. ADF text is depth bounded.
- Strict settings imports reject unknown keys, including token fields; 16 KiB import cap.
- Requests reject redirects and non-allowlisted base URLs; streamed responses stop at 1 MiB.
- Error codes omit response bodies and token values. The application does not log issue contents.
- The unauthenticated mock binds only to loopback and rejects unapproved browser origins. Its reset/fault endpoints are test-only features, so it must never be exposed publicly.
- Bulk requires a preview, explicit confirmation and reports each failure. A failed write is not retried automatically.

Residual risks: malicious local processes and other installed extensions are out of scope; the mock is not an authentication boundary. Regex/text rules are heuristics. Loaded views are incomplete until pagination is exhausted. General accessibility, production OAuth, full rate-budget coordination, cancellation of all issue-detail requests and independent security audit remain unfinished.

Dependency selection uses an explicit minimatch 11.0.1 override to avoid the advisory affecting earlier versions. Lint/test compatibility is checked; reconsider this override with future upstream updates. TypeScript 6.0.3 is used because the chosen lint tooling does not support TypeScript 7 yet.
