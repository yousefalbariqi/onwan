// Only use the dedicated disposable database created by this test setup.
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {Pool}=require('pg');
const url=process.env.NONPROFIT_TEST_DATABASE_URL;
function load(file,mocks){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(mocks[name])return mocks[name];throw Error(name);},m,m.exports);return m.exports;}
test('nonprofit requests: ownership, snapshot, concurrency, email failure/retry and publication gate', {skip:!url},async()=>{
 const pool=new Pool({connectionString:url,max:8});
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',standard='33333333-3333-4333-8333-333333333333';
 let sent=0,mailOk=false;
 const http=load('api/_lib/http.ts',{});
 let design={name:'جمعية اختبار',links:[],wallpaper:{type:'color',value:'#fff'}};
 const service=load('api/_lib/nonprofit.ts',{'./db.js':{pool},'./http.js':http,'./page.js':{getPageDataByUserId:async()=>({...design})},'./runtime.js':{getEnv:k=>k==='ADMIN_EMAIL'?'admin@example.invalid':undefined},'./email.js':{sendNoticeEmail:async()=>{sent++;return mailOk;}}});
 try{
  await pool.query(`create table if not exists users(id uuid primary key,email text,phone text,email_verified_at timestamptz);
   create table if not exists pages(id uuid primary key default gen_random_uuid(),user_id uuid unique references users(id),status text default 'draft',draft_json jsonb);
   create table if not exists subscriptions(user_id uuid primary key,status text);
   create or replace function media_check_references(data jsonb) returns void language plpgsql as $$ begin if data::text like '%data:image%' then raise exception 'inline'; end if; end $$;`);
  await pool.query(fs.readFileSync('database/phase25-nonprofit-requests.sql','utf8'));
  await pool.query('truncate nonprofit_quote_requests,users,pages,subscriptions cascade');
  await pool.query("insert into users(id,email,phone,account_kind) values($1,'a@example.invalid','0500000000','nonprofit'),($2,'b@example.invalid','0500000001','nonprofit'),($3,'standard@example.invalid','0500000002','standard')",[a,b,standard]);
  await pool.query('insert into pages(user_id) values($1),($2),($3)',[a,b,standard]);
  await assert.rejects(()=>service.nonprofitStatus(standard),{status:403});
  await assert.rejects(()=>service.submitNonprofit(a,{organizationName:'جمعية',contactName:'مسؤول'}),{status:403},'unconfirmed email cannot request a quote');
  await pool.query('update users set email_verified_at=now()');
  await assert.rejects(()=>service.submitNonprofit(a,{organizationName:'',contactName:''}),{status:400});
  const form={organizationName:'جمعية اختبار',contactName:'مسؤول اختبار',notes:'ملاحظة'};
  const requests=await Promise.all([service.submitNonprofit(a,form),service.submitNonprofit(a,form)]);
  assert.equal(requests[0].request.id,requests[1].request.id);
  assert.equal((await pool.query('select * from nonprofit_quote_requests')).rowCount,1);
  assert.equal((await service.nonprofitStatus(b)).request,null,'other organization cannot see request');
  let row=(await pool.query('select * from nonprofit_quote_requests')).rows[0];
  assert.equal(row.email,'a@example.invalid');assert.equal(row.status,'pending');assert.equal(row.email_status,'failed');
  assert.equal(row.page_json.name,design.name);
  design.name='تصميم معدل';
  await service.submitNonprofit(a,form);
  assert.equal((await pool.query('select page_json from nonprofit_quote_requests')).rows[0].page_json.name,'جمعية اختبار','submitted snapshot is immutable');
  mailOk=true;await service.notifyNonprofit(row.id);
  assert.equal((await service.nonprofitStatus(a)).request.email_status,'sent');
  const before=sent;await service.submitNonprofit(a,form);assert.equal(sent,before,'repeat submit does not resend sent email');
  await assert.rejects(()=>pool.query("update pages set status='published' where user_id=$1",[a]),/nonprofit_manual_activation/);
  await assert.rejects(()=>pool.query("insert into subscriptions values($1,'active')",[a]),/nonprofit_manual_activation/);
  await pool.query("update pages set status='published' where user_id=$1",[standard]);
  assert.equal((await pool.query('select status from pages where user_id=$1',[a])).rows[0].status,'draft');
  await pool.query(fs.readFileSync('database/phase25-nonprofit-requests.sql','utf8'));
 } finally{await pool.end();}
});
