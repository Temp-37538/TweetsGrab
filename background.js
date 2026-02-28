chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tweetsGrab-toggle",
    title: "TweetsGrab — Toggle Selection Mode",
    contexts: ["page"],
    documentUrlPatterns: ["https://x.com/*"],
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!isXPage(tab.url)) return;
  await sendToggle(tab.id);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "tweetsGrab-toggle") return;
  if (!isXPage(tab.url)) return;
  await sendToggle(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download-json") {
    const dataUrl =
      "data:application/json;charset=utf-8," + encodeURIComponent(message.data);

    chrome.downloads.download(
      {
        url: dataUrl,
        filename: message.filename || "tweets-export.json",
        saveAs: true,
      },
      (downloadId) => {
        sendResponse({ success: !!downloadId });
      },
    );
    return true;
  }
});

function isXPage(url) {
  return /^https:\/\/x\.com/.test(url || "");
}

async function sendToggle(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "toggle-selection" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "retrieve_videolink.js",
        "extract.js",
        "selector.js",
        "export.js",
        "content.js",
      ],
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["styles.css"],
    });
    try {
      await chrome.tabs.sendMessage(tabId, { action: "toggle-selection" });
    } catch (e) {
      console.warn("[TweetsGrab] Could not activate on tab", tabId, e);
    }
  }
}
