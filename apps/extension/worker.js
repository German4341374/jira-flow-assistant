/* global chrome */
chrome.commands.onCommand.addListener(async (command, tab) => {
  let issue;
  if (tab?.url) {
    const url = new URL(tab.url);
    if (url.protocol === "https:" && url.hostname.endsWith(".atlassian.net")) {
      issue = url.pathname.match(/^\/browse\/([A-Z][A-Z0-9_]*-\d+)$/)?.[1];
    }
  }
  if (command === "quick-create") {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("index.html?view=Create"),
    });
  } else if (tab?.id) {
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: "index.html" + (issue ? "?issue=" + encodeURIComponent(issue) : ""),
      enabled: true,
    });
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});
