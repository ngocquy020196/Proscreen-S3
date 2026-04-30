import { MSG } from '../constants/messages';

// ─── Capture Overlay State ───────────────────────────────────────────────────

let overlay: HTMLDivElement | null = null;
let selectionBox: HTMLDivElement | null = null;
let dimensionLabel: HTMLDivElement | null = null;
let startX = 0;
let startY = 0;
let isSelecting = false;

// ─── Recording Widget State ──────────────────────────────────────────────────

let recWidget: HTMLDivElement | null = null;
let recTimerInterval: ReturnType<typeof setInterval> | null = null;
let recSeconds = 0;
let recPaused = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === MSG.CAPTURE_AREA_START) {
        showOverlay(msg.dataUrl);
    }
    if (msg.type === 'RECORDING_SHOW_CONTROLS') {
        showRecordingWidget();
    }
    if (msg.type === 'RECORDING_HIDE_CONTROLS') {
        hideRecordingWidget();
    }
    if (msg.type === MSG.FULLPAGE_GET_INFO) {
        sendResponse({
            totalHeight: document.documentElement.scrollHeight,
            totalWidth: document.documentElement.scrollWidth,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            scrollTop: window.scrollY,
        });
        return true;
    }
    if (msg.type === MSG.FULLPAGE_SCROLL) {
        window.scrollTo(0, msg.y);
        // Wait for scroll + any lazy-loaded content.
        // Chrome strictly limits captureVisibleTab to 2 calls per second.
        // We must delay at least 500ms to avoid MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND error.
        setTimeout(() => sendResponse({ done: true }), 550);
        return true;
    }
    if (msg.type === MSG.FULLPAGE_DONE) {
        window.scrollTo(0, msg.originalScrollTop ?? 0);
    }
});

function showOverlay(dataUrl?: string) {
    removeOverlay();

    overlay = document.createElement('div');
    overlay.id = 'proscreen-overlay';
    
    const backgroundStyle = dataUrl 
        ? `background-image: url(${dataUrl}); background-size: 100% 100%; background-repeat: no-repeat;`
        : `background: transparent;`;
        
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        cursor: crosshair;
        ${backgroundStyle}
    `;

    selectionBox = document.createElement('div');
    selectionBox.id = 'proscreen-selection';
    selectionBox.style.cssText = `
        position: fixed;
        border: 2px solid #1D2592;
        background: transparent;
        box-shadow: 0 0 0 9999px rgba(18, 20, 23, 0.45);
        z-index: 2147483647;
        left: -100px;
        top: -100px;
        width: 0px;
        height: 0px;
        display: block;
        pointer-events: none;
    `;

    dimensionLabel = document.createElement('div');
    dimensionLabel.id = 'proscreen-dimension';
    dimensionLabel.style.cssText = `
        position: fixed;
        background: #1D2592;
        color: #fff;
        font: 12px/1.4 -apple-system, sans-serif;
        padding: 2px 8px;
        border-radius: 3px;
        z-index: 2147483647;
        pointer-events: none;
        display: none;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(selectionBox);
    document.body.appendChild(dimensionLabel);

    overlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
}

function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    if (selectionBox) {
        selectionBox.style.left = `${startX}px`;
        selectionBox.style.top = `${startY}px`;
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
    }
    if (dimensionLabel) {
        dimensionLabel.style.display = 'block';
    }
}

function onMouseMove(e: MouseEvent) {
    if (!isSelecting || !selectionBox || !dimensionLabel) return;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = `${w}px`;
    selectionBox.style.height = `${h}px`;

    dimensionLabel.textContent = `${w} × ${h}`;
    dimensionLabel.style.left = `${x}px`;
    dimensionLabel.style.top = `${y + h + 8}px`;
}

function onMouseUp(e: MouseEvent) {
    if (!isSelecting) return;
    isSelecting = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    removeOverlay();

    if (w < 10 || h < 10) return; // Too small, ignore

    const dpr = window.devicePixelRatio || 1;
    chrome.runtime.sendMessage({
        type: MSG.CAPTURE_AREA_DONE,
        rect: {
            x: Math.round(x * dpr),
            y: Math.round(y * dpr),
            width: Math.round(w * dpr),
            height: Math.round(h * dpr),
        },
    });
}

