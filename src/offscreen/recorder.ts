// ─── Offscreen Document ──────────────────────────────────────────────────────
// Handles screen recording using getDisplayMedia + MediaRecorder.
// This runs in an offscreen document because Service Workers lack DOM access.

import { MSG } from '../constants/messages';

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
        case MSG.RECORDING_START:
            startRecording(msg.config);
            break;
        case MSG.RECORDING_STOP:
            stopRecording();
            break;
        case MSG.RECORDING_PAUSE:
            mediaRecorder?.pause();
            break;
        case MSG.RECORDING_RESUME:
            mediaRecorder?.resume();
            break;
        case 'CROP_IMAGE':
            cropImage(msg.dataUrl, msg.rect);
            break;
    }
});

async function startRecording(config: { audioSource?: string; webcamEnabled?: boolean }) {
    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: config.audioSource === 'system' || config.audioSource === 'both',
        });

        let finalStream = displayStream;

        // Mix microphone audio if requested
        if (config.audioSource === 'mic' || config.audioSource === 'both') {
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioCtx = new AudioContext();
                const dest = audioCtx.createMediaStreamDestination();

                // Add display audio tracks
                displayStream.getAudioTracks().forEach((track) => {
                    const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
                    source.connect(dest);
                });

                // Add microphone
                micStream.getAudioTracks().forEach((track) => {
                    const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
                    source.connect(dest);
                });

                // Combine video from display + mixed audio
                finalStream = new MediaStream([
                    ...displayStream.getVideoTracks(),
                    ...dest.stream.getAudioTracks(),
                ]);
            } catch {
                // Microphone denied, continue without mic
            }
        }

        recordedChunks = [];
        mediaRecorder = new MediaRecorder(finalStream, {
            mimeType: 'video/webm;codecs=vp9',
        });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                chrome.runtime.sendMessage({
                    type: MSG.RECORDING_DATA,
                    dataUrl: reader.result,
                });
            };
            reader.readAsDataURL(blob);

            // Cleanup
            finalStream.getTracks().forEach((t) => t.stop());
        };

        mediaRecorder.start(1000); // 1s timeslice

        chrome.runtime.sendMessage({
            type: MSG.RECORDING_STATUS,
            state: 'recording',
        });
    } catch (err) {
        chrome.runtime.sendMessage({
            type: MSG.UPLOAD_ERROR,
            error: (err as Error).message,
        });
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

// ─── Image Cropping ──────────────────────────────────────────────────────────

function cropImage(
    dataUrl: string,
    rect: { x: number; y: number; width: number; height: number }
) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

        const croppedDataUrl = canvas.toDataURL('image/png');

        // Store and open editor
        chrome.storage.local.set({ _pendingCapture: croppedDataUrl }, () => {
            chrome.runtime.sendMessage({ type: MSG.OPEN_EDITOR, dataUrl: croppedDataUrl });
        });
    };
    img.src = dataUrl;
}
