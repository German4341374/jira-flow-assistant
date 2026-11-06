import { z } from "zod";
import {
  issueSchema,
  transitionSchema,
  commentSchema,
  userSchema,
  adf,
  type Issue,
} from "../core/model.ts";
export type AuthProvider = () => Promise<string | undefined>;
export class JiraError extends Error {
  constructor(
    public code: string,
    public retryAfterMs = 0,
  ) {
    super(code);
  }
}
export class JiraClient {
  constructor(
    readonly base: string,
    private auth: AuthProvider = async () => undefined,
    private transport: typeof fetch = fetch,
  ) {
    const u = new URL(base);
    if (
      base !== "http://127.0.0.1:4318/rest/api/3" &&
      !/^https:\/\/api\.atlassian\.com\/ex\/jira\/[a-zA-Z0-9-]+\/rest\/api\/3$/.test(
        base,
      )
    )
      throw new JiraError("INVALID_SITE");
    if (u.username || u.password || u.search || u.hash)
      throw new JiraError("INVALID_SITE");
  }
  async request(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!/^\/[a-zA-Z0-9/?=&%_.-]+$/.test(path) || path.includes(".."))
      throw new JiraError("INVALID_REQUEST");
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = await this.auth();
      if (this.base.startsWith("https:") && !token)
        throw new JiraError("AUTH_REQUIRED");
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = "Bearer " + token;
      const timeout = AbortSignal.timeout(10000);
      let response: Response;
      try {
        response = await this.transport.call(globalThis, this.base + path, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: "error",
          credentials: "omit",
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch {
        throw new JiraError(signal?.aborted ? "CANCELLED" : "NETWORK_ERROR");
      }
      if (response.status === 429) {
        const retry = response.headers.get("Retry-After");
        const delay = retry
          ? Number.isFinite(Number(retry))
            ? Number(retry) * 1000
            : Math.max(0, Date.parse(retry) - Date.now())
          : 1000 * 2 ** attempt;
        await response.body?.cancel();
        if (
          method === "GET" &&
          attempt < 2 &&
          Number.isFinite(delay) &&
          delay <= 5000
        ) {
          await new Promise<void>((resolve, reject) => {
            const cancel = () => {
              clearTimeout(timer);
              reject(new JiraError("CANCELLED"));
            };
            const timer = setTimeout(
              () => {
                signal?.removeEventListener("abort", cancel);
                resolve();
              },
              Math.max(0, delay),
            );
            if (signal?.aborted) cancel();
            else signal?.addEventListener("abort", cancel, { once: true });
          });
          continue;
        }
        throw new JiraError(
          "RATE_LIMITED",
          Number.isFinite(delay) ? delay : 60000,
        );
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new JiraError(
          (
            {
              401: "AUTH_EXPIRED",
              403: "PERMISSION_DENIED",
              404: "ISSUE_NOT_FOUND",
              400: "INVALID_REQUEST",
            } as Record<number, string>
          )[response.status] ?? "JIRA_API_ERROR",
        );
      }
      if (response.status === 204) return undefined;
      const reader = response.body?.getReader();
      if (!reader) throw new JiraError("INVALID_RESPONSE");
      const decoder = new TextDecoder();
      let size = 0,
        text = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1024 * 1024) {
            await reader.cancel();
            throw new JiraError("RESPONSE_TOO_LARGE");
          }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        return JSON.parse(text);
      } catch (error) {
        if (error instanceof JiraError) throw error;
        throw new JiraError("INVALID_RESPONSE");
      } finally {
        reader.releaseLock();
      }
    }
    throw new JiraError("RATE_LIMITED");
  }
  private key(key: string) {
    if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(key))
      throw new JiraError("INVALID_REQUEST");
    return key;
  }
  async me() {
    return userSchema.parse(await this.request("/myself"));
  }
  async search(jql: string, nextPageToken?: string, signal?: AbortSignal) {
    return z
      .object({
        issues: z.array(issueSchema),
        nextPageToken: z.string().optional(),
        isLast: z.boolean().optional(),
      })
      .parse(
        await this.request(
          "/search/jql",
          "POST",
          {
            jql,
            maxResults: 25,
            fields: [
              "summary",
              "description",
              "status",
              "issuetype",
              "project",
              "priority",
              "assignee",
              "reporter",
              "labels",
              "components",
              "created",
              "updated",
              "duedate",
              "issuelinks",
              "parent",
            ],
            ...(nextPageToken ? { nextPageToken } : {}),
          },
          signal,
        ),
      );
  }
  async issue(key: string) {
    return issueSchema.parse(await this.request("/issue/" + this.key(key)));
  }
  async transitions(key: string) {
    return z
      .object({ transitions: z.array(transitionSchema) })
      .parse(await this.request("/issue/" + this.key(key) + "/transitions"))
      .transitions;
  }
  async transition(key: string, id: string) {
    const allowed = await this.transitions(key);
    if (!allowed.some((t) => t.id === id))
      throw new JiraError("TRANSITION_NOT_AVAILABLE");
    await this.request("/issue/" + this.key(key) + "/transitions", "POST", {
      transition: { id },
    });
  }
  async assignMe(key: string) {
    const me = await this.me();
    await this.request("/issue/" + this.key(key) + "/assignee", "PUT", {
      accountId: me.accountId,
    });
  }
  async update(key: string, fields: Record<string, unknown>) {
    await this.request("/issue/" + this.key(key), "PUT", { fields });
  }
  async addLabel(key: string, label: string) {
    await this.request("/issue/" + this.key(key), "PUT", {
      update: { labels: [{ add: label }] },
    });
  }
  async comment(key: string, text: string) {
    if (!text.trim() || text.length > 10000)
      throw new JiraError("INVALID_REQUEST");
    await this.request("/issue/" + this.key(key) + "/comment", "POST", {
      body: adf(text),
    });
  }
  async comments(key: string) {
    const all = [];
    for (let startAt = 0; startAt < 200;) {
      const page = z
        .object({
          comments: z.array(commentSchema),
          total: z.number(),
          startAt: z.number(),
        })
        .parse(
          await this.request(
            "/issue/" +
              this.key(key) +
              "/comment?startAt=" +
              startAt +
              "&maxResults=50",
          ),
        );
      all.push(...page.comments);
      startAt += page.comments.length;
      if (startAt >= page.total) return all;
      if (!page.comments.length) throw new JiraError("INVALID_PAGINATION");
    }
    throw new JiraError("COMMENT_LIMIT_REACHED");
  }
  async fields() {
    return z
      .array(z.object({ id: z.string(), name: z.string() }))
      .parse(await this.request("/field"));
  }
  async create(summary: string, description: string, parent?: string) {
    if (!summary.trim() || summary.length > 255)
      throw new JiraError("INVALID_REQUEST");
    return z.object({ key: z.string() }).parse(
      await this.request("/issue", "POST", {
        fields: {
          project: { key: "PAY" },
          issuetype: { id: parent ? "10002" : "10001" },
          summary,
          description: adf(description),
          ...(parent ? { parent: { key: this.key(parent) } } : {}),
        },
      }),
    );
  }
}
export type BulkPlan = { keys: readonly string[]; label: string };
const executed = new WeakSet<BulkPlan>();
export function planLabels(issues: Issue[], label: string): BulkPlan {
  if (
    !/^[a-zA-Z0-9_.-]{1,64}$/.test(label) ||
    !issues.length ||
    issues.length > 50
  )
    throw new JiraError("INVALID_REQUEST");
  return Object.freeze({
    keys: Object.freeze([...new Set(issues.map((i) => i.key))]),
    label,
  });
}
export async function executeLabels(
  client: JiraClient,
  plan: BulkPlan,
  confirmed: boolean,
) {
  if (!confirmed || executed.has(plan))
    throw new JiraError("CONFIRMATION_REQUIRED");
  executed.add(plan);
  const results: { key: string; ok: boolean; error?: string }[] = [];
  for (const key of plan.keys) {
    try {
      await client.addLabel(key, plan.label);
      results.push({ key, ok: true });
    } catch (error) {
      results.push({
        key,
        ok: false,
        error: error instanceof JiraError ? error.code : "JIRA_API_ERROR",
      });
    }
  }
  return results;
}
