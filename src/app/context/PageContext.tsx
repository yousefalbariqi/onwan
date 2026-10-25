import { arrangeSections, moveSectionItem, reorderSectionItem, saveSectionItem } from '../../../shared/linkSections';
import { expandPageData, slimPageData } from '../../../shared/pageTransfer';
import { moveInlineMedia } from '../lib/mediaUpload';
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Account, ApiError, fetchMyPage, saveMyDraft, saveMyPage } from '../lib/api';
import { DRAFT_STORAGE_KEY, HISTORY_STORAGE_PREFIX, SESSION_CLEARED_EVENT, clearLocalAccountData, clearSessionToken, getSessionToken, sessionOwner } from '../lib/session';
import { MAX_LINKS } from '../lib/site';

export interface LinkDisplay {
  kind?: 'heading' | 'video' | 'text';
  sectionLayout?: 'list' | 'grid' | 'carousel';
  body?: string;
  bodyEn?: string;
  sectionId?: string;
  layout?: 'card';
  image?: string;
  imageFit?: 'cover' | 'contain';
  positionX?: number;
  positionY?: number;
}

export interface Link {
  id: string;
  title: string;
  url: string;
  platform?: 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin' | 'github' | 'facebook' | 'snapchat' | 'whatsapp' | 'telegram' | 'website' | 'email' | 'custom' | 'file';
  linkType?: 'url' | 'file';
  fileCategory?: 'cv' | 'menu' | 'other';
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  iconStyle?: 'color' | 'mono';
  textPosition?: 'center' | 'right';
  hidden?: boolean; // مخفي عن الجمهور دون حذف
  titleEn?: string; // عنوان الزر في النسخة الإنجليزية
  // 'icon:<id>' from lib/linkIcons.tsx, or an uploaded image (data URL).
  customIcon?: string;
  display?: LinkDisplay;
}

export interface Theme {
  id: string;
  name: string;
  background: string;
  buttonColor: string;
  buttonTextColor: string;
  textColor: string;
}

export const FONT_CATEGORIES = [
  { id: 'modern', label: 'حديث' },
  { id: 'classic', label: 'كلاسيكي' },
  { id: 'kufi', label: 'كوفي' },
  { id: 'elegant', label: 'أنيق' },
  { id: 'display', label: 'عناوين' },
] as const;

// Ids are stored in pages.typography_json — never rename an existing one.
// Each font must also have a loader in lib/fonts.ts.
export const FONT_OPTIONS = [
  { id: 'cairo', name: 'Cairo', family: 'Cairo, sans-serif', category: 'modern' },
  { id: 'tajawal', name: 'Tajawal', family: 'Tajawal, sans-serif', category: 'modern' },
  { id: 'almarai', name: 'Almarai', family: 'Almarai, sans-serif', category: 'modern' },
  { id: 'plex', name: 'IBM Plex Arabic', family: "'IBM Plex Sans Arabic', sans-serif", category: 'modern' },
  { id: 'readex', name: 'Readex Pro', family: "'Readex Pro', sans-serif", category: 'modern' },
  { id: 'amiri', name: 'Amiri', family: 'Amiri, serif', category: 'classic' },
  { id: 'naskh', name: 'Noto Naskh', family: "'Noto Naskh Arabic', serif", category: 'classic' },
  { id: 'markazi', name: 'Markazi', family: "'Markazi Text', serif", category: 'classic' },
  { id: 'kufi', name: 'Noto Kufi', family: "'Noto Kufi Arabic', sans-serif", category: 'kufi' },
  { id: 'reemkufi', name: 'Reem Kufi', family: "'Reem Kufi', sans-serif", category: 'kufi' },
  { id: 'changa', name: 'Changa', family: 'Changa, sans-serif', category: 'kufi' },
  { id: 'messiri', name: 'El Messiri', family: "'El Messiri', sans-serif", category: 'elegant' },
  { id: 'alexandria', name: 'Alexandria', family: 'Alexandria, sans-serif', category: 'elegant' },
  { id: 'lalezar', name: 'Lalezar', family: 'Lalezar, sans-serif', category: 'display' },
  { id: 'lemonada', name: 'Lemonada', family: 'Lemonada, sans-serif', category: 'display' },
  { id: 'ruqaa', name: 'Aref Ruqaa', family: "'Aref Ruqaa', serif", category: 'display' },
] as const;

