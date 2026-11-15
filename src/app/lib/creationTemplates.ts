import { TEMPLATE_SEARCH_METADATA, type TemplateSearchMetadata } from './creationTemplateSearch';
import type { PageData } from '../context/PageContext';
import type { TemplateDesign } from './pageDesign';
import type { CreationCategory } from './creationStart';

export const TEMPLATE_GROUPS = [ { id: 'personal', label: 'أفراد' }, { id: 'business', label: 'مؤسسات' }, { id: 'nonprofit', label: 'قطاع غير ربحي' } ] as const;
export type TemplateGroup = typeof TEMPLATE_GROUPS[number]['id'];
export const templateGroup = (category: CreationCategory | null): TemplateGroup => category === 'business' || category === 'nonprofit' ? category : 'personal';
export type CreationTemplate = { id: string; name: string; tint: string; search: TemplateSearchMetadata; design: TemplateDesign };

const looks = [
  { id: 'calm', names: ['صفاء', 'واجهة', 'أثر'], bg: '#f0f0ec', ink: '#202321', button: '#ffffff', buttonInk: '#202321', shape: 'rounded', spacing: 'normal', profile: 'circle', align: 'center', surface: 'none', pattern: 'none', shadow: false, border: false },
  { id: 'editorial', names: ['حضور', 'نخبة', 'رسالة'], bg: '#f9ecdc', ink: '#4b3024', button: '#f9ecdc', buttonInk: '#4b3024', shape: 'pill', spacing: 'relaxed', profile: 'rounded', align: 'start', surface: 'outline', pattern: 'none', shadow: false, border: true },
  { id: 'night', names: ['مدار', 'رؤية', 'روافد'], bg: '#20232b', ink: '#f9f6ef', button: '#353a46', buttonInk: '#ffffff', shape: 'rounded', spacing: 'compact', profile: 'circle', align: 'center', surface: 'sheet', pattern: 'halo', shadow: true, border: false },
  { id: 'bold', names: ['نبض', 'علامة', 'مبادرة'], bg: '#7751b8', ink: '#ffffff', button: '#f4d86d', buttonInk: '#302038', shape: 'square', spacing: 'relaxed', profile: 'square', align: 'start', surface: 'none', pattern: 'none', shadow: true, border: true },
  { id: 'garden', names: ['نسق', 'مسار', 'نماء'], bg: '#e2e9dd', ink: '#29483e', button: '#29483e', buttonInk: '#ffffff', shape: 'pill', spacing: 'normal', profile: 'rounded', align: 'center', surface: 'none', pattern: 'arches', shadow: false, border: false },
  { id: 'paper', names: ['مساحة', 'احتراف', 'عطاء'], bg: '#fcfbf7', ink: '#22435e', button: '#edf2f4', buttonInk: '#22435e', shape: 'square', spacing: 'compact', profile: 'circle', align: 'start', surface: 'none', pattern: 'grid', shadow: false, border: true },
] as const;
export function creationTemplates(group: TemplateGroup): CreationTemplate[] {
  const index = group === 'personal' ? 0 : group === 'business' ? 1 : 2;
  return looks.map(look => ({
    id: `${group}-${look.id}`, name: look.names[index], tint: look.bg, search: TEMPLATE_SEARCH_METADATA[group][look.id],
    design: {
      theme: { id: `creation-${look.id}`, name: look.names[index], background: look.bg, textColor: look.ink, buttonColor: look.button, buttonTextColor: look.buttonInk },
      wallpaper: { type: 'color', value: look.bg },
      buttonStyle: { shape: look.shape, border: look.border, shadow: look.shadow, spacing: look.spacing, heightPx: look.id === 'bold' ? 68 : look.id === 'paper' ? 48 : 56, fontWeight: 'bold', composition: { align: look.align, width: look.id === 'night' ? 'narrow' : 'balanced', surface: look.surface, pattern: look.pattern, inset: look.id === 'editorial' ? 'airy' : 'compact', items: look.id === 'paper' ? 'ruled' : 'plain' } },
      profileStyle: { type: look.profile, fit: 'contain' },
      typography: { font: look.id === 'editorial' ? 'amiri' : 'cairo', nameSize: look.id === 'bold' ? 'large' : 'medium', bioSize: 'small' },
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
  return { ...sample, ...template.design };
}
const CHOICE_KEY = 'onwan_creation_template_v1';
export function readTemplateChoice(group: TemplateGroup): string | null {
  try { const id = sessionStorage.getItem(`${CHOICE_KEY}_${group}`); return creationTemplates(group).some(item => item.id === id) ? id : null; } catch { return null; }
}
export function saveTemplateChoice(group: TemplateGroup, id: string) {
  if (!creationTemplates(group).some(item => item.id === id)) return;
  try { sessionStorage.setItem(`${CHOICE_KEY}_${group}`, id); } catch { /* Selection still works in memory. */ }
}
