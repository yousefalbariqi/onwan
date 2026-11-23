import { TEMPLATE_SEARCH_METADATA, type TemplateSearchMetadata } from './creationTemplateSearch';
import type { PageData } from '../context/PageContext';
import type { TemplateDesign } from './pageDesign';
import type { CreationCategory } from './creationStart';

export const TEMPLATE_GROUPS = [ { id: 'personal', label: 'أفراد' }, { id: 'business', label: 'مؤسسات' }, { id: 'nonprofit', label: 'قطاع غير ربحي' } ] as const;
export type TemplateGroup = typeof TEMPLATE_GROUPS[number]['id'];
export const templateGroup = (category: CreationCategory | null): TemplateGroup => category === 'business' || category === 'nonprofit' ? category : 'personal';
export type CreationTemplate = { id: string; name: string; tint: string; search: TemplateSearchMetadata; design: TemplateDesign };

// Note 8: twelve complete looks: one calm background, one clear button, centred
// content and the same rhythm, so a page looks finished before it is edited.
type Look = { id: string; names: readonly [string, string, string]; bg: string; gradient?: string; ink: string; button: string; buttonInk: string; shape: 'pill' | 'rounded' | 'square'; border?: boolean; shadow?: boolean; font?: 'amiri' };
const looks: readonly Look[] = [
  { id: 'calm', names: ['صفاء', 'واجهة', 'أثر'], bg: '#f3f1ec', ink: '#1c1c1a', button: '#ffffff', buttonInk: '#1c1c1a', shape: 'pill' },
  { id: 'editorial', names: ['حضور', 'نخبة', 'رسالة'], bg: '#f6e9d8', gradient: 'linear-gradient(180deg, #fbf3e8 0%, #eed9bf 100%)', ink: '#3f2a1f', button: '#3f2a1f', buttonInk: '#3f2a1f', shape: 'pill', border: true, font: 'amiri' },
  { id: 'night', names: ['مدار', 'رؤية', 'روافد'], bg: '#141a2e', gradient: 'linear-gradient(165deg, #27335c 0%, #141a2e 62%, #0c1020 100%)', ink: '#f6f4ee', button: '#f6f4ee', buttonInk: '#141a2e', shape: 'pill' },
  { id: 'bold', names: ['نبض', 'علامة', 'مبادرة'], bg: '#6d35d8', ink: '#ffffff', button: '#ffe45c', buttonInk: '#2a1458', shape: 'rounded', shadow: true },
  { id: 'garden', names: ['نسق', 'مسار', 'نماء'], bg: '#1f4a3b', gradient: 'linear-gradient(180deg, #2f6a55 0%, #173a2e 100%)', ink: '#f3f7ee', button: '#e6f2d8', buttonInk: '#173a2e', shape: 'pill' },
  { id: 'paper', names: ['مساحة', 'احتراف', 'عطاء'], bg: '#ffffff', ink: '#14304a', button: '#14304a', buttonInk: '#ffffff', shape: 'rounded' },
  { id: 'sunset', names: ['غروب', 'وهج', 'أمل'], bg: '#f2643d', gradient: 'linear-gradient(170deg, #ffb057 0%, #f2643d 52%, #c42f6b 100%)', ink: '#ffffff', button: '#ffffff', buttonInk: '#a3264f', shape: 'pill', shadow: true },
  { id: 'ocean', names: ['موج', 'أفق', 'عطاء البحر'], bg: '#0f6e84', gradient: 'linear-gradient(175deg, #38bfc2 0%, #0f6e84 55%, #0a3f5c 100%)', ink: '#ffffff', button: '#ffffff', buttonInk: '#0a3f5c', shape: 'rounded' },
  { id: 'clay', names: ['طين', 'أصالة', 'جذور'], bg: '#b5533a', ink: '#fff6ea', button: '#fff6ea', buttonInk: '#7c3323', shape: 'square', font: 'amiri' },
  { id: 'mono', names: ['حبر', 'هيبة', 'ثبات'], bg: '#111111', ink: '#ffffff', button: '#ffffff', buttonInk: '#111111', shape: 'square' },
  { id: 'blush', names: ['ورد', 'أناقة', 'رحمة'], bg: '#f9d9de', gradient: 'linear-gradient(180deg, #fdeef0 0%, #f6c6d0 100%)', ink: '#4a1f2c', button: '#4a1f2c', buttonInk: '#fff4f5', shape: 'pill' },
  { id: 'lime', names: ['طاقة', 'انطلاق', 'همّة'], bg: '#d6f24a', ink: '#14210a', button: '#14210a', buttonInk: '#e9fb8f', shape: 'rounded' },
];
export function creationTemplates(group: TemplateGroup): CreationTemplate[] {
  const index = group === 'personal' ? 0 : group === 'business' ? 1 : 2;
  return looks.map(look => ({
    id: `${group}-${look.id}`, name: look.names[index], tint: look.bg, search: TEMPLATE_SEARCH_METADATA[group][look.id],
    design: {
      theme: { id: `creation-${look.id}`, name: look.names[index], background: look.bg, textColor: look.ink, buttonColor: look.button, buttonTextColor: look.buttonInk },
      wallpaper: look.gradient ? { type: 'gradient', value: look.gradient } : { type: 'color', value: look.bg },
      buttonStyle: { shape: look.shape, border: Boolean(look.border), shadow: Boolean(look.shadow), spacing: 'normal', iconColor: 'custom', iconCustomColor: look.buttonInk, heightPx: 56, fontWeight: 'bold', composition: { align: 'center', width: 'balanced', surface: 'none', pattern: 'none', inset: 'compact', items: 'plain' } },
      profileStyle: { type: 'circle', fit: 'cover' },
      typography: { font: look.font ?? 'cairo', nameSize: 'medium', bioSize: 'small' },
      customColors: {},
    },
  }));
}
export function creationSample(group: TemplateGroup): Pick<PageData, 'name' | 'bio' | 'profileImage' | 'username' | 'links'> {
  return {
    username: '', profileImage: '/template-samples/mark.svg',
    name: group === 'business' ? 'اسم مؤسستك' : group === 'nonprofit' ? 'اسم جمعيتك' : 'اسمك هنا',
    bio: group === 'business' ? 'خدماتنا وأعمالنا، في مكان واحد.' : group === 'nonprofit' ? 'معًا نترك أثرًا يستمر.' : 'مساحة صغيرة لكل ما يعرّف بي.',
    links: ['تعرّف علينا', 'أحدث أعمالنا', 'تواصل معنا'].map((title, index) => ({ id: `creation-${index}`, title: group === 'personal' ? ['تعرّف عليّ', 'أعمالي', 'تواصل معي'][index] : title, url: '', platform: index === 2 ? 'whatsapp' : 'website' })),
  };
}
const DRAFT_KEY = 'onwan_guest_creation_v1';
export function readCreationDraft(): Partial<PageData> | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    return value && typeof value.name === 'string' && Array.isArray(value.links) ? value : null;
  } catch { return null; }
}
export function saveCreationDraft(data: Partial<PageData>): boolean {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); sessionStorage.setItem('onwan_guest_creation_stamp', String(Date.now())); return true; } catch { return false; }
}
export function templatePreviewData(sample: Partial<PageData>, template: CreationTemplate): Partial<PageData> {
  // Note 9: a design never undoes how the owner framed their own picture.
  const own = sample.profileImage && sample.profileImage !== '/template-samples/mark.svg' ? sample.profileStyle : undefined;
  const framing = own ? { fit: own.fit, zoom: own.zoom, positionX: own.positionX, positionY: own.positionY } : {};
  return { ...sample, ...template.design, profileStyle: { ...template.design.profileStyle, ...framing } };
}
const CHOICE_KEY = 'onwan_creation_template_v1';
export function readTemplateChoice(group: TemplateGroup): string | null {
  try { const id = sessionStorage.getItem(`${CHOICE_KEY}_${group}`); return creationTemplates(group).some(item => item.id === id) ? id : null; } catch { return null; }
}
export function saveTemplateChoice(group: TemplateGroup, id: string) {
  if (!creationTemplates(group).some(item => item.id === id)) return;
  try { sessionStorage.setItem(`${CHOICE_KEY}_${group}`, id); } catch { /* Selection still works in memory. */ }
}
