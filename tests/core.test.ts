import { describe, it, expect } from "vitest";
import { fixtures } from "../packages/test-fixtures/pay.ts";
import {
  defaults,
  parseSettings,
  plainText,
  adf,
  currentIssue,
} from "../packages/core/model.ts";
import {
  health,
  query,
  branchName,
  similar,
  blockers,
  standup,
  renderTemplate,
} from "../packages/core/features.ts";
import {
  JiraClient,
  JiraError,
  planLabels,
  executeLabels,
} from "../packages/jira-client/client.ts";
describe("deterministic core", () => {
  it("explains missing health checks", () => {
    const issue = fixtures().issues[3];
    const checks = health(issue, defaults);
    expect(checks.find((c) => c.id === "assignee")?.pass).toBe(false);
    expect(checks.find((c) => c.id === "stale")?.pass).toBe(false);
  });
  it("does not call completed issues stale", () => {
    const issue = fixtures().issues[3];
    issue.fields.status.statusCategory.key = "done";
    expect(health(issue, defaults).find((c) => c.id === "stale")?.pass).toBe(
      true,
    );
  });
  it("honors disabled rules", () =>
    expect(
      health(fixtures().issues[0], {
        ...defaults,
        disabledRules: ["estimate"],
      }).some((c) => c.id === "estimate"),
    ).toBe(false));
  it("uses mapped fields including zero", () => {
    const issue = fixtures().issues[0];
    issue.fields.customfield_123 = 0;
    expect(
      health(issue, { ...defaults, estimateField: "customfield_123" }).find(
        (c) => c.id === "estimate",
      )?.pass,
    ).toBe(true);
  });
  it("does not invent acceptance criteria", () =>
    expect(
      health(fixtures().issues[1], defaults).find((c) => c.id === "acceptance")
        ?.pass,
    ).toBe(false));
  it("escapes JQL values", () =>
    expect(query("PAY", 'x" OR x')).toContain('x\\" OR x'));
  it("rejects invalid project", () =>
    expect(() => query("PAY OR 1", "")).toThrow());
  it("recognizes issue-key searches", () =>
    expect(query("PAY", "PAY-101")).toContain('key = "PAY-101"'));
  it("supports current user search", () =>
    expect(query("PAY", "", true)).toContain("currentUser()"));
  it("creates safe branch names", () =>
    expect(branchName(fixtures().issues[0])).toMatch(/^[a-z0-9-]{1,80}$/));
  it("ranks overlap rather than claiming duplicates", () =>
    expect(
      similar("Payment callback timeout", fixtures().issues)[0].score,
    ).toBe(1));
  it("returns no match for empty title", () =>
    expect(similar("", fixtures().issues)).toEqual([]));
  it("builds directed blocker edges", () =>
    expect(blockers(fixtures().issues)).toContainEqual({
      blocker: "PAY-104",
      blocked: "PAY-101",
      loaded: true,
    }));
  it("builds standup only from supplied activity", () => {
    const f = fixtures();
    const s = standup(
      f.issues,
      f.comments,
      "demo-engineer",
      Date.now() - 86400000,
    );
    expect(s).toContain("Investigated callback");
    expect(s).not.toContain("resolved");
  });
  it("filters another author", () => {
    const f = fixtures();
    expect(standup(f.issues, f.comments, "other", 0)).not.toContain(
      "Investigated callback",
    );
  });
  it("renders known variables and preserves unknown", () =>
    expect(renderTemplate("{{date}} {{missing}}", { date: "today" })).toBe(
      "today {{missing}}",
    ));
  it("ADF preserves text without interpreting HTML", () =>
    expect(plainText(adf("<script>alert(1)</script>"))).toBe(
      "<script>alert(1)</script>",
    ));
  it.each([
    '{"token":"secret"}',
    '{"__proto__":{"polluted":true}}',
    "[]",
    "null",
  ])("rejects unsafe settings %s", (s) =>
    expect(() => parseSettings(s)).toThrow(),
  );
  it("round trips settings", () =>
    expect(parseSettings(JSON.stringify(defaults))).toEqual(defaults));
  it("rejects oversized settings", () =>
    expect(() => parseSettings(" ".repeat(17000))).toThrow());
  it.each([
    "javascript:alert(1)",
    "https://evil.example/browse/PAY-1",
    "https://a.atlassian.net.evil.example/browse/PAY-1",
  ])("rejects unsafe URL %s", (s) => expect(currentIssue(s)).toBeUndefined());
  it("recognizes Jira issue context", () =>
    expect(currentIssue("https://example.atlassian.net/browse/PAY-101")).toBe(
      "PAY-101",
    ));
  it("rejects arbitrary API origins", () =>
    expect(() => new JiraClient("https://evil.example")).toThrow(
      "INVALID_SITE",
    ));
  it("requires auth for the Cloud adapter", async () =>
    expect(
      new JiraClient("https://api.atlassian.com/ex/jira/site/rest/api/3").me(),
    ).rejects.toThrow("AUTH_REQUIRED"));
  it("rejects empty bulk plan", () =>
    expect(() => planLabels([], "label")).toThrow());
  it("requires explicit bulk confirmation", async () =>
    expect(
      executeLabels(
        new JiraClient("http://127.0.0.1:4318/rest/api/3"),
        planLabels(fixtures().issues, "test"),
        false,
      ),
    ).rejects.toThrow("CONFIRMATION_REQUIRED"));
  it("does not expose response bodies in errors", async () => {
    const c = new JiraClient(
      "http://127.0.0.1:4318/rest/api/3",
      async () => undefined,
      async () => new Response("Bearer secret", { status: 401 }),
    );
    await expect(c.me()).rejects.toThrow(new JiraError("AUTH_EXPIRED"));
  });
  it("bounds streamed responses", async () => {
    const c = new JiraClient(
      "http://127.0.0.1:4318/rest/api/3",
      async () => undefined,
      async () => new Response("x".repeat(1024 * 1024 + 1)),
    );
    await expect(c.me()).rejects.toThrow("RESPONSE_TOO_LARGE");
  });
  it("does not retry writes on rate limits", async () => {
    let calls = 0;
    const c = new JiraClient(
      "http://127.0.0.1:4318/rest/api/3",
      async () => undefined,
      async () => {
        calls++;
        return new Response("", {
          status: 429,
          headers: { "Retry-After": "0" },
        });
      },
    );
    await expect(c.comment("PAY-101", "Hello")).rejects.toThrow("RATE_LIMITED");
    expect(calls).toBe(1);
  });
});
