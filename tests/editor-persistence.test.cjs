const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const vm = require('node:vm');

// Execute the real provider with deterministic hooks, timers and API responses.
// No DOM or network is involved: races can be held at exact request boundaries.
async function editor(options = {}) {
  let slots = [], cursor = 0, effects = [], dirty = false, value;
  let now = 0, nextTimer = 1;
  const timers = new Map(), listeners = new Map(), storage = new Map();
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createContext: () => ({ Provider: 'provider' }), useContext: () => value,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { const resolved = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(resolved, slots[i])) { slots[i] = resolved; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const webStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, v) => storage.set(key, v), removeItem: key => storage.delete(key), key: i => [...storage.keys()][i], get length() { return storage.size; } };
  const api = { snapshot: null, calls: [], draft: async () => ({ revision: 1 }), publish: async data => ({ revision: 2, pageData: data, account: { kind: 'nonprofit', pageStatus: 'published' } }) };
  const jsx = (type, props) => { if (type === 'provider') value = props.value; return { type, props }; };
  const sandbox = { console, URLSearchParams, crypto, performance, localStorage: webStorage, sessionStorage: webStorage,
    window: { location: { search: '', hostname: 'nonprofit.onwan.link' }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, at: now + ms }); return id; }, clearTimeout: id => timers.delete(id) },
    __api: api, __react: react, __jsx: { jsx, jsxs: jsx, Fragment: 'fragment' }, module: { exports: {} },
  };
  sandbox.globalThis = sandbox;
  const result = await build({ entryPoints: ['src/app/context/PageContext.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'test-boundaries', setup(b) {
    b.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, args => ({ path: args.path, namespace: 'mock' }));
    b.onResolve({ filter: /\/lib\/(api|session|mediaUpload|wallpaperTint|draftRecovery|site)$/ }, args => ({ path: args.path.split('/').pop(), namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
      path === 'react' ? 'module.exports=globalThis.__react' : path === 'react/jsx-runtime' ? 'module.exports=globalThis.__jsx' :
      path === 'api' ? `export class ApiError extends Error { constructor(message,status,code){super(message);this.status=status;this.code=code;} } globalThis.__api.ApiError=ApiError; export const fetchMyPage=async()=>globalThis.__api.snapshot; export const saveMyDraft=async(data,revision,id)=>{globalThis.__api.calls.push({draft:true,data,revision,id});return globalThis.__api.draft(data,revision,id);}; export const saveMyPage=async(data,revision,id)=>{globalThis.__api.calls.push({draft:false,data,revision,id});return globalThis.__api.publish(data,revision,id);};` :
      path === 'session' ? `export const DRAFT_STORAGE_KEY='bio_page_data',HISTORY_STORAGE_PREFIX='history:',SESSION_CLEARED_EVENT='clear';export const sessionOwner=()=> 'user:one',getSessionToken=()=> 'token',clearLocalAccountData=()=>{},clearSessionToken=()=>{};` :
      path === 'mediaUpload' ? 'export const moveInlineMedia=async data=>data;' : path === 'wallpaperTint' ? 'export const withWallpaperTint=async data=>data;' :
      path === 'draftRecovery' ? 'export const readRecovery=async()=>null,writeRecovery=async()=>{};' : 'export const MAX_LINKS=30;', loader: 'js' }));
  } }] });
  vm.runInNewContext(result.outputFiles[0].text, sandbox);
  const provider = sandbox.module.exports;
  if (options.local) storage.set('bio_page_data', JSON.stringify({ owner: 'user:one', savedAt: Date.now(), ...options.local, data: provider.mergeWithDefaults(options.local.data) }));
  // First render supplies the provider defaults for the server response.
  cursor = 0; provider.PageProvider({ children: null });
  api.snapshot = { pageData: options.serverData ? provider.mergeWithDefaults(options.serverData) : value.pageData, revision: options.revision ?? 0, draft: options.serverDraft ? { pageData: provider.mergeWithDefaults(options.serverDraft) } : null, account: { kind: 'nonprofit', pageStatus: 'published' } };
  async function flush() {
    for (let i = 0; i < 40; i++) {
      if (dirty) { dirty = false; cursor = 0; provider.PageProvider({ children: null }); }
      const pending = effects.splice(0); for (const effect of pending) effect();
      await Promise.resolve();
    }
    assert.equal(dirty, false, 'provider settled');
  }
  await flush();
  return { api, get value() { return value; }, flush,
    async advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } await flush(); },
    rejectConflict() { const error = new Error('conflict'); error.status = 409; error.code = 'page_conflict'; return error; },
  };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('an old autosave acknowledgement cannot mark newer input saved', async () => {
  const e = await editor(), pending = deferred(); e.api.draft = () => pending.promise;
  e.value.updatePageData({ bio: 'first' }); await e.flush(); await e.advance(2500);
  assert.equal(e.api.calls.length, 1);
  e.value.updatePageData({ bio: 'second' }); await e.flush();
  pending.resolve({ revision: 1 }); await e.flush();
  assert.equal(e.value.pageData.bio, 'second'); assert.notEqual(e.value.draftState, 'saved');
});
test('edits made during publication stay dirty and are not replaced by its response', async () => {
  const e = await editor(), pending = deferred(); e.api.publish = () => pending.promise;
  e.value.updatePageData({ bio: 'publish me' }); await e.flush();
  const saving = e.value.save(); await e.flush();
  const sent = e.api.calls[0].data;
  e.value.updatePageData({ bio: 'newer draft' }); await e.flush();
  pending.resolve({ revision: 2, pageData: sent, account: { kind: 'nonprofit', pageStatus: 'published' } }); await saving; await e.flush();
  assert.equal(e.value.pageData.bio, 'newer draft'); assert.equal(e.value.isDirty, true);
});
test('unfinished content is autosaved but cannot accidentally be published', async () => {
  const e = await editor();
  e.value.updatePageData({ editorForm: { form: { title: 'unfinished link', url: '' }, screen: { name: 'form' } } }); await e.flush(); await e.advance(2500);
  assert.equal(e.api.calls[0].data.editorForm.form.title, 'unfinished link');
  await assert.rejects(e.value.save(), /أكمل العنصر/);
  assert.equal(e.api.calls.filter(call => !call.draft).length, 0);
});
test('retry after a lost publication response reuses its operation instead of publishing twice', async () => {
  const e = await editor(); let attempts = 0;
  e.api.publish = async data => { if (++attempts === 1) throw Error('response lost'); return { revision: 2, pageData: data, account: { kind: 'nonprofit', pageStatus: 'published' } }; };
  e.value.updatePageData({ bio: 'keep me' }); await e.flush();
  await assert.rejects(e.value.save(), /response lost/); await e.flush();
  await e.value.save(); await e.flush();
  assert.equal(e.api.calls.length, 2); assert.equal(e.api.calls[0].id, e.api.calls[1].id); assert.equal(e.value.isDirty, false);
});

