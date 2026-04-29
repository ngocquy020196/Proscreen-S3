import { MSG } from '../constants/messages';

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

        case MSG.CAPTURE_FULLPAGE:
            handleCaptureFullPage();
            break;

        case MSG.RECORDING_START:
            handleStartRecording(msg.config, msg.streamId);
            break;

        case MSG.RECORDING_STOP:
            handleStopRecording();
            break;

        case MSG.RECORDING_DATA:
            handleRecordingData(msg.dataUrl);
            break;

        case MSG.RECORDING_STATUS:
            if (msg.state === 'recording') isRecording = true;
            break;

        case MSG.OPEN_EDITOR:
            openEditor(msg.dataUrl);
            break;

        case MSG.GET_RECORDING_STATE:
            sendResponse({ isRecording });
            return true;
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

function handleCaptureArea() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        chrome.tabs.sendMessage(tabs[0].id, { type: MSG.CAPTURE_AREA_START }).catch(() => {});
    });
}

function handleAreaCaptureDone(rect: { x: number; y: number; width: number; height: number }) {
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

    chrome.tabs.sendMessage(tabId, { type: MSG.FULLPAGE_DONE, originalScrollTop }).catch(() => {});

    if (captures.length === 0) return;

    // Stitch all captures into one tall image using OffscreenCanvas
    const firstImg = await fetchBitmap(captures[0].dataUrl);
    const imgW = firstImg.width;
    const imgH = firstImg.height;
    const canvas = new OffscreenCanvas(imgW, totalHeight);
    const ctx = canvas.getContext('2d')!;

    for (const { dataUrl, y: captureY } of captures) {
        const bitmap = await fetchBitmap(dataUrl);
        const remaining = totalHeight - captureY;
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

function handleToggleRecording() {
    if (isRecording) {
        handleStopRecording();
    } else {
        handleStartRecording({});
    }
}

async function handleStartRecording(config: Record<string, unknown> = {}, streamId?: string) {
    if (streamId) {
        // streamId already obtained by the popup (extension page)
        await startRecordingWithStream(config, streamId);
    } else {
        // Keyboard shortcut path: background acquires streamId via native picker
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab?.id) return;
        chrome.desktopCapture.chooseDesktopMedia(
            ['screen', 'window', 'tab'],
            tab,
            async (sid: string) => {
                if (!sid) return;
                await startRecordingWithStream(config, sid);
            }
        );
    }
}

async function startRecordingWithStream(config: Record<string, unknown>, streamId: string) {
    await createOffscreenIfNeeded();
    chrome.runtime.sendMessage({
        type: MSG.RECORDING_START,
        config: { ...config, streamId },
    });
    isRecording = true;

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'RECORDING_SHOW_CONTROLS' }).catch(() => {});
    }
}

function handleStopRecording() {
    chrome.runtime.sendMessage({
        type: MSG.RECORDING_STOP,
    });
    isRecording = false;

    // Hide recording controls on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'RECORDING_HIDE_CONTROLS' }).catch(() => {});
        }
    });
}

function handleRecordingData(dataUrl: string) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const filename = `proscreen-recording-${time}.webm`;

    chrome.downloads.download({
        url: dataUrl,
        filename,
        saveAs: true,
    });

    // Also hide controls (in case stop came from offscreen)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'RECORDING_HIDE_CONTROLS' }).catch(() => {});
        }
    });
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
        justification: 'Screen recording via getUserMedia with desktop stream ID',
    });
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function openEditor(dataUrl: string) {
    // Store capture data temporarily, then open editor
    chrome.storage.local.set({ _pendingCapture: dataUrl }, () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('editor.html'),
        });
    });
}
