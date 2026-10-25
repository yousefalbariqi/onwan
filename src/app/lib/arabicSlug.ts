// Note 22: a suggested link name from an association's Arabic name, e.g.
// «جمعية البر والإحسان» → «albir-walihsan». Only a suggestion: the owner (or
// staff) can change the link before it is fixed, and the Arabic name stays.
const LETTERS: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ء': '', 'ؤ': 'u', 'ئ': 'e', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'a', 'ى': 'a',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};
// Note 22 (update): written Arabic drops most vowels, so letter-by-letter
// gives «yusf». Common names and the words associations use get their usual
// English spelling here; any other word falls back to the letters. Several
// spellings can be right — this is a suggestion the owner can edit.
const KNOWN: Record<string, string> = {
  'يوسف': 'yousef', 'محمد': 'mohammed', 'أحمد': 'ahmed', 'احمد': 'ahmed', 'علي': 'ali', 'عمر': 'omar', 'خالد': 'khaled', 'عبدالله': 'abdullah',
  'عبدالرحمن': 'abdulrahman', 'عبدالعزيز': 'abdulaziz', 'سلمان': 'salman', 'فهد': 'fahad', 'سعود': 'saud', 'فيصل': 'faisal', 'إبراهيم': 'ibrahim',
  'ابراهيم': 'ibrahim', 'فاطمة': 'fatima', 'عائشة': 'aisha', 'خديجة': 'khadija', 'مريم': 'maryam', 'نورة': 'noura', 'سارة': 'sarah', 'حسن': 'hassan',
  'حسين': 'hussein', 'صالح': 'saleh', 'ناصر': 'nasser', 'سعد': 'saad', 'منصور': 'mansour', 'عثمان': 'othman', 'مصطفى': 'mustafa',
  'بر': 'bir', 'البر': 'albir', 'إحسان': 'ihsan', 'الإحسان': 'alihsan', 'الاحسان': 'alihsan', 'خير': 'khair', 'الخير': 'alkhair',
  'خيرية': 'khairiya', 'الخيرية': 'alkhairiya', 'الخيري': 'alkhairi', 'رعاية': 'riaya', 'الأيتام': 'alaytam', 'الايتام': 'alaytam', 'أيتام': 'aytam',
  'التنمية': 'altanmiya', 'تنمية': 'tanmiya', 'الاجتماعية': 'alijtimaiya', 'الأهلية': 'alahliya', 'الاهلية': 'alahliya', 'الوطنية': 'alwataniya',
  'السعودية': 'alsaudiya', 'الإسكان': 'aliskan', 'القرآن': 'alquran', 'القران': 'alquran', 'الكريم': 'alkareem', 'تحفيظ': 'tahfeez',
  'الأسرة': 'alusra', 'الاسرة': 'alusra', 'أسرة': 'usra', 'المرأة': 'almarah', 'الشباب': 'alshabab', 'الصحة': 'alsiha', 'الصحية': 'alsihiya',
  'الإغاثة': 'aleghatha', 'الاغاثة': 'aleghatha', 'الهلال': 'alhilal', 'الأحمر': 'alahmar', 'إنسان': 'insan', 'الإنسان': 'alinsan',
  'الوفاء': 'alwafa', 'وفاء': 'wafa', 'العطاء': 'alataa', 'عطاء': 'ataa', 'النور': 'alnoor', 'نور': 'noor', 'الأمل': 'alamal', 'أمل': 'amal',
  'سند': 'sanad', 'عون': 'aoun', 'كافل': 'kafil', 'الزكاة': 'alzakat', 'الصدقة': 'alsadaqa', 'الوقف': 'alwaqf', 'الأوقاف': 'alawqaf',
  'التعليم': 'altaleem', 'الإعاقة': 'aliaqa', 'الاعاقة': 'aliaqa', 'ذوي': 'dhawi', 'المسنين': 'almusinneen', 'الأرامل': 'alaramel',
  'تراحم': 'tarahum', 'إطعام': 'itaam', 'اطعام': 'itaam', 'بنك': 'bank', 'الطعام': 'altaam', 'الرياض': 'alriyadh', 'جدة': 'jeddah',
  'مكة': 'makkah', 'المدينة': 'almadinah', 'المنورة': 'almunawwarah', 'الدمام': 'aldammam', 'الشرقية': 'alsharqiya', 'القصيم': 'alqassim',
  'أبها': 'abha', 'تبوك': 'tabuk', 'حائل': 'hail', 'جازان': 'jazan', 'نجران': 'najran', 'الطائف': 'altaif', 'الأحساء': 'alahsa',
  'بيت': 'bait', 'دار': 'dar', 'مركز': 'markaz', 'نادي': 'nadi', 'لجنة': 'lajna', 'برنامج': 'barnamaj', 'مبادرة': 'mubadara',
};

function known(w: string): string | undefined {
  if (KNOWN[w]) return KNOWN[w];
  // «و» joined to the next word: والإحسان → walihsan.
  if (w.startsWith('و') && KNOWN[w.slice(1)]) return `w${KNOWN[w.slice(1)].startsWith('a') ? '' : 'a'}${KNOWN[w.slice(1)]}`;
  // «ب» / «ل» joined to a known word: بالرياض → balriyadh.
  if ((w.startsWith('ب') || w.startsWith('ل')) && KNOWN[w.slice(1)]) return `${w.startsWith('ب') ? 'b' : 'l'}${KNOWN[w.slice(1)]}`;
  return undefined;
}

// Words that say what the entity is rather than which one it is.
const GENERIC = new Set(['جمعية', 'جمعيه', 'الجمعية', 'مؤسسة', 'مؤسسه', 'منظمة']);

function word(text: string) {
  const spelled = known(text);
  if (spelled) return spelled;
  return [...text].map((ch, i) => {
    if (ch === 'و') return i === 0 ? 'w' : 'u';
    if (ch === 'ي') return i === 0 ? 'y' : 'i';
    if (/[a-z0-9]/.test(ch)) return ch;
    return LETTERS[ch] ?? '';
  }).join('');
}

export function arabicSlug(name: string, max = 30) {
  const words = name
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel and tatweel
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !GENERIC.has(w))
    .map(word)
    .filter(Boolean);
  let slug = '';
  for (const w of words) {
    const next = slug ? `${slug}-${w}` : w;
    if (next.length > max) break;
    slug = next;
  }
  return slug || words[0]?.slice(0, max) || '';
}
