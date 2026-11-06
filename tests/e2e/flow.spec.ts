import { test, expect, chromium } from "@playwright/test";
import { resolve, join } from "node:path";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:4318/__test/reset");
});
test("real dashboard workflow and screenshots", async ({ page }) => {
  await mkdir("docs/screenshots", { recursive: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect mock Jira" }).click();
  await expect(page.getByRole("button", { name: /PAY-101/ })).toBeVisible();
  while (await page.getByRole("button", { name: "Load more" }).isVisible()) {
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByRole("button", { name: "Load more" }))
      .toBeEnabled()
      .catch(() => {});
  }
  await page.screenshot({
    path: "docs/screenshots/my-work.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /PAY-104.*Database/ }).click();
  await page.getByRole("button", { name: "Assign to me", exact: true }).click();
  await expect(page.getByText("Assignee: Demo Engineer")).toBeVisible();
  await page.getByRole("button", { name: "Set priority High" }).click();
  await page.getByRole("button", { name: "Move to In Progress" }).click();
  await expect(page.getByText("Task · In Progress · High")).toBeVisible();
  await page
    .getByLabel("Comment", { exact: true })
    .fill("<img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(
    page.getByText("Demo Engineer: <img src=x onerror=alert(1)>"),
  ).toBeVisible();
  await expect(page.locator(".detail img")).toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/issue-sidebar.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Triage", exact: true })
    .click();
  await page.screenshot({
    path: "docs/screenshots/triage.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Standup", exact: true })
    .click();
  await page.getByRole("button", { name: "Generate standup" }).click();
  await expect(page.getByLabel("Standup draft")).toHaveValue(
    /Investigated callback/,
  );
  await page.screenshot({
    path: "docs/screenshots/standup.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Blockers", exact: true })
    .click();
  await page.screenshot({
    path: "docs/screenshots/blockers.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Bulk", exact: true })
    .click();
  await page.getByLabel(/PAY-101 —/).check();
  await page.getByLabel(/PAY-102 —/).check();
  await page.getByRole("button", { name: "Preview changes" }).click();
  await page.screenshot({
    path: "docs/screenshots/bulk-preview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByText("PAY-101: Success")).toBeVisible();
  await expect(page.getByText("PAY-102: Success")).toBeVisible();
  await page.getByRole("button", { name: /Commands/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/command-palette.png",
    fullPage: true,
  });
});
test("packaged extension loads and connects to mock Jira", async () => {
  const extension = resolve("dist"),
    profile = await mkdtemp(join(tmpdir(), "flow-extension-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      "--disable-extensions-except=" + extension,
      "--load-extension=" + extension,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto("chrome-extension://" + id + "/index.html");
    await page.getByRole("button", { name: "Connect mock Jira" }).click();
    await expect(page.getByRole("button", { name: /PAY-101/ })).toBeVisible();
    await page.getByRole("button", { name: /PAY-101/ }).click();
    await expect(
      page.getByRole("heading", { name: /Issue health/ }),
    ).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/extension.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
