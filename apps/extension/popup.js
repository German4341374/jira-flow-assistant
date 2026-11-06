/* global chrome */
document
  .querySelector("#dashboard")
  .addEventListener("click", () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html") }),
  );
document.querySelector("#create").addEventListener("click", () =>
  chrome.tabs.create({
    url: chrome.runtime.getURL("index.html?view=Create"),
  }),
);
