// Explicit opt-in: ONLY an isolated disposable database, never production.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { Pool } = require('pg');
const url = process.env.MEDIA_TEST_DATABASE_URL;
function load(file, mocks) {
 const module = { exports: {} };
 const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name => { if (mocks[name]) return mocks[name]; throw new Error(name); },module,module.exports);
 return module.exports;
}
test('media quotas, replacement trigger, and cleanup on real PostgreSQL', { skip: !url }, async () => {
 const pool = new Pool({connectionString:url,max:8});
 const owner = '11111111-1111-4111-8111-111111111111';
 const page = '22222222-2222-4222-8222-222222222222';
 const key = i => `files/${owner}/${String(i).padStart(64,'a')}.png`;
 const http = load('api/_lib/http.ts', {});
 const references = load('api/_lib/mediaReferences.ts', {});
 const quota = load('api/_lib/storageQuota.ts', {'./db.js':{pool}, './http.js':http,'./mediaReferences.js':references});
 const limits = load('api/_lib/mediaUploadLimits.ts', {'./db.js':{pool},'./http.js':http,'./storageQuota.js':quota});
 const cleanup = load('api/_lib/mediaCleanup.ts', {'./db.js':{pool},'./mediaReferences.js':references});
 try {
  await pool.query('truncate media_upload_events, media_slot_state, media_replacement_counts, media_deleted_keys, media_orphans, media_cleanup_log, pages, page_links, partner_orders, deleted_links, content_reviews cascade');
  await pool.query(fs.readFileSync('database/phase22-media-controls.sql','utf8')); // rerun safety
  const concurrent = await Promise.allSettled(Array.from({length:8},()=> limits.beginMediaUpload(owner,100)));
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,5,'rolling minute is atomic');
  await pool.query('truncate media_upload_events');
  await pool.query("insert into media_upload_events(owner_id,started_at,reserved_bytes) select $1, clock_timestamp()- interval '2 minutes', 1 from generate_series(1,50)",[owner]);
  await assert.rejects(()=>limits.beginMediaUpload(owner,1),{status:429});
  await pool.query('truncate media_upload_events');
  await pool.query("insert into media_upload_events(owner_id,started_at,reserved_bytes) values($1,clock_timestamp()- interval '2 minutes',$2)",[owner,500*1024*1024]);
  await assert.rejects(()=>limits.beginMediaUpload(owner,1),{status:429});
  await pool.query('truncate media_upload_events');
  const files = new Map();
  const media = {
   list:async ({prefix})=>({objects:[...files].filter(([k])=>k.startsWith(prefix)).map(([key,f])=>({key,size:f.size,uploaded:f.uploaded})),truncated:false}),
   head:async k=>files.get(k)||null,
   put:async(k,body)=>{await new Promise(r=>setTimeout(r,10));files.set(k,{size:body.byteLength,uploaded:new Date()});},
   delete:async keys=>keys.forEach(k=>files.delete(k)),
  };
  await assert.rejects(()=>quota.storageUsed({},owner),{status:503});
  files.set(key(0),{size:30*1024*1024,uploaded:new Date()});
  await assert.rejects(()=>quota.assertStorageRoom(media,owner,1),{code:'temporary_quota'});
  await pool.query('insert into pages values($1,$2,$3,$4,null)',[page,owner,'/media/'+key(0),JSON.stringify({type:'color',value:'#fff'})]);
  files.set(key(0),{size:199*1024*1024,uploaded:new Date()});
  const events=await Promise.all([limits.beginMediaUpload(owner,1024*1024),limits.beginMediaUpload(owner,1024*1024)]);
  const uploads=await Promise.allSettled(events.map((e,i)=>limits.storeLimitedUpload(media,owner,key(i+1),new ArrayBuffer(1024*1024),'image/png',e)));
  assert.equal(uploads.filter(r=>r.status==='fulfilled').length,1,'concurrent writes cannot exceed 200 MiB');
  assert.equal(await quota.storageUsed(media,owner),200*1024*1024);
  const winner=uploads.findIndex(r=>r.status==='fulfilled')+1;
  await pool.query('truncate media_upload_events');
  const repeat=await limits.beginMediaUpload(owner,1024*1024);
  await limits.storeLimitedUpload(media,owner,key(winner),new ArrayBuffer(1024*1024),'image/png',repeat);
  assert.equal(await quota.storageUsed(media,owner),200*1024*1024,'dedup adds no storage');
  for(let i=1;i<=20;i++) await pool.query('update pages set profile_image_url=$2 where id=$1',[page,'/media/'+key(100+i)]);
  await assert.rejects(()=>pool.query('update pages set profile_image_url=$2 where id=$1',[page,'/media/'+key(121)]),/media_replacement_limit/);
  await pool.query('update pages set profile_image_url = null where id=$1',[page]);
  await assert.rejects(()=>pool.query('update pages set profile_image_url=$2 where id=$1',[page,'/media/'+key(122)]),/media_replacement_limit/);
  await assert.rejects(()=>pool.query('update pages set draft_json=$2 where id=$1',[page,JSON.stringify({profileImage:'data:image/png;base64,AAAA'})]),/media_inline_forbidden/);
  // Reusing a still-referenced file must never be deleted.
  files.clear();
  files.set(key(120),{size:100,uploaded:new Date(Date.now()-2*86400000)});
  files.set(key(200),{size:100,uploaded:new Date(Date.now()-2*86400000)});
  await pool.query('update pages set profile_image_url=$2 where id=$1',[page,'/media/'+key(120)]);
  const result=await cleanup.runMediaCleanup(media);
  assert.equal(result.deleted,1);
  assert.ok(files.has(key(120)));
  await assert.rejects(()=>pool.query('update pages set draft_json=$2 where id=$1',[page,JSON.stringify({profileImage:'/media/'+key(200)})]),/media_file_deleted/);
  // A save in flight holds the shared lock. Cleanup waits and sees its new reference.
  files.set(key(201),{size:100,uploaded:new Date(Date.now()-2*86400000)});
  const writer=await pool.connect();
  await writer.query('begin');
  await writer.query('update pages set draft_json=$2 where id=$1',[page,JSON.stringify({links:[{id:'draft',url:'/media/'+key(201),linkType:'file'}]})]);
  const cleaning=cleanup.runMediaCleanup(media);
  await new Promise(r=>setTimeout(r,25));
  await writer.query('commit');writer.release();
  await cleaning;
  assert.ok(files.has(key(201)),'cleanup sees the committed draft');
  // Partial R2 failure must not roll back tombstones for already-deleted keys.
  files.set(key(202),{size:100,uploaded:new Date(Date.now()-2*86400000)});
  await assert.rejects(()=>cleanup.runMediaCleanup({...media,delete:async keys=>{files.delete(keys[0]);throw new Error('R2 failure');}}),/R2 failure/);
  assert.ok((await pool.query('select key from media_deleted_keys where key=$1',[key(202)])).rowCount);
 } finally {await pool.end();}
});
