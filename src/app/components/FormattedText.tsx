import { textRuns, type TextFormat } from '../../../shared/textFormatting';
export function FormattedText({ text, format }: { text: string; format?: TextFormat }) {
  if (!format?.length) return <>{text}</>;
  let offset = 0;
  return <>{text.split('\n').map((line, index) => {
    const start = offset; offset += line.length + 1;
    const ranges = format.map(range => ({ ...range, start: Math.max(0, range.start - start), end: Math.min(line.length, range.end - start) })).filter(range => range.end > range.start);
    const align = ranges.find(range => range.align)?.align;
    return <span key={index} style={{ display: 'block', textAlign: align, whiteSpace: 'pre-wrap', minHeight: line ? undefined : '1em' }}>{textRuns(line, ranges).map(run => <span key={run.start} style={{ fontWeight: run.style.bold ? 700 : undefined, fontStyle: run.style.italic ? 'italic' : undefined, textDecoration: run.style.underline ? 'underline' : undefined }}>{run.text}</span>)}</span>;
  })}</>;
}
