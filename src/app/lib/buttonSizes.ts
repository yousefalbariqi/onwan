import type { PageData } from '../context/PageContext';

// Notes 34: what the presets measure, and the bounds of the exact sizes, so a
// text or a logo can never spill out of its button.
export const BUTTON_PRESETS = {
  small: { height: 44, font: 14, icon: 20 },
  medium: { height: 56, font: 16, icon: 24 },
  large: { height: 68, font: 18, icon: 26 },
} as const;

export const BUTTON_LIMITS = {
  height: { min: 36, max: 96 },
  font: { min: 12, max: 28 },
  icon: { min: 14, max: 40 },
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// The effective sizes of a button: exact values where set, else the preset.
export function buttonMetrics(style: PageData['buttonStyle']) {
  const preset = BUTTON_PRESETS[style.size ?? 'medium'];
  const height = clamp(style.heightPx ?? preset.height, BUTTON_LIMITS.height.min, BUTTON_LIMITS.height.max);
  // Text and logo always leave room inside the button's height.
  const font = clamp(style.fontPx ?? preset.font, BUTTON_LIMITS.font.min, Math.min(BUTTON_LIMITS.font.max, Math.floor(height * 0.5)));
  const icon = clamp(style.iconPx ?? preset.icon, BUTTON_LIMITS.icon.min, Math.min(BUTTON_LIMITS.icon.max, height - 12));
  return { height, font, icon, custom: style.heightPx !== undefined || style.fontPx !== undefined || style.iconPx !== undefined };
}

export const FONT_WEIGHTS = { normal: 400, medium: 500, bold: 700 } as const;
