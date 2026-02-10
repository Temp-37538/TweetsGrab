window.TweetsGrabExtract = (() => {
  "use strict";

  /**
   * Main entry: extract structured data from a tweet article element.
   * @param {HTMLElement} article - The article DOM node ([data-testid="tweet"])
   * @param {number}      order  - Selection order id
   * @returns {object|null}
   */
  async function extractTweet(article, order) {
    try {
      const text = getText(article);
      const { username, displayName } = getUser(article);
      const { url, tweetId } = getUrlAndId(article);
      const timestamp = getTimestamp(article);
      const stats = getStats(article);
      const media = getMedia(article);
      const postedVideoUrls = await resolveVideoLinks(url, media.hasVideo);
      const quotedTweet = await getQuotedTweet(article);

      return {
        id: order,
        tweet_text: text,
        username: username,
        display_name: displayName,
        tweet_url: url,
        posted_image_urls: media.images,
        posted_video_urls: postedVideoUrls,
        posted_gif_urls: media.gifs,
        timestamp: timestamp,
        tweet_id: tweetId,
        likes: stats.likes,
        retweets: stats.retweets,
        replies: stats.replies,
        quoted_tweet: quotedTweet,
      };
    } catch (err) {
      console.error("[TweetsGrab] Extraction error:", err);
      return null;
    }
  }
 
  function getText(article, skipQuoted = true) { 
    const allTexts = article.querySelectorAll('[data-testid="tweetText"]');
    for (const el of allTexts) { 
      if (skipQuoted && el.closest('[role="link"][tabindex="0"]')) continue;
      if (isDirectChild(el, article)) return el.innerText.trim();
    }
    return "";
  } 

  function getUser(article) {
    const container = article.querySelector('[data-testid="User-Name"]');
    if (!container) return { username: "", displayName: "" };

    let username = "";
    let displayName = "";
    
    const spans = container.querySelectorAll("span");
    for (const span of spans) {
      const t = span.textContent.trim();
      if (t.startsWith("@") && t.length > 1) {
        username = t;
        break;
      }
    } 

    const firstLink = container.querySelector('a[role="link"]');
    if (firstLink) { 
      const clone = firstLink.cloneNode(true);
      clone.querySelectorAll("svg, img").forEach((n) => n.remove());
      displayName = clone.textContent.trim();
 
      if (!username) {
        const href = firstLink.getAttribute("href") || "";
        const m = href.match(/^\/([A-Za-z0-9_]+)$/);
        if (m) username = "@" + m[1];
      }
    }

    return { username, displayName };
  }
 
  function getUrlAndId(article) { 
    const timeEl = article.querySelector("time[datetime]");
    if (timeEl) {
      const link = timeEl.closest('a[href*="/status/"]');
      if (link && isDirectChild(link, article)) {
        return hrefToData(link.getAttribute("href"));
      }
    }
 
    const allLinks = article.querySelectorAll('a[href*="/status/"]');
    for (const link of allLinks) {
      if (!isDirectChild(link, article)) continue;
      return hrefToData(link.getAttribute("href"));
    }

    return { url: "", tweetId: "" };
  }

  function hrefToData(href) {
    const url = href.startsWith("http") ? href : "https://x.com" + href;
    const match = href.match(/\/status\/(\d+)/);
    return { url, tweetId: match ? match[1] : "" };
  } 

  function getTimestamp(article) {
    const el = article.querySelector("time[datetime]");
    return el ? el.getAttribute("datetime") : "";
  }
 
  function getStats(article) {
    const group = article.querySelector('[role="group"]');
    if (!group) return { likes: 0, retweets: 0, replies: 0 };

    const replyBtn = group.querySelector('[data-testid="reply"]');
    const retweetBtn = group.querySelector('[data-testid="retweet"]');
    const likeBtn =
      group.querySelector('[data-testid="like"]') ||
      group.querySelector('[data-testid="unlike"]');

    return {
      replies: parseStatButton(replyBtn),
      retweets: parseStatButton(retweetBtn),
      likes: parseStatButton(likeBtn),
    };
  }

  function parseStatButton(btn) {
    if (!btn) return 0;
 
    const aria = btn.getAttribute("aria-label") || "";
    const m = aria.match(/([\d,.\s]+)/);
    if (m) {
      const n = parseInt(m[1].replace(/[,.\s]/g, ""), 10);
      if (!isNaN(n)) return n;
    }
 
    const spans = btn.querySelectorAll("span");
    for (const s of spans) {
      const t = s.textContent.trim();
      if (t && /^\d/.test(t)) return parseHumanNumber(t);
    }

    return 0;
  }
 
  function parseHumanNumber(text) {
    text = text.trim().replace(/,/g, "");
    const mult = { K: 1e3, M: 1e6, B: 1e9 };
    const m = text.match(/^([\d.]+)\s*([KMBkmb])?$/);
    if (m) {
      const num = parseFloat(m[1]);
      const fac = m[2] ? mult[m[2].toUpperCase()] || 1 : 1;
      return Math.round(num * fac);
    }
    return parseInt(text, 10) || 0;
  }
 
  function getMedia(article) {
    const images = [];
    const videos = [];
    const gifs = [];
    let hasVideo = false;
 
    const photoEls = article.querySelectorAll('[data-testid="tweetPhoto"]');
    photoEls.forEach((photoEl) => {
      if (!isDirectChild(photoEl, article)) return;
      const img = photoEl.querySelector("img[src]");
      if (!img) return;
      let src = img.src; 
      if (/profile_images|emoji/i.test(src)) return; 
      src = src.replace(/name=\w+/, "name=orig");
      images.push(src);
    });
 
    const players = article.querySelectorAll('[data-testid="videoPlayer"]');
    players.forEach((player) => {
      if (!isDirectChild(player, article)) return;

      const isGif = detectGif(player);
      const videoSrc = getVideoSrc(player);

      if (videoSrc) {
        (isGif ? gifs : videos).push(videoSrc);
      }
      if (!isGif) hasVideo = true;
    });
 
    const strayVideos = article.querySelectorAll("video");
    strayVideos.forEach((v) => {
      if (!isDirectChild(v, article)) return;
      if (v.closest('[data-testid="videoPlayer"]')) return;
      const src = v.src || v.querySelector("source")?.src || ""; 
      if (src && !src.startsWith("blob:")) {
        videos.push(src);
        hasVideo = true;
      }
    });

    return { images, videos, gifs, hasVideo };
  }

  async function resolveVideoLinks(tweetUrl, hasVideo) {
    if (!hasVideo || !tweetUrl) return [];
    const resolver = window.TweetsGrabRetrieveLinkVideo;
    if (typeof resolver !== "function") return [];

    try {
      const resolved = await resolver(tweetUrl);
      return resolved ? [resolved] : [];
    } catch (err) {
      console.warn("[TweetsGrab] Video resolve failed:", err);
      return [];
    }
  }

  function detectGif(player) { 
    if (player.querySelector('[data-testid="gifBadge"]')) return true;
    const labels = player.querySelectorAll("span");
    for (const s of labels) {
      if (s.textContent.trim().toUpperCase() === "GIF") return true;
    }
    if (player.closest('[aria-label*="GIF"]')) return true;
    return false;
  }

  function getVideoSrc(player) {
    const video = player.querySelector("video");
    if (!video) return "";
    const src = video.src || video.querySelector("source")?.src || ""; 
    if (src.startsWith("blob:")) return "";
    return src;
  }
 
  async function getQuotedTweet(article) { 
    const quotedLinks = article.querySelectorAll('[role="link"][tabindex="0"]');

    for (const link of quotedLinks) { 
      const hasUserName = link.querySelector('[data-testid="User-Name"]');
      const hasTweetText = link.querySelector('[data-testid="tweetText"]');

      if (!hasUserName || !hasTweetText) continue;
      if (!isDirectChild(link, article)) continue; 
      const { username, displayName } = getUserFromContainer(link);
      const text = hasTweetText.innerText.trim();
      const { url, tweetId } = getUrlAndIdFromContainer(link);
      const timestamp = getTimestampFromContainer(link);
      const media = getMediaFromContainer(link);
      const postedVideoUrls = await resolveVideoLinks(url, media.hasVideo);

      return {
        tweet_text: text,
        username: username,
        display_name: displayName,
        tweet_url: url,
        tweet_id: tweetId,
        posted_image_urls: media.images,
        posted_video_urls: postedVideoUrls,
        posted_gif_urls: media.gifs,
        timestamp: timestamp,
      };
    }

    return null;
  }
 
  function getUserFromContainer(container) {
    const userNameEl = container.querySelector('[data-testid="User-Name"]');
    if (!userNameEl) return { username: "", displayName: "" };

    let username = "";
    let displayName = "";

    const spans = userNameEl.querySelectorAll("span");
    for (const span of spans) {
      const t = span.textContent.trim();
      if (t.startsWith("@") && t.length > 1) {
        username = t;
        break;
      }
    }

    const firstLink = userNameEl.querySelector('a[role="link"], div');
    if (firstLink) {
      const clone = firstLink.cloneNode(true);
      clone.querySelectorAll("svg, img").forEach((n) => n.remove());
      displayName = clone.textContent.trim();
      if (!username) {
        const href = firstLink.getAttribute("href") || "";
        const m = href.match(/^\/([A-Za-z0-9_]+)$/);
        if (m) username = "@" + m[1];
      }
    }

    return { username, displayName };
  }

  function getUrlAndIdFromContainer(container) {
    const timeEl = container.querySelector("time[datetime]");
    if (timeEl) {
      const link = timeEl.closest('a[href*="/status/"]');
      if (link) return hrefToData(link.getAttribute("href"));
    }

    const allLinks = container.querySelectorAll('a[href*="/status/"]');
    for (const link of allLinks) {
      return hrefToData(link.getAttribute("href"));
    }

    return { url: "", tweetId: "" };
  }

  function getTimestampFromContainer(container) {
    const el = container.querySelector("time[datetime]");
    return el ? el.getAttribute("datetime") : "";
  }

  function getMediaFromContainer(container) {
    const images = [];
    const videos = [];
    const gifs = [];
    let hasVideo = false;

    const photoEls = container.querySelectorAll('[data-testid="tweetPhoto"]');
    photoEls.forEach((photoEl) => {
      const img = photoEl.querySelector("img[src]");
      if (!img) return;
      let src = img.src;
      if (/profile_images|emoji/i.test(src)) return;
      src = src.replace(/name=\w+/, "name=orig");
      images.push(src);
    });

    const players = container.querySelectorAll('[data-testid="videoPlayer"]');
    players.forEach((player) => {
      const isGif = detectGif(player);
      const videoSrc = getVideoSrc(player);
      if (videoSrc) {
        (isGif ? gifs : videos).push(videoSrc);
      }
      if (!isGif) hasVideo = true;
    });
 
    return { images, videos, gifs, hasVideo };
  }
 
  function isDirectChild(el, article) {
    const closest = el.closest(
      '[data-testid="tweet"], article[role="article"]',
    );
    return closest === article;
  }
 
  return { extractTweet, parseHumanNumber };
})();
