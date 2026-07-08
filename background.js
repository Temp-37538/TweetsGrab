importScripts("shared.js");

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tweetsGrab-toggle",
    title: "TweetsGrab — Toggle Selection Mode",
    contexts: ["page"],
    documentUrlPatterns: ["https://x.com/*"],
  });

  chrome.contextMenus.create({
    id: "tweetsGrab-thread",
    title: "TweetsGrab — Select Thread",
    contexts: ["page"],
    documentUrlPatterns: ["https://x.com/*/status/*"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !isXPage(tab.url)) return;

  const action =
    info.menuItemId === "tweetsGrab-toggle"
      ? "toggle-selection"
      : info.menuItemId === "tweetsGrab-thread"
        ? "select-thread"
        : null;

  if (action) await dispatchToContentScript(tab.id, action);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "download-json") {
    handleDownload(message, sendResponse);
    return true;
  }
  return false;
});

async function dispatchToContentScript(tabId, action) {
  try {
    await chrome.tabs.sendMessage(tabId, { action });
    return;
  } catch {
  }

  try {
    await ensureContentScriptInjected(tabId);
    await chrome.tabs.sendMessage(tabId, { action });
  } catch (e) {
    console.warn("[TweetsGrab] Impossible d'activer l'action sur l'onglet", tabId, e);
  }
}

function handleDownload(message, sendResponse) {
  const dataUrl =
    "data:application/json;charset=utf-8," + encodeURIComponent(message.data);

  chrome.downloads.download(
    {
      url: dataUrl,
      filename: message.filename || "tweets-export.json",
      saveAs: true,
    },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        console.warn(
          "[TweetsGrab] Échec du téléchargement :",
          chrome.runtime.lastError?.message,
        );
        sendResponse({ success: false, error: chrome.runtime.lastError?.message });
        return;
      }
      sendResponse({ success: true, downloadId });
    },
  );
}
