import { MSG } from '../constants/messages';

// ─── State ───────────────────────────────────────────────────────────────────

let isRecording = false;
let recordingTimer: ReturnType<typeof setInterval> | null = null;
let recordingStartTime = 0;

export function getIsRecording() {
    return isRecording;
}

// ─── Timer ───────────────────────────────────────────────────────────────────

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

// ─── Handlers ────────────────────────────────────────────────────────────────

export function handleToggleRecording() {
    if (isRecording) {
        handleStopRecording();
    } else {
        handleStartRecording({});
    }
}

export async function handleStartRecording(config: Record<string, unknown> = {}) {
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

export function handleStopRecording() {
    chrome.runtime.sendMessage({
        type: MSG.RECORDING_STOP,
    });
    isRecording = false;
    stopRecordingTimer();

    hideRecordingControls();
}

export function handleRecordingData() {
    isRecording = false;
    stopRecordingTimer();
    hideRecordingControls();

    // Video data is already in IndexedDB (saved by offscreen)
    chrome.tabs.create({
        url: chrome.runtime.getURL('video.html'),
    });

    // Cleanup offscreen document
    chrome.offscreen.closeDocument().catch(() => { });
}

export function handleRecordingStatus(state: string) {
    if (state === 'recording') {
        isRecording = true;
        startRecordingTimer();
    }
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hideRecordingControls() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'RECORDING_HIDE_CONTROLS' }).catch(() => { });
        }
    });
}
