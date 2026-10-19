import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageData, usePageContext } from '../context/PageContext';
import { PageView } from './PageView';

const WIDTH = 390;
const HEIGHT = 844;

// Render the real page first, then scale the whole scene uniformly into a compact window.
// The portal shares the live draft without serializing it or loading a saved page.
export function PhonePreview({ data, interactive = true }: { data?: PageData; interactive?: boolean }) {
  const { pageData } = usePageContext();
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [document, setDocument] = useState<Document | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / WIDTH));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document) return;
    const source = window.document.head;
    const copies = new Map<Element, Node>();
    const sync = () => {
      const styles = new Set(source.querySelectorAll('style, link[rel="stylesheet"]'));
      for (const [original, copy] of copies) {
        if (!styles.has(original)) { copy.parentNode?.removeChild(copy); copies.delete(original); }
      }
      for (const original of styles) {
        const previous = copies.get(original);
        const copy = original.cloneNode(true);
        if (previous && previous.isEqualNode(copy)) continue;
        if (previous) previous.parentNode?.replaceChild(copy, previous);
        else document.head.appendChild(copy);
        copies.set(original, copy);
      }
    };
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.body.style.margin = '0';
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(source, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => { observer.disconnect(); copies.forEach(copy => copy.parentNode?.removeChild(copy)); };
  }, [document]);

  return (
    <div className="mx-auto w-full max-w-[280px] rounded-2xl border border-gray-200 bg-white p-1 shadow-lg">
      <div ref={frame} className="relative w-full overflow-hidden rounded-xl bg-white" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <iframe title="نافذة مصغرة على الصفحة الفعلية" srcDoc={'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'} onLoad={event => setDocument(event.currentTarget.contentDocument)} tabIndex={interactive ? 0 : -1} className={`absolute left-0 top-0 origin-top-left border-0 ${interactive ? '' : 'pointer-events-none'}`} style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})` }} />
        {document && createPortal(<div onClickCapture={event => { if ((event.target as Element).closest('a')) event.preventDefault(); }}><PageView data={data ?? pageData} variant="public" /></div>, document.body)}
      </div>
    </div>
  );
}
