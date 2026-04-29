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
            handleCaptureVisible(); // TODO: implement full page scrolling capture
            break;

        case MSG.RECORDING_START:
            handleStartRecording(msg.config);
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

function cropAndOpenEditor(
    dataUrl: string,
    rect: { x: number; y: number; width: number; height: number }
) {
    // Use offscreen document to crop since service worker has no canvas
    createOffscreenIfNeeded().then(() => {
        chrome.runtime.sendMessage({
            type: 'CROP_IMAGE',
            dataUrl,
            rect,
        });
    });
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

async function handleStartRecording(config: Record<string, unknown>) {
    await createOffscreenIfNeeded();
    chrome.runtime.sendMessage({
        type: MSG.RECORDING_START,
        config,
    });
    isRecording = true;

    // Show recording controls on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'RECORDING_SHOW_CONTROLS' }).catch(() => {});
        }
    });
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
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: 'Screen recording requires DOM access for MediaRecorder',
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
