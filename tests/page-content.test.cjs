const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadSections() {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('shared/linkSections.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

function loadVideos() {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('shared/videoSources.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

function loadShared(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

const image = '/media/files/owner/' + 'a'.repeat(64) + '.png';
function api() {
  const db = { links: [], reviews: [] };
  const page = { id: 'page', username: 'example', status: 'published' };
  const query = async (sql, values = []) => {
    const text = sql.replace(/\s+/g, ' ').trim();
    if (text.startsWith('update pages')) { page.profile_image_url = values[3]; page.wallpaper_json = JSON.parse(values[5]); return { rows: [{ id: page.id }] }; }
    if (text.startsWith('delete from page_links')) { db.links = []; return { rows: [] }; }
    if (text.startsWith('insert into page_links')) {
      // One batched insert: the rows arrive as a JSON array (jsonb_to_recordset).
      for (const row of JSON.parse(values[1])) db.links.push({ ...row, id: row.id || `row-${db.links.length}-${Math.random().toString(36).slice(2)}`, page_id: values[0] });
      return { rows: [] };
    }
    if (text.startsWith('select id, profile_image_url, wallpaper_json from pages')) return { rows: [{ id: page.id, profile_image_url: page.profile_image_url ?? '', wallpaper_json: page.wallpaper_json ?? null }] };
    if (text.startsWith('insert into content_reviews')) { db.reviews.push(JSON.parse(values[1])); return { rows: [] }; }
    if (text.startsWith('select id from page_links')) return { rows: [] };
    if (text.includes('from page_links')) return { rows: db.links.filter(row => !text.includes('is_hidden = false') || !row.is_hidden) };
    if (text.includes('from pages p') || text.includes('from usernames u')) return { rows: [page] };
    if (['begin', 'commit', 'rollback'].includes(text) || text.startsWith('insert into pages')) return { rows: [] };
    throw new Error(`Unexpected SQL: ${text}`);
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const module = { exports: {} };
  const source = fs.readFileSync('api/_lib/page.ts', 'utf8') + '\nexport { normalizeLinks as testNormalize };';
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    name = name.replace(/\.js$/, '');
    if (name === '../../shared/videoSources') return loadVideos();
    if (name === '../../shared/linkSections') return loadSections();
    if (name === '../../shared/pageTransfer') return loadShared('shared/pageTransfer.ts');
    if (name === '../../shared/fileSignatures') return loadShared('shared/fileSignatures.ts');
    if (name === './stream') return { streamUidFromUrl: () => null, verifyStreamVideo: async () => null };
    if (name === './runtime') return { getBinding: name => (name === 'MEDIA' && db.media ? db.media : undefined) };
    if (name === './db') return { pool };
    if (name === './http') return { HttpError: class extends Error { constructor(status, message) { super(message); this.status = status; } } };
    throw new Error(name);
  }, module, module.exports);
  return { ...module.exports, db };
}

test('existing buttons remain regular links', () => {
  const [link] = api().testNormalize([{ title: 'الموقع', url: 'example.com' }]);
  assert.equal(link.url, 'https://example.com');
  assert.deepEqual(link.display, {});
});
test('section headings require a title but no destination and discard unrelated content', () => {
  const normalize = api().testNormalize;
  const [heading] = normalize([{ title: 'خدماتنا', display: { kind: 'heading' }, url: 'javascript:alert(1)' }]);
  assert.equal(heading.url, '');
  assert.deepEqual(heading.display, { kind: 'heading' });
  assert.throws(() => normalize([{ title: ' ', display: { kind: 'heading' } }]), { status: 400 });
});
test('cards require a safe, bounded image and retain fit and focal position', () => {
  const normalize = api().testNormalize;
  const card = { title: 'حملتنا', url: 'https://example.com', display: { layout: 'card', image, imageFit: 'contain', positionX: -5, positionY: 130 } };
  const [link] = normalize([card]);
  assert.equal(link.display.imageFit, 'contain');
  assert.equal(link.display.positionX, 0);
  assert.equal(link.display.positionY, 100);
  for (const badImage of ['', 'javascript:alert(1)', 'data:text/html;base64,AAAA', 'data:image/png;base64,' + 'A'.repeat(2_000_000)]) {
    assert.throws(() => normalize([{ ...card, display: { layout: 'card', image: badImage } }]), { status: 400 });
  }
  assert.throws(() => normalize([{ ...card, url: 'javascript:alert(1)' }]), { status: 400 });
});
test('save/load preserves mixed content, ordering, translations and hidden state; review omits image bodies', async () => {
  const service = api();
  const content = [
    { title: 'خدماتنا', titleEn: 'Services', url: '', display: { kind: 'heading' } },
    { title: 'حملتنا', url: 'https://example.com/campaign', display: { layout: 'card', image, imageFit: 'contain', positionX: 25, positionY: 60 } },
    { title: 'التقرير', url: 'https://example.com/report', hidden: true },
  ];
  const saved = await service.savePageData('owner', { links: content });
  assert.deepEqual(saved.links.map(link => link.title), ['خدماتنا', 'حملتنا', 'التقرير']);
  assert.equal(saved.links[0].titleEn, 'Services');
  assert.equal(saved.links[0].url, '');
  assert.deepEqual(saved.links[1].display, content[1].display);
  assert.equal(saved.links[2].hidden, true);
  assert.ok(!JSON.stringify(service.db.reviews).includes('iVBOR'));
  const publicPage = await service.getPublicPageByUsername('example');
  assert.equal(publicPage.pageData.links.length, 2);
  assert.equal(publicPage.pageData.links[0].display.kind, 'heading');
  const resaved = await service.savePageData('owner', { links: saved.links });
  assert.deepEqual(resaved.links.map(link => link.display), saved.links.map(link => link.display));
});

test('section membership survives new row ids, hiding sections removes children from public data', async () => {
  const service = api();
  const content = [
    { id: 'a', title: 'أول', url: 'https://example.com/1', display: { sectionId: 'stable-section' } },
    { id: 'h', title: 'خدماتنا', url: '', display: { kind: 'heading', sectionId: 'stable-section' }, hidden: true },
    { id: 'b', title: 'ثاني', url: 'https://example.com/2', display: { sectionId: 'stable-section', layout: 'card', image } },
    { id: 'c', title: 'عام', url: 'https://example.com' },
  ];
  const saved = await service.savePageData('owner', { links: content });
  assert.deepEqual(saved.links.map(link => link.title), ['خدماتنا', 'أول', 'ثاني', 'عام']);
  assert.notEqual(saved.links[0].id, 'h');
  const again = await service.savePageData('owner', { links: saved.links });
  assert.equal(again.links[1].display.sectionId, 'stable-section');
  const publicPage = await service.getPublicPageByUsername('example');
  assert.deepEqual(publicPage.pageData.links.map(link => link.title), ['عام']);
});
test('moving sections keeps members together; member movement stays within its section', () => {
  const { moveSectionItem, arrangeSections, reorderSectionItem } = loadSections();
  const items = [{ id: 'h', display: { kind: 'heading', sectionId: 's' } }, { id: 'a', display: { sectionId: 's' } }, { id: 'b', display: { sectionId: 's' } }, { id: 'x' }];
  assert.deepEqual(moveSectionItem(items, 'h', 'down').map(item => item.id), ['x', 'h', 'a', 'b']);
  assert.deepEqual(moveSectionItem(items, 'a', 'down').map(item => item.id), ['h', 'b', 'a', 'x']);
  assert.equal(moveSectionItem(items, 'a', 'up'), items);
  const dropped = reorderSectionItem(items, 'x', 'h');
  assert.equal(dropped.find(item => item.id === 'x').display.sectionId, 's');
  const orphaned = arrangeSections(items.filter(item => item.id !== 'h'));
  assert.deepEqual(orphaned.map(item => item.id), ['a', 'b', 'x']);
  assert.equal(orphaned[0].display.sectionId, undefined);
});
test('editing group membership is atomic and does not delete unselected links', () => {
  const { saveSectionItem } = loadSections();
  const heading = { id: 'h', display: { kind: 'heading', sectionId: 's' } };
  const items = [heading, { id: 'a', display: { sectionId: 's' } }, { id: 'b' }];
  const updated = saveSectionItem(items, heading, ['b']);
  assert.equal(updated.length, 3);
  assert.deepEqual(updated.map(item => item.id), ['h', 'b', 'a']);
  assert.equal(updated.find(item => item.id === 'a').display.sectionId, undefined);
});

test('video sources normalize supported providers and reject HTML, deceptive hosts and unsafe schemes', () => {
  const { parseVideoSource: parse } = loadVideos();
  for (const url of ['https://youtu.be/M7lc1UVf-VE', 'https://www.youtube.com/watch?v=M7lc1UVf-VE', 'https://www.youtube.com/shorts/M7lc1UVf-VE', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE']) {
    const source = parse(url);
    assert.equal(source.kind, 'youtube');
    assert.ok(source.src.startsWith('https://www.youtube-nocookie.com/embed/'));
    assert.equal(parse(url, true), null);
  }
  assert.equal(parse('https://vimeo.com/123456789/abc123').src, 'https://player.vimeo.com/video/123456789?h=abc123');
  assert.equal(parse('https://player.vimeo.com/video/123456789?h=abc123').kind, 'vimeo');
  assert.equal(parse('https://cdn.example.com/movie.mp4?signature=abc', true).src, 'https://cdn.example.com/movie.mp4?signature=abc');
  assert.equal(parse('https://cdn.example.com/movie.webm', true).kind, 'file');
  for (const url of ['javascript:alert(1)', 'data:video/mp4;base64,AAAA', '<iframe src="https://example.com"></iframe>', 'http://example.com/video.mp4', 'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE', 'https://user:password@example.com/movie.mp4', 'https://example.com/not-a-video']) assert.equal(parse(url), null);
});
test('embedded video and background video persist with sections and poster data', async () => {
  const service = api();
  const wallpaper = { type: 'video', value: 'https://example.com/bg.webm', poster: image, dim: 30, position: 'top' };
  const saved = await service.savePageData('owner', { wallpaper, links: [
    { id: 'section', title: 'تعرف علينا', url: '', display: { kind: 'heading', sectionId: 'videos' } },
    { title: 'الفيديو التعريفي', url: 'https://youtu.be/M7lc1UVf-VE', display: { kind: 'video', sectionId: 'videos' } },
  ] });
  assert.equal(saved.links[1].display.kind, 'video');
  assert.equal(saved.links[1].display.sectionId, 'videos');
  assert.deepEqual(saved.wallpaper, wallpaper);
  assert.ok(!JSON.stringify(service.db.reviews).includes('iVBOR'));
  const resaved = await service.savePageData('owner', saved);
  assert.deepEqual(resaved.wallpaper, wallpaper);
});
test('API rejects unsupported background and content video sources before writing', async () => {
  const service = api();
  await assert.rejects(() => service.savePageData('owner', { wallpaper: { type: 'video', value: 'https://youtu.be/M7lc1UVf-VE' } }), { status: 400 });
  await assert.rejects(() => service.savePageData('owner', { links: [{ title: 'فيديو', url: 'https://example.com/page', display: { kind: 'video' } }] }), { status: 400 });
  assert.equal(service.db.reviews.length, 0);
});

test('section layouts and bilingual plain-text paragraphs survive save/load and preserve line breaks', async () => {
  for (const sectionLayout of ['list', 'grid', 'carousel']) {
    const service = api();
    const saved = await service.savePageData('owner', { links: [
      { title: 'خدماتنا', url: '', display: { kind: 'heading', sectionId: 's', sectionLayout } },
      { title: 'نبذة', url: '', display: { kind: 'text', sectionId: 's', body: 'السطر الأول\nالسطر الثاني', bodyEn: 'First line\nSecond line' } },
      { title: 'طلب خدمة', url: 'https://example.com', display: { sectionId: 's' } },
    ] });
    assert.equal(saved.links[0].display.sectionLayout, sectionLayout);
    assert.equal(saved.links[1].url, '');
    assert.equal(saved.links[1].display.body, 'السطر الأول\nالسطر الثاني');
    assert.equal(saved.links[1].display.bodyEn, 'First line\nSecond line');
    const again = await service.savePageData('owner', saved);
    assert.deepEqual(again.links.map(link => link.display), saved.links.map(link => link.display));
  }
});
test('paragraph validation rejects empty/oversized content; old sections default to list', () => {
  const normalize = api().testNormalize;
  for (const display of [{ kind: 'text', body: '' }, { kind: 'text', body: 'x'.repeat(2001) }, { kind: 'text', body: 'valid', bodyEn: 'x'.repeat(2001) }]) assert.throws(() => normalize([{ title: 'نص', url: '', display }]), { status: 400 });
  const [heading] = normalize([{ title: 'قسم', url: '', display: { kind: 'heading', sectionId: 's', sectionLayout: 'unknown' } }]);
  assert.equal(heading.display.sectionLayout, 'list');
  const [text] = normalize([{ title: 'نص', display: { kind: 'text', body: '<script>alert(1)</script>\nنص عادي' } }]);
  assert.equal(text.display.body, '<script>alert(1)</script>\nنص عادي');
});

test('content videos accept only YouTube; 20 MB background file boundary is enforced', () => {
  const { parseYouTubeVideoSource, backgroundVideoFileError, MAX_BACKGROUND_VIDEO_BYTES } = loadVideos();
  assert.ok(parseYouTubeVideoSource('https://youtu.be/M7lc1UVf-VE'));
  for (const url of ['https://vimeo.com/123456789', 'https://example.com/movie.mp4', 'https://www.youtube.com/@channel']) assert.equal(parseYouTubeVideoSource(url), null);
  assert.equal(backgroundVideoFileError({ type: 'video/mp4', size: MAX_BACKGROUND_VIDEO_BYTES }), '');
  assert.ok(backgroundVideoFileError({ type: 'video/mp4', size: MAX_BACKGROUND_VIDEO_BYTES + 1 }));
  assert.ok(backgroundVideoFileError({ type: 'video/quicktime', size: 100 }));
  assert.ok(backgroundVideoFileError({ type: 'video/webm', size: 0 }));
  const normalize = api().testNormalize;
  for (const url of ['https://vimeo.com/123456789', 'https://example.com/movie.mp4']) assert.throws(() => normalize([{ title: 'فيديو', url, display: { kind: 'video' } }]), { status: 400 });
});
test('save verifies uploaded video ownership, content type and size in R2, once per file', async () => {
  const service = api();
  const objects = { 'wallpapers/owner/12345678-1234-1234-1234-123456789abc.mp4': { size: 20 * 1024 * 1024, httpMetadata: { contentType: 'video/mp4' } } };
  let heads = 0;
  service.db.media = { head: async key => { heads++; return objects[key] ?? null; } };
  const valid = { type: 'video', uploaded: true, value: '/media/wallpapers/owner/12345678-1234-1234-1234-123456789abc.mp4' };
  const saved = await service.savePageData('owner', { wallpaper: valid });
  assert.equal(saved.wallpaper.fileSize, 20 * 1024 * 1024);
  // The same stored file is not asked about again (names are never reused).
  assert.equal((await service.savePageData('owner', { wallpaper: valid })).wallpaper.fileSize, 20 * 1024 * 1024);
  assert.equal(heads, 1);
  const other = { ...valid, value: valid.value.replace('123456789abc', '123456789abd') };
  await assert.rejects(() => service.savePageData('owner', { wallpaper: other }), { status: 400 });
  objects['wallpapers/owner/12345678-1234-1234-1234-123456789abd.mp4'] = { size: 20 * 1024 * 1024 + 1, httpMetadata: { contentType: 'video/mp4' } };
  await assert.rejects(() => service.savePageData('owner', { wallpaper: other }), { status: 400 });
  objects['wallpapers/owner/12345678-1234-1234-1234-123456789abd.mp4'] = { size: 100, httpMetadata: { contentType: 'text/html' } };
  await assert.rejects(() => service.savePageData('owner', { wallpaper: other }), { status: 400 });
  // Another account cannot claim this owner's stored video (its own page has none).
  const stranger = api();
  stranger.db.media = service.db.media;
  await assert.rejects(() => stranger.savePageData('another-owner', { wallpaper: valid }), { status: 403 });
});

test('upload endpoint authenticates, stores in the owner folder of R2 and enforces type and the 20 MB limit', async () => {
  let signedIn = true;
  let media;
  const stored = {};
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('api/video-upload.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const http = {
    HttpError: class extends Error { constructor(status, message) { super(message); this.status = status; } },
    allowMethods: () => true,
    sendJson: (res, status, body) => { res.status = status; res.body = body; res.headersSent = true; },
    handleApiError: (res, error) => { res.status = error.status || 500; res.body = { error: error.message }; },
  };
  new Function('require', 'module', 'exports', code)(name => {
    name = name.replace(/\.js$/, '');
    if (name === '../shared/videoSources') return loadVideos();
    if (name === '../shared/fileSignatures') return loadShared('shared/fileSignatures.ts');
    if (name === './_lib/mediaUploadLimits') return { beginMediaUpload: async () => 'event', storeLimitedUpload: async (media, owner, key, body, type) => media.put(key, body, { httpMetadata: { contentType: type } }) };
    if (name === './_lib/runtime') return { getBinding: () => media };
    if (name === './_lib/http') return http;
    if (name === './_lib/session') return { requireUser: async (req, res) => { if (signedIn) return { id: 'owner' }; http.sendJson(res, 401, {}); return null; } };
    if (name === './_lib/auth') return { getBearerToken: () => null, verifySessionToken: () => null };
    if (name === './_lib/db') return { pool: { query: async () => ({ rows: [] }) } };
    throw new Error(name);
  }, module, module.exports);
  const handler = module.exports.default;
  const send = async (type, size) => {
    const res = {};
    // Real file starts (REQ-017): MP4 has «ftyp» at byte 4, WebM starts 1A 45 DF A3.
    const body = new Uint8Array(size);
    if (type === 'video/mp4' && size >= 8) body.set([0x66, 0x74, 0x79, 0x70], 4);
    if (type === 'video/webm' && size >= 4) body.set([0x1a, 0x45, 0xdf, 0xa3]);
    await handler({ method: 'POST', headers: { 'content-type': type, 'content-length': String(size) }, arrayBuffer: async () => body.buffer }, res);
    return res;
  };
  assert.equal((await send('video/mp4', 10)).status, 503);
  media = { put: async (key, body, options) => { stored[key] = { size: body.byteLength, type: options.httpMetadata.contentType }; } };
  const ok = await send('video/mp4', 1000);
  assert.equal(ok.status, 200);
  assert.match(ok.body.url, /^\/media\/wallpapers\/owner\/[a-f0-9-]{36}\.mp4$/);
  assert.deepEqual(stored[ok.body.url.slice('/media/'.length)], { size: 1000, type: 'video/mp4' });
  assert.ok(loadVideos().parseVideoSource(ok.body.url, true));
  assert.equal((await send('video/quicktime', 10)).status, 400);
  assert.equal((await send('video/webm', 20 * 1024 * 1024 + 1)).status, 413);
  assert.equal((await send('video/webm', 0)).status, 400);
  signedIn = false;
  assert.equal((await send('video/mp4', 10)).status, 401);
});

test('stored file URLs and link ids survive repeated saves; missing KEPT references fail', async () => {
  const service = api();
  const { KEPT, slimPageData, expandPageData } = loadShared('shared/pageTransfer.ts');
  const id = '11111111-2222-4333-8444-555555555555';
  const first = { profileImage: image, links: [{ id, title: 'الملف', url: ('/media/files/owner/' + 'b'.repeat(64) + '.pdf'), linkType: 'file' }] };
  const saved = await service.savePageData('owner', first);
  assert.equal(saved.links[0].id, id);
  const slim = slimPageData({ ...saved, name: 'جديد' }, saved);
  assert.equal(slim.profileImage, image);
  assert.equal(slim.links[0].url, first.links[0].url);
  const again = await service.savePageData('owner', slim, { slimResponse: true });
  assert.equal(again.profileImage, image);
  assert.equal(again.links[0].id, id);
  assert.equal(service.db.links[0].url, ('/media/files/owner/' + 'b'.repeat(64) + '.pdf'));
  assert.equal(expandPageData(again, saved).profileImage, image);
  await assert.rejects(() => service.savePageData('owner', { links: [{ id: '99999999-2222-4333-8444-555555555555', title: 'x', url: KEPT, linkType: 'file' }] }), { status: 409 });
});

test('note 53: stored media links are accepted for logo, files, icons and cards; other paths are not', async () => {
  const normalize = api().testNormalize;
  const hash = 'a'.repeat(64);
  const [file] = normalize([{ title: 'الملف', url: `/media/files/owner/${hash}.pdf`, linkType: 'file' }]);
  assert.equal(file.fileMimeType, 'application/pdf');
  const [icon] = normalize([{ title: 'موقع', url: 'https://example.com', customIcon: `/media/files/owner/${hash}.png` }]);
  assert.equal(icon.customIcon, `/media/files/owner/${hash}.png`);
  const [card] = normalize([{ title: 'بطاقة', url: 'https://example.com', display: { layout: 'card', image: `/media/files/owner/${hash}.webp` } }]);
  assert.equal(card.display.image, `/media/files/owner/${hash}.webp`);
  for (const bad of ['/media/files/owner/short.png', `/media/files/../${hash}.png`, `/media/files/owner/${hash}.html`]) {
    assert.throws(() => normalize([{ title: 'ملف', url: bad, linkType: 'file' }]), { status: 400 });
  }
  const saved = await api().savePageData('owner', { profileImage: `/media/files/owner/${hash}.jpg`, links: [] });
  assert.equal(saved.profileImage, `/media/files/owner/${hash}.jpg`);
});


test('inline files are rejected before page or partner draft writes, including nested fields', async () => {
  for (const data of [
    { profileImage: 'data:image/png;base64,AAAA' },
    { wallpaper: { type: 'image', value: 'data:image/png;base64,AAAA' } },
    { links: [{ title: 'PDF', linkType: 'file', url: 'data:application/pdf;base64,AAAA' }] },
    { links: [{ title: 'x', url: 'https://example.com', customIcon: 'data:image/png;base64,AAAA' }] },
    { extra: { nested: ['data:image/png;base64,AAAA'] } },
  ]) {
    const service = api();
    await assert.rejects(() => service.savePageData('owner', data), { status: 400 });
    assert.throws(() => service.validatePartnerPageDraft(data, 'partner'), { status: 400 });
    assert.deepEqual(service.db.links, []);
    assert.deepEqual(service.db.reviews, []);
  }
});

test('media preparation fails closed on upload errors and only returns stored links', async () => {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/app/lib/mediaUpload.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let fail = true;
  const stored = '/media/files/owner/' + 'c'.repeat(64) + '.png';
  const fetchMock = async url => String(url).startsWith('data:')
    ? { blob: async () => new Blob(['image'], { type: 'image/png' }) }
    : { ok: !fail, json: async () => fail ? { error: 'upload failed' } : { url: stored } };
  new Function('require', 'module', 'exports', 'fetch', code)(() => ({ getSessionToken: () => 'token' }), module, module.exports, fetchMock);
  const inline = 'data:image/png;base64,AAAA';
  const page = { profileImage: inline, wallpaper: { type: 'color', value: '#fff' }, links: [] };
  await assert.rejects(() => module.exports.moveInlineMedia(page), /upload failed/);
  assert.equal(page.profileImage, inline);
  await assert.rejects(() => module.exports.moveInlineMedia(page, null), /سجّل الدخول/);
  fail = false;
  assert.equal((await module.exports.moveInlineMedia(page)).profileImage, stored);
});

test('media cleanup: used files stay; unused saved files go after 30 days, abandoned after 24 hours', async () => {
  const orphans = new Map();
  const log = [];
  const state = { referenced: ['files/u/a.png'], saved: ['files/u/a.png', 'files/u/old.png'] };
  const query = async (sql, values = []) => {
    const text = sql.replace(/\s+/g, ' ');
    if (['begin', 'commit', 'rollback'].includes(text) || text.startsWith('select pg_advisory') || text.startsWith('insert into media_deleted_keys') || text.startsWith('delete from media_upload_events') || text.startsWith('select key from media_deleted_keys') || text.startsWith('update media_deleted_keys')) return { rows: [] };
    if (text.includes('from content_reviews')) return { rows: state.saved.map((key) => ({ key })) };
    if (text.includes('from pages')) return { rows: state.referenced.map((key) => ({ key })) };
    if (text.startsWith('delete from media_orphans where not')) { for (const k of [...orphans.keys()]) if (!values[0].includes(k)) orphans.delete(k); return { rows: [] }; }
    if (text.startsWith('insert into media_orphans')) { for (const k of values[0]) if (!orphans.has(k)) orphans.set(k, values[1]); return { rows: [] }; }
    if (text.startsWith('select key, first_seen from media_orphans')) return { rows: [...orphans].map(([key, first_seen]) => ({ key, first_seen })) };
    if (text.startsWith('insert into media_cleanup_log')) { log.push(...values[0]); return { rows: [] }; }
    if (text.startsWith('delete from media_orphans where key = any')) { for (const k of values[0]) orphans.delete(k); return { rows: [] }; }
    throw new Error(`Unexpected SQL: ${text}`);
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('api/_lib/mediaCleanup.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)((name) => { if (name.replace(/\.js$/, '') === './db') return { pool: { query, connect: async () => ({ query, release() {} }) } }; if (name.replace(/\.js$/, '') === './mediaReferences') return loadShared('api/_lib/mediaReferences.ts'); throw new Error(name); }, module, module.exports);
  const files = new Set(['files/u/a.png', 'files/u/old.png', 'wallpapers/u/unsaved.mp4']);
  const store = {
    list: async ({ prefix }) => ({ objects: [...files].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
    delete: async (keys) => keys.forEach((k) => files.delete(k)),
  };
  const day = (n) => new Date(Date.UTC(2026, 9, 1 + n));
  await module.exports.runMediaCleanup(store, day(0));
  await module.exports.runMediaCleanup(store, new Date(day(0).getTime() + 23 * 3600000));
  assert.equal(files.size, 3, 'nothing goes before 24 hours');
  await module.exports.runMediaCleanup(store, day(1));
  assert.ok(!files.has('wallpapers/u/unsaved.mp4'), 'never-saved file goes after 24 hours');
  assert.ok(files.has('files/u/old.png'), 'a saved design file stays for 30 days');
  await module.exports.runMediaCleanup(store, day(29));
  assert.ok(files.has('files/u/old.png'));
  await module.exports.runMediaCleanup(store, day(30));
  assert.ok(!files.has('files/u/old.png'), 'saved file goes after 30 days');
  assert.ok(files.has('files/u/a.png'), 'a file in use is never deleted');
  assert.deepEqual(log.sort(), ['files/u/old.png', 'wallpapers/u/unsaved.mp4']);
});


test('REQ-004: accepts 30 page elements and rejects the 31st', async () => {
  const service = api();
  const links = Array.from({ length: 30 }, (_, i) => ({ title: `Link ${i}`, url: 'https://example.com' }));
  assert.equal((await service.savePageData('owner', { links })).links.length, 30);
  await assert.rejects(() => service.savePageData('owner', { links: [...links, links[0]] }), { status: 400 });
});


test('REQ-002: oversized still images are compressed before upload; oversized GIFs fail', async () => {
  const module = { exports: {} };
  const source = fs.readFileSync('src/app/lib/mediaUpload.ts', 'utf8') + '\nexport { prepareImage };';
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let attempts = 0;
  const canvas = { getContext: () => ({ drawImage() {} }), toBlob: callback => callback(new Blob([new Uint8Array(++attempts === 1 ? 1_000_001 : 999_000)], { type: 'image/webp' })) };
  class ImageMock { width = 2400; height = 1600; async decode() {} }
  new Function('require', 'module', 'exports', 'document', 'Image', 'URL', code)(() => ({}), module, module.exports, { createElement: () => canvas }, ImageMock, { createObjectURL: () => 'blob:test', revokeObjectURL() {} });
  const result = await module.exports.prepareImage(new Blob([new Uint8Array(1_000_001)], { type: 'image/png' }));
  assert.ok(result.size <= 1_000_000);
  assert.equal(attempts, 2);
  await assert.rejects(() => module.exports.prepareImage(new Blob([new Uint8Array(1_000_001)], { type: 'image/gif' })), /GIF/);
});


test('REQ-006: one image per slot; structural elements reject media; only video keeps poster', async () => {
  const service = api();
  for (const kind of ['heading', 'text']) {
    for (const media of [{ customIcon: image }, { display: { kind, body: 'text', image } }]) {
      assert.throws(() => service.validatePartnerPageDraft({ links: [{ title: 'x', display: { kind, body: 'text' }, ...media }] }), { status: 400 });
    }
  }
  for (const profileImage of [[image], { image }]) {
    await assert.rejects(() => service.savePageData('owner', { profileImage }), { status: 400 });
  }
  const data = { profileImage: image, wallpaper: { type: 'image', value: image, poster: image, uploaded: true }, links: [{ title: 'x', url: 'https://example.com', customIcon: image, display: { layout: 'card', image } }] };
  const draft = service.validatePartnerPageDraft(data);
  assert.equal(draft.wallpaper.poster, undefined);
  assert.equal(draft.wallpaper.uploaded, undefined);
  const saved = await service.savePageData('owner', data);
  assert.equal(saved.wallpaper.poster, undefined);
  assert.equal(saved.links[0].customIcon, image);
  assert.equal(saved.links[0].display.image, image);
});

test('REQ-017: uploads and inline files are judged by their content, not their declared type', async () => {
  const { sniffFileType, contentMatchesType } = loadShared('shared/fileSignatures.ts');
  assert.equal(sniffFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffFileType(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
  assert.equal(contentMatchesType(new TextEncoder().encode('<html><script>'), 'image/png'), false);
  const normalize = api().testNormalize;
  const fakePdf = 'data:application/pdf;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
  assert.throws(() => normalize([{ title: 'ملف', url: fakePdf, linkType: 'file' }]), { status: 400 });
  const realPdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7 test').toString('base64');
  assert.equal(normalize([{ title: 'ملف', url: realPdf, linkType: 'file' }])[0].fileMimeType, 'application/pdf');
});

test('REQ-016: an account may store 200 MB in all; the next upload past it is refused', async () => {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('api/_lib/storageQuota.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name === './db.js') return { pool: { query: async () => ({ rows: [{ key: 'a' }, { key: 'v' }] }) } };
    if (name === './mediaReferences.js') return loadShared('api/_lib/mediaReferences.ts');
    return { HttpError: class extends Error { constructor(status, message) { super(message); this.status = status; } } };
  }, module, module.exports);
  const MB = 1024 * 1024;
  const media = { list: async ({ prefix }) => ({ objects: prefix.startsWith('files/') ? [{ key: 'a', size: 150 * MB }] : [{ key: 'v', size: 45 * MB }], truncated: false }) };
  await module.exports.assertStorageRoom(media, 'owner', 5 * MB);
  await assert.rejects(() => module.exports.assertStorageRoom(media, 'owner', 5 * MB + 1), { status: 413 });
});

test('REQ-023: Stream videos — owner-bound uploads, ready only with the MP4, foreign videos refused', async () => {
  const env = { CF_ACCOUNT_ID: 'acct', STREAM_API_TOKEN: 'test-only', STREAM_CUSTOMER_HOST: 'customer-abc.cloudflarestream.com' };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('api/_lib/stream.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)((name) => {
    if (name.includes('runtime')) return { getEnv: (key) => env[key] };
    if (name.includes('http')) return { HttpError: class extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } } };
    throw new Error(name);
  }, module, module.exports);
  const stream = module.exports;
  const uid = 'a'.repeat(32);
  const videos = { [uid]: { uid, readyToStream: true, size: 1234, meta: { owner: 'owner' } } };
  let mp4 = 'inprogress';
  const realFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    const path = String(url).split('/stream')[1];
    const reply = (result) => ({ ok: true, json: async () => ({ success: true, result }) });
    if (path === '/direct_upload') { assert.equal(JSON.parse(init.body).meta.owner, 'owner'); return reply({ uploadURL: 'https://upload.example/x', uid }); }
    if (path === `/${uid}/downloads`) return reply({ default: { status: mp4 } });
    if (path === `/${uid}`) return reply(videos[uid]);
    throw new Error(path);
  };
  try {
    assert.equal((await stream.createStreamUpload('owner')).uid, uid);
    assert.deepEqual(await stream.streamStatus(uid, 'owner'), { ready: false });
    mp4 = 'ready';
    const ready = await stream.streamStatus(uid, 'owner');
    assert.equal(ready.url, `https://customer-abc.cloudflarestream.com/${uid}/downloads/default.mp4`);
    await assert.rejects(() => stream.streamStatus(uid, 'someone-else'), { status: 403 });
    assert.equal(stream.streamUidFromUrl(ready.url), uid);
    assert.equal(stream.streamUidFromUrl(`https://customer-evil.cloudflarestream.com/${uid}/downloads/default.mp4`), null);
    await assert.rejects(() => stream.verifyStreamVideo(ready.url, 'someone-else'), { status: 403 });
    delete env.STREAM_API_TOKEN;
    await assert.rejects(() => stream.createStreamUpload('owner'), (error) => error.code === 'stream_off');
  } finally {
    global.fetch = realFetch;
  }
});

test('note (9): a custom font is only a stored font file and a plain name', async () => {
  const hash = 'b'.repeat(64);
  const service = api();
  await assert.rejects(() => service.savePageData('owner', { typography: { customFont: { url: 'https://evil.example/x.woff2', name: 'x' } } }), { status: 400 });
  await assert.rejects(() => service.savePageData('owner', { typography: { customFont: { url: `/media/files/owner/${hash}.png`, name: 'x' } } }), { status: 400 });
  await service.savePageData('owner', { typography: { customFont: { url: `/media/files/owner/${hash}.woff2`, name: 'خطي"; } body{display:none' } } });
  const { sniffFileType } = loadShared('shared/fileSignatures.ts');
  assert.equal(sniffFileType(new TextEncoder().encode('wOF2xxxx')), 'font/woff2');
  assert.equal(sniffFileType(new Uint8Array([0, 1, 0, 0, 0, 0])), 'font/ttf');
});
