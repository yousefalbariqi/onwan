// Eight deliberately different compositions for the first review round.
const concepts = [
  { name: 'رواق', idea: 'حضور مؤسسي هادئ، لوحة داخلية ومساحات رحبة', bg: '#f4efe5', ink: '#263e36', fill: '#284c3d', shape: 'rounded', font: 'amiri', align: 'center', surface: 'sheet', pattern: 'arches', width: 'balanced', spacing: 'relaxed', profile: 'circle' },
  { name: 'أثر', idea: 'أسلوب تحريري بمحاذاة البداية وحدود واضحة', bg: '#fffaf2', ink: '#25252a', fill: '#b3432f', shape: 'square', font: 'tajawal', align: 'start', surface: 'none', pattern: 'none', width: 'wide', spacing: 'relaxed', profile: 'square' },
  { name: 'مدار', idea: 'هوية معاصرة داكنة، هالات ضوئية وأزرار مستديرة', bg: '#162536', ink: '#f1f5f9', fill: '#c5e6ef', shape: 'pill', font: 'cairo', align: 'center', surface: 'none', pattern: 'halo', width: 'narrow', spacing: 'normal', profile: 'circle' },
  { name: 'نسيج', idea: 'ورق دافئ، شبكة خفيفة وأزرار بإطار', bg: '#f8f1e7', ink: '#544331', fill: '#775b3e', shape: 'rounded', font: 'tajawal', align: 'start', surface: 'none', pattern: 'grid', width: 'balanced', spacing: 'normal', profile: 'rounded', border: true },
  { name: 'فسحة', idea: 'صفحة مفتوحة بألوان طبيعية وزوايا لينة', bg: '#edf4ee', ink: '#284d44', fill: '#376954', shape: 'pill', font: 'cairo', align: 'center', surface: 'none', pattern: 'halo', width: 'wide', spacing: 'relaxed', profile: 'hero_safe' },
  { name: 'ميزان', idea: 'هندسة دقيقة، إيقاع متقارب وملمس تقني', bg: '#edf2f8', ink: '#26384e', fill: '#294c75', shape: 'square', font: 'plex', align: 'start', surface: 'outline', pattern: 'grid', width: 'balanced', spacing: 'compact', profile: 'square' },
  { name: 'ودّ', idea: 'بطاقة داخلية ناعمة، لون دافئ ومساحة هوية بارزة', bg: '#f7e9e6', ink: '#623d46', fill: '#8e4b5c', shape: 'rounded', font: 'cairo', align: 'center', surface: 'sheet', pattern: 'none', width: 'narrow', spacing: 'relaxed', profile: 'rounded' },
  { name: 'منارة', idea: 'طابع معماري داكن، إطار رفيع وأقواس مضيئة', bg: '#242d2c', ink: '#f8f1de', fill: '#e9cf98', shape: 'rounded', font: 'kufi', align: 'start', surface: 'outline', pattern: 'arches', width: 'wide', spacing: 'relaxed', profile: 'circle', border: true },
] as const;

export const PILOT_THEMES = concepts.map((c, i) => ({
  name: c.name, idea: c.idea, category: 'البر والتكافل الاجتماعي',
  design: {
    theme: { id: `pilot-${i + 1}`, name: c.name, background: c.bg, textColor: c.ink, buttonColor: c.fill, buttonTextColor: i === 2 || i === 7 ? c.bg : '#ffffff' },
    wallpaper: { type: 'color' as const, value: c.bg },
    buttonStyle: { shape: c.shape, border: 'border' in c && c.border, shadow: i === 6, heightPx: i === 5 ? 48 : i === 4 ? 64 : 56, fontPx: 16, fontWeight: 'bold' as const, mediaRadius: i === 1 || i === 5 ? 'none' : 'large', spacing: c.spacing,
      composition: { align: c.align, surface: c.surface, pattern: c.pattern, width: c.width, items: i === 1 || i === 7 ? 'ruled' : i === 0 || i === 6 ? 'tiles' : 'plain', inset: i === 5 ? 'compact' : 'airy' } },
    profileStyle: { type: c.profile, fit: 'contain' as const, logoSize: i === 4 ? 140 : 100 },
    typography: { font: c.font, nameSize: i === 1 ? 'large' : 'medium', headingSize: 'large', paragraphSize: 'medium' },
    customColors: {},
  },
}));