export type FontId = (typeof FONT_OPTIONS)[number]['id'];

export interface PageData {
  username: string;
  profileImage: string;
  name: string;
  bio: string;
  contactPhone?: string; // يظهران في بطاقة جهة الاتصال VCF
  contactEmail?: string;
  translations?: { en?: { name?: string; bio?: string } }; // النسخة الإنجليزية (إدخال يدوي)
  links: Link[];
  theme: Theme;
  wallpaper: {
    type: 'color' | 'gradient' | 'image' | 'video';
    value: string;
    position?: 'top' | 'center' | 'bottom';
    // Background photo framing from «تنسيق»: focus 0–100 % and zoom 1–3.
    positionX?: number;
    positionY?: number;
    zoom?: number;
    dim?: number; // تعتيم الخلفية 0-80
    poster?: string;
    uploaded?: boolean;
    fileName?: string;
    fileSize?: number;
  };
  buttonStyle: {
    shape: 'rounded' | 'square' | 'pill';
    border: boolean;
    shadow: boolean;
    size?: 'small' | 'medium' | 'large';
    opacity?: number; // 30-100
    customColor?: string;
    useCustomColor?: boolean;
    // 'brand' keeps each logo's colour (switched automatically when it would
    // vanish on the button); 'text' paints every logo in the button text colour.
    iconColor?: 'brand' | 'text' | 'custom';
    // Notes 31–34: exact sizes (px) and independent colours; unset = the preset.
    heightPx?: number;
    fontPx?: number;
    fontWeight?: 'normal' | 'medium' | 'bold';
    iconPx?: number;
    textColor?: string;
    iconCustomColor?: string;
  };
  profileStyle: {
    type: 'circle' | 'rounded' | 'square' | 'hero' | 'hero_safe' | 'premium' | 'banner';
    fit?: 'cover' | 'contain';
    // Note 21 «شعار مع بنر»: a wide photo on top, the logo over its lower edge.
    // positionX places the logo across the banner; logoSize is its width in px.
    bannerImage?: string;
    logoSize?: number;
    positionX?: number;
    positionY?: number;
    zoom?: number;
  };
  typography?: {
    font?: FontId;
    size?: 'small' | 'medium' | 'large';
    nameSize?: 'small' | 'medium' | 'large';
    bioSize?: 'small' | 'medium' | 'large';
    // Optional exact sizes in pixels; when set they win over the presets.
    namePx?: number;
    bioPx?: number;
    // Note (9): an uploaded font (stored file + its name); wins over `font`.
    customFont?: { url: string; name: string };
  };
  customColors?: {
    nameColor?: string;
    bioColor?: string;
    usernameColor?: string;
    headingColor?: string; // عناوين المجموعات والعناوين
    paragraphColor?: string; // النبذات النصية
  };
  extractedColors?: string[]; // ألوان مستخرجة من الصورة الشخصية
}

