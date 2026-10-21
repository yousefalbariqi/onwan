// Saving speed (note 28): uploaded images and files are inline data URLs, often
// megabytes each. A save sends a value that is unchanged since the last save
// as KEPT instead of its body, and the server puts the stored value back; the
// response is slimmed the same way and the editor restores it from its draft.
// Links are matched by id (ids are stable across saves).

export const KEPT = '__onwan_kept__';

type TransferLink = { id?: string; url?: string; customIcon?: string; display?: { image?: string } | null };
type Transferable = {
  profileImage?: string;
  wallpaper?: { value?: string; poster?: string };
  links?: TransferLink[];
};

const heavy = (value: unknown): value is string => typeof value === 'string' && value.startsWith('data:');

// Replaces every heavy value of `data` that equals the same value in `reference` with KEPT.
export function slimPageData<T extends Transferable>(data: T, reference: Transferable | null | undefined): T {
  if (!reference) return data;
  const same = (value: unknown, previous: unknown) => (heavy(value) && value === previous ? KEPT : value);
  const previousLinks = new Map((reference.links ?? []).filter((link) => link.id).map((link) => [link.id, link]));
  return {
    ...data,
    ...(data.profileImage !== undefined ? { profileImage: same(data.profileImage, reference.profileImage) } : {}),
    ...(data.wallpaper ? { wallpaper: { ...data.wallpaper, value: same(data.wallpaper.value, reference.wallpaper?.value), ...(data.wallpaper.poster !== undefined ? { poster: same(data.wallpaper.poster, reference.wallpaper?.poster) } : {}) } } : {}),
    ...(data.links ? {
      links: data.links.map((link) => {
        const previous = link.id ? previousLinks.get(link.id) : undefined;
        if (!previous) return link;
        return {
          ...link,
          url: same(link.url, previous.url),
          ...(link.customIcon !== undefined ? { customIcon: same(link.customIcon, previous.customIcon) } : {}),
          ...(link.display?.image !== undefined ? { display: { ...link.display, image: same(link.display.image, previous.display?.image) } } : {}),
        };
      }),
    } : {}),
  };
}

export function hasKept(data: Transferable) {
  return JSON.stringify(data).includes(KEPT);
}

// Puts the reference's values back in place of KEPT. Returns null when a KEPT
// value has nothing to come from (the reference changed meanwhile).
export function expandPageData<T extends Transferable>(data: T, reference: Transferable | null | undefined): T | null {
  let missing = false;
  const take = (value: unknown, previous: unknown) => {
    if (value !== KEPT) return value;
    if (!heavy(previous)) missing = true;
    return previous;
  };
  const previousLinks = new Map((reference?.links ?? []).filter((link) => link.id).map((link) => [link.id, link]));
  const expanded = {
    ...data,
    ...(data.profileImage !== undefined ? { profileImage: take(data.profileImage, reference?.profileImage) } : {}),
    ...(data.wallpaper ? { wallpaper: { ...data.wallpaper, value: take(data.wallpaper.value, reference?.wallpaper?.value), ...(data.wallpaper.poster !== undefined ? { poster: take(data.wallpaper.poster, reference?.wallpaper?.poster) } : {}) } } : {}),
    ...(data.links ? {
      links: data.links.map((link) => {
        const previous = link.id ? previousLinks.get(link.id) : undefined;
        return {
          ...link,
          url: take(link.url, previous?.url),
          ...(link.customIcon !== undefined ? { customIcon: take(link.customIcon, previous?.customIcon) } : {}),
          ...(link.display?.image !== undefined ? { display: { ...link.display, image: take(link.display.image, previous?.display?.image) } } : {}),
        };
      }),
    } : {}),
  } as T;
  return missing ? null : expanded;
}
