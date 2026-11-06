import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  JiraClient,
  executeLabels,
  planLabels,
  JiraError,
  type BulkPlan,
} from "../../packages/jira-client/client.ts";
import {
  defaults,
  parseSettings,
  plainText,
  type Issue,
  type Comment,
  type Settings,
} from "../../packages/core/model.ts";
import {
  health,
  query,
  blockers,
  standup,
  templates,
  renderTemplate,
  branchName,
  similar,
} from "../../packages/core/features.ts";
import { loadSettings, saveSettings } from "../../packages/storage/settings.ts";
import "./style.css";
const client = new JiraClient("http://127.0.0.1:4318/rest/api/3");
const views = [
  "My Work",
  "Triage",
  "Blockers",
  "Standup",
  "Bulk",
  "Create",
  "Settings",
];
function App() {
  const [connected, setConnected] = useState(false),
    [view, setView] = useState(
      new URLSearchParams(location.search).get("view") ?? "My Work",
    );
  const [issues, setIssues] = useState<Issue[]>([]),
    [selected, setSelected] = useState<Issue>(),
    [transitions, setTransitions] = useState<{ id: string; name: string }[]>(
      [],
    ),
    [comments, setComments] = useState<Comment[]>([]);
  const [next, setNext] = useState<string>(),
    [search, setSearch] = useState(""),
    [mine, setMine] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [settings, setSettings] = useState<Settings>(defaults);
  const [comment, setComment] = useState(""),
    [chosen, setChosen] = useState<string[]>([]),
    [label, setLabel] = useState("release-2.4"),
    [plan, setPlan] = useState<BulkPlan>(),
    [results, setResults] = useState<
      { key: string; ok: boolean; error?: string }[]
    >([]);
  const [summary, setSummary] = useState(""),
    [description, setDescription] = useState(templates.Bug),
    [parent, setParent] = useState(""),
    [draft, setDraft] = useState(""),
    [palette, setPalette] = useState(false),
    [settingsText, setSettingsText] = useState(""),
    [fields, setFields] = useState<{ id: string; name: string }[]>([]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (e) {
      setNotice(
        e instanceof JiraError
          ? e.code +
              (e.retryAfterMs
                ? " — retry after " +
                  Math.ceil(e.retryAfterMs / 1000) +
                  " seconds"
                : "")
          : "Could not complete this action. Check the mock server and input.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function open(issue: Issue) {
    const [fresh, t, c] = await Promise.all([
      client.issue(issue.key),
      client.transitions(issue.key),
      client.comments(issue.key),
    ]);
    setSelected(fresh);
    setTransitions(t);
    setComments(c);
  }
  async function refresh() {
    const page = await client.search(query("PAY", search, mine));
    setIssues(page.issues);
    setNext(page.nextPageToken);
    if (selected) await open(selected);
  }
  async function change(action: () => Promise<void>) {
    await action();
    await refresh();
    setNotice("Saved by the server.");
  }
  useEffect(() => {
    void loadSettings()
      .then(setSettings)
      .catch(() => setNotice("Local settings unavailable; using defaults."));
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void client
        .search(query("PAY", search, mine), undefined, controller.signal)
        .then((page) => {
          if (!controller.signal.aborted) {
            setIssues(page.issues);
            setNext(page.nextPageToken);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setNotice(e instanceof JiraError ? e.code : "Search failed");
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, mine, connected]);
  const checks = selected ? health(selected, settings) : [],
    edges = blockers(issues);
  return (
    <>
      <header>
        <div>
          <strong>Flow Assistant</strong>
          <span className="tag">LOCAL PREVIEW</span>
        </div>
        <button onClick={() => setPalette(true)}>
          Commands <kbd>Ctrl ⇧ K</kbd>
        </button>
      </header>
      <div className="layout">
        <nav aria-label="Main navigation">
          {views.map((name) => (
            <button
              className={view === name ? "active" : ""}
              key={name}
              onClick={() => setView(name)}
            >
              {name}
            </button>
          ))}
          <p>PAY · Payment Platform</p>
          <small>
            Synthetic data only.
            <br />
            No production Jira connection.
          </small>
        </nav>
        <main>
          <div className="heading">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h1>{view}</h1>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await client.me();
                  await refresh();
                  setConnected(true);
                  const key = new URLSearchParams(location.search).get("issue");
                  if (key) await open(await client.issue(key));
                  setNotice("Connected to local mock Jira.");
                })
              }
            >
              {connected ? "Refresh" : "Connect mock Jira"}
            </button>
          </div>
          <p role="status" className="notice">
            {busy ? "Working…" : notice}
          </p>
          {!connected ? (
            <section className="empty">
              <h2>A little less clicking.</h2>
              <p>
                Start the local mock server, then connect to explore the PAY
                project.
              </p>
              <p>
                Production OAuth is not available in this preview. No password
                or token is requested.
              </p>
            </section>
          ) : (
            <>
              <div className="toolbar">
                <label>
                  Search{" "}
                  <input
                    value={search}
                    placeholder="Issue key or summary"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={mine}
                    onChange={(e) => setMine(e.target.checked)}
                  />{" "}
                  Assigned to me
                </label>
                <span>
                  {issues.length} loaded{next ? " · more available" : ""}
                </span>
                {next && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const p = await client.search(
                          query("PAY", search, mine),
                          next,
                        );
                        setIssues((old) => [
                          ...new Map(
                            [...old, ...p.issues].map((i) => [i.key, i]),
                          ).values(),
                        ]);
                        setNext(p.nextPageToken);
                      })
                    }
                  >
                    Load more
                  </button>
                )}
              </div>
              {(view === "My Work" || view === "Triage") && (
                <div className="workspace">
                  <section className="list" aria-label="Issues">
                    {issues
                      .filter(
                        (i) =>
                          view !== "Triage" ||
                          health(i, settings).some((c) => !c.pass),
                      )
                      .map((i) => (
                        <button
                          className={
                            selected?.key === i.key ? "issue selected" : "issue"
                          }
                          key={i.key}
                          onClick={() => void run(() => open(i))}
                        >
                          <span className="key">{i.key}</span>
                          <strong>{i.fields.summary}</strong>
                          <span>
                            {i.fields.status.name} ·{" "}
                            {i.fields.assignee?.displayName ?? "Unassigned"}
                          </span>
                        </button>
                      ))}
                  </section>
                  <section className="detail">
                    {!selected ? (
                      <p>Select an issue to see its details.</p>
                    ) : (
                      <>
                        <div className="heading">
                          <span className="key">{selected.key}</span>
                          <button
                            onClick={() =>
                              void run(async () => {
                                await navigator.clipboard.writeText(
                                  branchName(selected),
                                );
                                setNotice("Branch name copied.");
                              })
                            }
                          >
                            Copy branch
                          </button>
                        </div>
                        <h2>{selected.fields.summary}</h2>
                        <p>
                          {selected.fields.issuetype.name} ·{" "}
                          {selected.fields.status.name} ·{" "}
                          {selected.fields.priority?.name ?? "No priority"}
                        </p>
                        <p>
                          Assignee:{" "}
                          {selected.fields.assignee?.displayName ??
                            "Unassigned"}
                        </p>
                        <p>
                          Labels: {selected.fields.labels.join(", ") || "None"}
                        </p>
                        <p>
                          Updated:{" "}
                          {new Date(selected.fields.updated).toLocaleString()}
                        </p>
                        <pre>{plainText(selected.fields.description)}</pre>
                        <h3>
                          Issue health · {checks.filter((c) => c.pass).length}/
                          {checks.length}
                        </h3>
                        <ul className="checks">
                          {checks.map((c) => (
                            <li key={c.id} className={c.pass ? "pass" : "fail"}>
                              {c.pass ? "✓" : "○"} {c.label}
                            </li>
                          ))}
                        </ul>
                        <div className="actions">
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                change(() => client.assignMe(selected.key)),
                              )
                            }
                          >
                            Assign to me
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                change(() =>
                                  client.update(selected.key, {
                                    priority: { id: "2", name: "High" },
                                  }),
                                ),
                              )
                            }
                          >
                            Set priority High
                          </button>
                          {transitions.map((t) => (
                            <button
                              disabled={busy}
                              key={t.id}
                              onClick={() =>
                                void run(() =>
                                  change(() =>
                                    client.transition(selected.key, t.id),
                                  ),
                                )
                              }
                            >
                              Move to {t.name}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              setParent(selected.key);
                              setView("Create");
                            }}
                          >
                            Create subtask
                          </button>
                        </div>
                        <h3>Comments</h3>
                        {comments.map((c) => (
                          <p key={c.id}>
                            {c.author.displayName}: {plainText(c.body)}
                          </p>
                        ))}
                        <label>
                          Comment
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            maxLength={10000}
                          />
                        </label>
                        <button
                          disabled={busy || !comment.trim()}
                          onClick={() =>
                            void run(async () => {
                              await change(() =>
                                client.comment(selected.key, comment),
                              );
                              setComment("");
                            })
                          }
                        >
                          Add comment
                        </button>
                        {view === "Triage" && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const n =
                                  issues[
                                    (issues.findIndex(
                                      (i) => i.key === selected.key,
                                    ) +
                                      1) %
                                      issues.length
                                  ];
                                if (n) await open(n);
                              })
                            }
                          >
                            Next issue
                          </button>
                        )}
                      </>
                    )}
                  </section>
                </div>
              )}
              {view === "Blockers" && (
                <section>
                  <h2>Dependency edges</h2>
                  <p>
                    Loaded issues only. A link does not prove an unresolved
                    blocker.
                  </p>
                  {edges.map((e, n) => (
                    <article key={n}>
                      <strong>{e.blocker}</strong> → blocks{" "}
                      <strong>{e.blocked}</strong>
                      {!e.loaded && " · blocker not loaded"}
                    </article>
                  ))}
                  <h3>Direct dependencies</h3>
                  {[...new Set(edges.map((e) => e.blocker))].map((key) => (
                    <p key={key}>
                      {key}: blocks{" "}
                      {edges.filter((e) => e.blocker === key).length} loaded
                      issue(s)
                    </p>
                  ))}
                </section>
              )}
              {view === "Standup" && (
                <section>
                  <p>
                    Built from your actual comments in loaded issues over the
                    last 24 hours. Today is a checklist, not a prediction.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const user = await client.me(),
                          map: Record<string, Comment[]> = {};
                        for (const i of issues)
                          map[i.key] = await client.comments(i.key);
                        setDraft(
                          standup(
                            issues,
                            map,
                            user.accountId,
                            Date.now() - 86400000,
                          ),
                        );
                      })
                    }
                  >
                    Generate standup
                  </button>
                  <label>
                    Standup draft
                    <textarea
                      className="large"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                  </label>
                  <button
                    onClick={() =>
                      void run(() => navigator.clipboard.writeText(draft))
                    }
                  >
                    Copy Markdown
                  </button>
                </section>
              )}
              {view === "Bulk" && (
                <section>
                  <p>
                    Choose loaded issues. Preview first; changes are sent one at
                    a time.
                  </p>
                  {issues.map((i) => (
                    <label className="bulk-row" key={i.key}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(i.key)}
                        onChange={(e) => {
                          setPlan(undefined);
                          setChosen(
                            e.target.checked
                              ? [...chosen, i.key]
                              : chosen.filter((k) => k !== i.key),
                          );
                        }}
                      />
                      {i.key} — {i.fields.summary}
                    </label>
                  ))}
                  <label>
                    Label
                    <input
                      value={label}
                      onChange={(e) => {
                        setPlan(undefined);
                        setLabel(e.target.value);
                      }}
                    />
                  </label>
                  <button
                    disabled={busy || !chosen.length}
                    onClick={() => {
                      try {
                        setPlan(
                          planLabels(
                            issues.filter((i) => chosen.includes(i.key)),
                            label,
                          ),
                        );
                        setResults([]);
                      } catch {
                        setNotice(
                          "Choose 1–50 issues and a label using letters, numbers, dots, - or _.",
                        );
                      }
                    }}
                  >
                    Preview changes
                  </button>
                  {plan && (
                    <article aria-label="Bulk preview">
                      <h3>Preview: add label {plan.label}</h3>
                      <p>{plan.keys.join(", ")}</p>
                      <p>
                        {plan.keys.length} issue(s). No universal undo is
                        available.
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const r = await executeLabels(client, plan, true);
                            setResults(r);
                            setPlan(undefined);
                            await refresh();
                          })
                        }
                      >
                        Apply changes
                      </button>
                      <button onClick={() => setPlan(undefined)}>Cancel</button>
                    </article>
                  )}
                  <ul aria-label="Bulk results">
                    {results.map((r) => (
                      <li key={r.key}>
                        {r.key}: {r.ok ? "Success" : r.error}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {view === "Create" && (
                <section>
                  <p>
                    Local PAY project only. This preview uses the mock project's
                    configured type IDs.
                  </p>
                  <label>
                    Template
                    <select
                      onChange={(e) =>
                        setDescription(
                          renderTemplate(templates[e.target.value], {
                            date: new Date().toISOString().slice(0, 10),
                          }),
                        )
                      }
                    >
                      {Object.keys(templates).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Summary
                    <input
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      maxLength={255}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      className="large"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <label>
                    Parent issue (optional)
                    <input
                      value={parent}
                      onChange={(e) => setParent(e.target.value)}
                    />
                  </label>
                  <h3>Potentially similar issues</h3>
                  {similar(summary, issues).map((r) => (
                    <p key={r.issue.key}>
                      {r.issue.key} — {Math.round(r.score * 100)}% token overlap
                    </p>
                  ))}
                  <button
                    disabled={busy || !summary.trim()}
                    onClick={() =>
                      void run(async () => {
                        const created = await client.create(
                          summary,
                          description,
                          parent || undefined,
                        );
                        await refresh();
                        await open(await client.issue(created.key));
                        setView("My Work");
                        setNotice("Created " + created.key);
                      })
                    }
                  >
                    Create issue
                  </button>
                </section>
              )}
              {view === "Settings" && (
                <section>
                  <h2>Local preferences</h2>
                  <label>
                    Appearance
                    <select
                      value={settings.theme}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          theme: e.target.value as Settings["theme"],
                        })
                      }
                    >
                      {["system", "light", "dark"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Stale after days
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={settings.staleDays}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          staleDays: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      void run(async () => setFields(await client.fields()))
                    }
                  >
                    Discover fields
                  </button>
                  <label>
                    Estimate field
                    <select
                      value={settings.estimateField}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          estimateField: e.target.value,
                        })
                      }
                    >
                      <option value="">Not mapped</option>
                      {fields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() =>
                      void run(async () => {
                        await saveSettings(settings);
                        setNotice("Preferences saved locally.");
                      })
                    }
                  >
                    Save preferences
                  </button>
                  <h3>Settings JSON (no credentials)</h3>
                  <textarea
                    aria-label="Settings JSON"
                    value={settingsText}
                    onChange={(e) => setSettingsText(e.target.value)}
                  />
                  <button
                    onClick={() =>
                      setSettingsText(JSON.stringify(settings, null, 2))
                    }
                  >
                    Export settings
                  </button>
                  <button
                    onClick={() =>
                      void run(async () => {
                        const parsed = parseSettings(settingsText);
                        await saveSettings(parsed);
                        setSettings(parsed);
                        setNotice("Settings imported.");
                      })
                    }
                  >
                    Import settings
                  </button>
                  <p>
                    Production OAuth: not implemented. No tokens are stored or
                    accepted by this UI.
                  </p>
                </section>
              )}
            </>
          )}
        </main>
      </div>
      {palette && (
        <div className="backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={(e) => {
              if (e.key === "Escape") setPalette(false);
            }}
          >
            <h2>Go to…</h2>
            {views.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setView(name);
                  setPalette(false);
                }}
              >
                {name}
              </button>
            ))}
            <button autoFocus onClick={() => setPalette(false)}>
              Close
            </button>
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