test('a server conflict blocks further writes and retains local changes', async () => {
  const e = await editor(); e.api.draft = async () => { throw new e.api.ApiError('conflict', 409, 'page_conflict'); };
  e.value.updatePageData({ bio: 'local survives' }); await e.flush(); await e.advance(2500);
  assert.equal(e.value.conflict, true); const count = e.api.calls.length;
  e.value.updatePageData({ bio: 'even newer' }); await e.flush(); await e.advance(2500);
  assert.equal(e.api.calls.length, count); assert.equal(e.value.pageData.bio, 'even newer');
});
test('recovery preserves a local branch instead of silently preferring the server draft', async () => {
  const e = await editor({ local: { revision: 1, data: { bio: 'local branch' } }, serverData: { bio: 'published' }, serverDraft: { bio: 'other device' }, revision: 2 });
  assert.equal(e.value.pageData.bio, 'local branch'); assert.equal(e.value.conflict, true);
  await e.advance(2500); assert.equal(e.api.calls.length, 0);
});

test('returning to the published content clears its obsolete server draft', async () => {
  const e = await editor(); const original = e.value.pageData.bio;
  e.value.updatePageData({ bio: 'draft to undo' }); await e.flush(); await e.advance(2500);
  e.value.updatePageData({ bio: original }); await e.flush();
  assert.equal(e.value.isDirty, false);
  assert.equal(e.api.calls.at(-1).draft, true); assert.equal(e.api.calls.at(-1).data, null);
});

