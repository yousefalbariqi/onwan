import { PoolClient } from 'pg';
import { pool } from './db';
import { HttpError } from './http';

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
};

// PAGE-04 / AC-02.03
export const MAX_LINKS = 20;

// FILE-01 / AC-03.01: images and PDF only. Files are still stored inline as
// data URLs; the real storage backend and its limits are pending decision P-02.
const ALLOWED_FILE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

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
  p.contact_phone,
  p.contact_email,
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
  is_hidden
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
      left join usernames u on u.user_id = p.user_id
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
    pageData: mapPage(page, await loadLinks(page.id, false)),
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

function normalizeLinks(rawLinks: unknown) {
  const links = Array.isArray(rawLinks) ? rawLinks : [];

  if (links.length > MAX_LINKS) {
    throw new HttpError(400, `الحد الأقصى ${MAX_LINKS} زرًا في الصفحة.`);
  }

  return links.map((link: any) => {
    const title = String(link.title ?? '').trim();
    const url = String(link.url ?? '').trim();
    const isFile = link.linkType === 'file';

    if (!title || !url) {
      throw new HttpError(400, 'كل زر يحتاج عنوانًا ورابطًا أو ملفًا.');
    }

    if (isFile) {
      const mimeType = /^data:([^;,]+);base64,/i.exec(url)?.[1]?.toLowerCase() ?? '';

      if (!ALLOWED_FILE_MIME_TYPES.includes(mimeType)) {
        throw new HttpError(400, `ملف الزر «${title}» غير مدعوم. المسموح: الصور وملفات PDF فقط.`);
      }

      return {
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
  });
}

function normalizeContactEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'بريد التواصل غير صالح.');
  }

  return email || null;
}

function normalizeContactPhone(value: unknown) {
  const phone = String(value ?? '').replace(/[^\d+]/g, '');

  if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) {
    throw new HttpError(400, 'رقم التواصل غير صالح.');
  }

  return phone || null;
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
    wallpaper: { ...(pageData.wallpaper ?? {}), value: trim(pageData.wallpaper?.value) },
    contactPhone: pageData.contactPhone ?? '',
    contactEmail: pageData.contactEmail ?? '',
    links: links.map((link) => ({
      title: link.title,
      url: trim(link.url),
      linkType: link.linkType,
      fileName: link.fileName,
      fileSize: link.fileSize,
      hidden: link.hidden,
    })),
  };
}

// PAGE-07: this is the explicit «حفظ». It publishes the edit and (PAGE-01,
// MOD-01) queues it for the administration's later review.
export async function savePageData(userId: string, pageData: any) {
  const links = normalizeLinks(pageData.links);
  const profileImage = validateImageValue(pageData.profileImage, 'الصورة / الشعار');
  const wallpaper = pageData.wallpaper ?? DEFAULT_PAGE_DATA.wallpaper;

  if (wallpaper.type === 'image') {
    validateImageValue(wallpaper.value, 'صورة الخلفية');
  }

  const contactPhone = normalizeContactPhone(pageData.contactPhone);
  const contactEmail = normalizeContactEmail(pageData.contactEmail);

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
          contact_phone = $12,
          contact_email = $13,
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
        contactPhone,
        contactEmail,
      ],
    );

    const pageId = pageResult.rows[0]?.id;

    if (!pageId) {
      throw new Error('Page not found');
    }

    await client.query('delete from page_links where page_id = $1', [pageId]);

    for (const [index, link] of links.entries()) {
      await client.query(
        `
          insert into page_links (
            page_id,
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
            is_hidden
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          pageId,
          link.title,
          link.url,
          link.linkType,
          link.fileCategory,
          link.fileName,
          link.fileMimeType,
          link.fileSize,
          link.platform,
          index,
          link.iconStyle,
          link.textPosition,
          link.hidden,
        ],
      );
    }

    await client.query(
      'insert into content_reviews (page_id, snapshot_json) values ($1, $2::jsonb)',
      [pageId, JSON.stringify(buildReviewSnapshot(pageData, links))],
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

function mapPage(page: PageRecord, links: LinkRecord[]) {
  return {
    username: page.username ?? '',
    profileImage: page.profile_image_url || '',
    name: page.display_name || '',
    bio: page.bio || '',
    contactPhone: page.contact_phone || '',
    contactEmail: page.contact_email || '',
    links: links.map((link) => ({
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
    })),
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
