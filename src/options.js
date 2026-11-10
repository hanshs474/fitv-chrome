import { getApiKey, credits, KEYS_URL, BASE } from './api.js';

const $ = (id) => document.getElementById(id);
const utm = '?utm_source=chrome&utm_medium=extension';
const FIELDS = ['duration', 'resolution', 'aspect_ratio'];

async function checkKey(key) {
  const m = $('keymsg');
  if (!key) { m.className = 'msg bad'; m.textContent = 'Paste a key first.'; return; }
  m.className = 'msg';
  m.textContent = 'Checking…';
  try {
    const n = await credits(key);
    m.className = 'msg ok';
    m.textContent = `Connected. ${n} credits left on this account.`;
  } catch (e) {
    m.className = 'msg bad';
    m.textContent = e.message;
  }
}

async function init() {
  const key = await getApiKey();
  $('key').value = key;
  $('getkey').href = KEYS_URL;
  const { options = {} } = await chrome.storage.local.get('options');
  for (const f of FIELDS) $(f).value = options[f] ?? '';
  if (key) checkKey(key);
}

for (const f of FIELDS) {
  $(f).addEventListener('change', async () => {
    const options = {};
    for (const g of FIELDS) if ($(g).value) options[g] = g === 'duration' ? Number($(g).value) : $(g).value;
    await chrome.storage.local.set({ options });
    $('optmsg').className = 'msg ok';
    $('optmsg').textContent = 'Saved.';
  });
}
$('save').addEventListener('click', async () => {
  const key = $('key').value.trim();
  await chrome.storage.local.set({ apiKey: key });
  checkKey(key);
});
$('toggle').addEventListener('click', () => {
  const k = $('key');
  k.type = k.type === 'password' ? 'text' : 'password';
  $('toggle').textContent = k.type === 'password' ? 'Show' : 'Hide';
});
const open = (path) => (e) => { e.preventDefault(); chrome.tabs.create({ url: BASE + path + utm }); };
$('site').addEventListener('click', open('/'));
$('pricing').addEventListener('click', open('/pricing'));
$('privacy').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: 'https://github.com/hanshs474/fitv-chrome/blob/main/PRIVACY.md' }); });
init();
