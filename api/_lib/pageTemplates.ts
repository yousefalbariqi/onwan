import type { Handler } from './admin.js';
import { audit } from './admin.js';
import { pool } from './db.js';
import { HttpError } from './http.js';

// Ready-made templates (database/phase28-page-templates.sql). A template holds
// the page's design only; the manager makes them, associations see the shown
// ones nine at a time and copy the design onto their own draft.

const PAGE_SIZE = 9;
const COLOR = /^#[0-9a-f]{6}$/i;
const GRADIENT = /^linear-gradient\(\d{1,3}deg(, #[0-9a-f]{6} \d{1,3}%){2,4}\)$/i;
const DESIGN_KEYS = ['theme', 'wallpaper', 'buttonStyle', 'profileStyle', 'typography', 'customColors'] as const;

const text = (value: unknown, max: number) => String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
const plain = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {});

// Only design keys; a colour or gradient background (a template carries no
// files); colours are plain hex; an uploaded font stays with its own page.
export function normalizeDesign(value: any) {
  const source = plain(value);
  const design: Record<string, any> = {};
  for (const key of DESIGN_KEYS) design[key] = plain(source[key]);
  const { theme, wallpaper, typography, customColors } = design;
  for (const key of ['background', 'buttonColor', 'buttonTextColor', 'textColor']) {
    if (!COLOR.test(String(theme[key] ?? ''))) throw new HttpError(400, 'ألوان القالب غير مكتملة.');
  }
  theme.id = text(theme.id, 40) || 'template';
  theme.name = text(theme.name, 60);
  if (wallpaper.type === 'gradient' ? !GRADIENT.test(String(wallpaper.value ?? '')) : !COLOR.test(String(wallpaper.value ?? ''))) {
    design.wallpaper = { type: 'color', value: theme.background };
  } else {
    design.wallpaper = { type: wallpaper.type === 'gradient' ? 'gradient' : 'color', value: wallpaper.value, ...(Number.isFinite(wallpaper.dim) ? { dim: Math.max(0, Math.min(80, Number(wallpaper.dim))) } : {}) };
  }
  delete typography.customFont;
  delete typography.useCustomFont;
  for (const key of Object.keys(customColors)) if (!COLOR.test(String(customColors[key] ?? ''))) delete customColors[key];
  delete design.profileStyle.bannerImage;
  if (JSON.stringify(design).length > 8000) throw new HttpError(400, 'القالب أكبر من المسموح.');
  return design;
}

const LIST_COLUMNS = 'id, name, category, status, design, tried_count, used_count, updated_at';

async function listTemplates({ query, category, offset, visibleOnly }: { query?: unknown; category?: unknown; offset?: unknown; visibleOnly: boolean }) {
  const search = text(query, 60);
  const start = Math.max(0, Math.floor(Number(offset) || 0));
  const result = await pool.query(
    `select ${LIST_COLUMNS} from page_templates
      where ($1::boolean is false or status = 'visible')
        and ($2 = '' or name ilike '%' || $2 || '%' or category ilike '%' || $2 || '%')
        and ($3 = '' or category = $3)
      order by sort_order, created_at desc
      limit ${PAGE_SIZE + 1} offset $4`,
    [visibleOnly, search, text(category, 40), start],
  );
  const categories = await pool.query<{ category: string }>(
    `select distinct category from page_templates where category <> '' and ($1::boolean is false or status = 'visible') order by category`,
    [visibleOnly],
  );
  return { templates: result.rows.slice(0, PAGE_SIZE), more: result.rows.length > PAGE_SIZE, categories: categories.rows.map((row) => row.category) };
}

// The manager's own tools; only «مدير عنوان» can reach them.
export const templateAdminHandlers: Record<string, Handler> = {
  'templates.list': { access: 'manager', run: (params) => listTemplates({ ...params, visibleOnly: false }) },
  'templates.get': { access: 'manager', run: async (params) => {
    const row = (await pool.query(`select ${LIST_COLUMNS} from page_templates where id = $1`, [params.id])).rows[0];
    if (!row) throw new HttpError(404, 'القالب غير موجود.');
    return { template: row };
  } },
  // New templates start as drafts. Name and category are kept when left out.
  'templates.save': { access: 'manager', run: async (params, staff) => {
    const design = normalizeDesign(params.design);
    if (!params.id) {
      const name = text(params.name, 60);
      if (!name) throw new HttpError(400, 'اكتب اسم القالب.');
      const row = (await pool.query(`insert into page_templates (name, category, design) values ($1, $2, $3::jsonb) returning ${LIST_COLUMNS}`, [name, text(params.category, 40), JSON.stringify(design)])).rows[0];
      await audit(staff, 'templates.create', { type: 'template', id: row.id, label: name });
      return { template: row };
    }
    const row = (await pool.query(
      `update page_templates set design = $2::jsonb,
         name = coalesce(nullif($3, ''), name),
         category = case when $4::boolean then $5 else category end,
         updated_at = now()
       where id = $1 returning ${LIST_COLUMNS}`,
      [params.id, JSON.stringify(design), text(params.name, 60), params.category !== undefined, text(params.category, 40)],
    )).rows[0];
    if (!row) throw new HttpError(404, 'القالب غير موجود.');
    await audit(staff, 'templates.save', { type: 'template', id: row.id, label: row.name });
    return { template: row };
  } },
  'templates.rename': { access: 'manager', run: async (params, staff) => {
    const name = text(params.name, 60);
    if (!name) throw new HttpError(400, 'اكتب اسم القالب.');
    const row = (await pool.query(`update page_templates set name = $2, category = $3, updated_at = now() where id = $1 returning ${LIST_COLUMNS}`, [params.id, name, text(params.category, 40)])).rows[0];
    if (!row) throw new HttpError(404, 'القالب غير موجود.');
    await audit(staff, 'templates.rename', { type: 'template', id: row.id, label: name });
    return { template: row };
  } },
  'templates.setStatus': { access: 'manager', run: async (params, staff) => {
    if (!['draft', 'visible', 'hidden'].includes(params.status)) throw new HttpError(400, 'حالة القالب غير صحيحة.');
    const row = (await pool.query(`update page_templates set status = $2, updated_at = now() where id = $1 returning ${LIST_COLUMNS}`, [params.id, params.status])).rows[0];
    if (!row) throw new HttpError(404, 'القالب غير موجود.');
    await audit(staff, 'templates.setStatus', { type: 'template', id: row.id, label: params.status });
    return { template: row };
  } },
  // Pages that used it keep their own copy of the design.
  'templates.delete': { access: 'manager', run: async (params, staff) => {
    const row = (await pool.query('delete from page_templates where id = $1 returning name', [params.id])).rows[0];
    if (!row) throw new HttpError(404, 'القالب غير موجود.');
    await audit(staff, 'templates.delete', { type: 'template', id: params.id, label: row.name });
    return { deleted: true };
  } },
};

// For a signed-in association: the shown templates, and «جرّب» / «استخدم» counts.
export async function runTemplateAction(action: string, params: any) {
  if (action === 'templates.list') return listTemplates({ ...params, visibleOnly: true });
  if (action === 'templates.track') {
    const column = params.event === 'used' ? 'used_count' : params.event === 'tried' ? 'tried_count' : '';
    if (!column) throw new HttpError(400, 'إجراء غير معروف.');
    await pool.query(`update page_templates set ${column} = ${column} + 1 where id = $1 and status = 'visible'`, [params.id]);
    return { saved: true };
  }
  throw new HttpError(400, 'إجراء غير معروف.');
}
