import { getEnv, requestRuntime } from './runtime.js';

// REQ-021: a public page is answered from a ready copy for 60 seconds instead
// of being rebuilt from the database for every visitor; publishing drops the
// copy. The Cache API is per Cloudflare data centre: this drops the copy where
// the owner published at once; with CF_ZONE_ID + CF_PURGE_TOKEN set it is
// purged everywhere, otherwise other data centres refresh within 60 seconds.
export const PUBLIC_CACHE_SECONDS = 60;

const edgeCache = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;

function rootDomain() {
  return getEnv('ROOT_DOMAIN') || 'onwan.link';
}

// Every address under which this page's public data or HTML is served.
export function publicPageUrls(username: string) {
  const root = rootDomain();
  return [
    `https://${username}.${root}/`,
    `https://${username}.${root}/api/public-page?username=${username}`,
    `https://${root}/api/public-page?username=${username}`,
  ];
}

export async function purgePublicPage(username: string | null | undefined) {
  if (!username || !requestRuntime()) return;
  const urls = publicPageUrls(username);
  const cache = edgeCache();
  if (cache) await Promise.all(urls.map((url) => cache.delete(new Request(url)).catch(() => false)));
  const zone = getEnv('CF_ZONE_ID');
  const token = getEnv('CF_PURGE_TOKEN');
  if (zone && token) {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: urls }),
    }).catch(() => undefined);
  }
}

export { edgeCache };
