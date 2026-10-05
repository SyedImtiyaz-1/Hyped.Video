// A clip picked on the homepage before signing up: kept in this browser (IndexedDB holds the file itself) while the
// visitor signs up, then handed to the reel form, which starts with it already chosen. Nothing leaves the browser until
// the form uploads it. Gone after PENDING_HOURS, or once taken.
import { isEditStyle, type ReelEditStyle } from "@launchreel/core/edit-styles";

const DB = "hyped";
const STORE = "pending";
const KEY = "clip";
const PENDING_HOURS = 3;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = work(tx.objectStore(STORE));
        tx.oncomplete = () => (db.close(), resolve(req.result));
        tx.onerror = tx.onabort = () => (db.close(), reject(tx.error ?? req.error));
      }),
  );
}

/** Keeps the clip for after sign-up. False when the browser can't (private mode, no room for a big file). */
export async function savePendingClip(file: File, editStyle: ReelEditStyle): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put({ file, editStyle, savedAt: Date.now() }, KEY));
    return true;
  } catch {
    return false;
  }
}

/** The clip picked on the homepage, if there is one (and it's recent); taking it removes it. */
export async function takePendingClip(): Promise<{ file: File; editStyle: ReelEditStyle } | null> {
  try {
    const value = (await run("readonly", (s) => s.get(KEY))) as { file?: unknown; editStyle?: unknown; savedAt?: number } | undefined;
    await run("readwrite", (s) => s.delete(KEY));
    if (!value || !(value.file instanceof File) || Date.now() - (value.savedAt ?? 0) > PENDING_HOURS * 3_600_000) return null;
    return { file: value.file, editStyle: isEditStyle(value.editStyle) ? value.editStyle : "creator" };
  } catch {
    return null;
  }
}
