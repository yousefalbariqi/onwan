// IndexedDB keeps large unfinished file forms out of localStorage's small quota.
// Keys are account-specific. A transaction completes before we call it backed up.
export type RecoveryDraft = { owner: string; data: any; revision: number | null; savedAt: number; sequence?: number; tabId?: string };
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('onwan-editor-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readRecovery(owner: string): Promise<RecoveryDraft | null> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('drafts').objectStore('drafts').get(owner);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function writeRecovery(record: RecoveryDraft, key = record.owner): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite');
      const store = transaction.objectStore('drafts');
      const previous = store.get(key);
      previous.onsuccess = () => {
        if ((previous.result?.sequence ?? -1) <= (record.sequence ?? 0)) store.put(record, key);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
