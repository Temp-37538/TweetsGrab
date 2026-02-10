window.TweetsGrabSelector = (() => {
  "use strict";
 
  let active = false;
  let selections = []; 
  let counter = 0;
  let indicator = null;
  let observer = null; 

  function activate() {
    if (active) return;
    active = true;
    counter = 0;
    selections = [];
    document.body.classList.add("tg-selection-mode");
    buildIndicator();
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("keydown", onKeydown, true);
    startObserver();
  }

  function deactivate() {
    if (!active) return;
    active = false;
    document.body.classList.remove("tg-selection-mode");
    document.removeEventListener("click", onClickCapture, true);
    document.removeEventListener("keydown", onKeydown, true);
    destroyIndicator();
    stopObserver();
  }

  function isActive() {
    return active;
  }

  function getSelections() {
    return selections.map((s) => s.data);
  }

  function clearAll() {
    selections.forEach((s) => {
      s.element.classList.remove("tg-selected");
      delete s.element.dataset.tgOrder;
      if (s.badgeEl?.parentNode) s.badgeEl.remove();
    });
    selections = [];
    counter = 0;
  }

  function finishSelection() {
    if (selections.length === 0) {
      deactivate();
      clearAll();
      return;
    }
    const data = selections.map((s) => s.data);
    deactivate();
    window.TweetsGrabExport.show(data);
  }

  async function onClickCapture(e) { 
    if (e.target.closest(".tg-ui")) return;

    const article = e.target.closest(
      '[data-testid="tweet"], article[role="article"]',
    );
    if (!article) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    await toggleArticle(article);
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finishSelection();
    }
  } 

  async function toggleArticle(article) {
    const idx = selections.findIndex((s) => s.element === article);

    if (idx !== -1) { 
      article.classList.remove("tg-selected");
      delete article.dataset.tgOrder;
      const badge = selections[idx].badgeEl;
      if (badge?.parentNode) badge.remove();
      selections.splice(idx, 1);
 
      selections.forEach((s, i) => {
        s.data.id = i + 1;
        s.element.dataset.tgOrder = i + 1;
        if (s.badgeEl) s.badgeEl.textContent = i + 1;
      });
    } else { 
      counter = selections.length + 1;
      const data = await window.TweetsGrabExtract.extractTweet(
        article,
        counter,
      );
      if (!data) return;

      article.classList.add("tg-selected");
      article.dataset.tgOrder = counter;

      const badgeEl = createBadge(article, counter);
      selections.push({ element: article, data, badgeEl });
    }

    refreshIndicatorCount();
  } 

  function createBadge(article, order) {
    const el = document.createElement("div");
    el.className = "tg-badge tg-ui";
    el.textContent = order;
    article.appendChild(el);
    return el;
  }
 
  function buildIndicator() {
    if (indicator) return;

    indicator = document.createElement("div");
    indicator.className = "tg-indicator tg-ui";
    indicator.innerHTML = `
      <div class="tg-indicator-inner">
        <div class="tg-indicator-brand">
          <svg class="tg-indicator-logo" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.09 12.5H11L10 22L18.91 11.5H12L13 2Z"
                  fill="#00d4ff" stroke="#00d4ff" stroke-width="1" stroke-linejoin="round"/>
          </svg>
          <span class="tg-indicator-name">TweetsGrab</span>
        </div>

        <div class="tg-indicator-status">
          <span class="tg-indicator-dot"></span>
          <span class="tg-indicator-text">Selection Mode</span>
        </div>

        <div class="tg-indicator-count">
          <span class="tg-count-num">0</span>
          <span class="tg-count-label">selected</span>
        </div>

        <div class="tg-indicator-actions">
          <button class="tg-btn tg-btn-export tg-ui">Export</button>
          <button class="tg-btn tg-btn-cancel tg-ui" title="Cancel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>`;

    document.body.appendChild(indicator);

    indicator.querySelector(".tg-btn-export").addEventListener("click", (e) => {
      e.stopPropagation();
      finishSelection();
    });
    indicator.querySelector(".tg-btn-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      deactivate();
      clearAll();
    });
  }

  function destroyIndicator() {
    if (!indicator) return;
    indicator.classList.add("tg-indicator-exit");
    const ref = indicator;
    setTimeout(() => {
      if (ref.parentNode) ref.remove();
    }, 300);
    indicator = null;
  }

  function refreshIndicatorCount() {
    if (!indicator) return;
    const num = indicator.querySelector(".tg-count-num");
    if (!num) return;
    num.textContent = selections.length;
    num.classList.add("tg-count-bump");
    setTimeout(() => num.classList.remove("tg-count-bump"), 200);
  } 

  function startObserver() {
    observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          reapplyOnNode(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function reapplyOnNode(root) {
    const articles = root.matches?.('[data-testid="tweet"]')
      ? [root]
      : Array.from(root.querySelectorAll?.('[data-testid="tweet"]') || []);

    for (const art of articles) {
      const timeEl = art.querySelector("time[datetime]");
      const link = timeEl?.closest('a[href*="/status/"]');
      const href = link?.getAttribute("href") || "";
      const match = href.match(/\/status\/(\d+)/);
      if (!match) continue;

      const tweetId = match[1];
      const sel = selections.find((s) => s.data.tweet_id === tweetId);
      if (!sel) continue;
 
      sel.element = art;
      art.classList.add("tg-selected");
      art.dataset.tgOrder = sel.data.id;
      if (sel.badgeEl?.parentNode) sel.badgeEl.remove();
      sel.badgeEl = createBadge(art, sel.data.id);
    }
  }
 
  return {
    activate,
    deactivate,
    isActive,
    getSelections,
    clearAll,
    finishSelection,
  };
})();
