# Privacy policy: Free Image to Video for Chrome and Firefox

Last updated: 2026-11-10

The Free Image to Video browser extension ("the extension") is published by Free Image to Video (https://freeimagetovideo.ai/). Contact: support@freeimagetovideo.ai.

**What is stored, and where.** Your Free Image to Video API key, your clip settings (length, resolution, shape) and a list of your most recent clips (up to 20: the motion text, the image URL, the task id, status and the video URL) are stored only in your browser with `storage.local`. They are never sent to the developer or any third party. Removing the extension deletes all of it.

**What is sent, and to whom.** Only when you choose the menu item or press "Make video":

- the image you picked: if it already has a public https address, that address is sent; if it is a file you chose or an inline (data:) image, the image itself is uploaded to `https://freeimagetovideo.ai/api/storage/upload-image` so the model can read it;
- the motion text and your clip settings are sent to `https://freeimagetovideo.ai/api/ai/generate`, with your API key in the `Authorization` header;
- to show progress, the task id is sent to `https://freeimagetovideo.ai/api/ai/query`; to show your credits, an empty request is sent to `https://freeimagetovideo.ai/api/user/get-user-credits`.

The extension talks to no other server and contains no analytics, ads or remote code.

**What is not collected.** Page contents, browsing history, cookies, or any image or text you did not choose and send yourself.

How Free Image to Video handles your images, clips and account: https://freeimagetovideo.ai/privacy-policy