test('a local revert at the current revision is not replaced by an obsolete server draft', async () => {
  const e = await editor({ local: { revision: 1, data: { bio: '' } }, serverData: { bio: '' }, serverDraft: { bio: 'reverted draft' }, revision: 1 });
  assert.equal(e.value.pageData.bio, ''); assert.equal(e.value.conflict, false); assert.equal(e.value.isDirty, false);
  assert.equal(e.api.calls.at(-1).data, null);
});
test('an unchanged older local copy does not hide a newer server draft', async () => {
  const e = await editor({ local: { revision: 0, data: { bio: '' } }, serverData: { bio: '' }, serverDraft: { bio: 'new remote work' }, revision: 1 });
  assert.equal(e.value.pageData.bio, 'new remote work'); assert.equal(e.value.conflict, false);
});

test('explicit draft save waits for acknowledgement and never publishes', async () => {
  const e = await editor(), pending = deferred(); e.api.draft = () => pending.promise;
  e.value.updatePageData({ bio: 'draft only' }); await e.flush();
  let confirmed = false; const request = e.value.saveDraft().then(() => { confirmed = true; }); await e.flush();
  assert.equal(confirmed, false); assert.equal(e.value.saving, true);
  assert.equal(e.api.calls.length, 1); assert.equal(e.api.calls[0].draft, true);
  pending.resolve({ revision: 1 }); await request; await e.flush();
  assert.equal(confirmed, true); assert.equal(e.value.draftState, 'saved'); assert.equal(e.value.isDirty, true);
});
test('failed explicit draft save retains edits and rejects instead of confirming', async () => {
  const e = await editor(); e.api.draft = async () => { throw Error('offline'); };
  e.value.updatePageData({ bio: 'keep this' }); await e.flush();
  await assert.rejects(e.value.saveDraft(), /offline/); await e.flush();
  assert.equal(e.value.pageData.bio, 'keep this'); assert.equal(e.value.draftState, 'error'); assert.equal(e.value.saving, false);
  assert.equal(e.api.calls.filter(call => !call.draft).length, 0);
});

test('plain bio edits and theme changes preserve selected-text formatting', async () => {
  const e = await editor();
  e.value.updatePageData({ bio: 'hello', typography: { bioFormat: [{ start: 0, end: 5, bold: true }] } }); await e.flush();
  e.value.updatePageData({ bio: 'Xhello' }); await e.flush();
  assert.equal(e.value.pageData.typography.bioFormat[0].end, 6);
  e.value.resetDesign(); await e.flush();
  assert.equal(e.value.pageData.typography.bioFormat[0].bold, true);
});

test('applying a template cannot import sample content over onboarding choices', async () => {
  const e = await editor();
  e.value.updatePageData({ name: 'my association', links: [{ id: 'chosen', title: 'واتساب', platform: 'whatsapp', url: '', hidden: true }] }); await e.flush();
  const design = { ...e.value.pageData, name: 'sample name', links: [{ id: 'sample', title: 'unselected Instagram', platform: 'instagram', url: 'https://example.org' }] };
  e.value.applyDesign(design); await e.flush();
  assert.equal(e.value.pageData.name, 'my association');
  assert.equal(e.value.pageData.links.length, 1); assert.equal(e.value.pageData.links[0].id, 'chosen');
});

test('applying a composition changes presentation while preserving content and contacts', async () => {
  const e = await editor();
  const before = e.value.pageData;
  const composition = { align: 'start', width: 'narrow', surface: 'sheet', pattern: 'grid', items: 'tiles', inset: 'airy' };
  e.value.applyDesign({ theme: before.theme, wallpaper: before.wallpaper, profileStyle: before.profileStyle, typography: before.typography, buttonStyle: { ...before.buttonStyle, composition } });
  await e.flush();
  assert.equal(e.value.pageData.name, before.name);
  assert.deepEqual(e.value.pageData.links, before.links);
  assert.equal(e.value.pageData.contactPhone, before.contactPhone);
  assert.deepEqual(e.value.pageData.buttonStyle.composition, composition);
  await e.advance(2500);
  assert.deepEqual(e.api.calls.at(-1).data.buttonStyle.composition, composition);
});
