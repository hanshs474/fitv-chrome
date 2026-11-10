// node scripts/test.mjs : offline unit tests for src/api.js against answers shaped like the live API.
import assert from 'node:assert';
const store = {};
globalThis.chrome = { storage: { local: { get: async (k) => ({ [k]: store[k] }) } } };
const calls = [];
let answer = () => [200, { code: 0, data: {} }];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('data:')) return { blob: async () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }) };
  calls.push({ url, init });
  const [status, body] = answer(url);
  return { status, json: async () => { if (body === undefined) throw new Error('not json'); return body; } };
};
const api = await import('../src/api.js');

assert.deepStrictEqual(api.generateBody('p', 'https://e.com/a.jpg', { duration: 6, resolution: '' }),
  { provider: 'auto', mediaType: 'video', model: 'minimax-h3', scene: 'image-to-video', prompt: 'p', options: { duration: 6, sound: true, image_input: ['https://e.com/a.jpg'] } });
assert.deepStrictEqual(api.generateBody('p').scene, 'text-to-video');

answer = () => [200, { code: 0, data: { id: 42 } }];
assert.strictEqual(await api.submit('sk-x', 'p', 'https://e.com/a.jpg'), '42');
assert.strictEqual(calls.at(-1).url, 'https://freeimagetovideo.ai/api/ai/generate');
assert.strictEqual(calls.at(-1).init.headers.authorization, 'Bearer sk-x');

const kind = (k) => (e) => e.kind === k;
const refuse = (status, body) => { answer = () => [status, body]; };
refuse(401, { code: -1, message: 'Invalid API key. Create one at https://freeimagetovideo.ai/settings/apikeys', data: { reason: 'invalid_api_key' } });
await assert.rejects(api.submit('sk-bad', 'p'), kind('auth'));
refuse(401, undefined); await assert.rejects(api.credits('sk-bad'), kind('auth'));
refuse(200, { code: -1, message: 'no auth, please sign in' }); await assert.rejects(api.credits('sk-x'), kind('auth'));
refuse(200, { code: -2, message: 'blocked' }); await assert.rejects(api.submit('sk-x', 'p'), kind('rejected'));
refuse(200, { code: -3, message: 'cooldown' }); await assert.rejects(api.submit('sk-x', 'p'), kind('rejected'));
refuse(200, { code: -1, message: 'x', data: { reason: 'insufficient_credits' } }); await assert.rejects(api.submit('sk-x', 'p'), kind('quota'));
refuse(200, { code: -1, message: 'x', data: { reason: 'plan_required' } }); await assert.rejects(api.submit('sk-x', 'p'), kind('plan'));
refuse(200, { code: -1, message: 'x', data: { reason: 'concurrency' } }); await assert.rejects(api.submit('sk-x', 'p'), kind('busy'));
refuse(502, undefined); await assert.rejects(api.status('sk-x', 't'), kind('server'));
refuse(200, { code: 5, message: 'odd', data: { id: 'x' } }); await assert.rejects(api.submit('sk-x', 'p'), kind('api'));
refuse(200, { code: 0, data: { id: 't', status: 'success', videos: ['https://cdn/x.mp4'] } });
assert.deepStrictEqual((await api.status('sk-x', 't')).videos, ['https://cdn/x.mp4']);
assert.deepStrictEqual(JSON.parse(calls.at(-1).init.body), { taskId: 't' });
refuse(200, { code: 0, data: { remainingCredits: 9 } }); assert.strictEqual(await api.credits('sk-x'), 9);
const n = calls.length; await assert.rejects(api.credits(''), kind('auth')); assert.strictEqual(calls.length, n);

// images: https passes through, data: is uploaded (Blob carries its MIME), anything else is refused
assert.strictEqual(await api.resolveImage('https://e.com/a.jpg'), 'https://e.com/a.jpg');
refuse(200, { code: 0, data: { urls: ['https://cdn.freeimagetovideo.ai/uploads/input/a.png'] } });
assert.strictEqual(await api.resolveImage('data:image/png;base64,iVBO'), 'https://cdn.freeimagetovideo.ai/uploads/input/a.png');
assert.strictEqual(calls.at(-1).url, 'https://freeimagetovideo.ai/api/storage/upload-image');
assert.strictEqual(calls.at(-1).init.body.get('files').type, 'image/png');
await assert.rejects(api.resolveImage('blob:https://e.com/1'), kind('validation'));
await assert.rejects(api.uploadImage(new Blob(['x'], { type: 'image/gif' })), kind('validation'));
refuse(413, undefined); await assert.rejects(api.uploadImage(new Blob(['x'], { type: 'image/png' })), kind('validation'));
console.log('api tests ok');