interface PageContextType {
  videoUploadToken?: string | null;
  pageData: PageData;
  account: Account | null;
  setAccount: (account: Account | null) => void;
  replacePageData: (nextPageData: PageData) => void;
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  loadingPage: boolean;
  isDirty: boolean;
  // The last version that reached the server, shown beside the live draft.
  savedPageData: PageData | null;
  savedHistory: SavedVersion[];
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  restoreDraft: (data: PageData) => void;
  // Puts an earlier version back into the draft; it still needs «حفظ».
  restoreVersion: (data: PageData) => void;
  saving: boolean;
  // REQ-015: the unpublished draft kept on the server ('limit' = daily cap reached).
  draftState: 'idle' | 'saving' | 'saved' | 'error' | 'limit';
  save: () => Promise<void>;
  logout: () => void;
  resetDesign: () => void;
  updatePageData: (updates: Partial<PageData>) => void;
  updateTheme: (theme: Theme) => void;
  updateWallpaper: (wallpaper: PageData['wallpaper']) => void;
  updateButtonStyle: (style: Partial<PageData['buttonStyle']>) => void;
  updateProfileStyle: (style: Partial<PageData['profileStyle']>) => void;
  updateTypography: (typography: Partial<NonNullable<PageData['typography']>>) => void;
  addLink: (link: Omit<Link, 'id'>, memberIds?: string[]) => void;
  removeLink: (id: string) => void;
  updateLink: (id: string, updates: Partial<Link>, memberIds?: string[]) => void;
  moveLink: (id: string, direction: 'up' | 'down') => void;
  reorderLink: (id: string, targetId: string) => void;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

const defaultThemes: Theme[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    background: '#ffffff',
    buttonColor: '#000000',
    buttonTextColor: '#ffffff',
    textColor: '#000000',
  },
  {
    id: 'dark',
    name: 'Dark',
    background: '#1a1a1a',
    buttonColor: '#ffffff',
    buttonTextColor: '#000000',
    textColor: '#ffffff',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#e0f7ff',
    buttonColor: '#0066cc',
    buttonTextColor: '#ffffff',
    textColor: '#003366',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: '#fff5eb',
    buttonColor: '#ff6b35',
    buttonTextColor: '#ffffff',
    textColor: '#8b4513',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#f0f9f0',
    buttonColor: '#2d5016',
    buttonTextColor: '#ffffff',
    textColor: '#1a3409',
  },
  {
    id: 'neon',
    name: 'Neon',
    background: '#0a0a0a',
    buttonColor: '#39ff14',
    buttonTextColor: '#000000',
    textColor: '#39ff14',
  },
  {
    id: 'rose',
    name: 'Rose',
    background: '#fff0f5',
    buttonColor: '#e91e63',
    buttonTextColor: '#ffffff',
    textColor: '#880e4f',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    background: '#f3e5f5',
    buttonColor: '#9c27b0',
    buttonTextColor: '#ffffff',
    textColor: '#4a148c',
  },
  {
    id: 'peach',
    name: 'Peach',
    background: '#ffeaa7',
    buttonColor: '#fd79a8',
    buttonTextColor: '#ffffff',
    textColor: '#6c5ce7',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#0f0f23',
    buttonColor: '#00d4ff',
    buttonTextColor: '#000000',
    textColor: '#00d4ff',
  },
  {
    id: 'sand',
    name: 'Sand',
    background: '#f5deb3',
    buttonColor: '#8b6914',
    buttonTextColor: '#ffffff',
    textColor: '#5c4a1a',
  },
  {
    id: 'candy',
    name: 'Candy',
    background: '#ffb3d9',
    buttonColor: '#ff1493',
    buttonTextColor: '#ffffff',
    textColor: '#8b008b',
  },
  {
    id: 'mint',
    name: 'Mint',
    background: '#e0fff4',
    buttonColor: '#00b894',
    buttonTextColor: '#ffffff',
    textColor: '#00603d',
  },
  {
    id: 'royal',
    name: 'Royal',
    background: '#e6e6fa',
    buttonColor: '#4b0082',
    buttonTextColor: '#ffffff',
    textColor: '#2e0854',
  },
  {
    id: 'coral',
    name: 'Coral',
    background: '#fff5ee',
    buttonColor: '#ff7f50',
    buttonTextColor: '#ffffff',
    textColor: '#8b4726',
  },
  {
    id: 'sky',
    name: 'Sky',
    background: '#e8f4f8',
    buttonColor: '#00bfff',
    buttonTextColor: '#ffffff',
    textColor: '#1e3a8a',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    background: '#faf0e6',
    buttonColor: '#8b4513',
    buttonTextColor: '#ffffff',
    textColor: '#654321',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    background: '#d1f2eb',
    buttonColor: '#059669',
    buttonTextColor: '#ffffff',
    textColor: '#064e3b',
  },
  {
    id: 'autumn',
    name: 'Autumn',
    background: '#fef3c7',
    buttonColor: '#d97706',
    buttonTextColor: '#ffffff',
    textColor: '#92400e',
  },
  {
    id: 'berry',
    name: 'Berry',
    background: '#fce7f3',
    buttonColor: '#be185d',
    buttonTextColor: '#ffffff',
    textColor: '#831843',
  },
];

