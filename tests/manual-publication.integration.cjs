const {test}=require('node:test'),assert=require('node:assert/strict'),{build}=require('esbuild'),pg=require('pg'),crypto=require('node:crypto');
const url=process.env.MANUAL_PUBLICATION_TEST_DATABASE_URL;
test('isolated PostgreSQL: publish unpaid, retry once, serve full content, then confirm payment without duplicate orders',{skip:!url},async()=>{
 const target=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(target.hostname)&&target.pathname.startsWith('/onwan_test_'));
 const pool=new pg.Pool({connectionString:url,max:1}),client=await pool.connect();
 try{
  await client.query('begin');
  const wrapped={query:(sql,args)=>client.query(sql==='begin'?'savepoint launch':sql==='commit'?'release savepoint launch':sql==='rollback'?'rollback to savepoint launch':sql,args),release(){}};
  globalThis.__manualDb={query:client.query.bind(client),connect:async()=>wrapped};
  const {outputFiles}=await build({stdin:{contents:"export {publishWithManualPayment} from './api/_lib/manualPublication.ts';export {ensurePageForUser,getPublicPageByUsername} from './api/_lib/page.ts';export {completeCart} from './api/_lib/cartPayment.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'local-db',setup(b){b.onLoad({filter:/api\/_lib\/db\.ts$/},()=>({contents:'export const pool=globalThis.__manualDb;',loader:'ts'}));b.onLoad({filter:/api\/_lib\/publicCache\.ts$/},()=>({contents:'export const purgePublicPage=async()=>{};',loader:'ts'}));}}]});
  const module={exports:{}};new Function('require','module','exports',outputFiles[0].text)(require,module,module.exports);const api=module.exports;
  const id=crypto.randomUUID(),name='qa-'+id.replaceAll('-','').slice(0,14);
  await client.query("insert into users(id,email,phone,password_hash,email_verified_at) values($1,$2,$3,'test-only',now())",[id,id+'@example.invalid','05'+crypto.randomInt(10000000,99999999)]);
  await api.ensurePageForUser(id,client);await client.query('insert into username_reservations(username,user_id) values($1,$2)',[name,id]);
  const data={name:'صفحتي',bio:'retained content',profileImage:'',links:[{id:crypto.randomUUID(),title:'retained link',url:'https://example.org',platform:'website'}]};
  await client.query('update pages set draft_json=$2::jsonb where user_id=$1',[id,JSON.stringify(data)]);
  const first=await api.publishWithManualPayment({expectedTotal:180},{id});assert.equal(first.username,name);
  const published=await api.getPublicPageByUsername(name);assert.equal(published.state,'published');assert.equal(published.pageData.name,data.name);assert.equal(published.pageData.links[0].title,'retained link');
  assert.equal((await client.query('select status from subscriptions where user_id=$1',[id])).rows[0].status,'pending_payment');
  assert.equal((await client.query('select count(*)::int as n from payments where user_id=$1',[id])).rows[0].n,0);
  const second=await api.publishWithManualPayment({expectedTotal:180},{id});assert.equal(second.cartNumber,first.cartNumber);
  assert.equal((await client.query('select count(*)::int as n from registration_carts where user_id=$1',[id])).rows[0].n,1);
  const cart=(await client.query('select * from registration_carts where user_id=$1 for update',[id])).rows[0];await api.completeCart(client,cart,'LOCAL-TEST','local-test');
  assert.equal((await client.query('select status from subscriptions where user_id=$1',[id])).rows[0].status,'active');
  assert.equal((await client.query('select count(*)::int as n from payments where user_id=$1',[id])).rows[0].n,1);
 }finally{await client.query('rollback');delete globalThis.__manualDb;client.release();await pool.end();}
});
