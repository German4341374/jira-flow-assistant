import { defaults, settingsSchema, type Settings } from "../core/model.ts";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("jira-flow-settings", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("settings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Local settings unavailable"));
  });
}
export async function loadSettings(): Promise<Settings> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings");
    const request = tx.objectStore("settings").get("global");
    request.onsuccess = () => {
      const parsed = settingsSchema.safeParse(request.result);
      resolve(parsed.success ? parsed.data : defaults);
    };
    request.onerror = () => reject(new Error("Cannot read settings"));
    tx.oncomplete = () => db.close();
  });
}
export async function saveSettings(settings: Settings) {
  const valid = settingsSchema.parse(settings),
    db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put(valid, "global");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Cannot save settings"));
    };
  });
}
