import type { UploadHistoryItem } from '../types';

const HISTORY_KEY = 'uploadHistory';
const MAX_ENTRIES = 100;

export async function getHistory(): Promise<UploadHistoryItem[]> {
    return new Promise((resolve) => {
        chrome.storage.local.get({ [HISTORY_KEY]: [] }, (result) => {
            resolve(result[HISTORY_KEY] as UploadHistoryItem[]);
        });
    });
}

export async function addHistoryItem(item: UploadHistoryItem): Promise<void> {
    const history = await getHistory();
    history.unshift(item);

    // FIFO eviction
    if (history.length > MAX_ENTRIES) {
        history.length = MAX_ENTRIES;
    }

    return new Promise((resolve) => {
        chrome.storage.local.set({ [HISTORY_KEY]: history }, resolve);
    });
}

export async function removeHistoryItem(id: string): Promise<void> {
    const history = await getHistory();
    const filtered = history.filter((item) => item.id !== id);

    return new Promise((resolve) => {
        chrome.storage.local.set({ [HISTORY_KEY]: filtered }, resolve);
    });
}

export async function clearHistory(): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [HISTORY_KEY]: [] }, resolve);
    });
}

export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
