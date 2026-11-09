const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { generateKeyPairSync, verify } = require('node:crypto');
test('Google Wallet uses saved identity, a stable object, verified issuance and a signed native QR pass', async () => {
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  process.env.GOOGLE_WALLET_SERVICE_ACCOUNT=JSON.stringify({type:'service_account',client_email:'wallet@example.test',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
  process.env.GOOGLE_WALLET_ISSUER_ID='123'; process.env.GOOGLE_WALLET_CLASS_ID='123.class';
  const built=await build({entryPoints:['api/_lib/googleWallet.ts'],bundle:true,platform:'node',format:'cjs',write:false});
  const module={exports:{}}; new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);
  const api=module.exports, oldFetch=global.fetch, calls=[];
  let fail=false;
  global.fetch=async(url,options={})=>{
    calls.push({url,options});
    if(url.includes('oauth2'))return Response.json({access_token:'test-token',expires_in:3600});
    if(!options.method)return new Response('',{status:404});
    return Response.json(fail?{}:{id:'123.onwan_page_1'},{status:fail?403:200});
  };
  try{
    const page={name:'جمعية اختبار',username:'association',profileImage:'/media/files/owner/logo.png'};
    const object=api.buildGoogleObject('page-1',page,'#ff6b2c');
    assert.equal(object.id,'123.onwan_page-1'); assert.equal(object.header.defaultValue.value,page.name);
    assert.equal(object.logo.sourceUri.uri,'https://onwan.link'+page.profileImage);
    assert.equal(object.barcode.value,'https://association.onwan.link'); assert.equal(object.barcode.type,'QR_CODE');
    assert.equal(api.buildGoogleObject('page-1',{...page,username:'renamed'}).id,object.id);
    const link=await api.issueGoogleWallet('page-1',page);
    const [header,payload,sig]=link.split('/save/')[1].split('.');
    assert.ok(verify('RSA-SHA256',Buffer.from(header+'.'+payload),publicKey,Buffer.from(sig,'base64url')));
    assert.equal(JSON.parse(Buffer.from(payload,'base64url')).payload.genericObjects[0].id,object.id);
    assert.ok(calls.some(c=>c.options.method==='POST'&&c.url.endsWith('/genericObject')));
    fail=true; await assert.rejects(api.issueGoogleWallet('page-1',page),/تعذر تجهيز/);
    await assert.rejects(api.existingGoogleSaveLink('123.absent'),/لم يتم تجهيز/);
  } finally {global.fetch=oldFetch;delete process.env.GOOGLE_WALLET_SERVICE_ACCOUNT;}
});
