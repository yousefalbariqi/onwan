import { useEffect } from 'react';

// Note (1), 25 Oct 2026: no white bands above or below the page on phones.
// The page reaches the screen edges (viewport-fit=cover); this paints the
// status-bar area (theme-color) and everything outside the page — the safe
// areas and the iOS rubber-band — in the colours actually showing at the top
// and the bottom of the screen, for every page, and follows them as they change
// (a customer's wallpaper, a gradient, the editor, the cart…).

const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;

// The first and last colours of a gradient, or the plain colour, of the
// nearest painted element under a screen point.
function colourAt(x: number, y: number, edge: 'top' | 'bottom') {
  let element = document.elementFromPoint(x, y) as HTMLElement | null;
  while (element && element !== document.documentElement) {
    const style = getComputedStyle(element);
    const stops = style.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi);
    if (style.backgroundImage.includes('gradient') && stops?.length) return edge === 'top' ? stops[0] : stops[stops.length - 1];
    if (!TRANSPARENT.test(style.backgroundColor)) return style.backgroundColor;
    element = element.parentElement;
  }
  return null;
}

function apply() {
  const width = window.innerWidth;
  const top = colourAt(width / 2, 2, 'top');
  const bottom = colourAt(width / 2, window.innerHeight - 2, 'bottom') ?? top;
  if (!top) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  if (meta.content !== top) meta.content = top;
  // Above the page: the top colour; below it and on overscroll: the bottom one.
  document.documentElement.style.background = `linear-gradient(${top} 50%, ${bottom} 50%)`;
  document.documentElement.style.backgroundColor = bottom ?? top;
  document.body.style.backgroundColor = 'transparent';
}

export function EdgeColors() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    schedule();
    // Pages change their colours as people edit, navigate or scroll.
    const observer = new MutationObserver(schedule);
    observer.observe(document.getElementById('root') ?? document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
    };
  }, []);
  return null;
}
