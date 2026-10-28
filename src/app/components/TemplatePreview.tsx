import { mergeWithDefaults } from '../context/PageContext';
import { TEMPLATE_SAMPLE, type TemplateDesign } from '../lib/pageDesign';
import { PageView } from './PageView';

// A template's cover: its design drawn on the generic sample page, at half
// size — so no picture is uploaded and it always matches the template.
export function TemplatePreview({ design }: { design: TemplateDesign }) {
  const data = mergeWithDefaults({ ...TEMPLATE_SAMPLE, ...design });
  return (
    <div className="pointer-events-none relative aspect-[9/13] w-full overflow-hidden rounded-2xl border border-[#E7E7E7] bg-white" aria-hidden="true" inert>
      <div className="absolute right-0 top-0 w-[200%] origin-top-right scale-50">
        <PageView data={data} variant="preview" showIncomplete />
      </div>
    </div>
  );
}