export const themes = defaultThemes;

const LOCAL_STORAGE_KEY = DRAFT_STORAGE_KEY;
// Earlier saved versions, kept in this browser only (no server history yet).
const HISTORY_KEY_PREFIX = HISTORY_STORAGE_PREFIX;
const HISTORY_LIMIT = 10;

export type SavedVersion = { savedAt: string; data: PageData };

// Note 74: earlier versions are filed under the account's id (from the
// session), never under the page name, so another account on this browser —
// or a later owner of a released name — can never see them.
function readHistory(owner: string): SavedVersion[] {
  if (!owner.startsWith('user:')) return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY_PREFIX + owner);
    return raw ? (JSON.parse(raw) as SavedVersion[]).map((v) => ({ ...v, data: mergeWithDefaults(v.data) })) : [];
  } catch {
    return [];
  }
}

function writeHistory(owner: string, history: SavedVersion[]) {
  if (!owner.startsWith('user:') || owner !== sessionOwner()) return;
  // Uploaded images can exceed the quota: drop the oldest until it fits.
  for (let list = history; list.length > 0; list = list.slice(0, -1)) {
    try {
      localStorage.setItem(HISTORY_KEY_PREFIX + owner, JSON.stringify(list));
      return;
    } catch {
      // try with fewer versions
    }
  }
}

const defaultDesign = {
  theme: defaultThemes[0],
  wallpaper: {
    type: 'color',
    value: '#ffffff',
  },
  buttonStyle: {
    shape: 'rounded',
    border: false,
    shadow: true,
  },
  profileStyle: {
    type: 'circle',
  },
  typography: {},
} satisfies Partial<PageData>;

const defaultPageData: PageData = {
  username: '',
  profileImage: '',
  name: '',
  bio: '',
  contactPhone: '',
  contactEmail: '',
  links: [],
  ...defaultDesign,
};

export function mergeWithDefaults(candidate?: Partial<PageData> | null): PageData {
  return {
    ...defaultPageData,
    ...(candidate || {}),
    links: Array.isArray(candidate?.links) ? arrangeSections(candidate.links) : defaultPageData.links,
    theme: {
      ...defaultPageData.theme,
      ...(candidate?.theme || {}),
    },
    wallpaper: {
      ...defaultPageData.wallpaper,
      ...(candidate?.wallpaper || {}),
    },
    buttonStyle: {
      ...defaultPageData.buttonStyle,
      ...(candidate?.buttonStyle || {}),
    },
    profileStyle: {
      ...defaultPageData.profileStyle,
      ...(candidate?.profileStyle || {}),
    },
    typography: candidate?.typography || {},
    translations: candidate?.translations || {},
    customColors: candidate?.customColors || undefined,
    extractedColors: candidate?.extractedColors || [],
  };
}

// Note (2), 25 Oct 2026: a guest's design (before signing up) lives only in
// this tab, and only for the page name being signed up for — a new sign-up on
// the same computer never starts from someone's earlier design.
function guestDraftKey() {
  const params = new URLSearchParams(window.location.search);
  return `${LOCAL_STORAGE_KEY}:guest:${(params.get('username') || '').toLowerCase()}`;
}

// Leftovers from before accounts were kept apart: a guest draft in the shared
// storage, and earlier versions filed under a page name. Removed once, freeing
// the space they took (often megabytes of images).
function purgeLegacyStorage() {
  try {
    const shared = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (shared && JSON.parse(shared)?.owner === 'guest') localStorage.removeItem(LOCAL_STORAGE_KEY);
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith(HISTORY_KEY_PREFIX) && !key.startsWith(`${HISTORY_KEY_PREFIX}user:`)) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable: nothing to clean
  }
}

