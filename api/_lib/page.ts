import { getEnv } from './runtime.js';
import { BACKGROUND_VIDEO_TYPES, MAX_BACKGROUND_VIDEO_BYTES, parseVideoSource, parseYouTubeVideoSource } from '../../shared/videoSources.js';
import { arrangeSections, visibleSectionItems } from '../../shared/linkSections.js';
import { PoolClient } from 'pg';
import { pool } from './db.js';
import { HttpError } from './http.js';

type PageRecord = {
  id: string;
  user_id: string;
  display_name: string | null;
  bio: string | null;
  profile_image_url: string | null;
  theme_json: Record<string, unknown> | null;
  wallpaper_json: Record<string, unknown> | null;
  button_style_json: Record<string, unknown> | null;
  profile_style_json: Record<string, unknown> | null;
  custom_colors_json: Record<string, unknown> | null;
  extracted_colors_json: string[] | null;
  typography_json: Record<string, unknown> | null;
  contact_phone: string | null;
  contact_email: string | null;
  translations_json: Record<string, any> | null;
  status: 'draft' | 'published' | 'suspended';
  suspension_message: string | null;
  username: string | null;
};

type LinkRecord = {
  id: string;
  title: string;
  url: string;
  link_type: 'url' | 'file' | null;
  file_category: 'cv' | 'menu' | 'other' | null;
  file_name: string | null;
  file_mime_type: string | null;
  file_size: number | null;
  platform: string | null;
  sort_order: number;
  icon_style: 'color' | 'mono' | null;
  text_position: 'center' | 'right' | null;
  is_hidden: boolean;
  title_en: string | null;
  custom_icon: string | null;
  display_json: Record<string, any> | null;
};

// PAGE-04 / AC-02.03
export const MAX_LINKS = 20;

// FILE-01 / AC-03.01: images and PDF only. Files are still stored inline as
// data URLs; the real storage backend and its limits are pending decision P-02.
const ALLOWED_FILE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

// The contact card (VCF, SHARE-02) carries the phone and email the account
// signed up with (owner decision, 15 Oct 2026); pages.contact_* are no longer read.
const PAGE_COLUMNS = `
  p.id,
  p.user_id,
  p.display_name,
  p.bio,
  p.profile_image_url,
  p.theme_json,
  p.wallpaper_json,
  p.button_style_json,
  p.profile_style_json,
  p.custom_colors_json,
  p.extracted_colors_json,
  p.typography_json,
  owner.phone as contact_phone,
  owner.email as contact_email,
  p.translations_json,
  p.status,
  p.suspension_message,
  u.username
`;

const LINK_COLUMNS = `
  id,
  title,
  url,
  link_type,
  file_category,
  file_name,
  file_mime_type,
  file_size,
  platform,
  sort_order,
  icon_style,
  text_position,
  is_hidden,
  title_en,
  custom_icon,
  display_json
`;

const DEFAULT_THEME = {
  id: 'minimal',
  name: 'Minimal',
  background: '#ffffff',
  buttonColor: '#000000',
  buttonTextColor: '#ffffff',
  textColor: '#000000',
};

export const DEFAULT_PAGE_DATA = {
  username: '',
  profileImage: '',
  name: '',
  bio: '',
  links: [] as any[],
  theme: DEFAULT_THEME,
  wallpaper: {
    type: 'color',
    value: '#ffffff',
  },
  buttonStyle: {
    shape: 'rounded',
    border: false,
    shadow: true,
    customColor: undefined,
    useCustomColor: false,
  },
  profileStyle: {
    type: 'circle',
  },
  typography: {},
  customColors: undefined,
  extractedColors: [] as string[],
};