function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        removeOverlay();
        chrome.runtime.sendMessage({ type: MSG.CAPTURE_AREA_CANCEL });
    }
}

function removeOverlay() {
    isSelecting = false;
    overlay?.remove();
    selectionBox?.remove();
    dimensionLabel?.remove();
    overlay = null;
    selectionBox = null;
    dimensionLabel = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
}

// ─── Recording Controls Widget ───────────────────────────────────────────────

function pad(n: number) { return n.toString().padStart(2, '0'); }
function fmtTime(s: number) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }

function showRecordingWidget() {
    hideRecordingWidget();
    recSeconds = 0;
    recPaused = false;

    recWidget = document.createElement('div');
    recWidget.id = 'proscreen-rec-widget';
    recWidget.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 16px;
        background: #121417;
        border: 1px solid #30343d;
        border-radius: 24px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        font: 13px/1 -apple-system, sans-serif;
        color: #F5F5F5;
        cursor: grab;
        user-select: none;
    `;

    // Red dot
    const dot = document.createElement('span');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:#D93025;animation:proscreen-pulse 1.5s infinite;flex-shrink:0;`;
    recWidget.appendChild(dot);

    // Timer
    const timer = document.createElement('span');
    timer.id = 'proscreen-rec-timer';
    timer.textContent = '00:00';
    timer.style.cssText = 'font-variant-numeric:tabular-nums;min-width:40px;';
    recWidget.appendChild(timer);

    // Separator
    const sep = document.createElement('span');
    sep.style.cssText = 'width:1px;height:16px;background:#30343d;';
    recWidget.appendChild(sep);

    // Pause button
    const pauseBtn = document.createElement('button');
    pauseBtn.title = 'Pause/Resume';
    pauseBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    pauseBtn.style.cssText = 'all:unset;cursor:pointer;display:flex;align-items:center;color:#9CA2AC;';
    pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        recPaused = !recPaused;
        chrome.runtime.sendMessage({ type: recPaused ? MSG.RECORDING_PAUSE : MSG.RECORDING_RESUME });
        pauseBtn.innerHTML = recPaused
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
        dot.style.animation = recPaused ? 'none' : 'proscreen-pulse 1.5s infinite';
    });
    recWidget.appendChild(pauseBtn);

    // Stop button
    const stopBtn = document.createElement('button');
    stopBtn.title = 'Stop Recording';
    stopBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
    stopBtn.style.cssText = 'all:unset;cursor:pointer;display:flex;align-items:center;color:#D93025;';
    stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: MSG.RECORDING_STOP });
        hideRecordingWidget();
    });
    recWidget.appendChild(stopBtn);

    // Inject pulse animation
    if (!document.getElementById('proscreen-rec-style')) {
        const style = document.createElement('style');
        style.id = 'proscreen-rec-style';
        style.textContent = `@keyframes proscreen-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`;
        document.head.appendChild(style);
    }

    document.body.appendChild(recWidget);

    // Draggable
    let dragOffsetX = 0, dragOffsetY = 0, isDragging = false;
    recWidget.addEventListener('mousedown', (e) => {
        isDragging = true;
        const r = recWidget!.getBoundingClientRect();
        dragOffsetX = e.clientX - r.left;
        dragOffsetY = e.clientY - r.top;
        recWidget!.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !recWidget) return;
        recWidget.style.left = `${e.clientX - dragOffsetX}px`;
        recWidget.style.top = `${e.clientY - dragOffsetY}px`;
        recWidget.style.bottom = 'auto';
        recWidget.style.transform = 'none';
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        if (recWidget) recWidget.style.cursor = 'grab';
    });

    // Timer interval
    recTimerInterval = setInterval(() => {
        if (!recPaused) {
            recSeconds++;
            const el = document.getElementById('proscreen-rec-timer');
            if (el) el.textContent = fmtTime(recSeconds);
        }
    }, 1000);
}

function hideRecordingWidget() {
    recWidget?.remove();
    recWidget = null;
    if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }
    recSeconds = 0;
    recPaused = false;
}

