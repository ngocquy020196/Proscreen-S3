import { MSG } from '../constants/messages';
import {
    handleCaptureVisible,
    handleCaptureArea,
    handleAreaCaptureDone,
    handleCaptureFullPage,
    resetFrozenAreaCapture,
    openEditor,
} from './capture';
import {
    handleStartRecording,
    handleStopRecording,
    handleRecordingData,
    handleRecordingStatus,
    handleToggleRecording,
    getIsRecording,
} from './recording';

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
        return true;
    }

    if (msg.type === MSG.GET_RECORDING_STATE) {
        sendResponse({ isRecording: getIsRecording() });
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
            resetFrozenAreaCapture();
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
            handleRecordingStatus(msg.state);
            break;

        case MSG.OPEN_EDITOR:
            openEditor(msg.dataUrl);
            break;
    }

    sendResponse({ ok: true });
    return true;
});
