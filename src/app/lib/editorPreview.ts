import { saveSectionItem } from '../../../shared/linkSections';
import type { Link, PageData } from '../context/PageContext';

// Incomplete form values are visual-only. They never enter published links.
export function editorPreview(data: PageData): PageData {
  const pending = data.editorForm;
  const form = pending?.form;
  if (!form || pending.screen?.name !== 'form') return data;
  const id = pending.screen.id || 'onwan-unfinished-preview';
  const heading = form.kind === 'group' || (form.kind === 'text' && form.textStyle === 'heading');
  const display = form.kind === 'group'
    ? { ...form.display, kind: 'heading', sectionId: form.display?.sectionId || 'onwan-preview-section' }
    : heading ? { kind: 'heading' }
    : form.kind === 'text' ? { ...form.display, kind: 'text' } : form.display;
  const existing = data.links.find(link => link.id === id);
  const item: Link = {
    ...existing, id,
    title: form.kind === 'group' && form.noName ? '' : form.title || (form.kind === 'text' ? form.display?.body : 'محتوى جديد') || 'محتوى جديد',
    url: heading || form.kind === 'text' ? '' : form.url || '',
    platform: (form.kind === 'file' ? 'file' : form.platform || 'custom') as Link['platform'],
    linkType: form.kind === 'file' ? 'file' : 'url',
    iconStyle: form.iconStyle, textPosition: form.textPosition, hidden: false,
    customIcon: form.customIcon, display,
    fileName: form.fileName, fileMimeType: form.fileMimeType, fileSize: form.fileSize, fileCategory: form.fileCategory,
  };
  return { ...data, links: saveSectionItem(data.links, item, form.kind === 'group' ? form.sectionMembers : undefined) };
}
