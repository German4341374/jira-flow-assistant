# Five-minute local demo

Prepare first: npm ci, npx playwright install chromium, npm run build. Start npm run mock, then load dist as an unpacked Chrome extension.

1. Open the popup and dashboard; connect mock Jira. Explain the visible local-preview boundary.
2. Load all three search pages. Open PAY-104 and inspect missing assignee/priority and stale health results. Assign it and set High priority.
3. Select an available transition and add a comment. Show that results survive refreshing the extension while the mock remains running.
4. Open Blockers with all issues loaded; PAY-104 blocks PAY-101, which in turn blocks PAY-105. Generate a standup from the mock author's real comments.
5. Choose PAY-101 and PAY-102 in Bulk, preview release-2.4, apply, and inspect individual success rows. Explain partial failures and the lack of universal undo.

Conclude with tests and the documented OAuth boundary. Do not describe this as a production Jira deployment.
