// ─── Generic IndexedDB Blob Store ────────────────────────────────────────────
// Factory for creating simple key-value blob stores backed by IndexedDB.
// Eliminates duplication between image-store.ts and video-store.ts.

export function createBlobStore(dbName: string, storeName: string) {
    function openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(storeName);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function save(blob: Blob, key = 'latest'): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(blob, key);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async function load(key = 'latest'): Promise<Blob | null> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            tx.oncomplete = () => db.close();
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async function clear(key = 'latest'): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    return { save, load, clear };
}
