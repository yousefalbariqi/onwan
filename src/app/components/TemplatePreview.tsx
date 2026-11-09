import { useLayoutEffect, useRef, useState } from 'react';
import { mergeWithDefaults } from '../context/PageContext';
import { TEMPLATE_SAMPLE, TEMPLATE_SCENARIOS, type TemplateDesign } from '../lib/pageDesign';
import { PageView } from './PageView';

// A template's cover: its design drawn on the generic sample page, at half
// size — so no picture is uploaded and it always matches the template.
export function TemplatePreview({ design, phone = false, scenario = 'standard', viewportWidth = 390 }: { design: TemplateDesign; phone?: boolean; scenario?: keyof typeof TEMPLATE_SCENARIOS; viewportWidth?: number }) {
  if (phone) return <PhoneTemplatePreview design={design} scenario={scenario} viewportWidth={viewportWidth} />;
  const data = mergeWithDefaults({ ...TEMPLATE_SAMPLE, ...design });
  return (
    <div className="pointer-events-none relative aspect-[9/13] w-full overflow-hidden rounded-2xl border border-[#E7E7E7] bg-white" aria-hidden="true" inert>
      <div className="absolute right-0 top-0 w-[200%] origin-top-right scale-50">
        <PageView data={data} variant="preview" showIncomplete />
      </div>
    </div>
  );
}

// Render a real 390 × 844 page, then scale the viewport as a whole. Text and
// images keep the same wrapping/proportions regardless of thumbnail width.
function PhoneTemplatePreview({ design, scenario, viewportWidth }: { design: TemplateDesign; scenario: keyof typeof TEMPLATE_SCENARIOS; viewportWidth: number }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => { if (element.clientWidth > 0) setScale(element.clientWidth / viewportWidth); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportWidth]);
  const data = mergeWithDefaults({ ...TEMPLATE_SCENARIOS[scenario], ...design });
  return <div ref={frame} aria-hidden="true" inert style={{ aspectRatio: `${viewportWidth}/844` }} className="pointer-events-none relative w-full overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-[#E7E7E7]">
    <div className="absolute right-0 top-0 origin-top-right [&>div]:!min-h-[844px]" style={{ width: viewportWidth, minHeight: 844, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
      <PageView data={data} variant="preview" showIncomplete />
    </div>
  </div>;
}
