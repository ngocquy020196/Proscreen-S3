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
    }
});

async function startRecording(config: { audioSource?: string; webcamEnabled?: boolean; streamId?: string }) {
    try {
        if (!config.streamId) {
            throw new Error('No stream ID provided');
        }

        const needSystemAudio = config.audioSource === 'system' || config.audioSource === 'both';

        // Use the streamId from chrome.desktopCapture.chooseDesktopMedia()
        const displayStream = await navigator.mediaDevices.getUserMedia({
            video: {
                // @ts-ignore – Chrome-specific constraint
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: config.streamId,
                },
            },
            audio: needSystemAudio
                ? {
                      // @ts-ignore
                      mandatory: {
                          chromeMediaSource: 'desktop',
                          chromeMediaSourceId: config.streamId,
                      },
                  }
                : false,
        });

        let finalStream = displayStream;

        // Mix microphone audio if requested
        if (config.audioSource === 'mic' || config.audioSource === 'both') {
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioCtx = new AudioContext();
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

