import { escapeHtml } from './_lib/email';
import { allowMethods, handleApiError, sendJson } from './_lib/http';
import { getPublicPageByUsername, recordVisit } from './_lib/page';
import { normalizeUsername } from './_lib/username';
import { getUsernameByDomain } from './_lib/domains';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'onwan.link';

// The built SPA shell, fetched once per warm function from the main domain
// (a serverless function has no access to the static build output).
let cachedShell: { html: string; at: number } | null = null;

async function getShell() {
  if (cachedShell && Date.now() - cachedShell.at < 5 * 60 * 1000) {
    return cachedShell.html;
  }

  const response = await fetch(process.env.SPA_SHELL_URL || `https://${ROOT_DOMAIN}/index.html`);

  if (!response.ok) {
    throw new Error(`Failed to load SPA shell: ${response.status}`);
  }

  cachedShell = { html: await response.text(), at: Date.now() };
  return cachedShell.html;
}

// SEO-01/02: name.onwan.link/ is rewritten here (vercel.json) so crawlers and
// share previews get the entity's name, description and logo in the HTML
// itself. The page content is still rendered by the SPA.
async function sendHtml(res: any, username: string) {
  let shell = await getShell();
  const page = await getPublicPageByUsername(username);

  if (page?.state === 'published') {
    const { name, bio, profileImage } = page.pageData;
    const title = escapeHtml(name || username);
    const description = escapeHtml(bio || name || username);
    const url = `https://${username}.${ROOT_DOMAIN}`;
    const tags = [
      `<title>${title}</title>`,
      `<meta name="description" content="${description}" />`,
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:url" content="${url}" />`,
      profileImage ? `<meta property="og:image" content="${url}/api/public-page?username=${username}&amp;image=logo" />` : '',
      `<meta name="twitter:card" content="summary" />`,
    ].join('\n    ');

    shell = shell
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta name="description"[^>]*>/i, '')
      .replace('</head>', `    ${tags}\n  </head>`);
  } else {
    // Unpublished, suspended or unknown: nothing for a search engine to index.
    shell = shell.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
  }

  res.status(page ? 200 : 404).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  res.send(shell);
}

// The logo as a real image URL: share previews cannot use an inline data URL.
async function sendLogo(res: any, username: string) {
  const page = await getPublicPageByUsername(username);
  const image = page?.state === 'published' ? page.pageData.profileImage : '';
  const inline = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i.exec(image);

  if (inline) {
    res.status(200).setHeader('Content-Type', inline[1]);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(Buffer.from(inline[2], 'base64'));
    return;
  }

  if (/^https:\/\//i.test(image)) {
    res.status(302).setHeader('Location', image);
    res.send('');
    return;
  }

  sendJson(res, 404, { error: 'No image' });
}

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET'])) {
    return;
  }

  try {
    // DOMAIN-03: a page opened on the entity's own domain is looked up by host.
    const host = String(req.query.host ?? '').toLowerCase();
    const username = host
      ? (await getUsernameByDomain(host)) ?? ''
      : normalizeUsername(String(req.query.username ?? ''));

    if (host && !username) {
      sendJson(res, 404, { error: 'Page not found' });
      return;
    }

    if (!username) {
      sendJson(res, 400, { error: 'Username is required' });
      return;
    }

    if (req.query.render === 'html') {
      await sendHtml(res, username);
      return;
    }

    if (req.query.image === 'logo') {
      await sendLogo(res, username);
      return;
    }

    const page = await getPublicPageByUsername(username);

    if (!page) {
      sendJson(res, 404, { error: 'Page not found' });
      return;
    }

    if (page.state === 'moved') {
      sendJson(res, 200, { movedTo: page.username });
      return;
    }

    if (page.state === 'suspended') {
      sendJson(res, 200, { suspended: true, message: page.message });
      return;
    }

    // PAGE-15. A failed count must never fail the page.
    await recordVisit(page.pageId).catch((error) => console.error('Failed to record visit:', error));

    sendJson(res, 200, { pageData: page.pageData });
  } catch (error) {
    handleApiError(res, error);
  }
}
