// Minimal CDP-over-pipe driver for a dedicated-profile headless Chrome (never the everyday browser, never focused).
// Extensions load through Extensions.loadUnpacked: branded Chrome 137+ ignores --load-extension.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const PROFILE = `${process.env.HOME}/.cache/chrome-automation-profile-fitv`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function launch() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const proc = spawn(CHROME, [`--user-data-dir=${PROFILE}`, '--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1280,800', '--lang=en', '--hide-scrollbars', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const w = proc.stdio[3], r = proc.stdio[4];
  let buf = '', nextId = 1; const pending = new Map();
  r.on('data', (d) => {
    buf += d.toString(); let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = nextId++; pending.set(id, { res, rej });
    w.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
  const ev = async (s, expr) => {
    const x = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, s);
    if (x.exceptionDetails) throw new Error(x.exceptionDetails.exception?.description || x.exceptionDetails.text);
    return x.result.value;
  };
  const openPage = async (url, width, height, scale = 1) => {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', background: true });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false }, sessionId);
    await send('Page.navigate', { url }, sessionId);
    await sleep(1200);
    return { targetId, sessionId };
  };
  const shot = async (s, file) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, s);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  };
  const close = async () => { try { await send('Browser.close'); } catch {} await sleep(500); if (proc.exitCode === null) proc.kill(); };
  return { send, ev, openPage, shot, close };
}

export async function loadExtension(b, dir) {
  const { id } = await b.send('Extensions.loadUnpacked', { path: dir });
  await sleep(1500);
  const { targetInfos } = await b.send('Target.getTargets');
  const sw = targetInfos.find((t) => t.type === 'service_worker' && t.url.includes(id));
  const swSession = sw ? (await b.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true })).sessionId : null;
  return { id, sw, swSession };
}
