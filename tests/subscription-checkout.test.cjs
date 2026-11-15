const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(entry, mocks = {}) {
 const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-dom', 'react-router', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
 const module = { exports: {} }; new Function('require','module','exports',outputFiles[0].text)(name => mocks[name] ?? require(name),module,module.exports); return module.exports;
}
const { subscriptionCheckoutPolicy } = load('shared/subscriptionCheckout.ts');
class HttpError extends Error { constructor(status,message,code) { super(message); this.status=status; this.code=code; } }
function accountActions({ total=180, status='pending_payment', reference=null, pageStatus='draft', unpublished=false, manual=false }={}) {
 const queries=[], writes=[];
 const account={ pageStatus, subscription:{ status:'active',expiresAt:'2099-01-01' } };
 const empty=['./turnstile.js','./email.js','./otp.js','./password.js','./username.js','./domains.js'];
 const mocks=Object.fromEntries(empty.map(name=>[name,{}]));
 Object.assign(mocks,{
  './partnerReferral.js':{ getReferralOffer:async()=>null },'./demoPayment.js':{},'./runtime.js':{},'./demoPrices.js':{demoPricesOn:()=>false},
  './account.js':{ getPlans:async()=>[{plan:'annual',priceSar:total,discountPercent:null}],getAccountSummary:async()=>account },
  './services.js':{getSettings:async()=>({}),getLatestDesignPackage:async()=>null,getDesignPrice:()=>43,isPackageOpen:()=>false},
  './http.js':{HttpError},'./page.js':{getPageDataByUserId:async()=>({username:'actual-owner'})},
  './db.js':{pool:{query:async(sql,args)=>{queries.push({sql,args});if(/insert|update|delete/i.test(sql))writes.push(sql);return {rows:[{cart_number:25,status,payment_reference:reference,total,unpublished_draft:unpublished,manual_published_at:manual?"now":null}]};}}},
 });
 return {...load('api/_lib/accountActions.ts',mocks),queries,writes};
}
test('annual equivalent and final tax-inclusive amount are computed from server prices rather than fixed UI values',()=>{
 const policy=subscriptionCheckoutPolicy([{plan:'monthly',priceSar:99,discountPercent:null},{plan:'annual',priceSar:180,discountPercent:null}]);
 assert.equal(policy.total,180);assert.equal(policy.monthlyEquivalent,15);assert.equal(policy.taxIncluded,true);assert.equal(policy.renewal,'automatic');assert.equal(policy.renewalEnabled,false);
 assert.equal(subscriptionCheckoutPolicy([{plan:'annual',priceSar:240,discountPercent:10}]).total,216);
 assert.equal(subscriptionCheckoutPolicy([]).total,null);
 assert.equal(subscriptionCheckoutPolicy([{plan:'annual',priceSar:NaN,discountPercent:null}]).total,null);
 assert.deepEqual(policy.methods,[]);assert.equal(policy.paymentConfigured,false);
 assert.ok(!policy.features.some(text=>/نطاق خاص/.test(text)));
});
test('quote reuses existing plan service and does not create a payable cart or activate the subscription',async()=>{
 const h=accountActions({total:240});const quote=await h.runAccountAction('cart.quote',{}, {id:'owner'});
 assert.equal(quote.checkout.total,240);assert.equal(quote.checkout.monthlyEquivalent,20);assert.equal(h.writes.length,0);
});
test('unconfigured checkout fails closed even when a caller requests demo or supplies a fabricated price',async()=>{
 const h=accountActions(); await assert.rejects(h.runAccountAction('checkout.start',{demo:true,method:'apple_pay',expectedTotal:0},{id:'owner'}),error=>error.status===503&&error.code==='payment_not_configured');assert.equal(h.queries.length,0);
});
test('result requires a paid server record, active subscription and published content; query strings cannot prove payment',async()=>{
 const h=accountActions();const result=await h.runAccountAction('checkout.status',{cart:'25',paid:true,total:0},{id:'owner'});
 assert.equal(result.state,'pending');assert.deepEqual(h.queries[0].args,['owner','25']);assert.ok(h.queries[0].sql.includes('user_id=$1'));
 const paid=accountActions({status:'paid',reference:'verified-reference',pageStatus:'published'});
 assert.equal((await paid.runAccountAction('checkout.status',{cart:'25'},{id:'owner'})).state,'published');
 const waiting=accountActions({status:'paid',reference:'verified-reference',pageStatus:'published',unpublished:true});
 assert.equal((await waiting.runAccountAction('checkout.status',{}, {id:'owner'})).state,'publication_pending');
 const demo=accountActions({status:'paid',reference:'DEMO:cart:1',pageStatus:'published'});
 assert.equal((await demo.runAccountAction('checkout.status',{}, {id:'owner'})).demo,true);
});
function walk(node,predicate,found=[]) {if(!node||typeof node!=='object')return found;if(predicate(node))found.push(node);React.Children.forEach(node.props?.children,child=>walk(child,predicate,found));return found;}
function checkout(total) {
 const quote={checkout:subscriptionCheckoutPolicy([{plan:'annual',priceSar:total,discountPercent:null}]),account:{subscription:null}};
 let cursor=0; const calls=[];
 const hooks={...React,useEffect(){},useRef:value=>({current:value}),useState:initial=>{const i=cursor++;return [i===0?quote:typeof initial==='function'?initial():initial,()=>{}];}};
 const Page=load('src/app/pages/SubscriptionCheckout.tsx',{
  react:hooks,'react-router':{Link:'a',useNavigate:()=>()=>{}},
  '../context/PageContext':{usePageContext:()=>({pageData:{username:'owner'},isAuthenticated:true,loadingPage:false,setAccount(){},saveDraft:async()=>calls.push('save'),hasPendingChanges:()=>false})},
  '../lib/api':{accountCall:async()=>calls.push('payment')},
 }).default;
 return {tree:Page(),calls};
}
test('one-card checkout hides inactive methods, shows inclusive tax and allows manual publication without demo payment',async()=>{
 const h=checkout(180);const html=renderToStaticMarkup(h.tree);
 assert.match(html,/اشتراك عنوان السنوي/);assert.match(html,/180 ريال/);assert.match(html,/15 ريال/);assert.match(html,/شاملة ضريبة/);assert.match(html,/لا يوجد خصم تلقائي/);
 assert.doesNotMatch(html,/Apple Pay|Visa|Mastercard|Tabby|Tamara|ملخص الطلب|الدفع التجريبي/);
 const pay=walk(h.tree,node=>node.type==='button'&&node.props.className==='subscription-checkout__pay')[0];
 assert.equal(pay.props.disabled,false);assert.match(html,/انشر صفحتي/);pay.props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.calls,['save','payment']);
 assert.match(renderToStaticMarkup(checkout(240).tree),/240 ريال/);
});
function resultScreen(result) {
 let cursor=0;
 const Page=load('src/app/pages/PaymentResult.tsx',{
  react:{...React,useEffect(){},useState:initial=>[cursor++===0?result:initial,()=>{}]},
  'react-router':{Link:'a',useSearchParams:()=>[new URLSearchParams('cart=25&paid=true&username=forged&total=0')]},
  '../lib/api':{accountCall:async()=>{throw Error('not used during render');}},
  '../context/PageContext':{usePageContext:()=>({isAuthenticated:true,loadingPage:false})},
 }).default;
 return renderToStaticMarkup(Page());
}
test('success UI ignores claimed payment and usernames in the return URL and only shares the server-owned published address',()=>{
 const waiting=resultScreen({state:'pending',demo:false,username:'actual-owner'});
 assert.match(waiting,/جارٍ تأكيد عملية الدفع/);assert.doesNotMatch(waiting,/مبروك|forged|نسخ الرابط/);
 const success=resultScreen({state:'published',demo:false,username:'actual-owner'});
 assert.match(success,/actual-owner.onwan.link/);assert.match(success,/نسخ الرابط/);assert.match(success,/مشاركة الصفحة/);assert.doesNotMatch(success,/forged/);
 const blocked=resultScreen({state:'publication_pending',demo:false,username:'actual-owner'});
 assert.match(blocked,/لا تحتاج إلى الدفع مرة ثانية/);assert.doesNotMatch(blocked,/مبروك|ادفع الآن/);
});

test('published-before-payment is an explicit server state, never a paid claim',async()=>{
 const h=accountActions({manual:true,pageStatus:'published'});
 const result=await h.runAccountAction('checkout.status',{}, {id:'owner'});
 assert.equal(result.state,'published_pending_payment');
 const html=resultScreen({...result,username:'actual-owner'});
 assert.match(html,/بنتواصل معك لإرسال فاتورة الاشتراك ورابط الدفع/);
 assert.match(html,/بانتظار السداد/);assert.match(html,/نسخ الرابط/);assert.doesNotMatch(html,/تم تفعيل اشتراكك ونشر/);
});
