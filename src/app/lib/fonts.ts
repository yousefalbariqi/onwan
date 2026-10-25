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
const customLoaded = new Map<string, string>();
export function customFontFamily(url: string) {
  return `onwan-font-${url.replace(/[^a-z0-9]/gi, '').slice(-16)}`;
}
export function loadCustomFont(url: string | undefined) {
  if (!url || customLoaded.has(url) || typeof document === 'undefined') return;
  const family = customFontFamily(url);
  customLoaded.set(url, family);
  const face = new FontFace(family, `url(${JSON.stringify(url)})`);
  face.load().then((loadedFace) => document.fonts.add(loadedFace)).catch(() => customLoaded.delete(url));
}
