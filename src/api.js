// Free Image to Video API client shared by the background worker, the popup and the options page.
// Endpoints and error mapping follow the official SDKs; it talks to freeimagetovideo.ai only.

export const BASE = 'https://freeimagetovideo.ai';
const UTM = 'utm_source=chrome&utm_medium=extension';
export const KEYS_URL = `${BASE}/settings/apikeys?${UTM}`;
export const SITE_URL = `${BASE}/?${UTM}`;
export const PRICING_URL = `${BASE}/pricing?${UTM}`;
export const POLL_MS = 10_000;
export const TIMEOUT_MS = 30 * 60 * 1000;
export const DEFAULT_PROMPT = 'natural, gentle motion, slow camera push-in';

export async function getApiKey() {
  const s = await chrome.storage.local.get('apiKey');
  return String(s.apiKey || '').trim();
}

/** kind: auth | quota | plan | busy | rejected | generation | validation | network | server | api */
export class FitvError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'FitvError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

/** HTTP status + envelope -> error kind. Success = HTTP < 400 and code === 0; refusals often come as HTTP 200. */
export function classify(status, body) {
  body = body || {};
  const message = body.message || `request failed (HTTP ${status})`;
  const code = typeof body.code === 'number' ? body.code : 0;
  const reason = body.data && typeof body.data.reason === 'string' ? body.data.reason : undefined;
  if (status === 401 || /no auth/i.test(message)) {
    return new FitvError('auth', /settings\/apikeys/.test(message) ? message : `${message}. Create a key at ${BASE}/settings/apikeys`, { status });
  }
  if (code === -2 || code === -3) return new FitvError('rejected', `${message}. Change the prompt or the photo and try again.`, { status });
  if (reason === 'insufficient_credits') return new FitvError('quota', `${message}. See ${BASE}/pricing`, { status });
  if (reason === 'plan_required') return new FitvError('plan', `${message}. API runs need a paid plan: ${BASE}/pricing`, { status });
  if (reason === 'concurrency') return new FitvError('busy', `${message}. Wait for a clip to finish, then try again.`, { status });
  return new FitvError(status >= 500 ? 'server' : 'api', message, { status });
}

export function unwrap(status, body) {
  if (status < 400 && body && body.code === 0) return body.data || {};
  if (!body || typeof body !== 'object') {
    if (status === 401) throw classify(401, {});
    throw new FitvError('server', `freeimagetovideo.ai returned an unexpected answer (HTTP ${status})`, { status });
  }
  throw classify(status, body);
}

async function call(path, init) {
  let res;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new FitvError('network', 'Could not reach freeimagetovideo.ai. Check your connection.');
  }
  if (res.status === 413) throw new FitvError('validation', 'This photo is over 10MB; use a smaller one.');
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return unwrap(res.status, body);
}

function post(apiKey, path, payload) {
  if (!apiKey) return Promise.reject(new FitvError('auth', `Set your API key first. Create one at ${BASE}/settings/apikeys`));
  return call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload || {}),
  });
}

/** The request body for POST /api/ai/generate. */
export function generateBody(prompt, imageUrl, options = {}) {
  const opts = {};
  for (const [k, v] of Object.entries(options)) if (v !== undefined && v !== null && v !== '') opts[k] = v;
  opts.sound = true;
  let scene = 'text-to-video';
  if (imageUrl) { opts.image_input = [imageUrl]; scene = 'image-to-video'; }
  return { provider: 'auto', mediaType: 'video', model: 'minimax-h3', scene, prompt, options: opts };
}

export async function submit(apiKey, prompt, imageUrl, options) {
  const d = await post(apiKey, '/api/ai/generate', generateBody(prompt, imageUrl, options));
  if (d.id === undefined || d.id === null || d.id === '') throw new FitvError('api', 'freeimagetovideo.ai accepted the run but returned no id');
  return String(d.id);
}

export const status = (apiKey, id) => post(apiKey, '/api/ai/query', { taskId: id });

export async function credits(apiKey) {
  const d = await post(apiKey, '/api/user/get-user-credits', {});
  return Number(d.remainingCredits || 0);
}

const MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/** Upload a picked file or a data: image to freeimagetovideo.ai storage; returns its public https URL. */
export async function uploadImage(blob, filename = 'photo') {
  if (!MIMES.includes(blob.type)) throw new FitvError('validation', 'Use a JPG, PNG or WebP image.');
  const form = new FormData();
  form.append('files', blob, filename);
  const d = await call('/api/storage/upload-image', { method: 'POST', body: form });
  if (!Array.isArray(d.urls) || !d.urls[0]) throw new FitvError('api', 'The upload returned no URL.');
  return d.urls[0];
}

/** Turn whatever the page gave us into an https URL the model can read. */
export async function resolveImage(src) {
  if (/^https:\/\//i.test(src)) return src;
  if (/^data:image\//i.test(src)) {
    const blob = await (await fetch(src)).blob();
    return uploadImage(blob);
  }
  throw new FitvError('validation', 'This image is not on a public https address. Save it and pick it in the popup instead.');
}
