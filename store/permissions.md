# Chrome Web Store listing fields and privacy tab answers

**Name:** Free Image to Video: Animate Any Photo
**Summary (132 max):** Right-click any image to turn it into a video clip with sound on Free Image to Video. Runs on your freeimagetovideo.ai API key.
**Category:** Tools (alternative: Photos)
**Language:** English
**Homepage URL:** https://freeimagetovideo.ai/?utm_source=chrome&utm_medium=extension
**Support URL:** https://github.com/hanshs474/fitv-chrome/issues
**Privacy policy URL:** https://github.com/hanshs474/fitv-chrome/blob/main/PRIVACY.md
**Screenshots:** store/screenshots/shot1-1280x800.png, store/screenshots/shot2-1280x800.png · **Small promo tile:** store/screenshots/promo-440x280.png
**Description:** store/description-en.md

**Single purpose:** Turn an image the user picks (right-click on a page, or a file in the popup) into a video clip on freeimagetovideo.ai with the user's own API key, and tell the user when the clip is ready.

| Permission | Justification |
|---|---|
| `contextMenus` | Adds one item (with four motion presets) to the right-click menu on images, "Turn this image into a video", the extension's main entry point. |
| `storage` | Stores the user's API key, clip settings and recent clips locally (storage.local) so jobs survive the background worker stopping. Nothing is synced or sent elsewhere. |
| `notifications` | Tells the user when a clip starts, is ready (click opens it) or fails, since the user is usually on another page by then. |
| `alarms` | Wakes the background worker every 30 seconds only while a clip is still being made, to resume polling. Cleared when nothing is pending. |
| Host `https://freeimagetovideo.ai/*` | The extension calls only freeimagetovideo.ai's own API (image upload, generate, query, credits). |

**Remote code:** No.
**Data usage, check:** Authentication information (the API key, used only as the freeimagetovideo.ai auth header) · Website content (only the image the user chose and the motion text they typed). Nothing else.
**Certifications, check all three:** not sold to third parties · not used for unrelated purposes · not used for creditworthiness or lending.