export async function ensurePageForUser(userId: string, client?: PoolClient) {
  const queryable = client ?? pool;

  await queryable.query(
    `
      insert into pages (
        user_id,
        display_name,
        bio,
        profile_image_url,
        theme_json,
        wallpaper_json,
        button_style_json,
        profile_style_json,
        custom_colors_json,
        extracted_colors_json
      )
      values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
      on conflict (user_id) do nothing
    `,
    [
      userId,
      DEFAULT_PAGE_DATA.name,
      DEFAULT_PAGE_DATA.bio,
      DEFAULT_PAGE_DATA.profileImage,
      JSON.stringify(DEFAULT_PAGE_DATA.theme),
      JSON.stringify(DEFAULT_PAGE_DATA.wallpaper),
      JSON.stringify(DEFAULT_PAGE_DATA.buttonStyle),
      JSON.stringify(DEFAULT_PAGE_DATA.profileStyle),
      JSON.stringify(DEFAULT_PAGE_DATA.customColors ?? {}),
      JSON.stringify(DEFAULT_PAGE_DATA.extractedColors),
    ],
  );
}

async function loadLinks(pageId: string, includeHidden: boolean) {
  const linksResult = await pool.query<LinkRecord>(
    `
      select ${LINK_COLUMNS}
      from page_links
      where page_id = $1 ${includeHidden ? '' : 'and is_hidden = false'}
      order by sort_order asc, id asc
    `,
    [pageId],
  );

  return linksResult.rows;
}

// Owner view: includes hidden buttons.
export async function getPageDataByUserId(userId: string) {
  const pageResult = await pool.query<PageRecord>(
    `
      select ${PAGE_COLUMNS}
      from pages p
      join users owner on owner.id = p.user_id
      left join customer_names u on u.user_id = p.user_id
      where p.user_id = $1
      limit 1
    `,
    [userId],
  );

  const page = pageResult.rows[0];

  if (!page) {
    return null;
  }

  return mapPage(page, await loadLinks(page.id, true));
}

export type PublicPageResult =
  | { state: 'published'; pageId: string; pageData: ReturnType<typeof mapPage> }
  | { state: 'suspended'; pageId: string; message: string }
  | { state: 'moved'; username: string };

// Visitor view. A draft (unpaid) page and a banned account do not exist for the
// public (ACCT-02, AC-01.03); a suspended page shows only the administration's
// message (SUB-07, MOD-05); hidden buttons are never sent (PAGE-06).
export async function getPublicPageByUsername(username: string): Promise<PublicPageResult | null> {
  const pageResult = await pool.query<PageRecord>(
    `
      select ${PAGE_COLUMNS}
      from usernames u
      join pages p on p.user_id = u.user_id
      join users owner on owner.id = u.user_id
      where u.username = $1 and owner.status = 'active' and p.status <> 'draft'
      limit 1
    `,
    [username],
  );

  const page = pageResult.rows[0];

  if (!page) {
    // DOMAIN-02: for 30 days the old name forwards to the new one.
    const redirect = await pool.query<{ username: string }>(
      `select u.username from username_redirects r
       join usernames u on u.user_id = r.user_id
       where r.old_username = $1 and r.expires_at > now() limit 1`,
      [username],
    );

    return redirect.rows[0] ? { state: 'moved', username: redirect.rows[0].username } : null;
  }

  if (page.status === 'suspended') {
    return {
      state: 'suspended',
      pageId: page.id,
      message: page.suspension_message || 'هذه الصفحة متوقفة مؤقتًا.',
    };
  }

  return {
    state: 'published',
    pageId: page.id,
    pageData: mapPage(page, await loadLinks(page.id, true), false),
  };
}

function normalizeLinkUrl(rawUrl: string, title: string) {
  const value = rawUrl.trim();

  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) {
    return value;
  }

  // Any other scheme (javascript:, data:, ...) must not end up in a public href.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw new HttpError(400, `رابط الزر «${title}» غير مسموح. استخدم رابطًا يبدأ بـ https://`);
  }

  return `https://${value}`;
}

function validateImageValue(value: unknown, label: string) {
  const image = String(value ?? '').trim();

  if (image && !/^(data:image\/(png|jpeg|webp|gif);base64,|https:\/\/)/i.test(image)) {
    throw new HttpError(400, `${label} يجب أن تكون صورة (PNG أو JPG أو WebP أو GIF).`);
  }

  return image;
}

// A link's own icon: a library id, or a small uploaded image (cropped to a
// square in the editor, so 200 KB is generous).
const MAX_CUSTOM_ICON_LENGTH = 200_000;

