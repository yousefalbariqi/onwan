const {test}=require('node:test');const assert=require('node:assert/strict');const {buildSync}=require('esbuild');
function load(entry,mocks){const {outputFiles}=buildSync({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',write:false,external:Object.keys(mocks)});const module={exports:{}};new Function('require','module','exports',outputFiles[0].text)(name=>mocks[name]??require(name),module,module.exports);return module.exports;}
class HttpError extends Error{constructor(status,message,code){super(message);this.status=status;this.code=code;}}
function setup(options={}){
 const queries=[],saved=[];let cart=options.cart??null;let backup;let published=false;
 const data={name:'my page',theme:{id:'chosen'},links:[{id:'mine',title:'retained',url:'https://example.org'}],...options.data};
 const query=async(sql,args)=>{
  queries.push({sql,args});if(sql==='begin')backup={cart:cart&&structuredClone(cart),published};if(sql==='rollback'){cart=backup.cart;published=backup.published;}
  if(sql.startsWith('select account_kind'))return{rows:[{account_kind:options.nonprofit?'nonprofit':'standard',email_verified_at:options.unverified?null:'verified',status:'active'}]};
  if(sql.startsWith('select status,draft_json'))return{rows:[{status:options.suspended?'suspended':'draft',draft_json:data}]};
  if(sql.includes('manual_published_at is not null'))return{rows:cart?.manual_published_at?[cart]:[]};
  if(sql.startsWith('select 1 from subscriptions'))return{rowCount:0};
  if(sql.startsWith('select * from registration_carts'))return{rows:cart?[cart]:[]};
  if(sql.startsWith('select 1 from usernames'))return{rowCount:options.nameTaken?0:1};
  if(sql.startsWith('update pages'))published=true;
  if(sql.startsWith('insert into registration_carts')){cart={id:'cart',cart_number:24,total:180,manual_published_at:'now',status:'pending_payment'};return{rows:[cart]};}
  if(sql.startsWith('update registration_carts')){cart.manual_published_at='now';return{rows:[cart]};}
  return{rows:[],rowCount:0};
 };
 const api=load('api/_lib/manualPublication.ts',{
  './db.js':{pool:{connect:async()=>({query,release(){}})}},'./http.js':{HttpError},'./publicCache.js':{purgePublicPage:async()=>{}},
  './account.js':{pricePlan:async()=>({finalPrice:180,listPrice:180,generalDiscount:0})},'./partnerReferral.js':{getReferralOffer:async()=>options.partner?{}:null},
  './page.js':{getPageDataByUserId:async()=>({...data,username:'actual-owner'}),savePageData:async(_,value)=>{if(options.failSave)throw Error('save failed');saved.push(value);}},
 });
 return{...api,queries,saved,cart:()=>cart,published:()=>published};
}
test('manual launch publishes the entire draft and creates an unpaid annual request atomically, without activation or a payment record',async()=>{
 const h=setup();const result=await h.publishWithManualPayment({expectedTotal:180},{id:'owner'});
 assert.equal(result.username,'actual-owner');assert.equal(h.published(),true);assert.equal(h.cart().status,'pending_payment');assert.equal(h.saved[0].theme.id,'chosen');assert.equal(h.saved[0].links[0].title,'retained');
 assert.ok(h.queries.some(q=>q.sql.includes("'pending_payment'")));assert.ok(!h.queries.some(q=>/insert into payments|status='active'[, ]*updated|payment_reference\s*=/.test(q.sql)));
 assert.equal(h.queries.at(-1).sql,'commit');
});
test('repeating a completed publication returns the same request without publishing or charging twice',async()=>{
 const h=setup();await h.publishWithManualPayment({expectedTotal:180},{id:'owner'});const second=await h.publishWithManualPayment({expectedTotal:180},{id:'owner'});
 assert.equal(second.alreadyPublished,true);assert.equal(second.cartNumber,24);assert.equal(h.saved.length,1);assert.equal(h.queries.filter(q=>q.sql.startsWith('insert into registration_carts')).length,1);
});
test('nonprofit, partner, unverified, suspended and unfinished pages cannot use the official manual launch exception',async()=>{
 for(const options of [{nonprofit:true},{partner:true},{unverified:true},{suspended:true},{data:{editorForm:{unfinished:true}}},{nameTaken:true}]){const h=setup(options);await assert.rejects(h.publishWithManualPayment({expectedTotal:180},{id:'owner'}));assert.equal(h.published(),false);assert.equal(h.cart(),null);assert.equal(h.queries.at(-1).sql,'rollback');}
});
test('price changes, prior extras and failed content saves retain the draft and never create a publication request',async()=>{
 const price=setup();await assert.rejects(price.publishWithManualPayment({expectedTotal:1},{id:'owner'}),error=>error.code==='price_changed');assert.equal(price.cart(),null);
 const extras=setup({cart:{plan:'annual',design_price:43,nfc_quantity:0,total:223}});await assert.rejects(extras.publishWithManualPayment({expectedTotal:180},{id:'owner'}));assert.equal(extras.published(),false);
 const failure=setup({failSave:true});await assert.rejects(failure.publishWithManualPayment({expectedTotal:180},{id:'owner'}),/save failed/);assert.equal(failure.published(),false);assert.equal(failure.cart(),null);
});
test('staff payment confirmation is idempotent and manual URLs reject unsafe schemes before a database update',async()=>{
 const cart={id:'cart',user_id:'owner',status:'pending_payment',cart_number:24,total:180};let confirmations=0,updates=0;
 const client={query:async sql=>sql.startsWith('select *')?{rows:[cart]}:{rows:[]},release(){}};
 const names=['./pageMutation.js','./runtime.js','./publicCache.js','./page.js','./domains.js'];const mocks=Object.fromEntries(names.map(name=>[name,{}]));
 Object.assign(mocks,{'./http.js':{HttpError},'./db.js':{pool:{connect:async()=>client,query:async()=>{updates++;return{rowCount:1,rows:[{user_id:'owner',cart_number:24}]};}}},'./cartPayment.js':{completeCart:async()=>{confirmations++;cart.status='paid';}},'./admin.js':{requireText:value=>value,audit:async()=>{},getCustomerLabel:async()=> 'owner'},'./services.js':{SETTING_KEYS:[]}});
 const {serviceAdminHandlers:handlers}=load('api/_lib/adminServices.ts',mocks);
 assert.equal(handlers['carts.confirmPayment'].access,'staff');
 const params={id:'cart',reference:'bank-reference'};await handlers['carts.confirmPayment'].run(params,{name:'staff'});
 assert.equal((await handlers['carts.confirmPayment'].run(params,{name:'staff'})).alreadyConfirmed,true);assert.equal(confirmations,1);
 for(const paymentUrl of ['javascript:alert(1)','http://bank.example/pay','https://name:secret@bank.example/pay'])await assert.rejects(handlers['carts.setManualLinks'].run({id:'cart',paymentUrl},{name:'staff'}),error=>error.status===400);
 assert.equal(updates,0);
 await handlers['carts.setManualLinks'].run({id:'cart',paymentUrl:'https://bank.example/pay',invoiceUrl:'https://example.org/invoice'},{name:'staff'});assert.equal(updates,1);
});
