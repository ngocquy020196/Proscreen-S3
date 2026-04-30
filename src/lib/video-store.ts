// ─── Video Blob Storage ──────────────────────────────────────────────────────
// Uses IndexedDB to store/retrieve video blobs efficiently.
// No base64 conversion needed — stores raw binary, accessible from all extension pages.

const DB_NAME = 'proscreen-video';
const STORE_NAME = 'recordings';
const KEY = 'latest';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveVideoBlob(blob: Blob): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(blob, KEY);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function loadVideoBlob(): Promise<Blob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(KEY);
        req.onsuccess = () => {
            // Clean up after reading
            store.delete(KEY);
            resolve(req.result ?? null);
        };
        tx.oncomplete = () => db.close();
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}
