// Audit E01: colours that follow the theme must stay readable on the page's
// real background. A colour the owner picked is never changed silently: it is
// reported, and changes only when they press «اجعله مقروءًا».
import type { PageData } from '../context/PageContext';

const INK = '#111111';
const PAPER = '#FFFFFF';
export const READABLE_TEXT = 4.5;
export const READABLE_EDGE = 3;

const channels = (color: string) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  return hex ? [0, 2, 4].map(at => parseInt(hex.slice(at, at + 2), 16)) : null;
};
const toHex = (rgb: number[]) => `#${rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
const luminance = (color: string) => {
  const rgb = channels(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)];
  return x === null || y === null ? 21 : (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export const worstContrast = (color: string, surfaces: string[]) => Math.min(...surfaces.map(surface => contrast(color, surface)));

// The colours under the page's text. A photo or video has no single colour, so it returns null.
export function pageSurfaces(data: Pick<PageData, 'wallpaper' | 'theme'>): string[] | null {
  const { wallpaper } = data;
  if (!wallpaper) return null;
  if (wallpaper.type === 'color') return channels(wallpaper.value) ? [wallpaper.value] : null;
  if (wallpaper.type !== 'gradient') return null;
  const stops = (wallpaper.value.match(/#[0-9a-f]{6}\b|rgba?\([^)]+\)/gi) ?? []).map(stop => {
    if (stop.startsWith('#')) return stop;
    const [r, g, b] = stop.match(/\d+(\.\d+)?/g)!.map(Number);
    return toHex([r, g, b]);
  });
  return stops.length ? stops : null;
}

// Keeps the colour when it reads; otherwise the clearest of it, ink or paper.
export function readableOn(color: string, surfaces: string[] | null, minimum = READABLE_TEXT) {
  if (!surfaces?.length || !channels(color) || worstContrast(color, surfaces) >= minimum) return color;
  return [color, INK, PAPER].reduce((best, option) => worstContrast(option, surfaces) > worstContrast(best, surfaces) + 0.01 ? option : best);
}

const over = (fill: string, opacity: number, surface: string) => {
  const [top, bottom] = [channels(fill), channels(surface)];
  return top && bottom ? toHex(top.map((value, index) => value * opacity + bottom[index] * (1 - opacity))) : fill;
};

// What a button's text actually sits on.
function buttonSurfaces(data: PageData, fill: string, surfaces: string[] | null) {
  if (data.buttonStyle?.border) return surfaces;
  const opacity = (data.buttonStyle?.opacity ?? 100) / 100;
  if (opacity >= 1) return [fill];
  return surfaces ? surfaces.map(surface => over(fill, opacity, surface)) : null;
}

export function pageColors(data: PageData) {
  const theme = data.theme ?? ({} as PageData['theme']);
  const buttonStyle = data.buttonStyle ?? ({} as PageData['buttonStyle']);
  const surfaces = pageSurfaces(data);
  const text = readableOn(theme.textColor, surfaces);
  const customFill = buttonStyle.useCustomColor && buttonStyle.customColor ? buttonStyle.customColor : undefined;
  const fill = customFill ?? theme.buttonColor;
  const under = buttonSurfaces(data, fill, surfaces);
  const buttonText = buttonStyle.textColor || readableOn(buttonStyle.border ? fill : theme.buttonTextColor, under);
  const buttonEdge = buttonStyle.border && !customFill ? readableOn(fill, surfaces, READABLE_EDGE) : fill;
  // Some gradients run from light to dark, so no single colour clears the bar: the text gets a soft halo.
  const halo = surfaces && worstContrast(text, surfaces) < READABLE_TEXT
    ? `0 1px 3px ${contrast(text, INK) > contrast(text, PAPER) ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.75)'}`
    : undefined;
  // A theme's icon colour matches its own palette; it follows the readable button text.
  const same = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
  const iconFollowsTheme = same(buttonStyle.iconCustomColor, theme.textColor) || same(buttonStyle.iconCustomColor, theme.buttonColor) || same(buttonStyle.iconCustomColor, theme.buttonTextColor);
  const icon = buttonStyle.iconColor === 'custom' && buttonStyle.iconCustomColor
    ? (iconFollowsTheme ? readableOn(buttonStyle.iconCustomColor, under, READABLE_EDGE) === buttonStyle.iconCustomColor ? buttonStyle.iconCustomColor : buttonText : buttonStyle.iconCustomColor)
    : undefined;
  return { surfaces, under, text, fill, buttonText, buttonEdge, halo, icon, iconFollowsTheme };
}

export type ColorIssueId = 'name' | 'bio' | 'link' | 'headings' | 'paragraphs' | 'button' | 'buttonText' | 'icons';

// Colours the owner chose that are now hard to read, each with a safe replacement.
export function colorIssues(data: PageData): Partial<Record<ColorIssueId, string>> {
  const colors = data.customColors ?? {};
  const { surfaces, under, iconFollowsTheme } = pageColors(data);
  const buttonStyle = data.buttonStyle ?? ({} as PageData['buttonStyle']);
  const issues: Partial<Record<ColorIssueId, string>> = {};
  const check = (id: ColorIssueId, color: string | undefined, under: string[] | null, minimum = READABLE_TEXT) => {
    if (!color || !under?.length || !channels(color)) return;
    if (worstContrast(color, under) < minimum) {
      const fixed = readableOn(color, under, minimum);
      if (fixed !== color) issues[id] = fixed;
    }
  };
  check('name', colors.nameColor, surfaces);
  check('bio', colors.bioColor, surfaces);
  check('link', colors.usernameColor, surfaces);
  check('headings', colors.headingColor, surfaces);
  check('paragraphs', colors.paragraphColor, surfaces);
  check('buttonText', buttonStyle.textColor, under);
  if (buttonStyle.border && buttonStyle.useCustomColor) check('button', buttonStyle.customColor, surfaces, READABLE_EDGE);
  if (buttonStyle.iconColor === 'custom' && !iconFollowsTheme) check('icons', buttonStyle.iconCustomColor, under, READABLE_EDGE);
  return issues;
}

// One change for every flagged colour, so a single undo brings them all back.
export function readableFix(data: PageData): Pick<PageData, 'customColors' | 'buttonStyle'> {
  const issues = colorIssues(data);
  const colors = { ...(data.customColors ?? {}) };
  if (issues.name) colors.nameColor = issues.name;
  if (issues.bio) colors.bioColor = issues.bio;
  if (issues.link) colors.usernameColor = issues.link;
  if (issues.headings) colors.headingColor = issues.headings;
  if (issues.paragraphs) colors.paragraphColor = issues.paragraphs;
  return { customColors: colors, buttonStyle: { ...data.buttonStyle, ...(issues.buttonText ? { textColor: issues.buttonText } : {}), ...(issues.button ? { customColor: issues.button } : {}), ...(issues.icons ? { iconCustomColor: issues.icons } : {}) } };
}
