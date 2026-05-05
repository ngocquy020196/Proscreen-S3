import { MSG } from '../constants/messages';
import { saveImageBlob } from '../lib/image-store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchBitmap(dataUrl: string): Promise<ImageBitmap> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return createImageBitmap(blob);
}

export async function openEditor(dataUrl: string) {
    try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await openEditorBlob(blob);
    } catch (err) {
        console.error('Failed to open editor:', err);
    }
}

export async function openEditorBlob(blob: Blob) {
    try {
        await saveImageBlob(blob);
        chrome.tabs.create({
            url: chrome.runtime.getURL('editor.html'),
        });
    } catch (err) {
        console.error('Failed to open editor:', err);
    }
}

// ─── Capture Visible Tab ─────────────────────────────────────────────────────

export function handleCaptureVisible() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.windowId) return;
        chrome.tabs.captureVisibleTab(
            tabs[0].windowId,
            { format: 'png' },
            (dataUrl) => {
                if (chrome.runtime.lastError || !dataUrl) return;
                openEditor(dataUrl);
            }
        );
    });
}

// ─── Capture Area ────────────────────────────────────────────────────────────

let currentFrozenAreaCapture: string | null = null;

export function resetFrozenAreaCapture() {
    currentFrozenAreaCapture = null;
}

export function handleCaptureArea() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id || !tab?.windowId) return;

        chrome.tabs.captureVisibleTab(
            tab.windowId,
            { format: 'png' },
            (dataUrl) => {
                if (chrome.runtime.lastError || !dataUrl) return;
                currentFrozenAreaCapture = dataUrl;
                chrome.tabs.sendMessage(tab.id!, {
                    type: MSG.CAPTURE_AREA_START,
                    dataUrl
                }).catch(() => { });
            }
        );
    });
}

export function handleAreaCaptureDone(rect: { x: number; y: number; width: number; height: number }) {
    if (currentFrozenAreaCapture) {
        cropAndOpenEditor(currentFrozenAreaCapture, rect);
        currentFrozenAreaCapture = null;
    } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]?.windowId) return;
            chrome.tabs.captureVisibleTab(
                tabs[0].windowId,
                { format: 'png' },
                (dataUrl) => {
                    if (chrome.runtime.lastError || !dataUrl) return;
                    cropAndOpenEditor(dataUrl, rect);
                }
            );
        });
    }
}

async function cropAndOpenEditor(
    dataUrl: string,
    rect: { x: number; y: number; width: number; height: number }
) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(rect.width, rect.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    bitmap.close();

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    await openEditorBlob(croppedBlob);
}

// ─── Capture Full Page ───────────────────────────────────────────────────────

export async function handleCaptureFullPage() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab?.windowId) return;
    const tabId = tab.id;
    const windowId = tab.windowId;

    const info = await chrome.tabs.sendMessage(tabId, { type: MSG.FULLPAGE_GET_INFO }) as {
        totalHeight: number;
        totalWidth: number;
        viewportHeight: number;
        viewportWidth: number;
        scrollTop: number;
    };

    const { totalHeight, viewportHeight, scrollTop: originalScrollTop } = info;
    const MAX_CANVAS_HEIGHT = 16384;
    const finalHeight = Math.min(totalHeight, MAX_CANVAS_HEIGHT);

    let canvas: OffscreenCanvas | null = null;
    let ctx: OffscreenCanvasRenderingContext2D | null = null;
    let y = 0;

    while (y < totalHeight && y < finalHeight) {
        await chrome.tabs.sendMessage(tabId, { type: MSG.FULLPAGE_SCROLL, y });
        const dataUrl = await new Promise<string>((resolve) => {
            chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, resolve);
        });
        if (chrome.runtime.lastError || !dataUrl) break;

        const bitmap = await fetchBitmap(dataUrl);

        // Initialize canvas on first capture to get actual viewport dimensions
        if (!canvas) {
            canvas = new OffscreenCanvas(bitmap.width, finalHeight);
            ctx = canvas.getContext('2d')!;
        }

        const remaining = finalHeight - y;
        const drawH = Math.min(bitmap.height, remaining);
        ctx!.drawImage(bitmap, 0, 0, bitmap.width, drawH, 0, y, bitmap.width, drawH);
        bitmap.close();
        y += viewportHeight;
    }

    chrome.tabs.sendMessage(tabId, { type: MSG.FULLPAGE_DONE, originalScrollTop }).catch(() => { });

    if (!canvas) return;

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    await openEditorBlob(blob);
}
