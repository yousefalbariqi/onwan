import type { Link } from '../context/PageContext';

export type OnboardingChoice =
  | { id: string; name: string; kind: 'platform' }
  | { id: 'video' | 'image' | 'file'; name: string; kind: 'content' }
  | { id: string; name: string; kind: 'document'; docType: string };

// Only explicit selections create placeholders. Existing user content is never
// deleted; repeating completion must not duplicate the selected placeholders.
export function onboardingItems(choices: OnboardingChoice[], chosen: string[], existing: Link[]): Omit<Link, 'id'>[] {
  const selected = new Set(chosen);
  const additions: Omit<Link, 'id'>[] = [];
  for (const choice of choices) {
    if (!selected.has(choice.id)) continue;
    const current = [...existing, ...additions];
    const base = { url: '', iconStyle: 'color' as const, textPosition: 'center' as const, hidden: true };
    if (choice.kind === 'platform') {
      if (!current.some(link => link.platform === choice.id && !(choice.id === 'youtube' && link.title === 'مقطع' && !link.url))) additions.push({ ...base, title: choice.name, platform: choice.id as Link['platform'], linkType: 'url' });
    } else if (choice.kind === 'document') {
      if (!current.some(link => link.display?.kind === 'document' && link.display.docType === choice.docType)) additions.push({ ...base, title: choice.name, platform: 'file', linkType: 'file', fileCategory: 'other', display: { kind: 'document', docType: choice.docType } });
    } else if (choice.id === 'video') {
      if (!current.some(link => link.platform === 'youtube' && link.title === 'مقطع')) additions.push({ ...base, title: 'مقطع', platform: 'youtube', linkType: 'url' });
    } else {
      const title = choice.id === 'image' ? 'صورة' : 'ملف';
      if (!current.some(link => link.platform === 'file' && link.title === title && !link.display?.kind)) additions.push({ ...base, title, platform: 'file', linkType: 'file', fileCategory: 'other' });
    }
  }
  return additions;
}
