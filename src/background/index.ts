import { MSG } from '../constants/messages';
import { saveImageBlob } from '../lib/image-store';

const MENU_ID_CAPTURE = 'proscreen-capture';

// ─── Context Menu ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: MENU_ID_CAPTURE,
        title: 'Capture this page with ProScreen',
        contexts: ['page', 'image'],
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID_CAPTURE || !tab?.id) return;

    chrome.tabs.captureVisibleTab(
        tab.windowId,
        { format: 'png' },
        (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) return;
            openEditor(dataUrl);
        }
    );
});

// ─── Keyboard Shortcuts ──────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
    const handlers: Record<string, () => void> = {
        'capture-visible': handleCaptureVisible,
        'capture-area': handleCaptureArea,
        'start-recording': handleToggleRecording,
    };

    handlers[command]?.();
});

// ─── Message Routing ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === MSG.CAPTURE_FULLPAGE) {
        handleCaptureFullPage().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true; // keep message channel open while async work runs
    }

    if (msg.type === MSG.GET_RECORDING_STATE) {
        sendResponse({ isRecording });
        return true;
    }

    switch (msg.type) {
        case MSG.CAPTURE_VISIBLE:
            handleCaptureVisible();
            break;

        case MSG.CAPTURE_AREA_START:
            handleCaptureArea();
            break;

        case MSG.CAPTURE_AREA_DONE:
            handleAreaCaptureDone(msg.rect);
            break;

        case MSG.CAPTURE_AREA_CANCEL:
            currentFrozenAreaCapture = null;
            break;

        case MSG.RECORDING_START:
            handleStartRecording(msg.config);
            break;

        case MSG.RECORDING_STOP:
            handleStopRecording();
            break;

        case MSG.RECORDING_DATA:
            handleRecordingData();
            break;

        case MSG.RECORDING_STATUS:
            if (msg.state === 'recording') {
                isRecording = true;
                startRecordingTimer();
            }
            break;

        case MSG.OPEN_EDITOR:
            openEditor(msg.dataUrl);
            break;
    }

    sendResponse({ ok: true });
    return true;
});

// ─── Capture Handlers ────────────────────────────────────────────────────────

function handleCaptureVisible() {
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

let currentFrozenAreaCapture: string | null = null;

function handleCaptureArea() {
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

function handleAreaCaptureDone(rect: { x: number; y: number; width: number; height: number }) {
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

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const croppedDataUrl = await blobToDataUrl(croppedBlob);
    openEditor(croppedDataUrl);
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}

async function handleCaptureFullPage() {
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
    const captures: { dataUrl: string; y: number }[] = [];
    let y = 0;

    while (y < totalHeight) {
        await chrome.tabs.sendMessage(tabId, { type: MSG.FULLPAGE_SCROLL, y });
        const dataUrl = await new Promise<string>((resolve) => {
            chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, resolve);
        });
        if (chrome.runtime.lastError || !dataUrl) break;
        captures.push({ dataUrl, y });
        y += viewportHeight;
    }

    chrome.tabs.sendMessage(tabId, { type: MSG.FULLPAGE_DONE, originalScrollTop }).catch(() => { });

    if (captures.length === 0) return;

    // Stitch all captures into one tall image using OffscreenCanvas
    const MAX_CANVAS_HEIGHT = 16384;
    const finalHeight = Math.min(totalHeight, MAX_CANVAS_HEIGHT);
    const firstImg = await fetchBitmap(captures[0].dataUrl);
    const imgW = firstImg.width;
    const imgH = firstImg.height;
    const canvas = new OffscreenCanvas(imgW, finalHeight);
    const ctx = canvas.getContext('2d')!;

    for (const { dataUrl, y: captureY } of captures) {
        if (captureY >= finalHeight) break;
        const bitmap = await fetchBitmap(dataUrl);
        const remaining = finalHeight - captureY;
        const drawH = Math.min(imgH, remaining);
        ctx.drawImage(bitmap, 0, 0, imgW, drawH, 0, captureY, imgW, drawH);
    }

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const stitchedDataUrl = await blobToDataUrl(blob);
    openEditor(stitchedDataUrl);
}

async function fetchBitmap(dataUrl: string): Promise<ImageBitmap> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return createImageBitmap(blob);
}

// ─── Recording Handlers ──────────────────────────────────────────────────────

let isRecording = false;
let recordingTimer: ReturnType<typeof setInterval> | null = null;
let recordingStartTime = 0;

function startRecordingTimer() {
    recordingStartTime = Date.now();
    chrome.action.setBadgeBackgroundColor({ color: '#e53935' });
    updateBadge();
    recordingTimer = setInterval(updateBadge, 1000);
}

function stopRecordingTimer() {
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
    chrome.action.setBadgeText({ text: '' });
}

function updateBadge() {
    const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    chrome.action.setBadgeText({ text: `${m}:${String(s).padStart(2, '0')}` });
}

function handleToggleRecording() {
    if (isRecording) {
        handleStopRecording();
    } else {
        handleStartRecording({});
    }
}

async function handleStartRecording(config: Record<string, unknown> = {}) {
    if (isRecording) return;

    await createOffscreenIfNeeded();
    // Give offscreen document time to load scripts and register listeners
    await new Promise((r) => setTimeout(r, 300));

    // Tell offscreen to start — it will call getDisplayMedia which shows the picker
    chrome.runtime.sendMessage({
        type: MSG.OFFSCREEN_START_RECORDING,
        config,
    });
    isRecording = true;
}

function handleStopRecording() {
    chrome.runtime.sendMessage({
        type: MSG.RECORDING_STOP,
    });
    isRecording = false;
    stopRecordingTimer();

    // Hide recording controls on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'RECORDING_HIDE_CONTROLS' }).catch(() => { });
        }
    });
}

function handleRecordingData() {
    isRecording = false;
    stopRecordingTimer();

    // Hide controls
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'RECORDING_HIDE_CONTROLS' }).catch(() => { });
        }
    });

    // Video data is already in IndexedDB (saved by offscreen)
    chrome.tabs.create({
        url: chrome.runtime.getURL('video.html'),
    });

    // Cleanup offscreen document
    chrome.offscreen.closeDocument().catch(() => {});
}

// ─── Offscreen Document ──────────────────────────────────────────────────────

async function createOffscreenIfNeeded() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });

    if (existingContexts.length > 0) return;

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.DISPLAY_MEDIA],
        justification: 'Screen recording via getDisplayMedia',
    });
}

// ─── Editor ──────────────────────────────────────────────────────────────────

async function openEditor(dataUrl: string) {
    try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await saveImageBlob(blob);
        chrome.tabs.create({
            url: chrome.runtime.getURL('editor.html'),
        });
    } catch (err) {
        console.error('Failed to open editor:', err);
    }
}