function loadLocalPageData() {
  if (typeof window === 'undefined') {
    return defaultPageData;
  }

  purgeLegacyStorage();
  const guest = sessionOwner() === 'guest';
  const saved = guest ? sessionStorage.getItem(guestDraftKey()) : localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!saved) {
    return defaultPageData;
  }

  // Note 42: a draft is shown only to the account (or guest) that wrote it.
  // Older drafts carry no owner and could be anyone's, so they are dropped.
  try {
    const stored = JSON.parse(saved);
    if (!stored || typeof stored !== 'object' || stored.owner !== sessionOwner() || !stored.data) {
      if (!guest) localStorage.removeItem(LOCAL_STORAGE_KEY);
      return defaultPageData;
    }
    return mergeWithDefaults(stored.data);
  } catch (error) {
    console.error('Error parsing saved data:', error);
    return defaultPageData;
  }
}

// Where the editor loads from and saves to. The default is the signed-in
// beneficiary's own page; the administration passes its own source to edit a
// customer's page with the same editor (PERM-01).
export type PageSource = {
  uploadToken?: () => string | null;
  load: () => Promise<{ pageData: any }>;
  save: (pageData: PageData) => Promise<{ pageData: any }>;
};

export function PageProvider({ children, source }: { children: ReactNode; source?: PageSource }) {
  const [pageData, setPageData] = useState<PageData>(() => (source ? defaultPageData : loadLocalPageData()));
  const [account, setAccount] = useState<Account | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(source || getSessionToken()));
  const [loadingPage, setLoadingPage] = useState(true);
  // PAGE-07: edits stay a local draft (live preview only) until «حفظ».
  const [isDirty, setIsDirty] = useState(false);
  const [savedPageData, setSavedPageData] = useState<PageData | null>(null);
  const [savedHistory, setSavedHistory] = useState<SavedVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'limit'>('idle');
  // Whose page is in memory: the guest, or the account it was loaded for.
  const draftOwner = useRef(source ? 'staff' : sessionOwner());

  useEffect(() => {
    // Someone else's page must never land in this browser's own draft.
    if (typeof window === 'undefined' || source) {
      return;
    }

    // Serialising a draft with inline images on every keystroke made typing
    // and saving sluggish; it is written once the editing pauses.
    const timer = window.setTimeout(() => {
      // Never file one account's page under another session (or the guest).
      if (draftOwner.current !== sessionOwner()) return;
      try {
        const record = JSON.stringify({ owner: draftOwner.current, data: pageData });
        if (draftOwner.current === 'guest') sessionStorage.setItem(guestDraftKey(), record);
        else localStorage.setItem(LOCAL_STORAGE_KEY, record);
      } catch (error) {
        // Uploaded images can exceed the localStorage quota; the draft still
        // lives in memory until it is saved.
        console.warn('Draft too large for local storage:', error);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [pageData, source]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromApi() {
      if (source) {
        try {
          const response = await source.load();
          if (!cancelled) {
            const loaded = mergeWithDefaults(response.pageData);
            setPageData(loaded);
            setSavedPageData(loaded);
          }
        } catch (error) {
          console.error('Failed to load page:', error);
          if (!cancelled) setIsAuthenticated(false);
        } finally {
          if (!cancelled) setLoadingPage(false);
        }
        return;
      }

      const token = getSessionToken();

      if (!token) {
        setLoadingPage(false);
        return;
      }

      try {
        const response = await fetchMyPage();

        if (!cancelled && response.pageData) {
          draftOwner.current = sessionOwner();
          const loaded = mergeWithDefaults(response.pageData);
          // REQ-015: unpublished edits saved earlier (from any device) come back.
          // Critical note (4): if they never reached the server (offline, closed
          // within seconds, drafts not enabled yet), this browser's own copy of
          // the same account is used — edits are never replaced by the old page,
          // whether or not the email is confirmed yet.
          const local = draftOwner.current === sessionOwner() && pageDataRef.current !== defaultPageData
            && JSON.stringify({ ...pageDataRef.current, username: '' }) !== JSON.stringify({ ...loaded, username: '' })
            ? mergeWithDefaults({ ...pageDataRef.current, username: loaded.username })
            : null;
          const draft = response.draft?.pageData ? mergeWithDefaults({ ...response.draft.pageData, username: loaded.username }) : local;
          setPageData(draft ?? loaded);
          setSavedPageData(loaded);
          setSavedHistory(readHistory(sessionOwner()));
          setAccount(response.account);
          setIsDirty(Boolean(draft));
          setDraftState(draft ? 'saved' : 'idle');
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Failed to hydrate page data:', error);
        clearSessionToken();

        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingPage(false);
        }
      }
    }

    hydrateFromApi();

    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    // A draft already on the server is safe; warn only for edits not yet kept.
    if (!isDirty || draftState === 'saved') {
      return;
    }

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [isDirty, draftState]);

  // Every editor change goes through here so the draft is marked unsaved.
  // Undo / redo over editor changes. Saving does not clear it; loading a
  // different page (login, hydrate) does. Typing bursts count as one step.
  const pageDataRef = useRef(pageData);
  pageDataRef.current = pageData;
  const savedRef = useRef<PageData | null>(null);
  savedRef.current = savedPageData;
  const past = useRef<PageData[]>([]);
  const future = useRef<PageData[]>([]);
  const lastPush = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  const HISTORY_STEPS = 60;

  const pushHistory = useCallback((force = false) => {
    const now = Date.now();
    if (force || now - lastPush.current > 700) {
      past.current = [...past.current, pageDataRef.current].slice(-HISTORY_STEPS);
    }
    lastPush.current = now;
    future.current = [];
    setHistoryTick((tick) => tick + 1);
  }, []);

  // A draft equals the server copy only when it is that very object.
  const show = useCallback((data: PageData) => {
    setPageData(data);
    setIsDirty(data !== savedRef.current);
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current = [pageDataRef.current, ...future.current];
    lastPush.current = 0;
    show(previous);
    setHistoryTick((tick) => tick + 1);
  }, [show]);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next) return;
    future.current = rest;
    past.current = [...past.current, pageDataRef.current];
    lastPush.current = 0;
    show(next);
    setHistoryTick((tick) => tick + 1);
  }, [show]);

  const edit = useCallback((updater: (prev: PageData) => PageData) => {
    pushHistory();
    setPageData(updater);
    setIsDirty(true);
  }, [pushHistory]);

  // Another account takes the screen (login, signup, set password): every
  // trace of the previous one goes — draft, saved copy, versions, undo steps
  // (note 74). The new account's own versions are read back.
  const replacePageData = useCallback((nextPageData: PageData) => {
    draftOwner.current = sessionOwner();
    past.current = [];
    future.current = [];
    setHistoryTick((tick) => tick + 1);
    const loaded = mergeWithDefaults(nextPageData);
    setPageData(loaded);
    savedRef.current = loaded;
    setSavedPageData(loaded);
    setSavedHistory(readHistory(draftOwner.current));
    setIsDirty(false);
  }, []);

  // Puts a whole earlier state back (a saved version, or the state before a
  // panel was opened); it is one undoable step.
  const restoreDraft = useCallback((data: PageData) => {
    pushHistory(true);
    show(data);
  }, [pushHistory, show]);

  // One save at a time: a second press while one is running gets the same
  // result instead of a duplicate request (note 28).
  const inFlight = useRef<Promise<void> | null>(null);
  const historyRef = useRef(savedHistory);
  historyRef.current = savedHistory;

  const save = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const sent = pageDataRef.current;
    const previous = savedRef.current;
    if (previous && sent === previous) return Promise.resolve();

    const run = async () => {
      setSaving(true);
      const started = performance.now();
      try {
        let savedData: PageData;
        if (source) {
          savedData = mergeWithDefaults((await source.save(sent)).pageData);
        } else {
          // Inline images and PDFs go to storage once (note 53); files
          // unchanged since the last save are not sent again (note 28).
          const prepared = await moveInlineMedia(sent);
          const body = slimPageData(prepared, previous);
          const response = await saveMyPage(body);
          const expanded = expandPageData(response.pageData, prepared);
          savedData = mergeWithDefaults(expanded ?? (await fetchMyPage()).pageData);
          setAccount(response.account);
          // Note 16: a save that changed nothing, or a version already on top, is not filed again.
          if (previous && JSON.stringify(previous) !== JSON.stringify(savedData) && JSON.stringify(previous) !== JSON.stringify(historyRef.current[0]?.data)) {
            const owner = draftOwner.current;
            const next = [{ savedAt: new Date().toISOString(), data: previous }, ...historyRef.current].slice(0, HISTORY_LIMIT);
            setSavedHistory(next);
            // Off the critical path: serialising earlier versions is slow.
            window.setTimeout(() => writeHistory(owner, next), 0);
          }
          if (import.meta.env.DEV) {
            console.info(`[onwan] save ${Math.round(performance.now() - started)} ms · sent ${Math.round(JSON.stringify(body).length / 1024)} KB of ${Math.round(JSON.stringify(sent).length / 1024)} KB`);
          }
        }

        savedRef.current = savedData;
        setSavedPageData(savedData);
        // Edits made while the save was running stay in the draft, unsaved.
        if (pageDataRef.current === sent) {
          setPageData(savedData);
          setIsDirty(false);
          setDraftState('idle');
        } else {
          setIsDirty(true);
        }
      } finally {
        setSaving(false);
        inFlight.current = null;
      }
    };

    inFlight.current = run();
    return inFlight.current;
  }, [source]);

  // REQ-015: unpublished edits are kept on the server by themselves, merged —
  // one save 2.5 s after the editing pauses, never one per change. They stay
  // invisible to visitors until «احفظ تعديلاتي» publishes them. Files go to
  // storage first so the draft stays small.
  useEffect(() => {
    if (source || !isAuthenticated || !isDirty || draftState === 'limit') return;
    const timer = window.setTimeout(async () => {
      if (inFlight.current) return;
      const sent = pageDataRef.current;
      setDraftState('saving');
      try {
        const prepared = await moveInlineMedia(sent);
        await saveMyDraft(prepared);
        // Stored files now travel as links; keep that unless the user moved on.
        if (prepared !== sent && pageDataRef.current === sent) setPageData(prepared);
        setDraftState('saved');
      } catch (error) {
        setDraftState(error instanceof ApiError && error.code === 'save_limit' ? 'limit' : 'error');
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [pageData, isDirty, isAuthenticated, source, draftState === 'limit']); // eslint-disable-line react-hooks/exhaustive-deps

  // Edits undone back to the published version: the server draft goes too.
  useEffect(() => {
    if (source || !isAuthenticated || isDirty || draftState !== 'saved') return;
    saveMyDraft(null).then(() => setDraftState('idle')).catch(() => undefined);
  }, [isDirty, draftState, isAuthenticated, source]);

  const restoreVersion = useCallback((data: PageData) => {
    pushHistory(true);
    setPageData(mergeWithDefaults(data));
    setIsDirty(true);
  }, [pushHistory]);

  // Drops the account from memory: its page, saved copy, versions and undo steps.
  const forgetAccount = useCallback(() => {
    draftOwner.current = 'guest';
    past.current = [];
    future.current = [];
    setHistoryTick((tick) => tick + 1);
    setIsAuthenticated(false);
    setAccount(null);
    setPageData(defaultPageData);
    setSavedPageData(null);
    setSavedHistory([]);
    setIsDirty(false);
  }, []);

  const logout = useCallback(() => {
    clearSessionToken();
    clearLocalAccountData();
    forgetAccount();
  }, [forgetAccount]);

  // Note 42: when the session ends any other way (expired, banned, logged out
  // in another tab), the previous account's page leaves the screen at once.
  useEffect(() => {
    if (source) return;
    const onCleared = () => forgetAccount();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'bio_sa_session_token' || event.key === null) {
        if (draftOwner.current !== sessionOwner()) forgetAccount();
      }
    };
    window.addEventListener(SESSION_CLEARED_EVENT, onCleared);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_CLEARED_EVENT, onCleared);
      window.removeEventListener('storage', onStorage);
    };
  }, [source, forgetAccount]);

  // PAGE-08: restores the default look only. Content (name, description,
  // logo, contact details, buttons and files) is left untouched.
  const resetDesign = useCallback(() => {
    edit((prev) => ({ ...prev, ...defaultDesign, customColors: undefined }));
  }, [edit]);

  const updatePageData = useCallback((updates: Partial<PageData>) => {
    edit((prev) => mergeWithDefaults({ ...prev, ...updates }));
  }, [edit]);

  const updateTheme = useCallback((theme: Theme) => {
    edit((prev) => ({
      ...prev,
      theme,
      wallpaper: { type: 'color', value: theme.background },
      customColors: undefined, // إعادة تعيين الألوان المخصصة عند تغيير الثيم
      buttonStyle: {
        ...prev.buttonStyle,
        useCustomColor: false, // إعادة تعيين اللون المخصص للأزرار
        customColor: undefined,
        textColor: undefined, // الثيم يحدد لون نص الأزرار من جديد
      },
    }));
  }, [edit]);

  const updateWallpaper = useCallback((wallpaper: PageData['wallpaper']) => {
    edit((prev) => ({ ...prev, wallpaper }));
  }, [edit]);

  const updateButtonStyle = useCallback((style: Partial<PageData['buttonStyle']>) => {
    edit((prev) => ({
      ...prev,
      buttonStyle: { ...prev.buttonStyle, ...style },
    }));
  }, [edit]);

  const updateProfileStyle = useCallback((style: Partial<PageData['profileStyle']>) => {
    edit((prev) => ({
      ...prev,
      profileStyle: { ...prev.profileStyle, ...style },
    }));
  }, [edit]);

  const updateTypography = useCallback((typography: Partial<NonNullable<PageData['typography']>>) => {
    edit((prev) => ({
      ...prev,
      typography: { ...prev.typography, ...typography },
    }));
  }, [edit]);

  const addLink = useCallback((link: Omit<Link, 'id'>, memberIds?: string[]) => {
    const newLink = { ...link, id: crypto.randomUUID() };
    edit((prev) => (prev.links.length >= MAX_LINKS ? prev : { ...prev, links: saveSectionItem(prev.links, newLink, memberIds) }));
  }, [edit]);

  const removeLink = useCallback((id: string) => {
    edit((prev) => ({
      ...prev,
      links: arrangeSections(prev.links.filter((link) => link.id !== id)),
    }));
  }, [edit]);

  const updateLink = useCallback((id: string, updates: Partial<Link>, memberIds?: string[]) => {
    edit(prev => {
      const current = prev.links.find(link => link.id === id);
      return current ? { ...prev, links: saveSectionItem(prev.links, { ...current, ...updates }, memberIds) } : prev;
    });
  }, [edit]);

  const moveLink = useCallback((id: string, direction: 'up' | 'down') => {
    edit(prev => ({ ...prev, links: moveSectionItem(prev.links, id, direction) }));
  }, [edit]);

  const reorderLink = useCallback((id: string, targetId: string) => {
    edit(prev => ({ ...prev, links: reorderSectionItem(prev.links, id, targetId) }));
  }, [edit]);

  return (
    <PageContext.Provider
      value={{
        pageData,
        account,
        setAccount,
        replacePageData,
        isAuthenticated,
        setAuthenticated: setIsAuthenticated,
        loadingPage,
        isDirty,
        savedPageData,
        savedHistory,
        restoreVersion,
        undo,
        redo,
        canUndo: historyTick >= 0 && past.current.length > 0,
        canRedo: historyTick >= 0 && future.current.length > 0,
        restoreDraft,
        saving,
        draftState,
        videoUploadToken: source?.uploadToken?.(),
        save,
        logout,
        resetDesign,
        updatePageData,
        updateTheme,
        updateWallpaper,
        updateButtonStyle,
        updateProfileStyle,
        updateTypography,
        addLink,
        removeLink,
        updateLink,
        moveLink,
        reorderLink,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within PageProvider');
  }
  return context;
}
