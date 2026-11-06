# Bulk actions

Only adding labels is implemented. A plan deduplicates keys, validates the label and limits selection to 50 issues. Preview shows the exact keys and value. Execution requires explicit confirmation, serializes requests and returns per-key success/error. Label add uses Jira's additive update operation so it does not replace unrelated labels with an old snapshot.

The same plan object cannot execute twice in one page session. This is not distributed exactly-once delivery. A timeout can leave an unknown server outcome; inspect the issue before retrying. No journal or undo is implemented. Future assignment/priority/transition operations need metadata validation and conflict-aware compensation; do not present them as supported.
