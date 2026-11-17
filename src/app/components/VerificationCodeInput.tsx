import { useId, useRef, useState } from 'react';
import { digitsOnly } from '../lib/digits';
import '../../styles/verification-code.css';

export const normalizeVerificationCode = (value: string, length = 4): string => digitsOnly(value).slice(0, length);

// One native text control owns typing, selection, paste and OS code suggestions.
// The boxes are only a presentation of its string value.
export function VerificationCodeInput({ value, onChange, length = 4, disabled = false, invalid = false, describedBy, autoFocus = false }: {
  value: string; onChange: (value: string) => void; length?: number; disabled?: boolean;
  invalid?: boolean; describedBy?: string; autoFocus?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(value.length);
  const update = (raw: string, position: number) => {
    const next = normalizeVerificationCode(raw, length);
    const caret = Math.min(digitsOnly(raw.slice(0, position)).length, next.length);
    onChange(next); setCursor(caret);
    window.requestAnimationFrame(() => input.current?.setSelectionRange(caret, caret));
  };
  return <div className={`otp-code${invalid ? ' is-invalid' : ''}${disabled ? ' is-disabled' : ''}`} dir="ltr">
    <label className="sr-only" htmlFor={id}>رمز التحقق المكوّن من {length} أرقام</label>
    <div className="otp-code__boxes" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length }, (_, index) => <span key={index} className={focused && Math.min(cursor, length - 1) === index ? 'is-active' : ''}>{value[index] || ''}</span>)}
    </div>
    <input id={id} ref={input} className="otp-code__input" type="text" inputMode="numeric" autoComplete="one-time-code"
      name="verification-code" dir="ltr" value={value} disabled={disabled} autoFocus={autoFocus} spellCheck={false} autoCapitalize="off"
      aria-invalid={invalid || undefined} aria-describedby={describedBy}
      onFocus={event => { setFocused(true); setCursor(event.currentTarget.selectionStart ?? value.length); }} onBlur={() => setFocused(false)}
      onSelect={event => setCursor(event.currentTarget.selectionStart ?? value.length)}
      onClick={event => {
        // Keep clicks on any box inside the same native control and place the caret nearby.
        const bounds = event.currentTarget.getBoundingClientRect();
        const position = Math.min(value.length, Math.max(0, Math.floor((event.clientX - bounds.left) / (bounds.width / length))));
        event.currentTarget.setSelectionRange(position, position); setCursor(position);
      }}
      onChange={event => update(event.target.value, event.target.selectionStart ?? event.target.value.length)}
      onPaste={event => {
        const pasted = digitsOnly(event.clipboardData.getData('text'));
        if (pasted.length < length) return; // Native selection-aware insertion handles partial corrections.
        event.preventDefault(); update(pasted, length);
      }} />
  </div>;
}
