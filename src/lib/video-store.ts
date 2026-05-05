import { createBlobStore } from './idb-store';

const store = createBlobStore('proscreen-video', 'recordings');

export const saveVideoBlob = (blob: Blob) => store.save(blob);
export const loadVideoBlob = () => store.load();
export const clearVideoBlob = () => store.clear();
