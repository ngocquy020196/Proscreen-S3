import React, { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { t } from '../i18n';
import { MSG } from '../constants/messages';
import { getHistory } from '../lib/history';
import { copyToClipboard } from '../utils/clipboard';
import { APP_LINKS } from '../constants/links';
import type { UploadHistoryItem, AudioSource } from '../types';

const App: React.FC = () => {
    const { settings, loaded, update } = useSettings();
    const [recentUploads, setRecentUploads] = useState<UploadHistoryItem[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [hideDonate, setHideDonate] = useState(true);

    useEffect(() => {
        chrome.storage.local.get({ _hideDonate: false }, (r) => setHideDonate(r._hideDonate));
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = settings.theme;
    }, [settings.theme]);

    useEffect(() => {
        getHistory().then((history) => setRecentUploads(history.slice(0, 3)));
    }, []);

    if (!loaded) return null;

    const handleCapture = (type: string) => {
        chrome.runtime.sendMessage({ type });
        window.close();
    };

    const handleCopyLink = async (item: UploadHistoryItem) => {
        await copyToClipboard(item.url);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const toggleAudio = (source: AudioSource) => {
        const current = settings.recording.audioSource;
        const newSource = current === source ? 'none' : source;
        update('recording', { ...settings.recording, audioSource: newSource });
    };

    const toggleWebcam = () => {
        update('recording', {
            ...settings.recording,
            webcamEnabled: !settings.recording.webcamEnabled,
        });
    };

    return (
        <div className="popup-container">
            {/* Header */}
            <header className="popup-header">
                <div className="header-content">
                    <div className="header-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                    </div>
                    <div className="header-text">
                        <h1>{t('appName')}</h1>
                        <p>{t('appTagline')}</p>
                    </div>
                </div>
                <button className="header-settings" onClick={() => chrome.runtime.openOptionsPage()} title={t('settings')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                </button>
            </header>

            {/* Screenshot Section */}
            <section className="section">
                <h2 className="section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                    </svg>
                    {t('screenshot')}
                </h2>
                <div className="capture-buttons">
                    <button
                        className="capture-btn"
                        onClick={() => handleCapture(MSG.CAPTURE_VISIBLE)}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <polyline points="8 21 12 17 16 21" />
                        </svg>
                        <span>{t('captureVisible')}</span>
                        <kbd>Alt+S</kbd>
                    </button>
                    <button
                        className="capture-btn"
                        onClick={() => handleCapture(MSG.CAPTURE_AREA_START)}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 2L2 6M6 2v4H2M18 2l4 4M18 2v4h4M6 22l-4-4M6 22v-4H2M18 22l4-4M18 22v-4h4" />
                        </svg>
                        <span>{t('captureArea')}</span>
                        <kbd>Alt+A</kbd>
                    </button>
                    <button
                        className="capture-btn"
                        onClick={() => handleCapture(MSG.CAPTURE_FULLPAGE)}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        <span>{t('captureFullpage')}</span>
                    </button>
                </div>
            </section>

            <div className="divider" />

            {/* Recording Section */}
            <section className="section">
                <h2 className="section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                    {t('recording')}
                </h2>
                <button
                    className="record-btn"
                    onClick={() => handleCapture(MSG.RECORDING_START)}
                >
                    <span className="record-dot" />
                    {t('startRecording')}
                    <kbd>Alt+R</kbd>
                </button>
                <div className="recording-options">
                    <label className="option-toggle">
                        <input
                            type="checkbox"
                            checked={settings.recording.audioSource === 'mic' || settings.recording.audioSource === 'both'}
                            onChange={() => toggleAudio('mic')}
                        />
                        <span>{t('microphone')}</span>
                    </label>
                    <label className="option-toggle">
                        <input
                            type="checkbox"
                            checked={settings.recording.webcamEnabled}
                            onChange={toggleWebcam}
                        />
                        <span>{t('webcam')}</span>
                    </label>
                </div>
            </section>

            {/* Recent Uploads */}
            {recentUploads.length > 0 && (
                <>
                    <div className="divider" />
                    <section className="section">
                        <h2 className="section-title section-title-small">
                            {t('recentUploads')} ({recentUploads.length})
                        </h2>
                        <div className="recent-list">
                            {recentUploads.map((item) => (
                                <div key={item.id} className="recent-item">
                                    <div className="recent-thumb icon-only" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                        {item.type === 'recording' ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                        )}
                                    </div>
                                    <span className="recent-name">{item.filename}</span>
                                    <button
                                        className="recent-copy"
                                        onClick={() => handleCopyLink(item)}
                                        title={t('copyLink')}
                                    >
                                        {copiedId === item.id ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}

            {/* Footer */}
            <footer className="popup-footer-block">
                {!hideDonate && (
                    <div className="donate-section">
                        <div className="donate-text">
                            <span>Enjoying this extension? Support its development!</span>
                            <button className="donate-close" onClick={() => { setHideDonate(true); chrome.storage.local.set({ _hideDonate: true }); }} title="Dismiss">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <a className="donate-btn" href={APP_LINKS.donate} target="_blank" rel="noopener noreferrer">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                            Buy Me a Coffee
                        </a>
                    </div>
                )}
                <div className="footer-info">
                    <span>Version {chrome.runtime.getManifest().version}</span>
                    <span>Powered by <a href={APP_LINKS.author} target="_blank" rel="noopener noreferrer">{t('authorName')}</a></span>
                </div>
            </footer>
        </div>
    );
};

export default App;
