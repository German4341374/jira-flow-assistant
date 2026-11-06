import { plainText, type Issue, type Settings, type Comment } from "./model.ts";
export function health(issue: Issue, settings: Settings, now = Date.now()) {
  const f = issue.fields,
    description = plainText(f.description),
    done = f.status.statusCategory.key === "done";
  const checks = [
    { id: "summary", label: "Summary exists", pass: !!f.summary.trim() },
    {
      id: "description",
      label: "Description has at least 40 characters",
      pass: description.trim().length >= 40,
    },
    {
      id: "acceptance",
      label: "Acceptance criteria present",
      pass: /(acceptance criteria|definition of done|^AC\s*:|given[\s\S]+when[\s\S]+then)/im.test(
        description,
      ),
    },
    { id: "assignee", label: "Assignee present", pass: !!f.assignee },
    { id: "priority", label: "Priority present", pass: !!f.priority },
    {
      id: "estimate",
      label: settings.estimateField
        ? "Estimate present"
        : "Estimate field not mapped",
      pass: settings.estimateField
        ? typeof f[settings.estimateField] === "number"
        : false,
    },
    {
      id: "component",
      label: "Component present",
      pass: f.components.length > 0,
    },
    { id: "labels", label: "Labels present", pass: f.labels.length > 0 },
    { id: "due", label: "Due date present", pass: !!f.duedate },
    {
      id: "stale",
      label: "Updated recently or completed",
      pass:
        done || now - Date.parse(f.updated) <= settings.staleDays * 86400000,
    },
  ];
  return checks.filter((c) => !settings.disabledRules.includes(c.id));
}
export function quoteJql(value: string) {
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}
export function query(project: string, text: string, mine = false) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(project))
    throw new Error("Invalid project key");
  const parts = ["project = " + quoteJql(project)];
  if (text.trim())
    parts.push(
      /^[A-Z][A-Z0-9_]*-\d+$/.test(text.trim())
        ? "key = " + quoteJql(text.trim())
        : "summary ~ " + quoteJql(text.trim()),
    );
  if (mine) parts.push("assignee = currentUser()");
  return parts.join(" AND ") + " ORDER BY updated DESC";
}
export function branchName(issue: Issue) {
  return (
    issue.key.toLowerCase() +
    "-" +
    issue.fields.summary.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  )
    .replace(/-+$/, "")
    .slice(0, 80);
}
export function similar(title: string, issues: Issue[]) {
  const words = (s: string) =>
      new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []),
    a = words(title);
  return issues
    .map((issue) => {
      const b = words(issue.fields.summary),
        intersection = [...a].filter((x) => b.has(x)).length;
      return { issue, score: intersection / (new Set([...a, ...b]).size || 1) };
    })
    .filter((x) => x.score > 0.2)
    .sort((a, b) => b.score - a.score);
}
export function blockers(issues: Issue[]) {
  const keys = new Set(issues.map((i) => i.key));
  return issues.flatMap((i) =>
    i.fields.issuelinks
      .filter((l) => l.type.inward === "is blocked by" && l.inwardIssue)
      .map((l) => ({
        blocked: i.key,
        blocker: l.inwardIssue!.key,
        loaded: keys.has(l.inwardIssue!.key),
      })),
  );
}
export function standup(
  issues: Issue[],
  comments: Record<string, Comment[]>,
  accountId: string,
  since: number,
) {
  const activity = issues.flatMap((i) =>
    (comments[i.key] ?? [])
      .filter(
        (c) =>
          c.author.accountId === accountId && Date.parse(c.created) >= since,
      )
      .map(
        (c) =>
          "- " +
          i.key +
          " — commented at " +
          c.created +
          ": " +
          plainText(c.body),
      ),
  );
  const assigned = issues.filter(
    (i) =>
      i.fields.assignee?.accountId === accountId &&
      i.fields.status.statusCategory.key !== "done",
  );
  return (
    "# Standup draft\n\n## Recent comments (loaded issues only)\n" +
    (activity.join("\n") || "No matching comments loaded.") +
    "\n\n## Today — choose your plan\n" +
    assigned
      .map((i) => "- [ ] " + i.key + " — " + i.fields.summary)
      .join("\n") +
    "\n\n## Linked blockers (status not inferred)\n" +
    blockers(assigned)
      .map((e) => "- " + e.blocked + " is blocked by " + e.blocker)
      .join("\n")
  );
}
export const templates: Record<string, string> = {
  Bug: "## Environment\n\n## Steps to reproduce\n1. \n\n## Actual result\n\n## Expected result\n\n## Evidence",
  Story: "## Description\n\n## Acceptance Criteria\nGiven\nWhen\nThen",
  Support:
    "## User impact\n\n## First observed\n{{date}}\n\n## Steps already performed\n\n## Workaround",
};
export function renderTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/{{(\w+)}}/g, (whole, key: string) => vars[key] ?? whole);
}
