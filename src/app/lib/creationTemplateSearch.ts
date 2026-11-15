import type { CreationTemplate, TemplateGroup } from './creationTemplates';

export type TemplateSearchMetadata = {
  primaryField: string;
  specialties: string[];
  keywords: string[];
};

// Open-ended strings: add a field or synonym here without duplicating a design.
export const TEMPLATE_SEARCH_METADATA: Record<TemplateGroup, Record<string, TemplateSearchMetadata>> = {
  business: {
    calm: { primaryField: 'طبي', specialties: ['عيادة', 'طب الأسنان', 'مركز صحي', 'خدمات صحية'], keywords: ['طبيب', 'طبيبة', 'صحة', 'اسنان', 'clinic', 'doctor', 'medical', 'dentist'] },
    editorial: { primaryField: 'قانوني', specialties: ['محاماة', 'استشارات قانونية', 'مكاتب مهنية', 'استشارات إدارية'], keywords: ['محامي', 'محامية', 'مكتب محاماة', 'مستشار', 'خدمات قانونية', 'lawyer', 'legal', 'law firm', 'consultant'] },
    night: { primaryField: 'عقاري', specialties: ['عقارات', 'وساطة عقارية', 'تطوير عقاري', 'هندسة معمارية'], keywords: ['عقار', 'وسيط', 'مكتب عقاري', 'عقارية', 'real estate', 'property', 'architecture'] },
    bold: { primaryField: 'تجاري', specialties: ['متجر', 'شركة', 'مؤسسة تجارية', 'تسويق'], keywords: ['تجارة', 'متاجر', 'براند', 'منتجات', 'تسويقي', 'store', 'shop', 'brand', 'business', 'marketing'] },
    garden: { primaryField: 'هندسي', specialties: ['مكتب هندسي', 'معماري', 'تصميم داخلي', 'مقاولات', 'تشييد', 'بناء'], keywords: ['هندسة', 'مهندس', 'مقاول', 'مقاولون', 'ديكور', 'engineer', 'engineering', 'interior', 'contractor', 'construction'] },
    paper: { primaryField: 'خدمات مهنية', specialties: ['استشارات', 'محاسبة', 'تدريب', 'مكاتب مهنية', 'استشارات إدارية'], keywords: ['محاسب', 'مدرب', 'مستشار', 'مالي', 'accountant', 'accounting', 'training', 'consulting'] },
  },
  personal: {
    calm: { primaryField: 'شخصي', specialties: ['تعريف شخصي', 'سيرة ذاتية'], keywords: ['شخصية', 'بسيط', 'هادئ', 'personal', 'minimal', 'profile'] },
    editorial: { primaryField: 'كتابة', specialties: ['أدب', 'تدوين', 'استشارات', 'محاماة'], keywords: ['كاتب', 'كاتبة', 'مؤلف', 'مستشار', 'محامي', 'writer', 'author', 'lawyer'] },
    night: { primaryField: 'تقنية', specialties: ['برمجة', 'أعمال حرة'], keywords: ['مطور', 'مبرمج', 'تقني', 'developer', 'software', 'freelancer'] },
    bold: { primaryField: 'صناعة محتوى', specialties: ['تصوير', 'فنون', 'تصميم'], keywords: ['صانع محتوى', 'مصور', 'مصمم', 'ابداع', 'creator', 'photographer', 'artist', 'design'] },
    garden: { primaryField: 'صحة وحياة', specialties: ['تدريب', 'رياضة', 'تغذية'], keywords: ['مدرب', 'رياضي', 'تغذية', 'coach', 'fitness', 'wellness'] },
    paper: { primaryField: 'تعليم', specialties: ['بحث علمي', 'ملف أعمال'], keywords: ['معلم', 'باحث', 'اكاديمي', 'طالب', 'teacher', 'researcher', 'portfolio', 'cv'] },
  },
  nonprofit: {
    calm: { primaryField: 'مجتمعي', specialties: ['جمعيات', 'خدمة المجتمع'], keywords: ['جمعية', 'خيري', 'اهلي', 'أثر', 'community', 'charity', 'nonprofit'] },
    editorial: { primaryField: 'توعية', specialties: ['تعليم', 'حقوق', 'خدمات قانونية'], keywords: ['توعوي', 'تعليمي', 'قانوني', 'حقوقي', 'education', 'rights', 'legal'] },
    night: { primaryField: 'تنمية', specialties: ['شراكات', 'تمكين'], keywords: ['تنموي', 'دعم', 'تطوير', 'development', 'partnership'] },
    bold: { primaryField: 'تطوع', specialties: ['مبادرات', 'حملات مجتمعية'], keywords: ['متطوع', 'فريق', 'حملة', 'volunteer', 'campaign'] },
    garden: { primaryField: 'استدامة', specialties: ['بيئة', 'أوقاف', 'زراعة'], keywords: ['وقف', 'بيئي', 'اخضر', 'sustainability', 'environment', 'waqf'] },
    paper: { primaryField: 'إغاثة', specialties: ['تبرعات', 'رعاية', 'مساعدات'], keywords: ['تبرع', 'اغاثي', 'داعم', 'donation', 'relief', 'care'] },
  },
};

export function normalizeTemplateSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

// Require every query word to match; prioritize names, then specialties, then synonyms.
// This is local indexed matching, not a generative AI request or a profession questionnaire.
export function searchCreationTemplates(templates: CreationTemplate[], query: string): CreationTemplate[] {
  const normalized = normalizeTemplateSearch(query);
  if (!normalized) return templates;
  const tokens = normalized.split(' ');
  const rank = (template: CreationTemplate) => {
    const metadata = template.search;
    const fields = [
      { value: normalizeTemplateSearch(template.name), weight: 100 },
      { value: normalizeTemplateSearch(metadata.primaryField), weight: 50 },
      ...metadata.specialties.map(value => ({ value: normalizeTemplateSearch(value), weight: 40 })),
      ...metadata.keywords.map(value => ({ value: normalizeTemplateSearch(value), weight: 25 })),
    ];
    if (!tokens.every(token => fields.some(field => field.value.includes(token)))) return 0;
    return tokens.reduce((total, token) => total + Math.max(...fields.map(field => field.value === token ? field.weight * 2 : field.value.includes(token) ? field.weight : 0)), 0)
      + (fields[0].value === normalized ? 200 : 0);
  };
  return templates.map((template, index) => ({ template, index, score: rank(template) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.template);
}
