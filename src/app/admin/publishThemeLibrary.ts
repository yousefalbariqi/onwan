import { LIBRARY_THEMES } from '../lib/themePilot';
import type { PageTemplate } from '../lib/pageDesign';

type Call = <T = any>(action: string, params?: Record<string, unknown>) => Promise<T>;
export async function publishThemeLibrary(call: Call, progress: (done: number) => void) {
  const existing = new Map<string, PageTemplate>();
  let offset = 0;
  while (true) {
    const batch = await call<{ templates: PageTemplate[]; more: boolean }>('templates.list', { offset });
    batch.templates.forEach(t => existing.set(t.design.theme.id, t));
    if (!batch.more || !batch.templates.length) break;
    offset += batch.templates.length;
  }
  let cursor = 0, done = 0, added = 0;
  const worker = async () => {
    while (cursor < LIBRARY_THEMES.length) {
      const seed = LIBRARY_THEMES[cursor++];
      let template = existing.get(seed.design.theme.id);
      if (!template) {
        template = (await call<{ template: PageTemplate }>('templates.save', { name: seed.name, category: seed.category, design: seed.design })).template;
        added++;
      }
      // Existing designs (including the owner's edited pilot) are preserved.
      if (template.status !== 'visible') await call('templates.setStatus', { id: template.id, status: 'visible' });
      progress(++done);
    }
  };
  // Bound concurrency and wait for every running operation before reporting
  // errors, so a retry can safely resume from the stored design ids.
  const results = await Promise.allSettled([worker(), worker(), worker()]);
  const failed = results.find(r => r.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  const verified = new Map<string, PageTemplate>();
  offset = 0;
  while (true) {
    const batch = await call<{ templates: PageTemplate[]; more: boolean }>('templates.list', { offset });
    batch.templates.forEach(t => verified.set(t.design.theme.id, t));
    if (!batch.more || !batch.templates.length) break;
    offset += batch.templates.length;
  }
  if (LIBRARY_THEMES.some(t => verified.get(t.design.theme.id)?.status !== 'visible')) throw new Error('لم يكتمل إظهار المكتبة. أعد المحاولة لاستكمال البقية.');
  return { added, visible: LIBRARY_THEMES.length };
}
