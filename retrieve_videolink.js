const TWEETSGRAB_API_URL = "https://twittergrabapi.onrender.com";
const TWEETSGRAB_API_TIMEOUT_MS = 10_000;

window.TweetsGrabRetrieveLinkVideo = async function retrieveLinkVideo(videoUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TWEETSGRAB_API_TIMEOUT_MS);

  try {
    const response = await fetch(TWEETSGRAB_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: videoUrl }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`TweetsGrab API a répondu ${response.status}`);
    }

    const data = await response.json();
    return data?.link || "";
  } finally {
    clearTimeout(timeout);
  }
};
