import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import { fixtures, demoUser } from "../../packages/test-fixtures/pay.ts";
import { adf, plainText } from "../../packages/core/model.ts";
export function createMock() {
  const state = fixtures();
  let rate = 0;
  let failKey = "";
  const send = (res: ServerResponse, code: number, value?: unknown) => {
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(value === undefined ? undefined : JSON.stringify(value));
  };
  async function body(req: IncomingMessage) {
    let data = "";
    for await (const chunk of req) {
      data += String(chunk);
      if (data.length > 65536) throw new Error("Too large");
    }
    return data ? JSON.parse(data) : {};
  }
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (
      origin &&
      !/^chrome-extension:\/\/[a-p]{32}$/.test(origin) &&
      origin !== "http://127.0.0.1:5173"
    ) {
      send(res, 403, { error: "Origin denied" });
      return;
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    if (req.method === "OPTIONS") {
      send(res, 204);
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1:4318"),
      path = url.pathname,
      method = req.method;
    try {
      if (path === "/health") {
        send(res, 200, { status: "ok", mode: "synthetic" });
        return;
      }
      if (path === "/__test/reset" && method === "POST") {
        Object.assign(state, fixtures());
        rate = 0;
        failKey = "";
        send(res, 204);
        return;
      }
      if (path === "/__test/fault" && method === "POST") {
        const b = await body(req);
        rate = Number(b.rate) || 0;
        failKey = String(b.failKey ?? "");
        send(res, 204);
        return;
      }
      if (rate > 0) {
        rate--;
        res.setHeader("Retry-After", "0");
        send(res, 429, { error: "Synthetic rate limit" });
        return;
      }
      if (path === "/rest/api/3/myself") {
        send(res, 200, demoUser);
        return;
      }
      if (path === "/rest/api/3/field") {
        send(res, 200, [{ id: "customfield_10100", name: "Story points" }]);
        return;
      }
      if (path === "/rest/api/3/search/jql" && method === "POST") {
        const b = await body(req);
        let issues = state.issues;
        const key = b.jql?.match(/key = "([A-Z]+-\d+)"/)?.[1],
          text = b.jql?.match(/summary ~ "((?:\\.|[^"])*)"/)?.[1];
        if (key) issues = issues.filter((i) => i.key === key);
        if (text) {
          const decoded = text.replace(/\\(.)/g, "$1").toLowerCase();
          issues = issues.filter((i) =>
            i.fields.summary.toLowerCase().includes(decoded),
          );
        }
        if (b.jql?.includes("currentUser()"))
          issues = issues.filter(
            (i) => i.fields.assignee?.accountId === demoUser.accountId,
          );
        const offset = Number(b.nextPageToken ?? 0);
        if (!Number.isInteger(offset) || offset < 0) {
          send(res, 400, {});
          return;
        }
        const page = issues.slice(offset, offset + 2),
          next = offset + page.length;
        send(res, 200, {
          issues: page,
          isLast: next >= issues.length,
          ...(next < issues.length ? { nextPageToken: String(next) } : {}),
        });
        return;
      }
      if (path === "/rest/api/3/issue" && method === "POST") {
        const b = await body(req),
          f = b.fields;
        if (
          !f?.summary ||
          String(f.summary).length > 255 ||
          f.project?.key !== "PAY"
        ) {
          send(res, 400, {});
          return;
        }
        const base = structuredClone(fixtures().issues[0]),
          n = 101 + state.issues.length;
        base.key = "PAY-" + n;
        base.id = String(n);
        base.fields.summary = String(f.summary);
        base.fields.description = adf(plainText(f.description));
        base.fields.issuelinks = [];
        if (f.parent) {
          if (!state.issues.some((i) => i.key === f.parent.key)) {
            send(res, 400, {});
            return;
          }
          base.fields.parent = { key: f.parent.key };
        }
        state.issues.push(base);
        send(res, 201, { id: base.id, key: base.key });
        return;
      }
      const match = path.match(
        /^\/rest\/api\/3\/issue\/([A-Z]+-\d+)(?:\/(assignee|transitions|comment))?$/,
      );
      if (!match) {
        send(res, 404, {});
        return;
      }
      const issue = state.issues.find((i) => i.key === match[1]);
      if (!issue) {
        send(res, 404, {});
        return;
      }
      if (method !== "GET" && issue.key === failKey) {
        send(res, 403, { error: "Synthetic permission failure" });
        return;
      }
      const part = match[2];
      if (!part && method === "GET") {
        send(res, 200, issue);
        return;
      }
      if (part === "transitions") {
        const transitions =
          issue.fields.status.statusCategory.key === "done"
            ? []
            : [
                { id: "2", name: "In Progress" },
                { id: "3", name: "Done" },
              ].filter((t) => t.name !== issue.fields.status.name);
        if (method === "GET") {
          send(res, 200, { transitions });
          return;
        }
        const b = await body(req),
          selected = transitions.find((t) => t.id === b.transition?.id);
        if (!selected) {
          send(res, 400, {});
          return;
        }
        issue.fields.status = {
          ...selected,
          statusCategory: {
            key: selected.id === "3" ? "done" : "indeterminate",
          },
        };
        issue.fields.updated = new Date().toISOString();
        send(res, 204);
        return;
      }
      if (part === "comment") {
        const comments = (state.comments[issue.key] ??= []);
        if (method === "GET") {
          const start = Number(url.searchParams.get("startAt") ?? 0);
          send(res, 200, {
            comments: comments.slice(start, start + 50),
            total: comments.length,
            startAt: start,
            maxResults: 50,
          });
          return;
        }
        const b = await body(req);
        if (!plainText(b.body).trim()) {
          send(res, 400, {});
          return;
        }
        const comment = {
          id: String(comments.length + 1),
          body: adf(plainText(b.body)),
          created: new Date().toISOString(),
          author: demoUser,
        };
        comments.push(comment);
        send(res, 201, comment);
        return;
      }
      const b = await body(req);
      if (part === "assignee" && method === "PUT") {
        if (b.accountId !== demoUser.accountId) {
          send(res, 400, {});
          return;
        }
        issue.fields.assignee = demoUser;
      } else if (!part && method === "PUT") {
        if (b.fields?.priority) issue.fields.priority = b.fields.priority;
        if (b.fields?.labels) issue.fields.labels = b.fields.labels;
        if (b.update?.labels)
          for (const operation of b.update.labels) {
            if (typeof operation.add !== "string") {
              send(res, 400, {});
              return;
            }
            issue.fields.labels = [
              ...new Set([...issue.fields.labels, operation.add]),
            ];
          }
      } else {
        send(res, 405, {});
        return;
      }
      issue.fields.updated = new Date().toISOString();
      send(res, 204);
    } catch {
      send(res, 400, { error: "Invalid request" });
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createMock();
  server.listen(4318, "127.0.0.1", () =>
    console.log("Synthetic Jira listening on 127.0.0.1:4318"),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => server.close(() => process.exit(0)));
}
