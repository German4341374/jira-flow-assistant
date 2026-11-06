# Getting started

## Windows: keep development data on D

Run from your project directory on drive D:

```powershell
$env:npm_config_cache = 'D:\DevCache\npm'
$env:TEMP = 'D:\DevCache\tmp'
$env:TMP = $env:TEMP
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:\DevCache\playwright'
New-Item -ItemType Directory -Force $env:npm_config_cache,$env:TEMP,$env:PLAYWRIGHT_BROWSERS_PATH
npm ci
npx playwright install chromium
npm run verify
```

Use the same environment variables in each terminal. No global packages are needed. Browser profiles created by tests use TEMP. OS-managed caches remain outside the project's control.

## Linux / WSL2

Use Node 24+, npm and a supported Chromium environment. Set npm_config_cache, TMPDIR and PLAYWRIGHT_BROWSERS_PATH to a spacious local filesystem if needed. On a clean Linux CI image, run npx playwright install --with-deps chromium. For manual unpacked-extension installation use Chrome on the host and a host-accessible build.

## Run

npm run mock starts port 4318. npm run dev starts port 5173 in a separate terminal. For the extension use npm run build and load dist at chrome://extensions. No API keys are needed.

## Troubleshooting

NETWORK_ERROR: ensure the loopback mock is running. The build cannot connect to arbitrary hosts.

Port already used: stop existing mock/dev processes before npm run verify; Playwright starts its own servers.

No more issues visible after refresh: search is intentionally page-based. Click Load more. Reports always disclose their loaded scope.

Changes disappeared: synthetic state resets when the mock restarts.

Browser shortcut unavailable: inspect chrome://extensions/shortcuts for conflicts.

Production Jira: not supported yet; do not enter company credentials into modified builds.
