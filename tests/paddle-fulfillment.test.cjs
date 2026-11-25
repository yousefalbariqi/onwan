const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {buildSync}=require('esbuild');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(entry,mocks={}) {
  const {outputFiles}=buildSync({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',
    external:['react','react-router','@paddle/paddle-node-sdk',...Object.keys(mocks)]});
  const module={exports:{}};
  new Function('require','module','exports',outputFiles[0].text)(name=>mocks[name]??require(name),module,module.exports);
  return module.exports;
}
const period={startsAt:'2026-11-23T00:00:00Z',endsAt:'2099-11-23T00:00:00Z'};
const transaction={id:'txn_test',status:'completed',subscriptionId:'sub_test',customerId:'ctm_test',currencyCode:'USD',discountId:null,
  items:[{quantity:1,price:{id:'pri_test',productId:'pro_test',billingCycle:{interval:'year',frequency:1},trialPeriod:null}}],
  details:{totals:{grandTotal:'5000'}},billingPeriod:period};
const order={id:'order',user_id:'owner',transaction_id:'txn_test',price_id:'pri_test',product_id:'pro_test',username:'my-page',
  status:'open',paid_at:null,fulfilled_at:null,page_json:{name:'Page at purchase'},draft_saved_at:'saved'};
function setup({failPublish=false,defer=false}={}) {
  let state={order:structuredClone(order),events:new Set(),sub:null,activations:0,published:0,saved:null};let backup;
  const queries=[],background=[];
  async function query(sql,args=[]) {
    queries.push({sql,args});
    if(sql==='begin') backup=structuredClone(state);
    if(sql==='rollback') state=backup;
    if(sql.startsWith('insert into paddle_webhook_events')) {
      if(state.events.has(args[0])) return {rowCount:0,rows:[]};state.events.add(args[0]);return {rowCount:1,rows:[{}]};
    }
    if(sql.startsWith('select * from paddle_checkout_orders where transaction_id')) return {rows:args[0]===state.order.transaction_id?[state.order]:[]};
    if(sql.startsWith('select * from paddle_checkout_orders where id')) return {rows:[state.order]};
    if(sql.startsWith('select user_id')) return {rows:[{user_id:'owner'}]};
    if(sql.startsWith('select status,email_verified_at')) return {rows:[{status:'active',email_verified_at:'yes',account_kind:'standard'}]};
    if(sql.startsWith('select status,draft_json')) return {rows:[{status:'draft',draft_saved_at:'saved'}]};
    if(sql.startsWith('select username')) return {rows:[{username:'my-page'}]};
    if(sql.startsWith('select * from paddle_subscriptions')) return {rows:state.sub?[state.sub]:[]};
    if(sql.includes("set status='paid'")) Object.assign(state.order,{status:'paid',subscription_id:args[1],paid_at:args[5]});
    if(sql.startsWith('insert into paddle_subscriptions')) {
      if(sql.includes("values($1,$2,'active'")) state.sub??={subscription_id:args[0],status:'active',current_period_starts_at:args[3],current_period_ends_at:args[4],last_event_at:args[5]};
      else {
        if(state.sub && state.sub.last_event_at>=args[7]) return {rowCount:0,rows:[]};
        state.sub={subscription_id:args[0],status:args[2],current_period_starts_at:args[4],current_period_ends_at:args[5],last_event_at:args[7]};
      }
      return {rowCount:1,rows:[{subscription_id:args[0]}]};
    }
    if(sql.includes("set status='published',fulfilled_at")) Object.assign(state.order,{status:'published',fulfilled_at:'fulfilled'});
    if(sql.includes("set status='publication_failed'")) state.order.status='publication_failed';
    return {rows:[],rowCount:1};
  }
  const api=load('api/_lib/paddleFulfillment.ts',{
    './db.js':{pool:{query,connect:async()=>({query,release(){}})}},
    './account.js':{activateSubscription:async()=>{state.activations++;}},
    './page.js':{getPageDataByUserId:async()=>({username:'my-page'}),savePageData:async(_id,data)=>{if(failPublish) throw Error('storage unavailable');state.published++;state.saved=data;}},
    './publicCache.js':{purgePublicPage:async()=>{}},
    './runtime.js':{requestRuntime:()=>defer?{defer:work=>background.push(work)}:undefined},
  });
  return {...api,state:()=>state,queries,background};
}
test('only a matched completed transaction with exact annual item can be fulfilled',()=>{
  const h=setup();h.validatePaddlePurchase(transaction,order);
  for(const mutate of [d=>d.id='txn_other',d=>d.status='paid',d=>d.items[0].quantity=2,d=>d.items[0].price.id='other',
    d=>d.items[0].price.productId='other',d=>d.discountId='discount',d=>d.subscriptionId=null,d=>d.billingPeriod=null,d=>d.details.totals.grandTotal='0']) {
    const bad=structuredClone(transaction);mutate(bad);assert.throws(()=>h.validatePaddlePurchase(bad,order));
  }
});
test('completed transaction activates and publishes exactly once; duplicate event and a different replay ID never extend access twice',async()=>{
  const h=setup();const event={eventId:'evt_1',eventType:'transaction.completed',occurredAt:'2026-11-23',data:transaction};
  await h.processPaddleEvent(event);await h.processPaddleEvent(event);await h.processPaddleEvent({...event,eventId:'evt_replay'});
  assert.equal(h.state().order.status,'published');assert.equal(h.state().activations,1);assert.equal(h.state().published,1);
  assert.equal(h.state().saved.name,'Page at purchase');
  assert.ok(h.queries.some(q=>q.sql.startsWith('update subscriptions set starts_at=') && q.args[2]===period.endsAt));
});
test('a failed publication retains confirmed payment and does not grant partial access',async()=>{
  const h=setup({failPublish:true});await h.processPaddleEvent({eventId:'evt_1',eventType:'transaction.completed',occurredAt:'2026-11-23',data:transaction});
  assert.equal(h.state().order.status,'publication_failed');assert.ok(h.state().order.paid_at);
  assert.equal(h.state().activations,0);assert.equal(h.state().order.fulfilled_at,null);
});
test('Worker acknowledges the durable payment before background publication, which runs without an open browser',async()=>{
  const h=setup({defer:true});await h.processPaddleEvent({eventId:'evt_background',eventType:'transaction.completed',occurredAt:'2026-11-23',data:transaction});
  assert.equal(h.state().order.status,'paid');assert.equal(h.state().activations,0);assert.equal(h.background.length,1);
  await h.background[0]();assert.equal(h.state().order.status,'published');assert.equal(h.state().activations,1);
});
test('client customData or email cannot attach an unrelated transaction to an account',async()=>{
  const h=setup();await h.processPaddleEvent({eventId:'evt_unrelated',eventType:'transaction.completed',occurredAt:'2026-11-23',data:{...transaction,id:'unrelated',customData:{onwanOrderId:'order',userId:'owner'}}});
  assert.equal(h.state().activations,0);assert.equal(h.state().order.paid_at,null);
});
test('scheduled cancellation retains access; canceled, paused and past_due deny it; older subscription events cannot restore it',async()=>{
  const h=setup();assert.equal(h.paddleGrantsAccess({status:'active',scheduled_change:{action:'cancel'}}),true);
  assert.equal(h.paddleGrantsAccess({status:'trialing'}),true);
  for(const status of ['canceled','paused','past_due']) assert.equal(h.paddleGrantsAccess({status}),false);
  const data={id:'sub_test',customerId:'ctm_test',items:transaction.items,currentBillingPeriod:period,status:'canceled'};
  await h.processPaddleEvent({eventId:'evt_new',eventType:'subscription.canceled',occurredAt:'2026-11-24',data});
  await h.processPaddleEvent({eventId:'evt_old',eventType:'subscription.created',occurredAt:'2026-11-23',data:{...data,status:'active'}});
  assert.equal(h.state().sub.status,'canceled');
});
test('real SDK verifies raw signature before any database work; tampering and absent signatures never return 2xx',async()=>{
  const {Paddle,Environment}=require('@paddle/paddle-node-sdk');
  const sdk=new Paddle('test-unused-api-key',{environment:Environment.sandbox});let processed=0;
  const handler=load('api/paddle/webhook.ts',{'../_lib/paddle.js':{paddleClient:()=>sdk,paddleConfig:()=>({secret:'signing-secret'})},
    '../_lib/paddleFulfillment.js':{processPaddleEvent:async()=>{processed++;}}}).default;
  const raw=JSON.stringify({event_id:'evt_example',event_type:'customer.created',occurred_at:'2026-11-23T00:00:00Z',data:{id:'ctm_example',email:'sandbox@example.com'}});
  const ts=Math.floor(Date.now()/1000);const signature=`ts=${ts};h1=${createHmac('sha256','signing-secret').update(`${ts}:${raw}`).digest('hex')}`;
  async function request(body,header) {const res={code:200,status(n){this.code=n;return this;},setHeader(){return this;},send(){}};await handler({method:'POST',headers:{'paddle-signature':header},text:async()=>body},res);return res.code;}
  assert.equal(await request(raw,signature),200);assert.equal(processed,1);
  assert.ok(await request(raw+' ',signature)>=400);assert.equal(processed,1);
  assert.equal(await request(raw,null),400);assert.equal(processed,1);
});
test('result UI never claims payment before the server confirms it, and shows sharing only after publication',()=>{
  function render(result) {
    let index=0;const hooks={...React,useEffect(){},useState:initial=>[index++===0?result:initial,()=>{}]};
    const Page=load('src/app/components/PaddlePaymentResult.tsx',{
      react:hooks,'react-router':{Link:({children,...props})=>React.createElement('a',props,children)},
      '../context/PageContext':{usePageContext:()=>({isAuthenticated:true,loadingPage:false,pageData:{name:'تصميمي'},setAccount(){}})},
      '../lib/api':{accountCall:async()=>{}},'../lib/site':{pageUrl:name=>`https://${name}.example.com`,pageHost:name=>`${name}.example.com`},
    }).default;
    return renderToStaticMarkup(React.createElement(Page,{order:'opaque-order'}));
  }
  const waiting=render({state:'open',paymentConfirmed:false});assert.match(waiting,/نتحقق من تأكيد الدفع/);assert.doesNotMatch(waiting,/تم الدفع، نجهّز|افتح صفحتي/);
  const paid=render({state:'paid',paymentConfirmed:true});assert.match(paid,/تم الدفع، نجهّز صفحتك/);assert.doesNotMatch(paid,/افتح صفحتي/);
  const ready=render({state:'published',username:'server-owned',paymentConfirmed:true});assert.match(ready,/صفحتك جاهزة/);assert.match(ready,/server-owned.example.com/);assert.match(ready,/انسخ الرابط/);
});
test('status lookup is scoped to the authenticated owner and hides the public URL until fulfillment',async()=>{
  let lookup,fulfilled=0;
  const {paddleCheckoutStatus}=load('api/_lib/paddleCheckout.ts',{
    './db.js':{pool:{query:async(sql,args)=>{lookup=args;return {rows:[{id:'order',status:'open',username:'hidden-until-paid',paid_at:null}]};}}},
    './paddle.js':{paddleConfig:()=>({}),paddleClient:()=>({})},'./page.js':{},'./account.js':{},
    './paddleFulfillment.js':{fulfillPaddleOrder:async()=>{fulfilled++;}},
  });
  const result=await paddleCheckoutStatus({order:'other-order',userId:'attacker-supplied'},{id:'session-owner'});
  assert.deepEqual(lookup,['session-owner','other-order']);assert.equal(result.username,null);assert.equal(result.paymentConfirmed,false);assert.equal(fulfilled,0);
});
