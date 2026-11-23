import { creationSession, readCloudCreation, storeCreationSession, writeCloudCreation } from './creationCloud';
import type { PageData, PageSource } from '../context/PageContext';
import { readRecovery, writeRecovery } from './draftRecovery';
import { readCreationDraft, saveCreationDraft } from './creationTemplates';

const queues = new Map<string, Promise<unknown>>();
const sequences = new Map<string, number>();
let volatileTabId: string | undefined;
function recoveryKey() {
  let tabId: string;
  try {
    tabId = sessionStorage.getItem('onwan_guest_creation_tab') || crypto.randomUUID();
    sessionStorage.setItem('onwan_guest_creation_tab', tabId);
  } catch { tabId = volatileTabId ??= crypto.randomUUID(); }
  return `guest:creation-trial:${tabId}`;
}
const STAMP_KEY = 'onwan_guest_creation_stamp';
function stamp() { try { return Number(sessionStorage.getItem(STAMP_KEY)) || 0; } catch { return 0; } }

export function createGuestPageSource(options: { cloud?: boolean } = {}): PageSource {
  const key = recoveryKey();
  const persist = (pageData: PageData, sync = true) => {
    const savedAt = Date.now();
    const nextSequence = Math.max(savedAt, (sequences.get(key) ?? 0) + 1); sequences.set(key, nextSequence);
    const operation = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      // IndexedDB confirms the transaction, including incomplete forms and binary data URLs.
      await writeRecovery({ owner: 'guest', data: pageData, revision: null, savedAt, sequence: nextSequence }, key);
      saveCreationDraft(pageData);
      const prepared = sync && options.cloud !== false ? await writeCloudCreation(pageData, nextSequence) : pageData;
      if (JSON.stringify(prepared) !== JSON.stringify(pageData)) {
        await writeRecovery({ owner: 'guest', data: prepared, revision: null, savedAt, sequence: nextSequence }, key);
        saveCreationDraft(prepared);
      }
      if (sync) {
        await writeRecovery({ owner: 'guest', data: prepared, revision: null, savedAt, sequence: nextSequence }, `${key}:saved`);
        try { sessionStorage.setItem(`${key}:saved`, JSON.stringify(prepared)); } catch { /* The IndexedDB snapshot remains available. */ }
      }
      return { pageData: prepared };
    });
    queues.set(key, operation);
    return operation;
  };
  return {
    uploadToken: () => creationSession()?.token ?? null,
    backupDraft: async pageData => { await persist(pageData, false); },
    load: async () => {
      const local = readCreationDraft();
      const recovered = await readRecovery(key).catch(() => null);
      sequences.set(key, Math.max(sequences.get(key) ?? 0, recovered?.sequence ?? 0));
      const pageData = recovered && recovered.savedAt > stamp() ? recovered.data : local ?? recovered?.data;
      let savedDraftData: Partial<PageData> | undefined = (await readRecovery(`${key}:saved`).catch(() => null))?.data;
      try { savedDraftData ??= JSON.parse(sessionStorage.getItem(`${key}:saved`) || 'null') ?? undefined; } catch { /* Recovery remains available. */ }
      const session = creationSession();
      if (session && options.cloud !== false) {
        const remote = await readCloudCreation(session);
        savedDraftData = remote.pageData ?? savedDraftData;
        const dirtyLocal = recovered && (recovered.sequence ?? 0) > (session.syncedSequence ?? 0);
        if (!dirtyLocal || !pageData) {
          storeCreationSession({ ...session, revision: remote.revision });
          if (remote.pageData) return { pageData: remote.pageData, savedDraftData };
        }
      }
      if (!pageData) throw new Error('اختر تصميمًا أولًا لبدء تحرير صفحتك.');
      return { pageData, savedDraftData: savedDraftData ?? pageData };
    },
    save: pageData => persist(pageData),
    saveDraft: pageData => persist(pageData),
  };
}
