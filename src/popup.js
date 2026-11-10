import { getApiKey, credits, uploadImage, SITE_URL, PRICING_URL } from './api.js';

const $ = (id) => document.getElementById(id);
const LABEL = { making: 'Making', ready: 'Ready', failed: 'Failed', timeout: 'Taking long' };
let image = ''; // https URL or data: URL; '' = text to video
let file = null;

function showImage(src, name) {
  $('thumb').hidden = !src;
  if (src) $('thumb').src = src;
  $('imgname').textContent = src ? name || src : 'No photo: this makes a text to video clip.';
  $('noimg').hidden = !src;
}

function renderJobs(jobs) {
  const ul = $('jobs');
  ul.textContent = '';
  $('empty').hidden = jobs.length > 0;
  $('clear').hidden = !jobs.some((j) => j.status !== 'making');
  for (const j of jobs) {
    const li = document.createElement('li');
    const p = Object.assign(document.createElement('div'), { className: 'p', textContent: j.prompt, title: j.prompt });
    const meta = Object.assign(document.createElement('div'), { className: 'meta' });
    const label = j.status === 'making' && j.queued ? 'In the queue' : LABEL[j.status] || j.status;
    meta.append(Object.assign(document.createElement('span'), { className: `chip ${j.status}`, textContent: label }));
    meta.append(Object.assign(document.createElement('span'), { className: 'spacer' }));
    if (j.status === 'ready' && j.url) {
      meta.append(Object.assign(document.createElement('a'), { className: 'btn small', href: j.url, target: '_blank', rel: 'noopener', textContent: 'Open MP4' }));
    } else if (j.status === 'timeout' || j.status === 'failed') {
      const b = Object.assign(document.createElement('button'), { className: 'btn ghost small', textContent: 'Check again' });
      b.onclick = () => chrome.runtime.sendMessage({ type: 'recheck', id: j.id });
      meta.append(b);
    }
    li.append(p, meta);
    if (j.status === 'ready' && j.url) li.append(Object.assign(document.createElement('video'), { src: j.url, controls: true, preload: 'metadata' }));
    if (j.error) li.append(Object.assign(document.createElement('div'), { className: 'err', textContent: j.error }));
    ul.append(li);
  }
}

async function init() {
  const key = await getApiKey();
  $('nokey').hidden = !!key;
  $('go').disabled = !key;
  if (key) {
    credits(key)
      .then((n) => { $('credits').textContent = ''; $('credits').append('Credits', document.createElement('br'), Object.assign(document.createElement('b'), { textContent: String(n) })); })
      .catch((e) => { $('credits').textContent = e.kind === 'auth' ? 'Key not valid' : ''; });
  }
  const { jobs = [], draftImage = '' } = await chrome.storage.local.get(['jobs', 'draftImage']);
  if (draftImage) {
    image = draftImage;
    showImage(draftImage, 'Image from the page');
    chrome.storage.local.remove('draftImage');
    $('prompt').focus();
  }
  renderJobs(jobs);
}

$('file').addEventListener('change', () => {
  file = $('file').files[0] || null;
  image = '';
  if (file) showImage(URL.createObjectURL(file), file.name);
});
$('noimg').addEventListener('click', () => { image = ''; file = null; $('file').value = ''; showImage(''); });

$('go').addEventListener('click', async () => {
  const prompt = $('prompt').value.trim();
  const msg = $('msg');
  if (!prompt && !image && !file) { msg.className = 'msg bad'; msg.textContent = 'Pick a photo or write what the clip should show.'; return; }
  $('go').disabled = true;
  msg.className = 'msg';
  let r;
  try {
    let src = image;
    if (file) { msg.textContent = 'Uploading the photo…'; src = await uploadImage(file, file.name); }
    msg.textContent = 'Sending…';
    r = await chrome.runtime.sendMessage({ type: 'generate', prompt, image: src });
  } catch (e) {
    r = { ok: false, error: e.message };
  }
  $('go').disabled = false;
  if (r && r.ok) {
    msg.className = 'msg ok';
    msg.textContent = 'Started. You will get a notification when the clip is ready.';
    $('prompt').value = ''; image = ''; file = null; $('file').value = ''; showImage('');
  } else { msg.className = 'msg bad'; msg.textContent = (r && r.error) || 'Could not reach freeimagetovideo.ai.'; }
});
$('clear').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'clear' }));
$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('settings').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
$('site').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: SITE_URL }); });
$('pricing').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: PRICING_URL }); });
chrome.storage.onChanged.addListener((c) => { if (c.jobs) renderJobs(c.jobs.newValue || []); });
init();
