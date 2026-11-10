// node scripts/screenshots.mjs : store screenshots (1280x800) from the real popup and options page,
// framed on a staging page inside a temporary copy of the extension. Demo jobs point at clips on the site's CDN.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, loadExtension, sleep } from './cdp.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = path.join(ROOT, 'store/screenshots');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fitv-shots-'));
fs.cpSync(path.join(ROOT, 'src'), tmp, { recursive: true });
const CDN = 'https://cdn.freeimagetovideo.ai';
const PHOTO = `${CDN}/images/showcase/old-family-portrait-1900-comes-alive-start.webp`;

const stage = (kind) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1280px;height:800px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#efe9f3;overflow:hidden}
.bar{height:44px;background:#dfd7e6;display:flex;align-items:center;gap:10px;padding:0 16px}.dot{width:12px;height:12px;border-radius:50%;background:#c9bfd2}
.url{flex:1;height:28px;border-radius:14px;background:#fff;color:#6b6078;font-size:13px;display:flex;align-items:center;padding:0 14px}
.ext{width:28px;height:28px;border-radius:7px;background:url(icons/icon32.png) center/20px no-repeat #fff;box-shadow:0 0 0 2px #e11d74}
.page{position:absolute;top:44px;left:0;right:0;bottom:0;background:#fff;padding:40px 56px}
h1{font:700 30px Georgia,serif;margin:0 0 6px;color:#2a2230}.sub{color:#7a7085;margin:0 0 24px;font-size:15px}
.photo{width:430px;height:540px;object-fit:cover;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.18)}
.menu{position:absolute;background:#fff;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.22);padding:6px 0;font-size:13.5px;color:#1d1428;min-width:250px}
.menu div{padding:6px 18px}.menu .sep{height:1px;background:#eee;padding:0;margin:5px 0}.menu .hi{background:#fbe3ee}
.menu .ico{display:inline-block;width:16px;height:16px;vertical-align:-3px;margin-right:8px;background:url(icons/icon16.png) center/16px}
.pop{position:absolute;top:52px;right:18px;width:380px;border:0;border-radius:12px;box-shadow:0 14px 40px rgba(40,10,60,.28);background:#fbf8fc}
.cap{position:absolute;left:56px;bottom:34px;font:700 26px system-ui;color:#1d1428;max-width:640px;line-height:1.25}
.cap span{color:#e11d74}
.opt{position:absolute;top:44px;left:0;width:1280px;height:756px;border:0}
</style></head><body><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><div class="url">${kind === 2 ? 'chrome-extension://free-image-to-video/options.html' : 'archive.example.org/family-portraits/1900'}</div><div class="ext"></div></div>
${kind === 1 ? `<div class="page"><h1>Family portrait, 1900</h1><p class="sub">From a scanned album</p><img class="photo" src="${PHOTO}">
<div class="menu" style="left:300px;top:250px"><div>Open image in new tab</div><div>Save image as…</div><div>Copy image</div><div class="sep"></div>
<div class="hi"><span class="ico"></span>Turn this image into a video &nbsp;▸</div><div>Inspect</div></div>
<div class="menu" style="left:552px;top:356px"><div class="hi">Bring the subject to life</div><div>Gentle motion</div><div>Slow camera orbit</div><div>Describe the motion…</div></div></div>
<div class="cap">Right-click any photo. <span>Get a video clip with sound.</span></div>
<iframe class="pop" src="popup.html" style="height:560px"></iframe>`
  : `<iframe class="opt" src="options.html" style="width:820px"></iframe><iframe class="pop" src="popup.html" style="top:180px;right:60px;height:600px"></iframe>`}
</body></html>`;
fs.writeFileSync(path.join(tmp, 'stage1.html'), stage(1));
fs.writeFileSync(path.join(tmp, 'stage2.html'), stage(2));

const now = Date.now();
const jobs1 = [
  { id: 'd1', prompt: 'Bring the subject to life: blinks, breathes, turns slightly toward the camera', image: PHOTO, status: 'making', queued: false, createdAt: now },
  { id: 'd2', prompt: 'a cat in a bucket hat dancing, upbeat', status: 'ready', url: `${CDN}/videos/showcase/bucket-hat-cat-dance.mp4`, createdAt: now - 6e5 },
];
const jobs2 = [
  { id: 'd3', prompt: 'the woman laughs and looks at the camera, 1925 film look', status: 'ready', url: `${CDN}/videos/showcase/cloche-hat-woman-1925-laughs-v2.mp4`, createdAt: now - 2e5 },
  { id: 'd4', prompt: 'the moustached man turns his head, soft light', status: 'ready', url: `${CDN}/videos/showcase/cabinet-card-moustache-man-turns.mp4`, createdAt: now - 9e5 },
];

const b = launch();
try {
  const { id, swSession } = await loadExtension(b, tmp);
  // demo state: no live calls with a real key; the credit line is filled in after load
  const seed = async (jobs) => b.ev(swSession, `chrome.storage.local.set(${JSON.stringify({ jobs, apiKey: '' })})`);
  for (const t of (await b.send('Target.getTargets')).targetInfos) if (t.type === 'page' && t.url.includes(id)) await b.send('Target.closeTarget', { targetId: t.targetId });
  const fill = `(()=>{const f=document.querySelectorAll('iframe');for(const x of f){const d=x.contentDocument;if(!d)continue;
    const nk=d.getElementById('nokey');if(nk)nk.hidden=true;const g=d.getElementById('go');if(g)g.disabled=false;
    const c=d.getElementById('credits');if(c){c.textContent='';c.append('Credits',d.createElement('br'));const bb=d.createElement('b');bb.textContent='1,240';c.append(bb);}
    const k=d.getElementById('key');if(k){k.value='sk-••••••••••••••••••••';const m=d.getElementById('keymsg');m.className='msg ok';m.textContent='Connected. 1240 credits left on this account.';}
    const v=d.querySelectorAll('video');v.forEach(e=>{e.muted=true;e.currentTime=1.5;});}})()`;
  await seed(jobs1);
  let p = await b.openPage(`chrome-extension://${id}/stage1.html`, 1280, 800);
  await sleep(4000); await b.ev(p.sessionId, fill);
  await b.ev(p.sessionId, `(()=>{const d=document.querySelector('.pop').contentDocument;const t=d.getElementById('thumb');t.src=${JSON.stringify(PHOTO)};t.hidden=false;d.getElementById('imgname').textContent='Image from the page';d.getElementById('noimg').hidden=false;d.getElementById('prompt').value='she smiles, blinks and turns toward the camera';})()`);
  await sleep(2500);
  await b.shot(p.sessionId, path.join(OUT, 'shot1-1280x800.png'));
  await b.send('Target.closeTarget', { targetId: p.targetId });
  await seed(jobs2);
  p = await b.openPage(`chrome-extension://${id}/stage2.html`, 1280, 800);
  await sleep(4000); await b.ev(p.sessionId, fill);
  await b.ev(p.sessionId, `(()=>{const d=document.querySelector('.opt').contentDocument;d.getElementById('duration').value='6';d.getElementById('aspect_ratio').value='9:16';})()`);
  await sleep(2500);
  await b.shot(p.sessionId, path.join(OUT, 'shot2-1280x800.png'));
  // small promo tile 440x280
  fs.writeFileSync(path.join(tmp, 'promo.html'), `<!doctype html><body style="margin:0;width:440px;height:280px;display:flex;align-items:center;gap:18px;padding:0 30px;box-sizing:border-box;background:linear-gradient(135deg,#ff4d8d,#9b4dff);font-family:system-ui;color:#fff"><img src="icons/icon128.png" style="width:96px;height:96px;border-radius:22px;box-shadow:0 6px 20px rgba(0,0,0,.25)"><div><div style="font:800 28px system-ui;line-height:1.1">Free Image to Video</div><div style="font-size:16px;margin-top:8px;opacity:.95">Right-click any photo.<br>Get a clip with sound.</div></div></body>`);
  p = await b.openPage(`chrome-extension://${id}/promo.html`, 440, 280);
  await sleep(800);
  await b.shot(p.sessionId, path.join(OUT, 'promo-440x280.png'));
} finally {
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('screenshots in', OUT);
