# ⚡ TweetsGrab

Chrome extension to select and export tweets from **x.com** as **structured JSON**. Manifest V3.

## Install

1. Open `chrome://extensions` → Enable **Developer mode**
2. Click **Load unpacked** → Select `TweetsGrab/` folder
3. Visit [x.com](https://x.com)

## Usage

| Action                        | Result                        |
| ----------------------------- | ----------------------------- |
| Click icon / Right-click menu | Toggle selection mode         |
| Click tweet                   | Select (cyan outline + badge) |
| Click selected tweet          | Deselect                      |
| **ESC** or **Export** button  | Finish & download/copy        |

## Export Format

Each tweet object contains:

- `id`, `tweet_text`, `username`, `display_name`, `tweet_url`
- `posted_image_urls`, `posted_video_urls`, `posted_gif_urls` (arrays)
- `timestamp`, `tweet_id`, `likes`, `retweets`, `replies`
- `quoted_tweet` (nested tweet or null)

## How It Works

```
selector.js     → click handler, visual selection, MutationObserver
extract.js      → DOM parsing → structured data
export.js       → overlay UI, copy/download
background.js   → downloads, extension lifecycle
```

**No framework, no dependencies. Vanilla JS only.**

## Notes

- Uses `data-testid` selectors (X.com stable API)
- MutationObserver syncs selections when DOM recycles (virtual scrolling)
- Video URLs: only direct URLs extracted; blob URLs skipped
- External video resolver: `fetch()` to the backend