function normalizeCustomIcon(value: unknown, title: string) {
  const icon = String(value ?? '').trim();
  if (!icon) return null;
  if (/^icon:[a-z0-9-]{1,30}$/.test(icon)) return icon;
  if (/^data:image\/(png|jpeg|webp);base64,/i.test(icon) && icon.length <= MAX_CUSTOM_ICON_LENGTH) return icon;
  throw new HttpError(400, `أيقونة الزر «${title}» غير صالحة. استخدم صورة صغيرة (PNG أو JPG أو WebP).`);
}

function normalizeLinkDisplay(value: any, title: string): { kind?: 'heading' | 'video' | 'text'; body?: string; bodyEn?: string; sectionLayout?: 'list' | 'grid' | 'carousel'; sectionId?: string; layout?: 'card'; image?: string; imageFit?: 'cover' | 'contain'; positionX?: number; positionY?: number } {
  const sectionId = typeof value?.sectionId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value.sectionId) ? value.sectionId : undefined;
  if (value?.kind === 'text') {
    const body = String(value.body ?? '').trim();
    const bodyEn = String(value.bodyEn ?? '').trim();
    if (!body || body.length > 2000 || bodyEn.length > 2000) throw new HttpError(400, 'اكتب نص الفقرة بما لا يتجاوز 2000 حرف لكل لغة.');
    return { kind: 'text', body, ...(bodyEn ? { bodyEn } : {}), ...(sectionId ? { sectionId } : {}) };
  }
  if (value?.kind === 'video') return { kind: 'video', ...(sectionId ? { sectionId } : {}) };
  if (value?.kind === 'heading') return { kind: 'heading', ...(sectionId ? { sectionId, sectionLayout: value.sectionLayout === 'grid' || value.sectionLayout === 'carousel' ? value.sectionLayout : 'list' } : {}) };
  if (!value || typeof value !== 'object') return {};
  const image = validateImageValue(value.image, `صورة بطاقة «${title}»`);
  if (image.length > 2_000_000) throw new HttpError(400, 'صورة البطاقة كبيرة جدًا. استخدم صورة أصغر.');
  if (value.layout === 'card' && !image) throw new HttpError(400, `أرفق صورة للبطاقة «${title}».`);
  const position = (input: unknown) => typeof input === 'number' && Number.isFinite(input) ? Math.min(100, Math.max(0, input)) : 50;
  return {
    ...(sectionId ? { sectionId } : {}),
    ...(value.layout === 'card' ? { layout: 'card' } : {}),
    ...(image ? { image, imageFit: value.imageFit === 'contain' ? 'contain' : 'cover', positionX: position(value.positionX), positionY: position(value.positionY) } : {}),
  };
}

