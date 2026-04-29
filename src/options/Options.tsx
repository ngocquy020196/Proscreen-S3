import React, { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { t } from '../i18n';
import { testS3Connection } from '../lib/s3-upload';
import { getHistory, removeHistoryItem, clearHistory } from '../lib/history';
import { copyToClipboard } from '../utils/clipboard';
import { APP_LINKS } from '../constants/links';
import type { S3Config, StorageMode, Theme, ImageFormat, UploadHistoryItem } from '../types';

type Tab = 's3' | 'history' | 'recording' | 'general';

const Options: React.FC = () => {
    const { settings, loaded, update } = useSettings();
    const [activeTab, setActiveTab] = useState<Tab>('s3');
    const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
    const [history, setHistory] = useState<UploadHistoryItem[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [hideDonate, setHideDonate] = useState(false);

    useEffect(() => {
        chrome.storage.local.get({ _hideDonate: false }, (r) => setHideDonate(r._hideDonate));
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = settings.theme;
    }, [settings.theme]);

    useEffect(() => {
        if (activeTab === 'history') {
            getHistory().then(setHistory);
        }
    }, [activeTab]);

    // Handle hash navigation
    useEffect(() => {
        const hash = window.location.hash.replace('#', '') as Tab;
        if (['s3', 'history', 'recording', 'general'].includes(hash)) {
            setActiveTab(hash);
        }
    }, []);

    if (!loaded) return null;

    const updateS3 = <K extends keyof S3Config>(key: K, value: S3Config[K]) => {
        update('s3', { ...settings.s3, [key]: value });
    };

    const handleTestConnection = async () => {
        setTestResult('testing');
        const ok = await testS3Connection(settings.s3);
        setTestResult(ok ? 'success' : 'fail');
        setTimeout(() => setTestResult('idle'), 3000);
    };

    const handleCopy = async (item: UploadHistoryItem) => {
        await copyToClipboard(item.url);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const handleDelete = async (id: string) => {
        await removeHistoryItem(id);
        setHistory((prev) => prev.filter((i) => i.id !== id));
    };

    const handleClearHistory = async () => {
        await clearHistory();
        setHistory([]);
    };

    const tabs: { key: Tab; label: string }[] = [
        { key: 's3', label: t('s3Settings') },
        { key: 'history', label: t('uploadHistory') },
        { key: 'recording', label: t('recordingSettings') },
        { key: 'general', label: t('general') },
    ];

    return (
        <div className="options-container">
            <header className="options-header">
                <h1>{t('appName')} — {t('settings')}</h1>
            </header>

            <nav className="options-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            <main className="options-content">
                {/* S3 Config Tab */}
                {activeTab === 's3' && (
                    <div className="tab-panel">
                        <div className="form-group">
                            <label>{t('storageMode')}</label>
                            <div className="segmented-control">
                                {(['local', 'custom', 'cloud'] as StorageMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        className={settings.s3.mode === mode ? 'seg-active' : ''}
                                        onClick={() => updateS3('mode', mode)}
                                    >
                                        {mode === 'local' ? t('localOnly') :
                                            mode === 'custom' ? t('customS3') :
                                                t('cloudManaged')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {settings.s3.mode === 'custom' && (
                            <>
                                <div className="form-group">
                                    <label>{t('endpoint')}</label>
                                    <input
                                        type="url"
                                        value={settings.s3.endpoint}
                                        onChange={(e) => updateS3('endpoint', e.target.value)}
                                        placeholder="https://xxx.r2.cloudflarestorage.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('bucket')}</label>
                                    <input
                                        type="text"
                                        value={settings.s3.bucket}
                                        onChange={(e) => updateS3('bucket', e.target.value)}
                                        placeholder="my-screenshots"
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>{t('accessKey')}</label>
                                        <input
                                            type="password"
                                            value={settings.s3.accessKeyId}
                                            onChange={(e) => updateS3('accessKeyId', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('secretKey')}</label>
                                        <input
                                            type="password"
                                            value={settings.s3.secretAccessKey}
                                            onChange={(e) => updateS3('secretAccessKey', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>{t('region')}</label>
                                        <input
                                            type="text"
                                            value={settings.s3.region}
                                            onChange={(e) => updateS3('region', e.target.value)}
                                            placeholder="auto"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('pathPrefix')}</label>
                                        <input
                                            type="text"
                                            value={settings.s3.pathPrefix}
                                            onChange={(e) => updateS3('pathPrefix', e.target.value)}
                                            placeholder="proscreen/"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>{t('publicUrl')}</label>
                                    <input
                                        type="url"
                                        value={settings.s3.publicUrl}
                                        onChange={(e) => updateS3('publicUrl', e.target.value)}
                                        placeholder="https://cdn.example.com"
                                    />
                                </div>
                                <button
                                    className={`test-btn ${testResult}`}
                                    onClick={handleTestConnection}
                                    disabled={testResult === 'testing'}
                                >
                                    {testResult === 'testing' ? '...' :
                                        testResult === 'success' ? (
                                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}><polyline points="20 6 9 17 4 12" /></svg>{t('connectionSuccess')}</>
                                        ) :
                                            testResult === 'fail' ? (
                                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>{t('connectionFailed')}</>
                                            ) :
                                                t('testConnection')}
                                </button>
                            </>
                        )}

                        {settings.s3.mode === 'cloud' && (
                            <div className="cloud-notice">
                                <p>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>
                                    Cloud mode coming soon. Use Custom S3 for now.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="tab-panel">
                        {history.length === 0 ? (
                            <p className="empty-state">{t('noUploads')}</p>
                        ) : (
                            <>
                                <div className="history-actions">
                                    <button className="clear-btn" onClick={handleClearHistory}>
                                        Clear All
                                    </button>
                                </div>
                                <div className="history-list">
                                    {history.map((item) => (
                                        <div key={item.id} className="history-item">
                                            <div className="history-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                                {item.type === 'recording' ? (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                                                ) : (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                                )}
                                            </div>
                                            <div className="history-info">
                                                <span className="history-name">{item.filename}</span>
                                                <span className="history-meta">
                                                    {new Date(item.timestamp).toLocaleString()} · {formatSize(item.size)}
                                                </span>
                                            </div>
                                            <button
                                                className="history-copy"
                                                onClick={() => handleCopy(item)}
                                            >
                                                {copiedId === item.id ? (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                ) : (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                                )}
                                            </button>
                                            <button
                                                className="history-delete"
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Recording Tab */}
                {activeTab === 'recording' && (
                    <div className="tab-panel">
                        <div className="form-group">
                            <label>{t('videoQuality')}</label>
                            <div className="segmented-control">
                                {(['low', 'medium', 'high'] as const).map((q) => (
                                    <button
                                        key={q}
                                        className={settings.recording.videoQuality === q ? 'seg-active' : ''}
                                        onClick={() => update('recording', { ...settings.recording, videoQuality: q })}
                                    >
                                        {t(q)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t('audioSource')}</label>
                            <div className="segmented-control">
                                {(['none', 'mic', 'system', 'both'] as const).map((src) => (
                                    <button
                                        key={src}
                                        className={settings.recording.audioSource === src ? 'seg-active' : ''}
                                        onClick={() => update('recording', { ...settings.recording, audioSource: src })}
                                    >
                                        {src === 'none' ? t('noAudio') :
                                            src === 'mic' ? t('microphone') :
                                                src === 'system' ? t('systemAudio') :
                                                    t('bothAudio')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* General Tab */}
                {activeTab === 'general' && (
                    <div className="tab-panel">
                        <div className="form-group">
                            <label>{t('theme')}</label>
                            <div className="segmented-control">
                                {(['dark', 'light'] as Theme[]).map((th) => (
                                    <button
                                        key={th}
                                        className={settings.theme === th ? 'seg-active' : ''}
                                        onClick={() => update('theme', th)}
                                    >
                                        {t(th)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t('imageFormat')}</label>
                            <div className="segmented-control">
                                {(['png', 'jpeg', 'webp'] as ImageFormat[]).map((fmt) => (
                                    <button
                                        key={fmt}
                                        className={settings.imageFormat === fmt ? 'seg-active' : ''}
                                        onClick={() => update('imageFormat', fmt)}
                                    >
                                        {fmt.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {settings.imageFormat !== 'png' && (
                            <div className="form-group">
                                <label>{t('imageQuality')}: {Math.round(settings.imageQuality * 100)}%</label>
                                <input
                                    type="range"
                                    min={0.1}
                                    max={1}
                                    step={0.05}
                                    value={settings.imageQuality}
                                    onChange={(e) => update('imageQuality', Number(e.target.value))}
                                />
                            </div>
                        )}
                        <div className="form-group toggle-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.autoCopyLink}
                                    onChange={(e) => update('autoCopyLink', e.target.checked)}
                                />
                                {t('autoCopyLink')}
                            </label>
                        </div>
                        <div className="form-group toggle-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.showNotification}
                                    onChange={(e) => update('showNotification', e.target.checked)}
                                />
                                {t('showNotification')}
                            </label>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="options-footer-block">
                {!hideDonate && (
                    <div className="donate-section">
                        <div className="donate-text">
                            <span>Enjoying this extension? Support its development!</span>
                            <button className="donate-close" onClick={() => { setHideDonate(true); chrome.storage.local.set({ _hideDonate: true }); }} title="Dismiss">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <a className="donate-btn" href={APP_LINKS.donate} target="_blank" rel="noopener noreferrer">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
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

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default Options;
