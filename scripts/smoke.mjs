// node scripts/smoke.mjs [extDir] : load the unpacked extension in headless Chrome and check it end to end
// against the live service with a wrong key (free: nothing is generated).
import fs from 'node:fs';
import path from 'node:path';
import { launch, loadExtension, sleep } from './cdp.mjs';

const EXT = path.resolve(process.argv[2] || new URL('../src', import.meta.url).pathname);
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${detail}`); };
const b = launch();
try {
  const { id, sw, swSession } = await loadExtension(b, EXT);
  ok('loadUnpacked', !!id, id);
  ok('background worker running', !!sw, sw && sw.url);
  for (const m of ['fitv', 'fitv-gentle', 'fitv-orbit', 'fitv-alive', 'fitv-custom']) {
    const r = await b.ev(swSession, `new Promise(r=>chrome.contextMenus.update(${JSON.stringify(m)},{},()=>r(chrome.runtime.lastError?'missing':'ok')))`);
    ok(`context menu ${m}`, r === 'ok', r);
  }
  const pop = await b.openPage(`chrome-extension://${id}/popup.html`, 380, 600);
  const noKey = await b.ev(pop.sessionId, `chrome.runtime.sendMessage({type:'generate',prompt:'smoke',image:''})`);
  ok('no key -> auth, no request', noKey && noKey.ok === false && noKey.kind === 'auth', JSON.stringify(noKey));
  for (const t of (await b.send('Target.getTargets')).targetInfos) if (t.type === 'page' && t.url.endsWith('options.html')) await b.send('Target.closeTarget', { targetId: t.targetId });
  await b.ev(pop.sessionId, `chrome.storage.local.set({apiKey:'sk-invalidsmoketest'})`);
  const wrong = await b.ev(pop.sessionId, `chrome.runtime.sendMessage({type:'generate',prompt:'the camera slowly pushes in',image:'https://cdn.freeimagetovideo.ai/images/showcase/old-family-portrait-1900-comes-alive-start.webp'})`);
  ok('wrong key -> generate (live) -> auth', wrong && wrong.ok === false && wrong.kind === 'auth', JSON.stringify(wrong));
  const wrongTxt = await b.ev(pop.sessionId, `chrome.runtime.sendMessage({type:'generate',prompt:'a paper lantern drifting over a night river'})`);
  ok('wrong key -> text to video (live) -> auth', wrongTxt && wrongTxt.kind === 'auth', JSON.stringify(wrongTxt));
  const jobs = await b.ev(pop.sessionId, `chrome.storage.local.get('jobs').then(s=>(s.jobs||[]).length)`);
  ok('refused runs leave no job', jobs === 0, String(jobs));
  for (const t of (await b.send('Target.getTargets')).targetInfos) if (t.type === 'page' && t.url.endsWith('options.html')) await b.send('Target.closeTarget', { targetId: t.targetId });
  await b.send('Page.reload', {}, pop.sessionId); await sleep(2500);
  const cred = await b.ev(pop.sessionId, `document.getElementById('credits').textContent`);
  ok('popup: wrong key -> "Key not valid" (live credits call)', cred === 'Key not valid', cred);
  const opt = await b.openPage(`chrome-extension://${id}/options.html`, 900, 900);
  await sleep(2500);
  const keymsg = await b.ev(opt.sessionId, `document.getElementById('keymsg').className + ' | ' + document.getElementById('keymsg').textContent`);
  ok('options: wrong key -> error message', /msg bad/.test(keymsg) && /Invalid API key/i.test(keymsg), keymsg);
  await b.ev(opt.sessionId, `(document.getElementById('duration').value='6', document.getElementById('duration').dispatchEvent(new Event('change')), new Promise(r=>setTimeout(r,300))).then(()=>chrome.storage.local.get('options')).then(s=>JSON.stringify(s.options))`)
    .then((v) => ok('options: clip settings saved', v === '{"duration":6}', v));
  // a data: image (as some pages serve) is uploaded first; only the public upload endpoint is hit, then generate refuses the key
  const dataImg = await b.ev(pop.sessionId, `(async()=>{const c=new OffscreenCanvas(64,64);const x=c.getContext('2d');x.fillStyle='#e11d74';x.fillRect(0,0,64,64);const bl=await c.convertToBlob({type:'image/png'});const u=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(bl)});return chrome.runtime.sendMessage({type:'generate',prompt:'pulse',image:u})})()`);
  ok('data: image -> upload -> generate -> auth', dataImg && dataImg.kind === 'auth', JSON.stringify(dataImg));
  const notHttps = await b.ev(pop.sessionId, `chrome.runtime.sendMessage({type:'generate',prompt:'x',image:'blob:https://e.com/1'})`);
  ok('non-https image -> validation', notHttps && notHttps.kind === 'validation', JSON.stringify(notHttps));
} catch (e) {
  ok('exception', false, e.stack || e.message);
} finally {
  await b.close();
  fs.writeFileSync(new URL('../smoke-results.json', import.meta.url), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(failed ? `${failed} FAILED` : `all ${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
