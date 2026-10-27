// Section keys are independent of database row ids, which change on every save.
export interface SectionItem {
  id?: string;
  hidden?: boolean;
  display?: { kind?: 'heading' | 'video' | 'text' | 'document'; sectionId?: string };
}

export function arrangeSections<T extends SectionItem>(items: T[]): T[] {
  const sections = new Set<string>();
  const clean = items.map(item => {
    const key = item.display?.sectionId;
    if (item.display?.kind !== 'heading' || !key) return item;
    if (!sections.has(key)) { sections.add(key); return item; }
    return { ...item, display: { ...item.display, sectionId: undefined } };
  }).map(item => {
    const key = item.display?.sectionId;
    return key && !sections.has(key) ? { ...item, display: { ...item.display, sectionId: undefined } } : item;
  });
  return clean.flatMap(item => {
    const key = item.display?.sectionId;
    if (!key) return [item];
    if (item.display?.kind !== 'heading') return [];
    return [item, ...clean.filter(child => child.display?.kind !== 'heading' && child.display?.sectionId === key)];
  });
}

export function visibleSectionItems<T extends SectionItem>(items: T[]): T[] {
  const hidden = new Set(items.filter(item => item.hidden && item.display?.kind === 'heading').map(item => item.display?.sectionId).filter(Boolean));
  return arrangeSections(items).filter(item => !item.hidden && !hidden.has(item.display?.sectionId));
}

export function sectionBlocks<T extends SectionItem>(items: T[]): T[][] {
  const blocks: T[][] = [];
  for (const item of arrangeSections(items)) {
    if (item.display?.kind !== 'heading' && item.display?.sectionId && blocks.length) blocks[blocks.length - 1].push(item);
    else blocks.push([item]);
  }
  return blocks;
}

export function saveSectionItem<T extends SectionItem>(items: T[], item: T, memberIds?: string[]): T[] {
  let next = items.some(value => value.id === item.id) ? items.map(value => value.id === item.id ? item : value) : [...items, item];
  const key = item.display?.sectionId;
  if (item.display?.kind === 'heading' && key && memberIds) {
    const members = new Set(memberIds);
    next = next.map(value => value.display?.kind === 'heading' ? value : members.has(value.id ?? '')
      ? { ...value, display: { ...value.display, sectionId: key } }
      : value.display?.sectionId === key ? { ...value, display: { ...value.display, sectionId: undefined } } : value);
  }
  return arrangeSections(next);
}

export function moveSectionItem<T extends SectionItem>(items: T[], id: string, direction: 'up' | 'down'): T[] {
  const item = items.find(value => value.id === id);
  if (!item) return items;
  const key = item.display?.kind !== 'heading' ? item.display?.sectionId : undefined;
  const blocks = sectionBlocks(items);
  if (key) {
    const block = blocks.find(values => values[0].display?.sectionId === key);
    if (!block) return items;
    const index = block.findIndex(value => value.id === id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (target < 1 || target >= block.length) return items;
    [block[index], block[target]] = [block[target], block[index]];
  } else {
    const index = blocks.findIndex(values => values[0].id === id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= blocks.length) return items;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  }
  return blocks.flat();
}

export function reorderSectionItem<T extends SectionItem>(items: T[], id: string, targetId: string): T[] {
  if (id === targetId) return items;
  const item = items.find(value => value.id === id);
  const target = items.find(value => value.id === targetId);
  if (!item || !target) return items;
  if (item.display?.kind === 'heading') {
    const blocks = sectionBlocks(items);
    const from = blocks.findIndex(values => values[0].id === id);
    const to = blocks.findIndex(values => values.some(value => value.id === targetId));
    if (from === to || from < 0 || to < 0) return items;
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    return blocks.flat();
  }
  const next = items.filter(value => value.id !== id);
  const index = next.findIndex(value => value.id === targetId);
  const key = target.display?.sectionId;
  const moved = { ...item, display: { ...item.display, sectionId: key } };
  next.splice(index + (target.display?.kind === 'heading' && key ? 1 : 0), 0, moved);
  return arrangeSections(next);
}
