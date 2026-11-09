// Disposable LOCAL database only; never point this at an application database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Pool } = require('pg');
const url = process.env.PAGE_REVISION_TEST_DATABASE_URL;
test('revision-safe drafts and publication (real PostgreSQL)', { skip: !url }, async t => {
  const target = new URL(url);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && target.pathname.startsWith('/onwan_test_'));
  const pool = new Pool({ connectionString: url, max: 8 });
  const cache = new Map();
  const load = file => {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (name.endsWith('/db.js')) return { pool };
      if (name.endsWith('/runtime.js')) return { getBinding: () => undefined };
      if (name.endsWith('/stream.js')) return { streamUidFromUrl: () => null };
      return load(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts')));
    }, module, module.exports);
    return module.exports;
  };
  const user = '10000000-0000-4000-8000-000000000001';
  try {
    await pool.query(`drop schema public cascade; create schema public;
      create table users(id uuid primary key,phone text,email text,account_kind text default 'nonprofit',status text default 'active');
      create table usernames(user_id uuid primary key,username text);
      create view customer_names as select * from usernames;
      create table pages(id uuid primary key default gen_random_uuid(),user_id uuid unique references users(id),display_name text,bio text,
        profile_image_url text,theme_json jsonb,wallpaper_json jsonb,button_style_json jsonb,profile_style_json jsonb,
        custom_colors_json jsonb,extracted_colors_json jsonb,typography_json jsonb,translations_json jsonb,
        suggested_username text,status text default 'draft',suspension_message text,updated_at timestamptz default now());
      create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
      create trigger trg_pages_updated_at before update on pages for each row execute function set_updated_at();
      create table page_links(id uuid primary key default gen_random_uuid(),page_id uuid,title text,url text,link_type text,file_category text,file_name text,file_mime_type text,file_size integer,platform text,sort_order integer,icon_style text,text_position text,is_hidden boolean,title_en text,custom_icon text,display_json jsonb);
      create table content_reviews(page_id uuid,snapshot_json jsonb,status text,reviewed_by text,reviewed_at timestamptz);
      create table deleted_links(page_id uuid,link_json jsonb,deleted_by text);
      create table link_writes(operation text);
      create function record_link_write() returns trigger language plpgsql as $$ begin insert into link_writes values(tg_op); return null; end $$;
      create trigger count_link_writes after insert or update or delete on page_links for each row execute function record_link_write();`);
    await pool.query(fs.readFileSync('database/phase20-drafts-and-save-limit.sql', 'utf8'));
    await pool.query(fs.readFileSync('database/phase30-page-revisions.sql', 'utf8'));
    await pool.query(fs.readFileSync('database/phase30-page-revisions.sql', 'utf8'));
    await pool.query("insert into users(id,phone,email) values($1,'0500000000','test@example.invalid')", [user]);
    const pages = load('api/_lib/page.ts');
    const { mutatePage } = load('api/_lib/pageMutation.ts');
    const { loadDraft } = load('api/_lib/pageDraft.ts');
    await pages.ensurePageForUser(user);
    const row = async () => (await pool.query('select * from pages where user_id=$1', [user])).rows[0];
    const revision = async () => Number((await row()).edit_revision);
    const mutate = async (draft, data, rev, id = crypto.randomUUID()) => mutatePage(user, { draft, pageData: data, revision: rev ?? await revision(), operationId: id });
    let data = { ...(await pages.getPageDataByUserId(user)), name: 'الجمعية', bio: 'original', links: [{ id: crypto.randomUUID(), title: 'الموقع', url: 'https://example.org', platform: 'website' }] };
    await t.test('draft survives the legacy updated_at trigger; public content stays unchanged', async () => {
      await mutate(true, data);
      assert.equal((await loadDraft(user)).pageData.name, data.name);
      assert.notEqual((await row()).display_name, data.name);
    });
    await t.test('two concurrent drafts from one revision: exactly one wins', async () => {
      const rev = await revision();
      const results = await Promise.allSettled([mutate(true, { ...data, bio: 'A' }, rev), mutate(true, { ...data, bio: 'B' }, rev)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.code, 'page_conflict');
    });
    await t.test('publication atomically clears draft; late drafts cannot resurrect it', async () => {
      const old = await revision();
      const saved = await mutate(false, data, old);
      data = saved.pageData;
      assert.equal((await row()).display_name, data.name);
      assert.equal((await row()).status, 'draft', 'saving does not activate an association');
      assert.equal(await loadDraft(user), null);
      await assert.rejects(() => mutate(true, { ...data, bio: 'late' }, old), { code: 'page_conflict' });
    });
    await t.test('lost response retry is idempotent and does not consume another save', async () => {
      const rev = await revision(), id = crypto.randomUUID();
      const first = await mutate(false, data, rev, id);
      const count = (await pool.query('select saves from page_save_counts')).rows[0].saves;
      const retry = await mutate(false, data, rev, id);
      assert.equal(first.revision, retry.revision);
      assert.equal((await pool.query('select saves from page_save_counts')).rows[0].saves, count);
    });
    await t.test('retry of an old operation cannot acknowledge a newer staff edit', async () => {
      const rev = await revision(), id = crypto.randomUUID();
      await mutate(false, data, rev, id);
      await pool.query("update pages set bio='new staff edit' where user_id=$1", [user]);
      await assert.rejects(() => mutate(false, data, rev, id), { code: 'page_conflict' });
    });
    await t.test('bio-only publication never rewrites link rows', async () => {
      await pool.query('truncate link_writes');
      data = (await mutate(false, { ...data, bio: 'changed bio' })).pageData;
      assert.equal((await pool.query('select * from link_writes')).rowCount, 0);
    });
    await t.test('changing one link updates only that row; deletion is archived', async () => {
      data = (await mutate(false, { ...data, links: [...data.links, { id: crypto.randomUUID(), title: 'second', url: 'https://example.org/second', platform: 'website' }] })).pageData;
      await pool.query('truncate link_writes');
      const ids = data.links.map(link => link.id);
      data = (await mutate(false, { ...data, links: data.links.map((link, i) => i === 0 ? { ...link, title: 'changed title' } : link) })).pageData;
      assert.deepEqual((await pool.query('select operation from link_writes')).rows.map(row => row.operation), ['UPDATE']);
      assert.deepEqual(data.links.map(link => link.id), ids);
      data = (await mutate(false, { ...data, links: data.links.slice(0, 1) })).pageData;
      assert.equal((await pool.query('select * from deleted_links')).rowCount, 1);
    });
    await t.test('failed draft cleanup rolls back content, review and quota writes', async () => {
      await mutate(true, { ...data, bio: 'pending' });
      const before = await row();
      const count = (await pool.query('select saves from page_save_counts')).rows[0].saves;
      await pool.query(`create function fail_cleanup() returns trigger language plpgsql as $$ begin if old.draft_json is not null and new.draft_json is null then raise exception 'test cleanup failure'; end if; return new; end $$;
        create trigger zz_fail_cleanup before update on pages for each row execute function fail_cleanup();`);
      await assert.rejects(() => mutate(false, { ...data, bio: 'must rollback' }));
      assert.equal((await row()).bio, before.bio);
      assert.deepEqual((await row()).draft_json, before.draft_json);
      assert.equal((await pool.query('select saves from page_save_counts')).rows[0].saves, count);
      await pool.query('drop trigger zz_fail_cleanup on pages');
    });
    await t.test('unchanged drafts cause no revision or quota write', async () => {
      const draft = (await row()).draft_json;
      const rev = await revision();
      const count = (await pool.query('select saves from page_save_counts')).rows[0].saves;
      await mutate(true, draft);
      assert.equal(await revision(), rev);
      assert.equal((await pool.query('select saves from page_save_counts')).rows[0].saves, count);
    });
    await t.test('staff content edits preserve conflicting drafts and reject stale clients', async () => {
      const rev = await revision();
      await pool.query("update pages set bio='staff version' where user_id=$1", [user]);
      assert.equal((await loadDraft(user)).conflict, true);
      await assert.rejects(() => mutate(false, data, rev), { code: 'page_conflict' });
    });
    await t.test('staff publication preserves the user draft as a reviewable conflict', async () => {
      await mutate(true, { ...data, bio: 'user unfinished draft' });
      await mutatePage(user, { revision: await revision(), operationId: crypto.randomUUID(), pageData: { ...data, bio: 'staff approved' } }, { staffName: 'staff' });
      assert.equal((await loadDraft(user)).pageData.bio, 'user unfinished draft');
      assert.equal((await loadDraft(user)).conflict, true);
    });
    await t.test('activation preserves an unfinished autosaved draft', async () => {
      await mutate(true, { ...data, bio: 'still designing' });
      await pool.query("update pages set status='published',suggested_username='association' where user_id=$1", [user]);
      assert.equal((await loadDraft(user)).pageData.bio, 'still designing');
      assert.equal((await loadDraft(user)).conflict, false);
    });
    await t.test('active pages retain publication status when edited', async () => {
      await pool.query("update pages set status='published' where user_id=$1", [user]);
      await mutate(false, data);
      assert.equal((await row()).status, 'published');
    });
  } finally { await pool.end(); }
});
