// Background worker: right-click an image -> upload if needed -> submit to Free Image to Video -> poll -> notify with the clip link.
// Jobs live in chrome.storage.local so a restarted worker (MV3 stops idle workers) picks them up again;
// a 30-second alarm wakes the worker while anything is still being made.

import { getApiKey, submit, status, resolveImage, POLL_MS, TIMEOUT_MS, SITE_URL, DEFAULT_PROMPT } from './api.js';

const ALARM = 'fitv-poll';
const MAX_JOBS = 20;
const ICON = 'icons/icon128.png';
const PRESETS = {
  'fitv-gentle': DEFAULT_PROMPT,
  'fitv-orbit': 'the camera slowly orbits the subject, cinematic light',
  'fitv-alive': 'the subject comes alive: blinks, breathes, turns slightly toward the camera',
};

let lock = Promise.resolve();
function withJobs(fn) {
  const run = lock.then(async () => {
    const { jobs = [] } = await chrome.storage.local.get('jobs');
    const out = await fn(jobs);
    await chrome.storage.local.set({ jobs: jobs.slice(0, MAX_JOBS) });
    return out;
  });
  lock = run.catch(() => {});
  return run;
}
const readJobs = async () => (await chrome.storage.local.get('jobs')).jobs || [];
const patchJob = (id, patch) => withJobs((jobs) => { const j = jobs.find((x) => x.id === id); if (j) Object.assign(j, patch); });

async function updateBadge() {
  const n = (await readJobs()).filter((j) => j.status === 'making').length;
  await chrome.action.setBadgeBackgroundColor({ color: '#e11d74' });
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
}

const notify = (id, title, message) =>
  chrome.notifications.create(id, { type: 'basic', iconUrl: ICON, title, message, priority: 1 });
const short = (s, n = 60) => (s.length > n ? s.slice(0, n) + '…' : s);

async function videoOptions() {
  const { options = {} } = await chrome.storage.local.get('options');
  return options;
}

/** image: an https URL, a data: URL, or '' for text to video. */
async function startJob({ prompt, image = '' }) {
  prompt = String(prompt || '').trim() || (image ? DEFAULT_PROMPT : '');
  if (!prompt) return { ok: false, error: 'Write what the clip should show first.', kind: 'validation' };
  const apiKey = await getApiKey();
  if (!apiKey) {
    notify('fitv-nokey', 'Free Image to Video needs your API key', 'Paste it on the settings page to start making clips.');
    chrome.runtime.openOptionsPage();
    return { ok: false, error: 'Set your API key first.', kind: 'auth' };
  }
  try {
    const imageUrl = image ? await resolveImage(image) : undefined;
    const id = await submit(apiKey, prompt, imageUrl, await videoOptions());
    await withJobs((jobs) => { jobs.unshift({ id, prompt, image: imageUrl || null, status: 'making', url: null, error: null, createdAt: Date.now() }); });
    notify(`fitv-start-${id}`, 'Making your clip', short(prompt));
    await updateBadge();
    ensurePolling();
    return { ok: true, id };
  } catch (e) {
    notify(`fitv-err-${Date.now()}`, 'Clip not started', e.message);
    if (e.kind === 'auth') chrome.runtime.openOptionsPage();
    return { ok: false, error: e.message, kind: e.kind };
  }
}

let loop = null;
function ensurePolling() {
  if (!loop) loop = pollLoop().finally(() => { loop = null; });
  return loop;
}

async function checkOne(job, apiKey) {
  if (Date.now() - job.createdAt > TIMEOUT_MS) {
    await patchJob(job.id, { status: 'timeout' });
    notify(`fitv-timeout-${job.id}`, 'Still generating', 'It will land in your history on freeimagetovideo.ai.');
    return;
  }
  let s;
  try {
    s = await status(apiKey, job.id);
  } catch (e) {
    if (e.kind === 'network' || e.kind === 'server') return; // a dropped poll is not a failed run
    await patchJob(job.id, { status: 'failed', error: e.message });
    notify(`fitv-err-${job.id}`, 'Clip not made', e.message);
    return;
  }
  if (s.status === 'success' && Array.isArray(s.videos) && s.videos[0]) {
    await patchJob(job.id, { status: 'ready', url: s.videos[0], queued: false });
    notify(`fitv-done-${job.id}`, 'Your clip is ready', `Click to open: ${short(job.prompt, 40)}`);
  } else if (s.status === 'failed' || s.status === 'canceled') {
    const msg = s.errorMessage || `the run was ${s.status}`;
    await patchJob(job.id, { status: 'failed', error: msg });
    notify(`fitv-fail-${job.id}`, 'Clip not made', msg);
  } else if (!!s.queued !== !!job.queued) {
    await patchJob(job.id, { queued: !!s.queued });
  }
}

async function pollLoop() {
  await chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
  for (;;) {
    const pending = (await readJobs()).filter((j) => j.status === 'making');
    if (!pending.length) break;
    const apiKey = await getApiKey();
    for (const job of pending) await checkOne(job, apiKey);
    await updateBadge();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await chrome.alarms.clear(ALARM);
  await updateBadge();
}

function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'fitv', title: 'Turn this image into a video', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'fitv-gentle', parentId: 'fitv', title: 'Gentle motion', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'fitv-orbit', parentId: 'fitv', title: 'Slow camera orbit', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'fitv-alive', parentId: 'fitv', title: 'Bring the subject to life', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'fitv-custom', parentId: 'fitv', title: 'Describe the motion…', contexts: ['image'] });
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  buildMenus();
  if (details.reason === 'install' && !(await getApiKey())) chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const image = info.srcUrl || '';
  if (PRESETS[info.menuItemId]) return startJob({ prompt: PRESETS[info.menuItemId], image });
  if (info.menuItemId === 'fitv-custom') {
    // The popup picks the image up and asks for the motion.
    await chrome.storage.local.set({ draftImage: image });
    try { await chrome.action.openPopup(); } catch { chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?tab=1') }); }
  }
});

chrome.notifications.onClicked.addListener(async (nid) => {
  chrome.notifications.clear(nid);
  if (nid === 'fitv-nokey') return chrome.runtime.openOptionsPage();
  const m = nid.match(/^fitv-(?:done|start|fail|timeout|err)-(.+)$/);
  const job = m && (await readJobs()).find((j) => j.id === m[1]);
  if (job && job.url) chrome.tabs.create({ url: job.url });
  else if (!job) chrome.tabs.create({ url: SITE_URL });
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) ensurePolling(); });
chrome.runtime.onStartup.addListener(() => { ensurePolling(); });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'generate') { startJob(msg).then(sendResponse); return true; }
  if (msg && msg.type === 'recheck') {
    patchJob(msg.id, { status: 'making', error: null, createdAt: Date.now() })
      .then(updateBadge).then(() => { ensurePolling(); sendResponse({ ok: true }); });
    return true;
  }
  if (msg && msg.type === 'clear') {
    withJobs((jobs) => { jobs.splice(0, jobs.length, ...jobs.filter((j) => j.status === 'making')); })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
