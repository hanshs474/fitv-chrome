# Free Image to Video for Chrome: right-click any image, get a video

Free image to video AI with no daily cap: start with no sign-up, keep going on a free account. Every video comes with sound and no watermark. This Chrome extension (Manifest V3) is the official [Free Image to Video](https://freeimagetovideo.ai/?utm_source=chrome&utm_medium=extension) client for your browser: right-click a photo on any page, choose **Turn this image into a video**, and a notification links to the finished MP4.

It is the quickest way to [animate a photo](https://freeimagetovideo.ai/video/animate-photo-ai) you just found: an old family portrait, a product shot, a painting. Every clip is [image to video AI with sound](https://freeimagetovideo.ai/video/image-to-video-ai-with-sound), with the photo as the first frame.

- Right-click any image → **Turn this image into a video** → Bring the subject to life / Gentle motion / Slow camera orbit / Describe the motion…
- Toolbar popup: pick a photo from disk (or none, for text to video), describe the motion, see recent clips with previews and your remaining credits
- Settings page: your API key (stored only in `chrome.storage.local`), clip length, resolution and shape
- Talks only to `https://freeimagetovideo.ai` (`/api/storage/upload-image`, `/api/ai/generate`, `/api/ai/query`, `/api/user/get-user-credits`)

Get a key at [freeimagetovideo.ai/settings/apikeys](https://freeimagetovideo.ai/settings/apikeys). API runs need a paid plan: each run draws on the plan's daily full-speed allowance, then waits in the relaxed queue ([plans](https://freeimagetovideo.ai/pricing?utm_source=chrome&utm_medium=extension)). To make clips without a key, use the generator on the website: start with no sign-up, keep going on a free account.

## Load locally

1. `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → choose `src/`.
2. The settings page opens on first install. Paste your key → **Save and check**.

## Layout

```
src/                   extension source (zip root)
scripts/pack.sh        builds fitv-chrome-<version>.zip
scripts/test.mjs       offline unit tests for src/api.js
scripts/smoke.mjs      headless Chrome smoke test (dedicated profile, CDP Extensions.loadUnpacked, live wrong-key checks)
scripts/screenshots.mjs store screenshots, 1280x800
store/                 listing copy, permission answers, screenshots
PRIVACY.md             privacy policy
```

The Firefox build of the same extension: [github.com/hanshs474/fitv-firefox](https://github.com/hanshs474/fitv-firefox).

MIT licensed. Questions: support@freeimagetovideo.ai.
