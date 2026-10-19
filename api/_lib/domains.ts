import dns from 'dns/promises';
import { pool } from './db.js';
import { HttpError } from './http.js';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'onwan.link';

// Where a customer's domain must point. These are the hosting provider's
// (Vercel) published targets; override them if the hosting changes.
export const CNAME_TARGET = (process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'cname.vercel-dns.com').toLowerCase();
export const APEX_IP = process.env.CUSTOM_DOMAIN_APEX_IP || '76.76.21.21';

export function normalizeDomain(value: unknown) {
  const domain = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');

  const label = '[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?';

  if (!new RegExp(`^(${label}\\.)+[a-z]{2,}$`).test(domain) || domain.length > 253) {
    throw new HttpError(400, 'اكتب الدومين بهذا الشكل: link.example.org');
  }

  if (domain === ROOT_DOMAIN || domain.endsWith(`.${ROOT_DOMAIN}`) || domain.endsWith('.vercel.app')) {
    throw new HttpError(400, 'هذا الدومين غير مسموح. اكتب دومينًا تملكه جهتك.');
  }

  return domain;
}

// example.org is an apex (needs an A record); link.example.org and
// www.example.org are subdomains (CNAME). Two-part public suffixes such as
// .org.sa / .com.sa count as one.
export function isApexDomain(domain: string) {
  const parts = domain.split('.');
  const twoPartSuffix = /^(com|org|net|edu|gov|med|sch|pub)\.[a-z]{2}$/.test(parts.slice(-2).join('.'));

  return parts.length === (twoPartSuffix ? 3 : 2);
}

// The record the customer has to add at their DNS provider.
export function dnsInstruction(domain: string) {
  return isApexDomain(domain)
    ? { type: 'A', name: '@', value: APEX_IP }
    : { type: 'CNAME', name: domain.split('.')[0], value: CNAME_TARGET };
}

// DOMAIN-03: pointing the domain at us is the proof that the customer
// controls it.
export async function checkDns(domain: string) {
  try {
    if (isApexDomain(domain)) {
      return (await dns.resolve4(domain)).includes(APEX_IP);
    }

    const records = await dns.resolveCname(domain);
    return records.some((record) => record.toLowerCase().replace(/\.$/, '') === CNAME_TARGET);
  } catch {
    return false;
  }
}

// Attaches the domain to the hosting project so it is served with a
// certificate. Needs VERCEL_TOKEN and VERCEL_PROJECT_ID; without them the
// employee adds the domain in the hosting dashboard by hand.
export async function attachToHosting(domain: string): Promise<'attached' | 'not_configured'> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    return 'not_configured';
  }

  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
  const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains${team}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: domain }),
  });

  // 409: already attached to this project — fine.
  if (!response.ok && response.status !== 409) {
    const body = await response.json().catch(() => ({}));
    throw new HttpError(502, `تعذر ربط الدومين بالاستضافة: ${body?.error?.message ?? response.status}`);
  }

  return 'attached';
}

// The page name behind an active custom domain, or null.
export async function getUsernameByDomain(host: string) {
  const result = await pool.query<{ username: string }>(
    `select un.username from custom_domains d join usernames un on un.user_id = d.user_id
     where d.domain = $1 and d.status = 'active' limit 1`,
    [host.toLowerCase().replace(/^www\./, '')],
  );

  if (result.rows[0]) return result.rows[0].username;

  // www.example.org registered as such.
  const exact = await pool.query<{ username: string }>(
    `select un.username from custom_domains d join usernames un on un.user_id = d.user_id
     where d.domain = $1 and d.status = 'active' limit 1`,
    [host.toLowerCase()],
  );

  return exact.rows[0]?.username ?? null;
}
