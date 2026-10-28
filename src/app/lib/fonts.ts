import type { FontId } from '../context/PageContext';

// Each page font is loaded only when it is needed: the public page loads its
// own font, the editor loads the ones it is showing. Cairo and Tajawal are
// already loaded globally (styles/fonts.css).
const LOADERS: Record<FontId, () => Promise<unknown>> = {
  cairo: () => Promise.resolve(),
  tajawal: () => Promise.resolve(),
  almarai: () => Promise.all([import('@fontsource/almarai/400.css'), import('@fontsource/almarai/800.css')]),
  plex: () => Promise.all([import('@fontsource/ibm-plex-sans-arabic/400.css'), import('@fontsource/ibm-plex-sans-arabic/700.css')]),
  readex: () => Promise.all([import('@fontsource/readex-pro/400.css'), import('@fontsource/readex-pro/700.css')]),
  amiri: () => Promise.all([import('@fontsource/amiri/400.css'), import('@fontsource/amiri/700.css')]),
  naskh: () => Promise.all([import('@fontsource/noto-naskh-arabic/400.css'), import('@fontsource/noto-naskh-arabic/700.css')]),
  markazi: () => Promise.all([import('@fontsource/markazi-text/400.css'), import('@fontsource/markazi-text/700.css')]),
  kufi: () => Promise.all([import('@fontsource/noto-kufi-arabic/400.css'), import('@fontsource/noto-kufi-arabic/800.css')]),
  reemkufi: () => Promise.all([import('@fontsource/reem-kufi/400.css'), import('@fontsource/reem-kufi/700.css')]),
  changa: () => Promise.all([import('@fontsource/changa/400.css'), import('@fontsource/changa/800.css')]),
  messiri: () => Promise.all([import('@fontsource/el-messiri/400.css'), import('@fontsource/el-messiri/700.css')]),
  alexandria: () => Promise.all([import('@fontsource/alexandria/400.css'), import('@fontsource/alexandria/800.css')]),
  lalezar: () => import('@fontsource/lalezar/400.css'),
  lemonada: () => Promise.all([import('@fontsource/lemonada/400.css'), import('@fontsource/lemonada/700.css')]),
  ruqaa: () => Promise.all([import('@fontsource/aref-ruqaa/400.css'), import('@fontsource/aref-ruqaa/700.css')]),
};

const loaded = new Set<string>();

export function loadFont(id: string | undefined) {
  if (!id || loaded.has(id) || !(id in LOADERS)) return;
  loaded.add(id);
  LOADERS[id as FontId]().catch(() => loaded.delete(id));
}

// Note (9): an uploaded font, registered once per file under a safe family
// name derived from its link (never from user text).
// Note 26: registered in the document that shows it — the editor's preview is
// its own frame, with its own font list, so a font added only to the main
// page never reached it.
const customLoaded = new WeakMap<Document, Set<string>>();
export function customFontFamily(url: string) {
  return `onwan-font-${url.replace(/[^a-z0-9]/gi, '').slice(-16)}`;
}
export function loadCustomFont(url: string | undefined, target?: Document | null) {
  const doc = target ?? (typeof document === 'undefined' ? null : document);
  if (!url || !doc) return;
  const done = customLoaded.get(doc) ?? new Set<string>();
  customLoaded.set(doc, done);
  if (done.has(url)) return;
  done.add(url);
  const face = new FontFace(customFontFamily(url), `url(${JSON.stringify(new URL(url, window.location.href).href)})`);
  face.load().then((loadedFace) => doc.fonts.add(loadedFace)).catch(() => done.delete(url));
}

// Note 26: an uploaded font stays with the page while another font is tried;
// `useCustomFont: false` only switches it off.
export const customFontActive = (typography?: { customFont?: { url: string }; useCustomFont?: boolean }) =>
  Boolean(typography?.customFont && typography.useCustomFont !== false);
