// Arabic-Indic (٠-٩) and Eastern/Persian (۰-۹) digits → ASCII 0-9, so a user can
// type or paste «٠٥٥» in a numeric field and it is stored as «055». Letters are
// left for the field's own filter to drop.
export function toAsciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660); // Arabic-Indic
    return String(code - 0x06f0); // Extended Arabic-Indic (Persian)
  });
}

// Keep only ASCII digits, converting Arabic ones first (for codes / plain numbers).
export const digitsOnly = (value: string): string => toAsciiDigits(value).replace(/[^0-9]/g, '');
