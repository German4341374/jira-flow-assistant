# Jira API contract notes

Official references reviewed on 6 November 2026:

- [REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Enhanced issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
- [Issues, assignment and transitions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/)
- [Fields](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/)
- [Rate limits](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/)

Search uses POST /search/jql with nextPageToken, not the retired offset search route. Comments use startAt pagination and fail explicitly above the preview's 200-comment bound rather than silently truncating a standup. Transitions are fetched per issue before mutation; status names are never submitted as transition IDs.

Descriptions/comments use Atlassian Document Format. The renderer extracts text with a depth bound, not HTML. Fields are discovered through /field and the estimate mapping is chosen by the user; no universal story-point ID is assumed.

Transport has a ten-second request timeout, a streaming 1 MiB body cap, redirect rejection, generic error codes and bounded retries for GET requests after 429. Retry-After above five seconds is returned to the UI rather than delaying invisibly. Writes, and POST-based search, are not automatically retried. The user may retry search after the reported cooldown.

The mock deliberately implements only the used subset. It has two-item search pages, dynamic transitions, comments, assignment, creation and synthetic fault endpoints. It is not a Jira emulator or contract certification. Real create-screen requirements, custom permissions, workflow-required fields and arbitrary JQL require further work.
