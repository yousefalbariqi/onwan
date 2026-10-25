// Note 22: a suggested link name from an association's Arabic name, e.g.
// «جمعية البر والإحسان» → «albr-walihsan». Only a suggestion: the owner (or
// staff) can change the link before it is fixed, and the Arabic name stays.
const LETTERS: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ء': '', 'ؤ': 'u', 'ئ': 'e', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'a', 'ى': 'a',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};
// Words that say what the entity is rather than which one it is.
const GENERIC = new Set(['جمعية', 'جمعيه', 'الجمعية', 'مؤسسة', 'مؤسسه', 'منظمة']);

function word(text: string) {
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
