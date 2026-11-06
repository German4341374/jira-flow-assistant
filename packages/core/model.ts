import { z } from "zod";
export const userSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
});
export const adfSchema = z.object({
  type: z.literal("doc"),
  version: z.literal(1),
  content: z.array(z.unknown()),
});
export function plainText(value: unknown, depth = 0): string {
  if (depth > 20 || !value || typeof value !== "object") return "";
  const node = value as { text?: unknown; content?: unknown };
  if (typeof node.text === "string") return node.text;
  return Array.isArray(node.content)
    ? node.content.map((v) => plainText(v, depth + 1)).join("\n")
    : "";
}
export const adf = (text: string) => ({
  type: "doc" as const,
  version: 1 as const,
  content: text.split("\n").map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  })),
});
export const issueSchema = z.object({
  id: z.string(),
  key: z.string().regex(/^[A-Z][A-Z0-9_]*-\d+$/),
  fields: z
    .object({
      summary: z.string(),
      description: z.unknown().optional(),
      status: z.object({
        id: z.string(),
        name: z.string(),
        statusCategory: z.object({ key: z.string() }),
      }),
      issuetype: z.object({ id: z.string(), name: z.string() }),
      project: z.object({ key: z.string() }),
      priority: z.object({ id: z.string(), name: z.string() }).nullable(),
      assignee: userSchema.nullable(),
      reporter: userSchema.optional(),
      labels: z.array(z.string()),
      components: z.array(z.object({ name: z.string() })),
      created: z.string(),
      updated: z.string(),
      duedate: z.string().nullable().optional(),
      issuelinks: z.array(
        z.object({
          type: z.object({ inward: z.string(), outward: z.string() }),
          inwardIssue: z.object({ key: z.string() }).optional(),
          outwardIssue: z.object({ key: z.string() }).optional(),
        }),
      ),
      parent: z.object({ key: z.string() }).optional(),
    })
    .catchall(z.unknown()),
});
export type Issue = z.infer<typeof issueSchema>;
export const transitionSchema = z.object({ id: z.string(), name: z.string() });
export const commentSchema = z.object({
  id: z.string(),
  body: z.unknown(),
  created: z.string(),
  author: userSchema,
});
export type Comment = z.infer<typeof commentSchema>;
export const settingsSchema = z
  .object({
    version: z.literal(1),
    theme: z.enum(["system", "light", "dark"]),
    staleDays: z.number().int().min(1).max(365),
    estimateField: z
      .string()
      .regex(/^customfield_\d+$/)
      .or(z.literal("")),
    disabledRules: z.array(z.string()).max(30),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export const defaults: Settings = {
  version: 1,
  theme: "system",
  staleDays: 7,
  estimateField: "",
  disabledRules: [],
};
export function parseSettings(text: string): Settings {
  if (text.length > 16384) throw new Error("Settings file too large");
  return settingsSchema.parse(JSON.parse(text));
}
export function currentIssue(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".atlassian.net")
      ? u.pathname.match(/^\/browse\/([A-Z][A-Z0-9_]*-\d+)$/)?.[1]
      : undefined;
  } catch {
    return undefined;
  }
}
