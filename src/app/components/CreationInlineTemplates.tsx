import { usePageContext } from '../context/PageContext';
import { readCreationCategory } from '../lib/creationStart';
import { creationTemplates, saveTemplateChoice, templateGroup } from '../lib/creationTemplates';
import { TemplatePreview } from './TemplatePreview';

export function CreationInlineTemplates() {
  const { pageData, applyDesign } = usePageContext();
  const group = templateGroup(readCreationCategory());
  return <div className="grid grid-cols-3 gap-3 p-4">{creationTemplates(group).map(template => <button type="button" key={template.id} aria-label={`تطبيق قالب ${template.name}`} aria-pressed={pageData.theme.id === template.design.theme.id} onClick={() => { applyDesign(template.design); saveTemplateChoice(group, template.id); }} className="space-y-2 rounded-xl border border-[#e4ddcf] p-1 text-xs aria-pressed:border-[#ff6b2c]">
    <TemplatePreview design={template.design} sample={pageData} phone /><span className="block pb-2">{template.name}</span>
  </button>)}</div>;
}
