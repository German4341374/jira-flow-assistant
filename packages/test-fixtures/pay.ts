import { adf, type Issue, type Comment } from "../core/model.ts";
export const demoUser = {
  accountId: "demo-engineer",
  displayName: "Demo Engineer",
};
export function fixtures(now = Date.now()) {
  const titles = [
    "Checkout authentication failure",
    "Payment callback timeout",
    "Update checkout UI",
    "Database connection investigation",
    "Release 2.4 QA",
  ];
  const issues: Issue[] = titles.map((summary, n) => ({
    id: String(101 + n),
    key: "PAY-" + (101 + n),
    fields: {
      summary,
      description: adf(
        n === 1
          ? "Callback occasionally times out. Investigate the retry path."
          : "## Description\nInvestigate this synthetic payment flow.\n## Acceptance Criteria\nGiven a request\nWhen processed\nThen return a useful result.",
      ),
      status: { id: "1", name: "To Do", statusCategory: { key: "new" } },
      issuetype: { id: "10001", name: "Task" },
      project: { key: "PAY" },
      priority: n === 3 ? null : { id: "2", name: "High" },
      assignee: n === 3 ? null : demoUser,
      reporter: demoUser,
      labels: [],
      components: [],
      created: new Date(now - 10 * 86400000).toISOString(),
      updated: new Date(
        now - (n === 3 ? 10 : n === 1 ? 5 : 1) * 86400000,
      ).toISOString(),
      duedate: null,
      issuelinks: [],
    },
  }));
  const link = (key: string) => ({
    type: { inward: "is blocked by", outward: "blocks" },
    inwardIssue: { key },
  });
  issues[0].fields.issuelinks = [link("PAY-104")];
  issues[4].fields.issuelinks = [link("PAY-101"), link("PAY-102")];
  const comments: Record<string, Comment[]> = {
    "PAY-102": [
      {
        id: "1",
        body: adf("Investigated callback timeout; checking retry behavior."),
        author: demoUser,
        created: new Date(now - 3600000).toISOString(),
      },
    ],
  };
  return { issues, comments };
}
