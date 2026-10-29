import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
const env = Object.fromEntries(readFileSync('.dev.vars','utf8').split('\n').map(l=>{const i=l.indexOf('=');return i<1?null:[l.slice(0,i),l.slice(i+1)];}).filter(Boolean));
const secret = env.SESSION_SECRET;
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const u = (await c.query("select id, email, session_version from users where email='yousefalbariqi2@gmail.com' or id in (select user_id from usernames where username='albariqi') limit 1")).rows[0]
       || (await c.query("select u.id, u.email, u.session_version from users u join usernames n on n.user_id=u.id where n.username='albariqi' limit 1")).rows[0];
await c.end();
if(!u){ console.log('user not found'); process.exit(0); }
const b64 = s => Buffer.from(s).toString('base64url');
const payload = b64(JSON.stringify({ userId: u.id, email: u.email, exp: Date.now()+3600000, sessionVersion: u.session_version ?? 0 }));
const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
const tokenB = `${payload}.${sig}`;
for (const host of ['nonprofit.onwan.link']) {
  const r = await fetch(`https://${host}/api/wallet-pass`, { headers: { Authorization: `Bearer ${tokenB}` } });
  const ct = r.headers.get('content-type')||'';
  const body = ct.includes('json') ? JSON.stringify(await r.json()) : `[${ct}] ${r.headers.get('content-length')||'?'} bytes`;
  console.log(`${host} → ${r.status}  ${body}`);
}
