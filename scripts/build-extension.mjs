import { writeFile, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const manifest = {
  manifest_version: 3,
  name: "Jira Flow Assistant (local preview)",
  version: "0.1.0",
  description:
    "A local preview of issue triage, health checks and safe bulk actions.",
  permissions: ["sidePanel", "activeTab"],
  host_permissions: ["http://127.0.0.1/*"],
  action: { default_popup: "popup.html" },
  side_panel: { default_path: "index.html" },
  options_page: "index.html?view=Settings",
  background: { service_worker: "worker.js" },
  commands: {
    "open-palette": {
      suggested_key: { default: "Ctrl+Shift+K", mac: "Command+Shift+K" },
      description: "Open Flow Assistant",
    },
    "quick-create": {
      suggested_key: { default: "Ctrl+Shift+J", mac: "Command+Shift+J" },
      description: "Open quick create",
    },
  },
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'none'; connect-src http://127.0.0.1:4318; base-uri 'none'",
  },
};
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));
await copyFile("apps/extension/worker.js", "dist/worker.js");
await copyFile("apps/extension/popup.html", "dist/popup.html");
await copyFile("apps/extension/popup.js", "dist/popup.js");
execFileSync(process.execPath, [
  "--input-type=module",
  "-e",
  "import{mkdirSync}from'node:fs';mkdirSync('artifacts',{recursive:true})",
]);
console.log(
  "Built local-preview MV3 extension in dist/. No production OAuth is included.",
);
