import { PILOT_THEMES } from './themePilot.js';

export const THEME_CATEGORIES = [
  ['البر والتكافل الاجتماعي', '#284c3d', '#b3432f', ['رواق', 'أثر', 'مدار', 'نسيج', 'فسحة', 'ميزان', 'ودّ', 'منارة']],
  ['الأيتام والرعاية الأسرية', '#80546a', '#b57c48', ['احتواء', 'سند', 'دفء', 'عائلة', 'ألفة', 'حضن', 'طمأنينة', 'وصال']],
  ['المساجد والقرآن', '#245448', '#947346', ['محراب', 'ترتيل', 'قبس', 'مشكاة', 'سكينة', 'إيوان', 'بيان', 'ضياء']],
  ['الدعوة والإرشاد', '#36576b', '#996349', ['بصيرة', 'سبيل', 'بلاغ', 'حكمة', 'يقين', 'رسالة', 'آفاق', 'دليل']],
  ['الصحة والعلاج', '#20666c', '#625b88', ['عافية', 'نبض', 'تعافي', 'حياة', 'رعاية', 'شفاء', 'أمل', 'توازن']],
  ['الإعاقة والتأهيل', '#4b5683', '#8b514d', ['قدرة', 'تمكين', 'عبور', 'خطوة', 'إمكان', 'تجاوز', 'استقلال', 'اندماج']],
  ['التعليم والمعرفة', '#344f80', '#906627', ['معرفة', 'مداد', 'مختبر', 'أفق', 'فكرة', 'منهج', 'بداية', 'بوصلة']],
  ['الإسكان والتنمية', '#755643', '#42656a', ['دار', 'أساس', 'عمران', 'عتبة', 'مسكن', 'حيّ', 'امتداد', 'بنيان']],
  ['الأوقاف والاستدامة المالية', '#38554b', '#84643c', ['وقف', 'نماء', 'رسوخ', 'غرس', 'رصيد', 'امتنان', 'دوام', 'إرث']],
  ['البيئة والاستدامة', '#46663e', '#3d6a76', ['وارف', 'واحة', 'نسيم', 'جذور', 'قطرة', 'مروج', 'تربة', 'تجدد']],
  ['الثقافة والشباب', '#804568', '#a45631', ['مشهد', 'حراك', 'ملامح', 'مسرح', 'ذاكرة', 'إيقاع', 'مسار', 'شرارة']],
  ['التطوع والتنمية المجتمعية', '#805335', '#3f6862', ['معًا', 'مبادرة', 'تكاتف', 'همة', 'لقاء', 'ميدان', 'صلة', 'عطاء']],
] as const;

