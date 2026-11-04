import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageData, usePageContext } from '../context/PageContext';
import { PageView } from './PageView';

const WIDTH = 390;
const HEIGHT = 844;
const FRAME_HTML = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';

// One fixed mobile viewport; only its outer presentation is scaled. Hidden
// desktop/mobile copies never overwrite their last valid scale with zero.
export function PhonePreview({ data, interactive = true, onItemClick }: { data?: PageData; interactive?: boolean; onItemClick?: (id: string) => void }) {
  const { pageData } = usePageContext();
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const [readyDocument, setReadyDocument] = useState<Document | null>(null);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = (width: number) => {
      // contentRect/clientWidth use layout pixels, unlike getBoundingClientRect
      // which includes the nonprofit workspace's CSS zoom.
      if (!Number.isFinite(width) || width <= 0) return;
      const next = width / WIDTH;
      setScale(previous => previous !== null && Math.abs(previous - next) < .0001 ? previous : next);
    };
    measure(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!frameDocument) return;
    let alive = true;
    const source = window.document.head;
    const copies = new Map<Element, Node>();
    const initialLoads: Promise<void>[] = [];
    const sync = () => {
      const styles = new Set(source.querySelectorAll('style, link[rel="stylesheet"]'));
      for (const [original, copy] of copies) {
        if (!styles.has(original)) { copy.parentNode?.removeChild(copy); copies.delete(original); }
      }
      for (const original of styles) {
        const previous = copies.get(original);
        const copy = original.cloneNode(true);
        if (previous && previous.isEqualNode(copy)) continue;
        if (copy.nodeName === 'LINK') {
          initialLoads.push(new Promise<void>(resolve => {
            copy.addEventListener('load', () => resolve(), { once: true });
            copy.addEventListener('error', () => resolve(), { once: true });
          }));
        }
        if (previous) previous.parentNode?.replaceChild(copy, previous);
        else frameDocument.head.appendChild(copy);
        copies.set(original, copy);
      }
    };
    frameDocument.documentElement.lang = 'ar';
    frameDocument.documentElement.dir = 'rtl';
    frameDocument.documentElement.style.width = `${WIDTH}px`;
    frameDocument.body.style.cssText = `margin:0;width:${WIDTH}px;min-height:${HEIGHT}px;overflow-x:hidden;`;
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(source, { childList: true, subtree: true, characterData: true, attributes: true });
    // Never expose a full-size unstyled frame while CSS is still in flight.
    const timeout = window.setTimeout(() => { if (alive) setReadyDocument(frameDocument); }, 4000);
    Promise.all(initialLoads).then(() => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
      .then(() => frameDocument.fonts?.ready)
      .then(() => { if (alive) { window.clearTimeout(timeout); setReadyDocument(frameDocument); } });
    return () => {
      alive = false;
      window.clearTimeout(timeout);
      observer.disconnect();
      copies.forEach(copy => copy.parentNode?.removeChild(copy));
    };
  }, [frameDocument]);

  const ready = scale !== null && readyDocument === frameDocument && frameDocument !== null;
  return <div className="mx-auto w-full max-w-[280px] rounded-2xl border border-gray-200 bg-white p-1 shadow-lg">
    <div ref={frame} aria-busy={!ready} className="relative w-full overflow-hidden rounded-xl bg-[#f5f5f3]" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
      <iframe title="نافذة مصغرة على الصفحة الفعلية" srcDoc={FRAME_HTML} width={WIDTH} height={HEIGHT} onLoad={event => setFrameDocument(event.currentTarget.contentDocument)} tabIndex={interactive ? 0 : -1} className={`absolute left-0 top-0 origin-top-left border-0 ${interactive ? '' : 'pointer-events-none'}`} style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale ?? 0})`, visibility: ready ? 'visible' : 'hidden' }} />
      {frameDocument && createPortal(<div onClickCapture={event => { if ((event.target as Element).closest('a')) event.preventDefault(); }}><PageView data={data ?? pageData} variant="public" showIncomplete onItemClick={onItemClick} /></div>, frameDocument.body)}
    </div>
  </div>;
}
