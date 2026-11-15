export const CREATION_CATEGORIES = [
  { id: 'personal', label: 'صفحة شخصية', icon: 'person' },
  { id: 'creator', label: 'صانع محتوى', icon: 'video' },
  { id: 'business', label: 'نشاط تجاري', icon: 'store' },
  { id: 'nonprofit', label: 'جمعية أو جهة غير ربحية', icon: 'heart' },
] as const;

export type CreationCategory = typeof CREATION_CATEGORIES[number]['id'];
const KEY = 'onwan_creation_category_v1';
export const isCreationCategory = (value: unknown): value is CreationCategory => CREATION_CATEGORIES.some(item => item.id === value);
export function readCreationCategory(): CreationCategory | null {
  try {
    const value = sessionStorage.getItem(KEY);
    return isCreationCategory(value) ? value : null;
  } catch { return null; }
}
export function saveCreationCategory(value: CreationCategory) {
  try { sessionStorage.setItem(KEY, value); } catch { /* Choosing still works when browser storage is unavailable. */ }
}
