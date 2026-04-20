import { PoolClient } from 'pg';
import { pool } from './db';

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
};

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
  profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
  name: 'أحمد محمد',
  bio: 'مصمم جرافيك ومطور مواقع 🎨💻',
  links: [
    {
      id: 'seed-1',
      title: 'إنستقرام',
      url: 'https://instagram.com',
      platform: 'instagram',
      iconStyle: 'color',
      textPosition: 'center',
    },
    {
      id: 'seed-2',
      title: 'تويتر X',
      url: 'https://twitter.com',
      platform: 'twitter',
      iconStyle: 'color',
      textPosition: 'center',
    },
    {
      id: 'seed-3',
      title: 'موقعي الشخصي',
      url: 'https://example.com',
      platform: 'website',
      iconStyle: 'color',
      textPosition: 'center',
    },
  ],
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

  const pageResult = await queryable.query<{ id: string }>(
    'select id from pages where user_id = $1 limit 1',
    [userId],
  );

  const pageId = pageResult.rows[0]?.id;

  if (!pageId) {
    throw new Error('Failed to load page record');
  }

  const linkCountResult = await queryable.query<{ count: string }>(
    'select count(*)::text as count from page_links where page_id = $1',
    [pageId],
  );

  if (Number(linkCountResult.rows[0]?.count ?? '0') === 0) {
    for (const [index, link] of DEFAULT_PAGE_DATA.links.entries()) {
      await queryable.query(
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
            text_position
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          pageId,
          link.title,
          link.url,
          link.linkType ?? 'url',
          link.fileCategory ?? null,
          link.fileName ?? null,
          link.fileMimeType ?? null,
          link.fileSize ?? null,
          link.platform,
          index,
          link.iconStyle,
          link.textPosition,
        ],
      );
    }
  }
}

export async function getPageDataByUserId(userId: string) {
  const pageResult = await pool.query<PageRecord>(
    `
      select
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
        u.username
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

  const linksResult = await pool.query<LinkRecord>(
    `
      select
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
        text_position
      from page_links
      where page_id = $1
      order by sort_order asc, id asc
    `,
    [page.id],
  );

  return mapPage(page, linksResult.rows);
}

export async function getPageDataByUsername(username: string) {
  const pageResult = await pool.query<PageRecord>(
    `
      select
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
        u.username
      from usernames u
      join pages p on p.user_id = u.user_id
      where u.username = $1
      limit 1
    `,
    [username],
  );

  const page = pageResult.rows[0];

  if (!page) {
    return null;
  }

  const linksResult = await pool.query<LinkRecord>(
    `
      select
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
        text_position
      from page_links
      where page_id = $1
      order by sort_order asc, id asc
    `,
    [page.id],
  );

  return mapPage(page, linksResult.rows);
}

export async function savePageData(userId: string, pageData: any) {
  const client = await pool.connect();

  try {
    await client.query('begin');
    await ensurePageForUser(userId, client);

    const pageResult = await client.query<{ id: string }>(
      'select id from pages where user_id = $1 limit 1',
      [userId],
    );

    const pageId = pageResult.rows[0]?.id;

    if (!pageId) {
      throw new Error('Page not found');
    }

    await client.query(
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
          extracted_colors_json = $10::jsonb
        where user_id = $1
      `,
      [
        userId,
        pageData.name ?? '',
        pageData.bio ?? '',
        pageData.profileImage ?? '',
        JSON.stringify(pageData.theme ?? DEFAULT_PAGE_DATA.theme),
        JSON.stringify(pageData.wallpaper ?? DEFAULT_PAGE_DATA.wallpaper),
        JSON.stringify(pageData.buttonStyle ?? DEFAULT_PAGE_DATA.buttonStyle),
        JSON.stringify(pageData.profileStyle ?? DEFAULT_PAGE_DATA.profileStyle),
        JSON.stringify(pageData.customColors ?? {}),
        JSON.stringify(pageData.extractedColors ?? []),
      ],
    );

    await client.query('delete from page_links where page_id = $1', [pageId]);

    const links = Array.isArray(pageData.links) ? pageData.links : [];

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
            text_position
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          pageId,
          String(link.title ?? '').trim(),
          String(link.url ?? '').trim(),
          link.linkType === 'file' ? 'file' : 'url',
          link.fileCategory && ['cv', 'menu', 'other'].includes(String(link.fileCategory))
            ? link.fileCategory
            : null,
          link.fileName ? String(link.fileName).trim() : null,
          link.fileMimeType ? String(link.fileMimeType).trim() : null,
          Number.isFinite(Number(link.fileSize)) ? Number(link.fileSize) : null,
          link.platform ?? 'custom',
          index,
          link.iconStyle ?? 'color',
          link.textPosition ?? 'center',
        ],
      );
    }

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
    profileImage: page.profile_image_url || DEFAULT_PAGE_DATA.profileImage,
    name: page.display_name || DEFAULT_PAGE_DATA.name,
    bio: page.bio || '',
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
    })),
    theme: page.theme_json || DEFAULT_PAGE_DATA.theme,
    wallpaper: page.wallpaper_json || DEFAULT_PAGE_DATA.wallpaper,
    buttonStyle: page.button_style_json || DEFAULT_PAGE_DATA.buttonStyle,
    profileStyle: page.profile_style_json || DEFAULT_PAGE_DATA.profileStyle,
    customColors:
      page.custom_colors_json && Object.keys(page.custom_colors_json).length > 0
        ? page.custom_colors_json
        : undefined,
    extractedColors: page.extracted_colors_json || [],
  };
}
