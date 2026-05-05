import { createBlobStore } from './idb-store';

const store = createBlobStore('proscreen-image', 'screenshots');

export const saveImageBlob = (blob: Blob) => store.save(blob);
export const loadImageBlob = () => store.load();
export const clearImageBlob = () => store.clear();