function normalizeLinks(rawLinks: unknown) {
  const links = Array.isArray(rawLinks) ? rawLinks : [];

  if (links.length > MAX_LINKS) {
    throw new HttpError(400, `الحد الأقصى ${MAX_LINKS} زرًا في الصفحة.`);
  }

  return arrangeSections(links.map((link: any) => {
    const title = String(link.title ?? '').trim();
    const url = String(link.url ?? '').trim();
    const isFile = link.linkType === 'file';
    const common = {
      id: String(link.id ?? ''),
      titleEn: String(link.titleEn ?? '').trim().slice(0, 255) || null,
      customIcon: normalizeCustomIcon(link.customIcon, title),
      display: normalizeLinkDisplay(link.display, title),
    };

    if (!title || title.length > 120) throw new HttpError(400, 'اكتب عنوانًا لا يتجاوز 120 حرفًا.');
    if (common.display.kind === 'heading' || common.display.kind === 'text') return {
      ...common, title, url: '', linkType: 'url', fileCategory: null, fileName: null, fileMimeType: null,
      fileSize: null, platform: 'custom', iconStyle: 'color', textPosition: 'right', hidden: Boolean(link.hidden), customIcon: null,
    };
    if (!url) {
      throw new HttpError(400, 'كل زر يحتاج عنوانًا ورابطًا أو ملفًا.');
    }

    if (common.display.kind === 'video' && !parseYouTubeVideoSource(url)) throw new HttpError(400, `رابط الفيديو «${title}» غير مدعوم. استخدم رابط فيديو يوتيوب محددًا.`);
    if (isFile && common.display.kind === 'video') throw new HttpError(400, 'أضف الفيديو برابط تشغيل، وليس كملف مرفق.');
    if (isFile) {
      const mimeType = /^data:([^;,]+);base64,/i.exec(url)?.[1]?.toLowerCase() ?? '';

      if (!ALLOWED_FILE_MIME_TYPES.includes(mimeType)) {
        throw new HttpError(400, `ملف الزر «${title}» غير مدعوم. المسموح: الصور وملفات PDF فقط.`);
      }

      return {
        ...common,
        title,
        url,
        linkType: 'file',
        fileCategory: ['cv', 'menu', 'other'].includes(String(link.fileCategory)) ? link.fileCategory : 'other',
        fileName: link.fileName ? String(link.fileName).trim() : null,
        fileMimeType: mimeType,
        fileSize: Number.isFinite(Number(link.fileSize)) ? Number(link.fileSize) : null,
        platform: 'file',
        iconStyle: link.iconStyle ?? 'color',
        textPosition: link.textPosition ?? 'center',
        hidden: Boolean(link.hidden),
      };
    }

    return {
      ...common,
      title,
      url: normalizeLinkUrl(url, title),
      linkType: 'url',
      fileCategory: null,
      fileName: null,
      fileMimeType: null,
      fileSize: null,
      platform: link.platform ?? 'custom',
      iconStyle: link.iconStyle ?? 'color',
      textPosition: link.textPosition ?? 'center',
      hidden: Boolean(link.hidden),
    };
  }));
}

// The review queue keeps what was published, without megabytes of inline
// file bodies.
function buildReviewSnapshot(pageData: any, links: ReturnType<typeof normalizeLinks>) {
  const trim = (value: unknown) => {
    const text = String(value ?? '');
    return text.startsWith('data:') ? `[ملف مضمّن ${text.slice(5, text.indexOf(';'))}]` : text;
  };

  return {
    name: pageData.name ?? '',
    bio: pageData.bio ?? '',
    profileImage: trim(pageData.profileImage),
    wallpaper: { ...(pageData.wallpaper ?? {}), value: trim(pageData.wallpaper?.value), ...(pageData.wallpaper?.poster ? { poster: trim(pageData.wallpaper.poster) } : {}) },
    contactPhone: pageData.contactPhone ?? '',
    contactEmail: pageData.contactEmail ?? '',
    translations: pageData.translations ?? {},
    links: links.map((link) => ({
      title: link.title,
      titleEn: link.titleEn,
      url: trim(link.url),
      linkType: link.linkType,
      fileName: link.fileName,
      fileSize: link.fileSize,
      customIcon: link.customIcon ? trim(link.customIcon) : undefined,
      display: { ...link.display, ...('image' in link.display ? { image: trim(link.display.image) } : {}) },
      hidden: link.hidden,
    })),
  };
}

// PAGE-16: a manually entered English name and description.
function normalizeTranslations(value: any) {
  const en = value?.en ?? {};
  const name = String(en.name ?? '').trim().slice(0, 255);
  const bio = String(en.bio ?? '').trim().slice(0, 500);

  return name || bio ? { en: { name, bio } } : {};
}

// FILE-02 / PERM-19: what leaves the page is archived, not destroyed.
export async function archiveLinks(client: PoolClient | typeof pool, pageId: string, linkIds: string[] | null, deletedBy: string) {
  await client.query(
    `insert into deleted_links (page_id, link_json, deleted_by)
     select page_id, to_jsonb(l) - 'page_id', $3
     from page_links l
     where l.page_id = $1 and ($2::uuid[] is null or l.id = any($2::uuid[]))`,
    [pageId, linkIds, deletedBy],
  );
}

