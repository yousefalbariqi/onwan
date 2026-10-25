import { forwardRef, useImperativeHandle, useRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Note 37: every password field has an eye to show / hide what was typed.
// Switching keeps the value, the focus and the caret where they were.
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function PasswordInput({ style, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current as HTMLInputElement);

  const toggle = () => {
    const element = input.current;
    const start = element?.selectionStart ?? null;
    const end = element?.selectionEnd ?? null;
    setVisible((value) => !value);
    requestAnimationFrame(() => {
      if (!element || start === null || end === null) return;
      element.focus();
      element.setSelectionRange(start, end);
    });
  };

  return (
    <div className="relative">
      <input ref={input} {...props} type={visible ? 'text' : 'password'} autoCapitalize="off" autoCorrect="off" spellCheck={false} style={{ ...style, paddingLeft: 44 }} />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
        aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        aria-pressed={visible}
        className="absolute inset-y-0 left-0 flex w-11 items-center justify-center text-[#8e8e93] hover:text-[#3a3a3c] focus-visible:text-[#0a84ff] focus-visible:outline-none"
      >
        {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
});
