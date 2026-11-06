import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { createMock } from "../apps/mock-jira/server.ts";
import {
  JiraClient,
  planLabels,
  executeLabels,
} from "../packages/jira-client/client.ts";
import { query } from "../packages/core/features.ts";
const server = createMock();
const client = new JiraClient("http://127.0.0.1:4318/rest/api/3");
beforeAll(async () => {
  await new Promise<void>((resolve) =>
    server.listen(4318, "127.0.0.1", resolve),
  );
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(async () => {
  await fetch("http://127.0.0.1:4318/__test/reset", { method: "POST" });
});
it("loads all cursor pages without assuming one response is complete", async () => {
  let token: string | undefined;
  const keys: string[] = [];
  do {
    const p = await client.search(query("PAY", ""), token);
    keys.push(...p.issues.map((i) => i.key));
    token = p.nextPageToken;
  } while (token);
  expect(new Set(keys).size).toBe(5);
});
it("executes the issue vertical slice through HTTP", async () => {
  await client.assignMe("PAY-104");
  expect((await client.issue("PAY-104")).fields.assignee?.accountId).toBe(
    "demo-engineer",
  );
  await client.transition("PAY-104", "2");
  expect((await client.issue("PAY-104")).fields.status.name).toBe(
    "In Progress",
  );
  await client.comment("PAY-104", "Investigating");
  expect(await client.comments("PAY-104")).toHaveLength(1);
});
it("rejects unavailable transitions", async () =>
  expect(client.transition("PAY-101", "invalid")).rejects.toThrow(
    "TRANSITION_NOT_AVAILABLE",
  ));
it("creates a subtask", async () => {
  const i = await client.create("Follow up", "Check results", "PAY-101");
  expect((await client.issue(i.key)).fields.parent?.key).toBe("PAY-101");
});
it("handles partial bulk failures without retrying successful mutations", async () => {
  await fetch("http://127.0.0.1:4318/__test/fault", {
    method: "POST",
    body: JSON.stringify({ failKey: "PAY-102" }),
  });
  const page = await client.search(query("PAY", ""));
  const plan = planLabels(page.issues, "release-2.4");
  const result = await executeLabels(client, plan, true);
  expect(result.map((r) => r.ok)).toEqual([true, false]);
  await expect(executeLabels(client, plan, true)).rejects.toThrow();
  expect((await client.issue("PAY-101")).fields.labels).toEqual([
    "release-2.4",
  ]);
});
it("backs off safe reads after a 429", async () => {
  await fetch("http://127.0.0.1:4318/__test/fault", {
    method: "POST",
    body: JSON.stringify({ rate: 1 }),
  });
  expect((await client.me()).accountId).toBe("demo-engineer");
});
it("discovers fields without a universal estimate ID", async () =>
  expect((await client.fields())[0].id).toBe("customfield_10100"));
it("does not permit arbitrary web origins to modify synthetic state", async () => {
  const r = await fetch("http://127.0.0.1:4318/__test/reset", {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  });
  expect(r.status).toBe(403);
});