// Coherent layout families. Color is only one part of each recipe; profiles,
// fonts, spacing, rhythm, surfaces and image treatment vary independently.
const recipes = [
  { align: 'start', surface: 'none', pattern: 'none', width: 'wide', items: 'ruled', shape: 'square', font: 'plex', spacing: 'relaxed' },
  { align: 'center', surface: 'sheet', pattern: 'halo', width: 'narrow', items: 'plain', shape: 'pill', font: 'tajawal', spacing: 'normal' },
  { align: 'start', surface: 'outline', pattern: 'grid', width: 'balanced', items: 'plain', shape: 'square', font: 'cairo', spacing: 'compact' },
  { align: 'center', surface: 'none', pattern: 'arches', width: 'wide', items: 'tiles', shape: 'rounded', font: 'amiri', spacing: 'relaxed' },
  { align: 'start', surface: 'sheet', pattern: 'none', width: 'balanced', items: 'tiles', shape: 'rounded', font: 'almarai', spacing: 'normal' },
  { align: 'center', surface: 'outline', pattern: 'dots', width: 'narrow', items: 'ruled', shape: 'pill', font: 'readex', spacing: 'relaxed' },
  { align: 'start', surface: 'none', pattern: 'diagonal', width: 'balanced', items: 'plain', shape: 'pill', font: 'tajawal', spacing: 'relaxed' },
  { align: 'center', surface: 'sheet', pattern: 'grid', width: 'wide', items: 'plain', shape: 'square', font: 'plex', spacing: 'normal' },
  { align: 'center', surface: 'none', pattern: 'halo', width: 'balanced', items: 'tiles', shape: 'rounded', font: 'messiri', spacing: 'relaxed' },
  { align: 'start', surface: 'outline', pattern: 'arches', width: 'narrow', items: 'plain', shape: 'rounded', font: 'kufi', spacing: 'normal' },
  { align: 'center', surface: 'none', pattern: 'none', width: 'wide', items: 'ruled', shape: 'square', font: 'cairo', spacing: 'compact' },
  { align: 'start', surface: 'sheet', pattern: 'dots', width: 'balanced', items: 'ruled', shape: 'rounded', font: 'readex', spacing: 'relaxed' },
  { align: 'center', surface: 'outline', pattern: 'none', width: 'balanced', items: 'tiles', shape: 'pill', font: 'almarai', spacing: 'normal' },
  { align: 'start', surface: 'none', pattern: 'grid', width: 'wide', items: 'tiles', shape: 'square', font: 'plex', spacing: 'normal' },
  { align: 'center', surface: 'sheet', pattern: 'arches', width: 'narrow', items: 'plain', shape: 'rounded', font: 'amiri', spacing: 'relaxed' },
  { align: 'start', surface: 'outline', pattern: 'halo', width: 'wide', items: 'ruled', shape: 'pill', font: 'tajawal', spacing: 'relaxed' },
] as const;
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (hex: string, other: number, amount: number) => '#' + rgb(hex).map(c => Math.round(c * amount + other * (1 - amount)).toString(16).padStart(2, '0')).join('');
const luminance = (hex: string) => rgb(hex).map(c => c / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const readableText = (hex: string) => luminance(hex) > .179 ? '#000000' : '#ffffff';

export const LIBRARY_THEMES = THEME_CATEGORIES.flatMap(([category, primary, secondary, names], categoryIndex) => names.map((name, j) => {
  if (categoryIndex === 0) return PILOT_THEMES[j];
  const n = (categoryIndex - 1) * 8 + j;
  const recipe = recipes[(j * 3 + categoryIndex * 5) % recipes.length];
  const dark = j === 2 || j === 7;
  const accent = j % 3 === 0 ? secondary : primary;
  const bg = dark ? mix(accent, 0, .28) : mix(accent, 255, j % 2 ? .05 : .10);
  const ink = dark ? '#f5f4ef' : mix(primary, 0, .43);
  const fill = dark ? mix(accent, 255, .25) : j === 3 ? mix(accent, 0, .70) : accent;
  const profile = ['circle', 'rounded', 'square', 'premium', 'hero_safe'][(categoryIndex + j) % 5];
  // Eleven variations per recipe produce 88 different monochrome design
  // signatures as well as category-specific palettes and names.
  const design = {
    theme: { id: `library-${categoryIndex + 1}-${j + 1}`, name, background: bg, textColor: ink, buttonColor: fill, buttonTextColor: readableText(fill) },
    wallpaper: { type: 'color', value: bg },
    buttonStyle: { shape: recipe.shape, border: j === 3 || j === 7, shadow: j === 1 || j === 4, heightPx: 48 + (n % 5) * 4, fontPx: 15 + (categoryIndex % 3), fontWeight: j % 3 ? 'bold' : 'medium', iconPx: 20 + (j % 3) * 2, opacity: 100,
      mediaRadius: ['none', 'small', 'medium', 'large'][j % 4], spacing: recipe.spacing,
      composition: { align: recipe.align, surface: recipe.surface, pattern: recipe.pattern, width: recipe.width, items: recipe.items, inset: j % 3 ? 'airy' : 'compact' } },
    profileStyle: { type: profile, fit: 'contain', logoSize: 80 + ((n * 3) % 9) * 8 },
    typography: { font: recipe.font, namePx: 24 + (categoryIndex % 4) * 2, bioPx: 14 + (j % 3), headingSize: j % 2 ? 'large' : 'medium', paragraphSize: j === 5 ? 'large' : 'medium' },
    customColors: {},
  };
  return { name, category, idea: `${recipe.align === 'start' ? 'تكوين تحريري' : 'هوية مركزية'}، ${dark ? 'حضور داكن' : 'سطح فاتح'}، ${recipe.items === 'tiles' ? 'بطاقات محتوى' : recipe.items === 'ruled' ? 'إيقاع بفواصل' : 'محتوى مفتوح'}`, design };
}));
