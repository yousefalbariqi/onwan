const fs = require('node:fs');
const { buildSync } = require('esbuild');
const { Pool } = require('pg');
const compiled = buildSync({ entryPoints: ['shared/themeLibrary.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const m = { exports: {} }; new Function('module', 'exports', compiled)(m, m.exports);
const { LIBRARY_THEMES } = m.exports;
const env = fs.readFileSync('.env.local', 'utf8');
const line = env.match(/^DATABASE_URL\s*=\s*(.+)$/m);
const connectionString = process.env.DATABASE_URL || line?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
if (!connectionString) throw Error('DATABASE_URL is not configured');
const url = new URL(connectionString);
const pool = new Pool({ connectionString, ssl: ['localhost', '127.0.0.1'].includes(url.hostname) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000, max: 1 });
(async () => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('onwan-theme-library-v1'))");
    const ids = LIBRARY_THEMES.map(t => t.design.theme.id);
    const before = await client.query("select id,name,status,design,design->'theme'->>'id' as design_id from page_templates where design->'theme'->>'id' = any($1::text[])", [ids]);
    if (!process.argv.includes('--publish')) {
      console.log(JSON.stringify({ totalExpected: 96, existing: before.rows.length, visible: before.rows.filter(t => t.status === 'visible').length, missing: 96 - new Set(before.rows.map(t => t.design_id)).size }));
      await client.query('rollback'); return;
    }
    let added = 0;
    const existing = new Set(before.rows.map(t => t.design_id));
    for (const theme of LIBRARY_THEMES) {
      if (existing.has(theme.design.theme.id)) continue;
      await client.query("insert into page_templates (name,category,status,design) values ($1,$2,'visible',$3::jsonb)", [theme.name, theme.category, JSON.stringify(theme.design)]);
      added++;
    }
    if (process.argv.includes('--repair-contrast')) {
      const luminance = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const ratio = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
      for (const row of before.rows) {
        if (!row.design_id.startsWith('library-')) continue;
        const seed = LIBRARY_THEMES.find(t=>t.design.theme.id===row.design_id);
        const theme = row.design.theme;
        if (theme.background !== seed.design.theme.background) continue;
        const bg = row.design.buttonStyle.border ? theme.background : theme.buttonColor;
        const fg = row.design.buttonStyle.border ? theme.buttonColor : theme.buttonTextColor;
        if (ratio(fg,bg)>=4.5) continue;
        row.design.theme = { ...theme, buttonColor: seed.design.theme.buttonColor, buttonTextColor: seed.design.theme.buttonTextColor };
        await client.query('update page_templates set design=$2::jsonb,updated_at=now() where id=$1', [row.id,JSON.stringify(row.design)]);
      }
    }
    await client.query("update page_templates set status='visible',updated_at=now() where design->'theme'->>'id'=any($1::text[]) and status<>'visible'", [ids]);
    const verification = await client.query("select category,count(*)::int as total,count(*) filter(where status='visible')::int as visible from page_templates where design->'theme'->>'id'=any($1::text[]) group by category order by category", [ids]);
    if (verification.rows.length !== 12 || verification.rows.some(r => r.total !== 8 || r.visible !== 8)) throw Error('Library verification failed; rolling back');
    await client.query('commit');
    console.log(JSON.stringify({ added, total: 96, visible: 96, categories: verification.rows }, null, 2));
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); await pool.end(); }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
