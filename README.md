# ⚡ TweetsGrab

Chrome extension (Manifest V3) to visually select tweets on **x.com** and export them as **structured JSON**.

---

## Installation (Developer Mode)

1. Open `chrome://extensions` (or `brave://extensions`)
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked extension**
4. Select the `TweetsGrab/` folder
5. Navigate to [https://x.com](https://x.com)

---

## Usage

| Action                            | Result                                 |
| --------------------------------- | -------------------------------------- |
| **Click extension icon**          | Toggle selection mode                  |
| **Right-click → TweetsGrab**      | Toggle selection mode                  |
| **Click on a tweet**              | Select (cyan outline + numbered badge) |
| **Re-click on selected tweet**    | Deselect                               |
| **ESC**                           | End selection → open export            |
| **Export button** (indicator bar) | End selection → open export            |

### Export

The export overlay provides two options:

- **Copy to Clipboard** — copies JSON to clipboard
- **Download JSON** — downloads a `.json` file

---

## JSON Format

Each exported tweet contains the following fields:

| Field               | Type           | Description                                          |
| ------------------- | -------------- | ---------------------------------------------------- |
| `id`                | number         | Selection order (1, 2, 3...)                         |
| `tweet_text`        | string         | Full text content (excludes quoted tweet text)       |
| `username`          | string         | Username with @ (e.g., "@jack")                      |
| `display_name`      | string         | Display name                                         |
| `tweet_url`         | string         | Direct link to tweet                                 |
| `posted_image_urls` | string[]       | Array of image URLs                                  |
| `posted_video_urls` | string[]       | Array of video URLs (may be empty for blob videos)   |
| `posted_gif_urls`   | string[]       | Array of GIF URLs (direct video.twimg.com links)     |
| `timestamp`         | string         | ISO 8601 format                                      |
| `tweet_id`          | string         | Tweet ID from URL                                    |
| `likes`             | number         | Like count                                           |
| `retweets`          | number         | Retweet count                                        |
| `replies`           | number         | Reply count                                          |
| `quoted_tweet`      | object \| null | Full quoted tweet data (recursive structure) or null |

### Example

```json
[
  {
    "id": 1,
    "tweet_text": "Check out this amazing project!",
    "username": "@jack",
    "display_name": "Jack Dorsey",
    "tweet_url": "https://x.com/jack/status/123456789",
    "posted_image_urls": ["https://pbs.twimg.com/media/abc123.jpg"],
    "posted_video_urls": [],
    "posted_gif_urls": ["https://video.twimg.com/tweet_video/xyz789.mp4"],
    "timestamp": "2025-01-15T12:30:00.000Z",
    "tweet_id": "123456789",
    "likes": 1200,
    "retweets": 300,
    "replies": 50,
    "quoted_tweet": {
      "tweet_text": "Original tweet being quoted",
      "username": "@elonmusk",
      "display_name": "Elon Musk",
      "tweet_url": "https://x.com/elonmusk/status/987654321",
      "posted_image_urls": [],
      "posted_video_urls": [],
      "posted_gif_urls": [],
      "timestamp": "2025-01-14T08:15:00.000Z",
      "tweet_id": "987654321",
      "likes": 5000,
      "retweets": 1200,
      "replies": 300
    }
  }
]
```

---

## Architecture

```
TweetsGrab/
├── manifest.json      Manifest V3
├── background.js      Service worker (action, context menu, downloads)
├── content.js         Orchestrator (messages background ↔ modules)
├── selector.js        Selection engine + MutationObserver
├── extract.js         DOM extraction → structured data
├── export.js          Export overlay (copy / download)
├── styles.css         UI "Signal" — dark glass-morphism + cyan
└── README.md
```

---

## Permissions

| Permission                | Reason                                                  |
| ------------------------- | ------------------------------------------------------- |
| `activeTab`               | Access to active tab only                               |
| `scripting`               | Programmatic injection if content script not yet loaded |
| `clipboardWrite`          | Copy JSON to clipboard                                  |
| `downloads`               | Download JSON file                                      |
| `contextMenus`            | Right-click context menu                                |
| `host_permissions: x.com` | Works only on x.com / twitter.com                       |

---

## Technical Notes

- **Resilient DOM selectors**: uses `data-testid` and `role` instead of dynamic CSS classes
- **MutationObserver**: re-applies visual selections when X.com recycles DOM nodes (virtual scrolling)
- **Data extracted at selection time**: no data loss if DOM is recycled before export
- **Quoted tweet extraction**: automatically detects and extracts quoted/retweeted content with full metadata
- **Media separation**: distinguishes between images, videos, and GIFs in separate arrays
- **Video URL limitation**: videos using blob URLs (Media Source Extensions) cannot be extracted; only direct URLs work. GIFs always use direct URLs and work correctly.
- **Vanilla JS** — no frameworks, no dependencies
