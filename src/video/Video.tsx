import React, { useEffect, useState } from 'react';
import { getSettings } from '../utils/storage';
import { uploadToS3 } from '../lib/s3-upload';
import { addHistoryItem, generateId } from '../lib/history';
import { copyToClipboard } from '../utils/clipboard';
import { loadVideoBlob } from '../lib/video-store';
import type { Settings } from '../types';

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const Icon = {
    video: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
    ),
    download: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    ),
    upload: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    ),
    copy: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    ),
    check: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
};

// ─── Component ───────────────────────────────────────────────────────────────

const Video: React.FC = () => {
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadUrl, setUploadUrl] = useState('');
    const [urlCopied, setUrlCopied] = useState(false);
    const [storageMode, setStorageMode] = useState<'local' | 'upload'>('local');

    useEffect(() => {
        document.title = 'Video Preview — ProScreen S3';

        getSettings().then((s) => {
            setStorageMode(s.s3.mode === 'custom' && !!s.s3.endpoint ? 'upload' : 'local');
        });

        loadVideoBlob().then((blob) => {
            if (!blob) return;
            setVideoBlob(blob);
            setVideoUrl(URL.createObjectURL(blob));
        });
    }, []);

    const handleDownload = () => {
        if (!videoUrl) return;
        const link = document.createElement('a');
        link.download = `proscreen-recording-${Date.now()}.webm`;
        link.href = videoUrl;
        link.click();
    };

    const handleSaveUpload = async () => {
        if (!videoBlob) return;

        let settings: Settings;
        try {
            settings = await getSettings();
        } catch {
            handleDownload();
            return;
        }

        if (settings.s3.mode !== 'custom' || !settings.s3.endpoint) {
            handleDownload();
            return;
        }

        setUploadState('uploading');
        setUploadProgress(0);

        try {
            const time = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
            const filename = `proscreen-recording-${time}.webm`;
            const result = await uploadToS3(settings.s3, filename, videoBlob, (p) => setUploadProgress(p.percentage));

            await addHistoryItem({
                id: generateId(),
                url: result.url,
                filename,
                size: result.size,
                type: 'recording',
                timestamp: Date.now(),
            });

            if (settings.autoCopyLink) await copyToClipboard(result.url);
            setUploadUrl(result.url);
            setUploadState('done');
        } catch {
            setUploadState('error');
        }
    };

    const handleCopyUrl = async () => {
        await copyToClipboard(uploadUrl);
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
    };

    return (
        <div className="video-page">
            {/* ── Header ── */}
            <header className="video-header">
                <div className="video-header-title">
                    {Icon.video}
                    <span>Video Preview</span>
                </div>

                <div className="video-header-actions">
                    <button className="btn" onClick={handleDownload} disabled={!videoUrl}>
                        {Icon.download}
                        <span>Download</span>
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSaveUpload}
                        disabled={!videoUrl || uploadState === 'uploading'}
                    >
                        {storageMode === 'upload' ? Icon.upload : Icon.download}
                        <span>
                            {uploadState === 'uploading'
                                ? `Uploading ${uploadProgress}%`
                                : storageMode === 'upload'
                                    ? 'Save & Upload'
                                    : 'Save'}
                        </span>
                    </button>
                </div>
            </header>

            {/* ── Progress ── */}
            {uploadState === 'uploading' && (
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
            )}

            {/* ── Success Banner ── */}
            {uploadState === 'done' && (
                <div className="success-banner">
                    <span className="success-label">✓ Uploaded</span>
                    <input
                        className="success-input"
                        readOnly
                        value={uploadUrl}
                        onFocus={(e) => e.target.select()}
                    />
                    <button className="success-copy" onClick={handleCopyUrl}>
                        {urlCopied ? Icon.check : Icon.copy}
                        <span>{urlCopied ? 'Copied!' : 'Copy URL'}</span>
                    </button>
                    <button className="success-close" onClick={() => setUploadState('idle')}>×</button>
                </div>
            )}

            {/* ── Error Toast ── */}
            {uploadState === 'error' && (
                <div className="error-toast" onClick={() => setUploadState('idle')}>
                    Upload failed — check S3 settings in Options. Click to dismiss.
                </div>
            )}

            {/* ── Video Player ── */}
            <main className="video-canvas">
                {!videoUrl ? (
                    <div className="video-loading">
                        <div className="video-loading-spinner" />
                        <span>Loading video...</span>
                    </div>
                ) : (
                    <video
                        className="video-player"
                        src={videoUrl}
                        controls
                        autoPlay
                    />
                )}
            </main>
        </div>
    );
};

export default Video;
