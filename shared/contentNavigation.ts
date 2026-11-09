export type ContentScreen = { name: 'list' } | { name: 'choose' } | { name: 'form'; id?: string };

// Existing items are edited from the list; all new content starts at the chooser.
export function contentBack(screen: ContentScreen, hasChanges = false): { target: ContentScreen; confirmDiscard: boolean } {
  return {
    target: screen.name === 'form' && !screen.id ? { name: 'choose' } : { name: 'list' },
    confirmDiscard: screen.name === 'form' && hasChanges,
  };
}
