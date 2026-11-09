export type TextStyle = { bold?: true; italic?: true; underline?: true; align?: 'right' | 'center' | 'left' };
export type TextRange = TextStyle & { start: number; end: number };
export type TextFormat = TextRange[];
const keys = ['bold', 'italic', 'underline', 'align'] as const;
export function normalizeTextFormat(value: unknown, length: number): TextFormat {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2000).flatMap(range => {
    if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.end)) return [];
    const start = Math.max(0, Math.min(length, range.start)), end = Math.max(start, Math.min(length, range.end));
    const style: TextStyle = {};
    for (const key of ['bold', 'italic', 'underline'] as const) if (range[key] === true) style[key] = true;
    if (['right', 'center', 'left'].includes(range.align)) style.align = range.align;
    return end > start && Object.keys(style).length ? [{ start, end, ...style }] : [];
  });
}
function cells(length: number, format?: TextFormat): TextStyle[] {
  const result: TextStyle[] = Array.from({ length }, () => ({}));
  for (const range of normalizeTextFormat(format, length)) for (let i = range.start; i < range.end; i++) Object.assign(result[i], Object.fromEntries(keys.filter(key => range[key]).map(key => [key, range[key]])));
  return result;
}
function compact(styles: TextStyle[]): TextFormat {
  const result: TextFormat = [];
  styles.forEach((style, i) => {
    if (!Object.keys(style).length) return;
    const previous = result.at(-1);
    if (previous?.end === i && keys.every(key => previous[key] === style[key])) previous.end++;
    else result.push({ start: i, end: i + 1, ...style });
  });
  return result;
}
export function applyTextStyle(text: string, format: TextFormat | undefined, start: number, end: number, key: keyof TextStyle | 'clear', alignment?: TextStyle['align']): TextFormat {
  const styles = cells(text.length, format);
  start = Math.max(0, Math.min(text.length, start)); end = Math.max(start, Math.min(text.length, end));
  if (key === 'align') {
    start = text.lastIndexOf('\n', Math.max(-1, start - 1)) + 1;
    const newline = text.indexOf('\n', end > start ? end - 1 : end);
    end = newline < 0 ? text.length : newline;
  } else if (start === end) return compact(styles);
  const remove = key !== 'align' && key !== 'clear' && styles.slice(start, end).every(style => style[key]);
  for (let i = start; i < end; i++) {
    if (key === 'clear') styles[i] = {};
    else if (key === 'align') styles[i].align = alignment;
    else if (remove) delete styles[i][key]; else styles[i][key] = true;
  }
  return compact(styles);
}
export function editTextFormat(before: string, after: string, format?: TextFormat): TextFormat {
  if (!format?.length) return [];
  let start = 0, suffix = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (suffix < before.length - start && suffix < after.length - start && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  const styles = cells(before.length, format);
  const inherited = start < before.length ? styles[start] : styles[start - 1] ?? {};
  return compact([...styles.slice(0, start), ...Array.from({ length: after.length - start - suffix }, () => ({ ...inherited })), ...styles.slice(before.length - suffix)]);
}
export function textRuns(text: string, format?: TextFormat) {
  const styles = cells(text.length, format);
  const result: Array<{ text: string; style: TextStyle; start: number }> = [];
  for (let i = 0; i < text.length; i++) {
    const previous = result.at(-1);
    if (previous && keys.every(key => previous.style[key] === styles[i][key])) previous.text += text[i];
    else result.push({ text: text[i], style: styles[i], start: i });
  }
  return result;
}