// PAGE-07: this is the explicit «حفظ». It publishes the edit and (PAGE-01,
// MOD-01) queues it for the administration's later review. A save made by an
// employee on the customer's behalf (PERM-01) is recorded as already reviewed.
export async function savePageData(userId: string, pageData: any, options: { staffName?: string } = {}) {
  const links = normalizeLinks(pageData.links);
  const profileImage = validateImageValue(pageData.profileImage, 'الصورة / الشعار');
  const wallpaper = { ...(pageData.wallpaper ?? DEFAULT_PAGE_DATA.wallpaper) };

  if (wallpaper.type === 'video') {
    if (!parseVideoSource(String(wallpaper.value ?? ''), true)) throw new HttpError(400, 'خلفية الفيديو تحتاج رابط HTTPS مباشرًا لملف MP4 أو WebM.');
    if (wallpaper.poster) validateImageValue(wallpaper.poster, 'الصورة البديلة للفيديو');
    if (wallpaper.uploaded) {
      const url = new URL(String(wallpaper.value));
      if (!url.hostname.endsWith('.public.blob.vercel-storage.com') || !url.pathname.startsWith(`/wallpapers/${userId}/`)) throw new HttpError(403, 'فيديو الخلفية لا يتبع ملفات حسابك.');
      const { head } = await import('@vercel/blob');
      const file = await head(url.href, { token: getEnv('BLOB_READ_WRITE_TOKEN') });
      if (file.size > MAX_BACKGROUND_VIDEO_BYTES || !BACKGROUND_VIDEO_TYPES.includes(file.contentType)) throw new HttpError(400, 'فيديو الخلفية يجب أن يكون MP4 أو WebM بحجم لا يتجاوز 20 MB.');
      wallpaper.fileSize = file.size;
    }

  }
  if (wallpaper.type === 'image') {
    validateImageValue(wallpaper.value, 'صورة الخلفية');
  }

  const client = await pool.connect();

  try {
    await client.query('begin');
    await ensurePageForUser(userId, client);

    const pageResult = await client.query<{ id: string }>(
      `
        update pages
        set
          display_name = $2,
          bio = $3,
          profile_image_url = $4,
          theme_json = $5::jsonb,
          wallpaper_json = $6::jsonb,
          button_style_json = $7::jsonb,
          profile_style_json = $8::jsonb,
          custom_colors_json = $9::jsonb,
          extracted_colors_json = $10::jsonb,
          typography_json = $11::jsonb,
          translations_json = $12::jsonb,
          updated_at = now()
        where user_id = $1
        returning id
      `,
      [
        userId,
        String(pageData.name ?? '').trim(),
        String(pageData.bio ?? '').trim(),
        profileImage,
        JSON.stringify(pageData.theme ?? DEFAULT_PAGE_DATA.theme),
        JSON.stringify(wallpaper),
        JSON.stringify(pageData.buttonStyle ?? DEFAULT_PAGE_DATA.buttonStyle),
        JSON.stringify(pageData.profileStyle ?? DEFAULT_PAGE_DATA.profileStyle),
        JSON.stringify(pageData.customColors ?? {}),
        JSON.stringify(pageData.extractedColors ?? []),
        JSON.stringify(pageData.typography ?? {}),
        JSON.stringify(normalizeTranslations(pageData.translations)),
      ],
    );

    const pageId = pageResult.rows[0]?.id;

    if (!pageId) {
      throw new Error('Page not found');
    }

    // Buttons the editor no longer sends were deleted by this save.
    const keptIds = links.map((link) => link.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    const removed = await client.query<{ id: string }>(
      'select id from page_links where page_id = $1 and not (id = any($2::uuid[]))',
      [pageId, keptIds],
    );

    if (removed.rowCount) {
      await archiveLinks(client, pageId, removed.rows.map((row) => row.id), options.staffName ?? 'العميل');
    }

    await client.query('delete from page_links where page_id = $1', [pageId]);

    // One round trip for every button (instead of one per button): a saved
    // page has up to MAX_LINKS of them and each trip to the database adds latency.
    if (links.length) {
      await client.query(
        `
          insert into page_links (
            page_id, title, url, link_type, file_category, file_name, file_mime_type, file_size,
            platform, sort_order, icon_style, text_position, is_hidden, title_en, custom_icon, display_json
          )
          select $1, r.title, r.url, r.link_type, r.file_category, r.file_name, r.file_mime_type, r.file_size,
                 r.platform, r.sort_order, r.icon_style, r.text_position, r.is_hidden, r.title_en, r.custom_icon, r.display_json
          from jsonb_to_recordset($2::jsonb) as r(
            title text, url text, link_type text, file_category text, file_name text, file_mime_type text,
            file_size integer, platform text, sort_order integer, icon_style text, text_position text,
            is_hidden boolean, title_en text, custom_icon text, display_json jsonb
          )
        `,
        [
          pageId,
          JSON.stringify(
            links.map((link, index) => ({
              title: link.title,
              url: link.url,
              link_type: link.linkType,
              file_category: link.fileCategory,
              file_name: link.fileName,
              file_mime_type: link.fileMimeType,
              file_size: link.fileSize,
              platform: link.platform,
              sort_order: index,
              icon_style: link.iconStyle,
              text_position: link.textPosition,
              is_hidden: link.hidden,
              title_en: link.titleEn,
              custom_icon: link.customIcon,
              display_json: link.display ?? null,
            })),
          ),
        ],
      );
    }

    await client.query(
      `insert into content_reviews (page_id, snapshot_json, status, reviewed_by, reviewed_at)
       values ($1, $2::jsonb, $3, $4, $5)`,
      [
        pageId,
        JSON.stringify(buildReviewSnapshot(pageData, links)),
        options.staffName ? 'accepted' : 'pending',
        options.staffName ?? null,
        options.staffName ? new Date() : null,
      ],
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return getPageDataByUserId(userId);
}

function mapPage(page: PageRecord, links: LinkRecord[], includeHidden = true) {
  return {
    username: page.username ?? '',
    profileImage: page.profile_image_url || '',
    name: page.display_name || '',
    bio: page.bio || '',
    contactPhone: page.contact_phone || '',
    contactEmail: page.contact_email || '',
    translations: page.translations_json || {},
    links: (includeHidden ? arrangeSections : visibleSectionItems)(links.map((link) => ({
      id: link.id,
      title: link.title,
      url: link.url,
      linkType: link.link_type || 'url',
      fileCategory: link.file_category || undefined,
      fileName: link.file_name || undefined,
      fileMimeType: link.file_mime_type || undefined,
      fileSize: link.file_size || undefined,
      platform: link.platform || 'custom',
      iconStyle: link.icon_style || 'color',
      textPosition: link.text_position || 'center',
      hidden: link.is_hidden,
      titleEn: link.title_en || undefined,
      customIcon: link.custom_icon || undefined,
      display: link.display_json || {},
    }))),
    theme: page.theme_json || DEFAULT_PAGE_DATA.theme,
    wallpaper: page.wallpaper_json || DEFAULT_PAGE_DATA.wallpaper,
    buttonStyle: page.button_style_json || DEFAULT_PAGE_DATA.buttonStyle,
    profileStyle: page.profile_style_json || DEFAULT_PAGE_DATA.profileStyle,
    typography: page.typography_json || {},
    customColors:
      page.custom_colors_json && Object.keys(page.custom_colors_json).length > 0
        ? page.custom_colors_json
        : undefined,
    extractedColors: page.extracted_colors_json || [],
  };
}

// PAGE-15: one visit per public load of a published page.
export async function recordVisit(pageId: string) {
  await pool.query(
    `insert into page_visits_daily (page_id, day, views) values ($1, current_date, 1)
     on conflict (page_id, day) do update set views = page_visits_daily.views + 1`,
    [pageId],
  );
}

export async function getVisitStats(userId: string) {
  const result = await pool.query<{ total: number; last30: number }>(
    `select coalesce(sum(v.views), 0)::int as total,
            coalesce(sum(v.views) filter (where v.day > current_date - 30), 0)::int as last30
     from page_visits_daily v join pages p on p.id = v.page_id
     where p.user_id = $1`,
    [userId],
  );

  return result.rows[0];
}
