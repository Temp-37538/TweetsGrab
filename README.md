# TweetsGrab

A browser extension for **x.com** that lets you pick tweets and export them as
structured JSON. It runs as a Manifest V3 extension with no backend of its own.

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked**, then select the `TweetsGrab` folder.
3. Go to x.com, and the extension is active on any x.com page.

The project is open source and not published to the Chrome Web Store, so you
load it unpacked directly from the repository.

## How to use it

There are two selection modes:

- **Manual**: click individual tweets to add or remove them.
- **Thread**: the extension finds every tweet by the original author in the
  open conversation and selects them all, keeping the selection in sync as you
  scroll.

**Starting a session**

- Click the extension icon to open the popup, then choose **Selection Mode**
  (manual) or **Select Thread**.
- Or right-click a page: **Toggle selection** works anywhere on x.com, and
  **Select Thread** only appears on a status (tweet) page.

A small indicator shows while a session is active. In manual mode, click a tweet
to toggle its selection (gold outline + number badge); click it again to
deseelect.

**Finishing**

Press **Export** in the indicator, or **Esc**, to open the export overlay, where
you can copy the JSON to the clipboard or download it as a file. **Cancel**
(from the popup or the indicator) ends the session and clears the selection.

**Videos:** when a selected tweet contains video, the real video URL is fetched
from an external resolver (`twittergrabapi.onrender.com`) at export time. Only
the resolved/direct URL is stored; `blob:` URLs are skipped.

## Exported data

Each tweet is a JSON object with:

- `id`, `tweet_text`, `username`, `display_name`, `tweet_url`
- `posted_image_urls`, `posted_video_urls`, `posted_gif_urls` (arrays)
- `timestamp`, `tweet_id`, `likes`, `retweets`, `replies`
- `quoted_tweet` (a nested tweet object, or `null`)

## Project structure

| File | Responsibility |
| --- | --- |
| `manifest.json` | Manifest V3 configuration and permissions. |
| `background.js` | Service worker: context menus, JSON download, on-demand content-script injection. |
| `content.js` | Receives popup/context-menu commands and forwards them to the selector. |
| `selector.js` | Selection state, click handling, thread auto-selection, indicator UI. |
| `extract.js` | Parses tweet DOM into structured data; resolves video links. |
| `retrieve_videolink.js` | Calls the external video resolver API. |
| `export.js` | Export overlay (copy / download JSON). |
| `shared.js` | Helpers shared by the popup and background (page checks, injection). |
| `popup.html` / `popup.js` | The toolbar popup. |
| `styles.css` | Styles injected into x.com pages. |

## Implementation notes

- Selection relies on x.com's stable `data-testid` attributes.
- A `MutationObserver` re-applies selections when x.com recycles DOM nodes
  during scrolling.
- There is no build step and no runtime dependency: the extension is plain
  JavaScript loaded directly as content scripts.
