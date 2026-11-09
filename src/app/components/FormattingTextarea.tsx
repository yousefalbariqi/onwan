import { useRef, useState, type TextareaHTMLAttributes } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline, Ellipsis, Type, RemoveFormatting } from 'lucide-react';
import { applyTextStyle, editTextFormat, type TextFormat, type TextStyle } from '../../../shared/textFormatting';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; format?: TextFormat; onChange: (text: string, format: TextFormat) => void };
export function FormattingTextarea({ value, format, onChange, ...props }: Props) {
  const field = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [selected, setSelected] = useState({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false), [pinned, setPinned] = useState(false), [more, setMore] = useState(false);
  const apply = (key: keyof TextStyle | 'clear', align?: TextStyle['align']) => {
    const { start, end } = selection.current;
    if (start === end && key !== 'align') return;
    onChange(value, applyTextStyle(value, format, start, end, key, align));
    field.current?.focus(); field.current?.setSelectionRange(start, end);
  };
  const tools = [{ Icon: Bold, label: 'عريض', key: 'bold' }, { Icon: Italic, label: 'مائل', key: 'italic' }, { Icon: Underline, label: 'تسطير', key: 'underline' }, { Icon: AlignRight, label: 'محاذاة الفقرة يمينًا', align: 'right' }, { Icon: AlignCenter, label: 'محاذاة الفقرة وسطًا', align: 'center' }, { Icon: AlignLeft, label: 'محاذاة الفقرة يسارًا', align: 'left' }] as const;
  return <div onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { setFocused(false); setMore(false); } }}>
    <textarea {...props} ref={field} value={value} onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; setSelected(selection.current); }} onChange={event => onChange(event.target.value, editTextFormat(value, event.target.value, format))} onKeyDown={event => {
      props.onKeyDown?.(event);
      if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'u'].includes(event.key.toLowerCase())) { event.preventDefault(); apply(({ b: 'bold', i: 'italic', u: 'underline' } as const)[event.key.toLowerCase() as 'b' | 'i' | 'u']); }
    }} />
    <div className="flex min-h-8 flex-wrap items-center gap-1 text-[#6e6e73]">
      <button type="button" title="تنسيق النص" aria-label="تنسيق النص" aria-expanded={focused || pinned} aria-pressed={pinned} onClick={() => setPinned(!pinned)} className="rounded-lg p-1.5 hover:bg-black/5"><Type size={17} /></button>
      {(focused || pinned) && <div role="toolbar" aria-label="أدوات تنسيق النص" className="flex flex-wrap items-center gap-0.5">
        {tools.map(tool => <button key={tool.label} type="button" title={tool.label} aria-label={tool.label} aria-pressed={'key' in tool ? selected.end > selected.start && Array.from({ length: selected.end - selected.start }, (_, i) => selected.start + i).every(i => format?.some(range => range.start <= i && range.end > i && range[tool.key])) : undefined} onMouseDown={event => event.preventDefault()} onClick={() => apply('key' in tool ? tool.key : 'align', 'align' in tool ? tool.align : undefined)} className="rounded-lg p-1.5 hover:bg-black/5 focus-visible:outline-2 aria-pressed:bg-black/10 aria-pressed:text-[#111111]"><tool.Icon size={17} /></button>)}
        <button type="button" aria-label="المزيد من أدوات التنسيق" aria-expanded={more} onMouseDown={event => event.preventDefault()} onClick={() => setMore(!more)} className="rounded-lg p-1.5 hover:bg-black/5"><Ellipsis size={17} /></button>
        {more && <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => apply('clear')} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-black/5"><RemoveFormatting size={15} />مسح تنسيق المحدد</button>}
      </div>}
    </div>
  </div>;
}
