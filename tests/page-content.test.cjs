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

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
function api() {
  const db = { links: [], reviews: [] };
  const page = { id: 'page', username: 'example', status: 'published' };
  const query = async (sql, values = []) => {
    const text = sql.replace(/\s+/g, ' ').trim();
    if (text.startsWith('update pages')) { page.wallpaper_json = JSON.parse(values[5]); return { rows: [{ id: page.id }] }; }
    if (text.startsWith('delete from page_links')) { db.links = []; return { rows: [] }; }
    if (text.startsWith('insert into page_links')) {
      const names = text.match(/page_links \((.*?)\)/)[1].split(',').map(value => value.trim());
      const row = Object.fromEntries(names.map((name, index) => [name, name === 'display_json' ? JSON.parse(values[index]) : values[index]]));
      db.links.push({ id: `row-${db.links.length}`, ...row });
      return { rows: [] };
    }
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
    if (name === '../../shared/videoSources') return loadVideos();
    if (name === '../../shared/linkSections') return loadSections();
    if (name === '@vercel/blob') return { head: async () => db.blobHead };
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
  const [heading] = normalize([{ title: 'خدماتنا', display: { kind: 'heading', image, layout: 'card' }, url: 'javascript:alert(1)' }]);
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
test('save verifies uploaded video ownership, content type and size using storage metadata', async () => {
  const service = api();
  const valid = { type: 'video', uploaded: true, value: 'https://store.public.blob.vercel-storage.com/wallpapers/owner/file.mp4' };
  service.db.blobHead = { size: 20 * 1024 * 1024, contentType: 'video/mp4' };
  const saved = await service.savePageData('owner', { wallpaper: valid });
  assert.equal(saved.wallpaper.fileSize, 20 * 1024 * 1024);
  service.db.blobHead.size++;
  await assert.rejects(() => service.savePageData('owner', { wallpaper: valid }), { status: 400 });
  service.db.blobHead = { size: 100, contentType: 'text/html' };
  await assert.rejects(() => service.savePageData('owner', { wallpaper: valid }), { status: 400 });
  await assert.rejects(() => service.savePageData('another-owner', { wallpaper: valid }), { status: 403 });
});

test('upload token endpoint authenticates, scopes paths and sets the 20 MB storage limit', async () => {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  let signedIn = true;
  let issued;
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('api/video-upload.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const http = {
    HttpError: class extends Error { constructor(status, message) { super(message); this.status = status; } },
    allowMethods: () => true,
    readJsonBody: async req => req.body,
    sendJson: (res, status, body) => { res.status = status; res.body = body; res.headersSent = true; },
    handleApiError: (res, error) => { res.status = error.status || 500; res.body = { error: error.message }; },
  };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '@vercel/blob/client') return { handleUpload: async options => { issued = await options.onBeforeGenerateToken(options.body.pathname); return { ok: true }; } };
    if (name === '../shared/videoSources') return loadVideos();
    if (name === './_lib/http') return http;
    if (name === './_lib/session') return { requireUser: async (req, res) => { if (signedIn) return { id: 'owner' }; http.sendJson(res, 401, {}); return null; } };
    throw new Error(name);
  }, module, module.exports);
  const handler = module.exports.default;
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    let res = {};
    await handler({ method: 'GET' }, res);
    assert.equal(res.status, 503);
    process.env.BLOB_READ_WRITE_TOKEN = 'test-only-not-a-credential';
    res = {};
    await handler({ method: 'POST', body: { pathname: 'wallpapers/owner/12345678-1234-1234-1234-123456789abc.mp4' } }, res);
    assert.equal(res.status, 200);
    assert.equal(issued.maximumSizeInBytes, 20 * 1024 * 1024);
    assert.deepEqual(issued.allowedContentTypes, ['video/mp4', 'video/webm']);
    assert.equal(issued.allowOverwrite, false);
    res = {};
    await handler({ method: 'POST', body: { pathname: 'wallpapers/another-owner/12345678-1234-1234-1234-123456789abc.mp4' } }, res);
    assert.equal(res.status, 400);
    signedIn = false;
    res = {};
    await handler({ method: 'GET' }, res);
    assert.equal(res.status, 401);
  } finally {
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  }
});
