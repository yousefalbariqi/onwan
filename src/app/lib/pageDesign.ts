import type { PageData } from '../context/PageContext';

// Step 1 of the ready-made templates: the looks that were fixed in the code are
// now page-wide design choices, so one template restyles every item at once.
// «medium» / «normal» are the old fixed values — existing pages look the same.
export const HEADING_SIZES = { small: 'text-base', medium: 'text-lg', large: 'text-xl' } as const;
export const PARAGRAPH_SIZES = { small: 'text-sm', medium: 'text-base', large: 'text-lg' } as const;
export const MEDIA_RADII = { none: 'rounded-none', small: 'rounded-md', medium: 'rounded-xl', large: 'rounded-3xl' } as const;
export const ITEM_SPACING = { compact: 'space-y-2', normal: 'space-y-4', relaxed: 'space-y-6' } as const;
export const GRID_SPACING = { compact: 'gap-2', normal: 'gap-3', relaxed: 'gap-4' } as const;

export type MediaRadius = keyof typeof MEDIA_RADII;
export type ItemSpacing = keyof typeof ITEM_SPACING;

export function pageDesign(data: Pick<PageData, 'typography' | 'buttonStyle'>) {
  return {
    heading: HEADING_SIZES[data.typography?.headingSize ?? 'medium'] ?? HEADING_SIZES.medium,
    paragraph: PARAGRAPH_SIZES[data.typography?.paragraphSize ?? 'medium'] ?? PARAGRAPH_SIZES.medium,
    mediaRadius: MEDIA_RADII[data.buttonStyle?.mediaRadius ?? 'medium'] ?? MEDIA_RADII.medium,
    spacing: data.buttonStyle?.spacing ?? 'normal',
  };
}

// A ready-made template: the page's design only, never its content (step 2).
export const DESIGN_KEYS = ['theme', 'wallpaper', 'buttonStyle', 'profileStyle', 'typography', 'customColors'] as const;
export type TemplateDesign = Pick<PageData, (typeof DESIGN_KEYS)[number]>;
export type PageTemplate = { id: string; name: string; category: string; status: 'draft' | 'visible' | 'hidden'; design: TemplateDesign; tried_count: number; used_count: number };

export function extractDesign(data: PageData): TemplateDesign {
  const typography = { ...data.typography };
  delete typography.customFont;
  delete typography.useCustomFont;
  const profileStyle = { ...data.profileStyle };
  delete profileStyle.bannerImage;
  return { theme: data.theme, wallpaper: data.wallpaper, buttonStyle: data.buttonStyle, profileStyle, typography, customColors: data.customColors };
}

// Generic sample content, so every kind of item is seen while a template is
// designed and previewed. It is never saved with the template.
export const TEMPLATE_SAMPLE: Pick<PageData, 'username' | 'profileImage' | 'name' | 'bio' | 'links'> = {
  username: '',
  profileImage: '',
  name: 'اسم الجهة',
  bio: 'وصف مختصر عن الجهة ورسالتها.',
  links: [
    { id: 'sample-heading', title: 'عن الجهة', url: '', display: { kind: 'heading' } },
    { id: 'sample-text', title: 'نبذة', url: '', display: { kind: 'text', body: 'نص تجريبي يوضح شكل الفقرات في الصفحة.' } },
    { id: 'sample-site', title: 'الموقع الإلكتروني', url: 'https://example.com', platform: 'website' },
    { id: 'sample-whatsapp', title: 'تواصل عبر واتساب', url: 'https://wa.me/966500000000', platform: 'whatsapp' },
    { id: 'sample-doc', title: 'التقرير السنوي', url: 'https://example.com/report.pdf', display: { kind: 'document', docType: 'report' } },
    { id: 'sample-video', title: 'فيديو تعريفي', url: '', display: { kind: 'video', caption: 'below' } },
  ],
};

export const templatePageData = (base: PageData, design: TemplateDesign): PageData => ({ ...base, ...TEMPLATE_SAMPLE, ...design });
