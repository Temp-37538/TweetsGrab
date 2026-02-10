window.TweetsGrabRetrieveLinkVideo = async function retrieveLinkVideo(
  videoUrl,
) {
  try {
    const response = await fetch("https://twittergrabapi.onrender.com", {
      body: JSON.stringify({
        url: videoUrl,
      }),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return data.link;
  } catch (error) {
    throw error;
  }
};
