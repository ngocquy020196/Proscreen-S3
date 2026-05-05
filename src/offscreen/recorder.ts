// ─── Offscreen Document ──────────────────────────────────────────────────────
// Handles screen recording using getDisplayMedia + MediaRecorder.
// This runs in an offscreen document because Service Workers lack DOM access.

import { MSG } from '../constants/messages';
import { saveVideoBlob } from '../lib/video-store';

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
        case MSG.OFFSCREEN_START_RECORDING:
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
    }
});

let audioCtxRef: AudioContext | null = null;

async function startRecording(config: { audioSource?: string; webcamEnabled?: boolean }) {
    try {
        // Use getDisplayMedia — Chrome shows native picker automatically
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: config.audioSource === 'system' || config.audioSource === 'both',
        });

        let finalStream = displayStream;

        // Mix microphone audio if requested
        if (config.audioSource === 'mic' || config.audioSource === 'both') {
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioCtx = new AudioContext();
                audioCtxRef = audioCtx;
                const dest = audioCtx.createMediaStreamDestination();

                displayStream.getAudioTracks().forEach((track) => {
                    const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
                    source.connect(dest);
                });

                micStream.getAudioTracks().forEach((track) => {
                    const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
                    source.connect(dest);
                });

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

        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });

            // Save blob directly to IndexedDB (no base64 conversion)
            await saveVideoBlob(blob);
            chrome.runtime.sendMessage({ type: MSG.RECORDING_DATA });

            // Cleanup
            finalStream.getTracks().forEach((t) => t.stop());
            if (audioCtxRef) {
                audioCtxRef.close().catch(() => {});
                audioCtxRef = null;
            }
        };

        mediaRecorder.start(1000); // 1s timeslice

        chrome.runtime.sendMessage({
            type: MSG.RECORDING_STATUS,
            state: 'recording',
        });
    } catch (err) {
        console.error('[ProScreen] Recording error:', err);
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
