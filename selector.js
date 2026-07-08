window.TweetsGrabSelector = (() => {
  "use strict";

  let active = false;
  let selections = [];
  let counter = 0;
  let indicator = null;
  let observer = null;
  let mode = 'manual';
  let threadAccum = null;
  let threadAuthor = '';
  let threadLastTotal = 0;
  let threadObserver = null;
  let threadDebounceTimer = null;
  let pendingExportAborted = false;

  function activate(modeParam) {
    if (active) return;
    active = true;
    mode = modeParam || 'manual';
    counter = 0;
    selections = [];
    document.body.classList.add("tg-selection-mode");
    document.body.classList.add("tg-mode-" + mode);
    buildIndicator();
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("keydown", onKeydown, true);
    startObserver();

    if (mode === 'thread') {
      threadAccum = new Set();
      threadLastTotal = 0;
      const m = location.pathname.match(/^\/([^\/]+)\/status\//);
      threadAuthor = m ? m[1] : '';
      startThreadObserver();
      selectThread();
    }
  }

  function deactivate() {
    if (!active) return;
    active = false;
    document.body.classList.remove("tg-selection-mode");
    document.body.classList.remove("tg-mode-manual", "tg-mode-thread");
    document.removeEventListener("click", onClickCapture, true);
    document.removeEventListener("keydown", onKeydown, true);
    destroyIndicator();
    stopObserver();
    stopThreadObserver();
    mode = 'manual';
    threadAccum = null;
    threadAuthor = '';
    threadLastTotal = 0;
  }

  function isActive() {
    return active;
  }

  function clearAll() {
    selections.forEach((s) => {
      s.element.classList.remove("tg-selected");
      delete s.element.dataset.tgOrder;
      if (s.badgeEl?.parentNode) s.badgeEl.remove();
    });
    selections = [];
    counter = 0;
    threadAccum = null;
    threadLastTotal = 0;
  }

  async function finishSelection() {
    pendingExportAborted = false;
    if (selections.length === 0) {
      deactivate();
      clearAll();
      return;
    }
    const pendingCount = selections.filter(
      (s) => s.needsVideo && s.data.posted_video_urls.length === 0
    ).length;
    if (pendingCount > 0) setExportLoading(pendingCount);
    const data = selections.map((s) => s.data);
    await resolvePendingVideos();
    if (pendingExportAborted) return;
    deactivate();
    window.TweetsGrabExport.show(data);
  }

  function getTweetId(article) {
    const times = article.querySelectorAll('time[datetime]');
    let fallback = null;
    for (const timeEl of times) {
      const link = timeEl.closest('a[href*="/status/"]');
      if (!link) continue;
      const m = (link.getAttribute('href') || '').match(/\/status\/(\d+)/);
      if (!m) continue;
      if (!timeEl.closest('[role="link"][tabindex="0"]')) return m[1];
      if (!fallback) fallback = m[1];
    }
    return fallback;
  }

  function selectThread() {
    if (!threadAuthor) return { total: 0 };

    const cells = document.querySelectorAll('[data-testid="cellInnerDiv"]');
    let broken = false;
    let order = 0;

    for (let i = 0; i < cells.length; i++) {
      const container = cells[i];
      const article = container.querySelector('[data-testid="tweet"]');
      if (!article) continue;

      const isAuthor = Array.from(
        article.querySelectorAll('[data-testid="User-Name"] a[href]')
      ).some((a) => {
        const h = a.getAttribute("href") || "";
        return h === "/" + threadAuthor || h.startsWith("/" + threadAuthor + "/");
      });
      const tweetId = getTweetId(article);

      if (isAuthor && !broken) {
        if (tweetId) threadAccum.add(tweetId);
      } else if (!isAuthor) {
        broken = true;
      }

      if (tweetId && threadAccum.has(tweetId)) {
        order++;
        if (!selections.some(s => s.element === article)) {
          counter = selections.length + 1;
          const result = extractTweetSync(article, counter);
          if (result) {
            article.classList.add("tg-selected");
            article.dataset.tgOrder = counter;
            const badgeEl = createBadge(article, counter);
            selections.push({
              element: article,
              data: result.data,
              badgeEl,
              needsVideo: result.needsVideo,
            });
          }
        } else {
          const sel = selections.find(s => s.element === article);
          if (sel) {
            sel.data.id = order;
            article.dataset.tgOrder = order;
            if (sel.badgeEl) sel.badgeEl.textContent = order;
          }
        }
      }
    }

    refreshIndicatorCount();
    return { total: threadAccum.size };
  }

  function extractTweetSync(article, order) {
    try {
      const E = window.TweetsGrabExtract;
      const text = E.getText(article);
      const { username, displayName } = E.getUser(article);
      const { url, tweetId } = E.getUrlAndId(article, article);
      const timestamp = E.getTimestamp(article);
      const stats = E.getStats(article);
      const media = E.getMedia(article, article);

      const data = {
        id: order,
        tweet_text: text,
        username,
        display_name: displayName,
        tweet_url: url,
        posted_image_urls: media.images,
        posted_video_urls: [],
        posted_gif_urls: media.gifs,
        timestamp,
        tweet_id: tweetId,
        likes: stats.likes,
        retweets: stats.retweets,
        replies: stats.replies,
        quoted_tweet: null,
      };

      return { data, needsVideo: media.hasVideo };
    } catch (err) {
      return null;
    }
  }

  async function resolvePendingVideos() {
    const pending = selections.filter(
      (s) => s.needsVideo && s.data.posted_video_urls.length === 0,
    );
    if (!pending.length) return;

    const E = window.TweetsGrabExtract;
    await Promise.all(
      pending.map(async (s) => {
        try {
          s.data.posted_video_urls = await E.resolveVideoLinks(s.data.tweet_url, true);
        } catch (e) {
          console.warn("[TweetsGrab] Résolution vidéo (thread) échouée :", e);
        }
      }),
    );
  }

  function startThreadObserver() {
    if (threadObserver) return;

    const root = document.querySelector('[aria-label^="Timeline"]')
              || document.querySelector('main[role="main"]')
              || document.body;

    threadObserver = new MutationObserver((mutations) => {
      let hasNewCell = false;
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('[data-testid="cellInnerDiv"]') || node.querySelector?.('[data-testid="cellInnerDiv"]')) {
            hasNewCell = true;
            break;
          }
        }
        if (hasNewCell) break;
      }
      if (!hasNewCell) return;

      clearTimeout(threadDebounceTimer);
      threadDebounceTimer = setTimeout(() => {
        const prev = threadLastTotal;
        const r = selectThread();
        if (r.total > prev) {
          threadLastTotal = r.total;
          refreshIndicatorCount();
        }
      }, 300);
    });

    threadObserver.observe(root, { childList: true, subtree: true });
  }

  function stopThreadObserver() {
    if (threadObserver) {
      threadObserver.disconnect();
      threadObserver = null;
    }
    clearTimeout(threadDebounceTimer);
    threadDebounceTimer = null;
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
      const needsVideo = window.TweetsGrabExtract.getMedia(article, article).hasVideo;
      const data = await window.TweetsGrabExtract.extractTweet(
        article,
        counter,
      );
      if (!data) return;

      article.classList.add("tg-selected");
      article.dataset.tgOrder = counter;

      const badgeEl = createBadge(article, counter);
      selections.push({ element: article, data, badgeEl, needsVideo });
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

    const modeLabel = mode === 'thread'
      ? '<span class="tg-indicator-text">≡ Thread Mode</span>'
      : '<span class="tg-indicator-dot"></span><span class="tg-indicator-text">Selection Mode</span>';

    indicator = document.createElement("div");
    indicator.className = "tg-indicator tg-ui";
    indicator.innerHTML = `
      <div class="tg-indicator-inner">
        <div class="tg-indicator-brand">
          <svg class="tg-indicator-logo" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 3h9.17a2 2 0 0 1 1.41.59l7.83 7.83a2 2 0 0 1 0 2.83l-7.75 7.75a2 2 0 0 1-2.83 0L3 14.17V3z" fill="#ffc933"/>
            <circle cx="7.5" cy="7.5" r="1.6" fill="#17181c"/>
          </svg>
          <span class="tg-indicator-name">TweetsGrab</span>
        </div>

        <div class="tg-indicator-status">
          ${modeLabel}
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
      pendingExportAborted = true;
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

  function setExportLoading(count) {
    if (!indicator) return;
    const btn = indicator.querySelector(".tg-btn-export");
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add("tg-btn-loading");
    btn.innerHTML =
      '<span class="tg-spin" aria-hidden="true"></span>' +
      '<span>Resolving videos… (' + count + ')</span>';
  }

  function startObserver() {
    const root = document.querySelector('[aria-label^="Timeline"]')
              || document.querySelector('main[role="main"]')
              || document.body;

    observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          reapplyOnNode(node);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
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
    clearAll,
    finishSelection,
  };
})();
