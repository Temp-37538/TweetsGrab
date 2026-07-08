function getContentScriptManifestEntry() {
  const manifest = chrome.runtime.getManifest();
  const entry = manifest.content_scripts && manifest.content_scripts[0];
  return {
    js: entry?.js || [],
    css: entry?.css || [],
  };
}

async function ensureContentScriptInjected(tabId) {
  const { js, css } = getContentScriptManifestEntry();
  if (js.length) {
    await chrome.scripting.executeScript({ target: { tabId }, files: js });
  }
  if (css.length) {
    await chrome.scripting.insertCSS({ target: { tabId }, files: css });
  }
}

function isXPage(url) {
  try {
    return new URL(url).hostname === "x.com";
  } catch {
    return false;
  }
}

function isStatusPageUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === "x.com" && /^\/[^/]+\/status\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}
