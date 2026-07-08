(function () {
  "use strict";

  const btnManual  = document.getElementById("btnManual");
  const btnThread  = document.getElementById("btnThread");
  const btnCancel  = document.getElementById("btnCancel");
  const statusEl   = document.getElementById("status");
  const pageTypeEl = document.getElementById("pageType");

  let currentTabId = null;
  let isStatusPage = false;

  init();

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      pageTypeEl.textContent = "Aucun onglet";
      disableAll();
      return;
    }

    currentTabId = tab.id;
    const url = tab.url || "";

    if (!isXPage(url)) {
      pageTypeEl.textContent = "Pas sur X.com";
      disableAll();
      statusEl.textContent = "Ouvrez une page X.com pour utiliser TweetsGrab";
      return;
    }

    isStatusPage = isStatusPageUrl(url);
    pageTypeEl.textContent = isStatusPage ? "Thread" : "X.com";
    enableAll();
    statusEl.textContent = isStatusPage
      ? "Prêt — Thread ou Manuel"
      : "Prêt — Mode manuel seulement";
  }

  async function sendAction(action) {
    if (!currentTabId) return;

    try {
      await chrome.tabs.sendMessage(currentTabId, { action });
    } catch {
      try {
        await ensureContentScriptInjected(currentTabId);
        await chrome.tabs.sendMessage(currentTabId, { action });
      } catch (e) {
        console.warn("[TweetsGrab] Échec d'activation depuis le popup :", e);
      }
    }
  }

  btnManual.addEventListener("click", () => {
    sendAction("toggle-selection");
    window.close();
  });

  btnThread.addEventListener("click", () => {
    sendAction("select-thread");
    window.close();
  });

  btnCancel.addEventListener("click", () => {
    sendAction("cancel-selection");
    window.close();
  });

  function disableAll() {
    for (const btn of [btnManual, btnThread, btnCancel]) {
      btn.disabled = true;
      btn.style.opacity = "0.4";
    }
  }

  function enableAll() {
    btnManual.disabled = false;
    btnCancel.disabled = false;
    btnManual.style.opacity = "1";
    btnCancel.style.opacity = "1";

    btnThread.disabled = !isStatusPage;
    btnThread.style.opacity = isStatusPage ? "1" : "0.4";
  }
})();
