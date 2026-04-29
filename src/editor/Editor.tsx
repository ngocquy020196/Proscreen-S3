import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSettings } from '../utils/storage';
import { uploadToS3 } from '../lib/s3-upload';
import { addHistoryItem, generateId } from '../lib/history';
import { copyToClipboard } from '../utils/clipboard';
import { canvasToBlob, generateFilename } from '../utils/image';
import type { Settings, ImageFormat } from '../types';

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const I = {
    pen: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>,
    arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19L19 5"/><path d="M19 5v10"/><path d="M19 5H9"/></svg>,
    rect: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
    text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
    blur: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
    crop: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>,
    download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    undo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
    redo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>,
};

type ToolKey = 'pen' | 'arrow' | 'rect' | 'text' | 'crop';
const TOOLS: { key: ToolKey; label: string }[] = [
    { key: 'pen', label: 'Pen' },
    { key: 'arrow', label: 'Arrow' },
    { key: 'rect', label: 'Rectangle' },
    { key: 'text', label: 'Text' },
    { key: 'crop', label: 'Crop' },
];

// ─── Component ───────────────────────────────────────────────────────────────

const Editor: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [activeTool, setActiveTool] = useState<ToolKey>('pen');
    const [color, setColor] = useState('#ff3b30');
    const [lineWidth, setLineWidth] = useState(3);

    // Drawing state
    const isDrawing = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const points = useRef<{ x: number; y: number }[]>([]);
    const snapshotBeforeDraw = useRef<ImageData | null>(null);

    // Undo/Redo
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);

    // Upload
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadUrl, setUploadUrl] = useState('');

    // Text input
    const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
    const [textValue, setTextValue] = useState('');
    const textRef = useRef<HTMLInputElement>(null);

    // Crop
    const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // ─── Load Image ──────────────────────────────────────────────────────────

    useEffect(() => {
        document.documentElement.dataset.theme = 'dark';
        chrome.storage.local.get('_pendingCapture', (result) => {
            const dataUrl = result._pendingCapture;
            if (!dataUrl || !canvasRef.current) return;
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current!;
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
                ctx.drawImage(img, 0, 0);
                setImageLoaded(true);
                // Save initial state
                const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setHistory([initial]);
                setHistoryIdx(0);
                chrome.storage.local.remove('_pendingCapture');
            };
            img.src = dataUrl;
        });
    }, []);

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const getCtx = () => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;

    const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const saveSnapshot = useCallback(() => {
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        const snap = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        const newHistory = history.slice(0, historyIdx + 1);
        newHistory.push(snap);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIdx(newHistory.length - 1);
    }, [history, historyIdx]);

    // ─── Undo / Redo ─────────────────────────────────────────────────────────

    const handleUndo = () => {
        if (historyIdx <= 0) return;
        const ctx = getCtx();
        if (!ctx) return;
        const newIdx = historyIdx - 1;
        ctx.putImageData(history[newIdx], 0, 0);
        setHistoryIdx(newIdx);
    };

    const handleRedo = () => {
        if (historyIdx >= history.length - 1) return;
        const ctx = getCtx();
        if (!ctx) return;
        const newIdx = historyIdx + 1;
        ctx.putImageData(history[newIdx], 0, 0);
        setHistoryIdx(newIdx);
    };

    // ─── Pointer Events ──────────────────────────────────────────────────────

    const onPointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getCanvasPos(e);
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;

        if (activeTool === 'text') {
            setTextInput({ x: e.clientX, y: e.clientY, visible: true });
            setTextValue('');
            setTimeout(() => textRef.current?.focus(), 50);
            return;
        }

        isDrawing.current = true;
        startPos.current = pos;
        points.current = [pos];
        snapshotBeforeDraw.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (activeTool === 'pen') {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    };

    const onPointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        const pos = getCanvasPos(e);
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;

        if (activeTool === 'pen') {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            points.current.push(pos);
        } else {
            if (snapshotBeforeDraw.current) {
                ctx.putImageData(snapshotBeforeDraw.current, 0, 0);
            }
            const s = startPos.current;
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';

            if (activeTool === 'arrow') {
                drawArrow(ctx, s.x, s.y, pos.x, pos.y);
            } else if (activeTool === 'rect') {
                ctx.strokeRect(s.x, s.y, pos.x - s.x, pos.y - s.y);
            } else if (activeTool === 'crop') {
                // Draw crop preview with dimmed overlay
                const cx = Math.min(s.x, pos.x), cy = Math.min(s.y, pos.y);
                const cw = Math.abs(pos.x - s.x), ch = Math.abs(pos.y - s.y);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                // Clear the selected area to show original
                if (snapshotBeforeDraw.current) {
                    const cropped = new ImageData(
                        new Uint8ClampedArray(snapshotBeforeDraw.current.data),
                        snapshotBeforeDraw.current.width, snapshotBeforeDraw.current.height
                    );
                    ctx.putImageData(cropped, 0, 0, cx, cy, cw, ch);
                }
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(cx, cy, cw, ch);
                ctx.setLineDash([]);
            }
        }
    };

    const onPointerUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        const pos = getCanvasPos(e);
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        const s = startPos.current;

        if (activeTool === 'crop') {
            if (snapshotBeforeDraw.current) ctx.putImageData(snapshotBeforeDraw.current, 0, 0);
            const cx = Math.min(s.x, pos.x), cy = Math.min(s.y, pos.y);
            const cw = Math.abs(pos.x - s.x), ch = Math.abs(pos.y - s.y);
            if (cw > 10 && ch > 10) {
                setCropRect({ x: Math.round(cx), y: Math.round(cy), w: Math.round(cw), h: Math.round(ch) });
            }
        } else {
            saveSnapshot();
        }
    };

    // ─── Drawing Helpers ─────────────────────────────────────────────────────

    function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
        const headLen = 14;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    // ─── Text Commit ─────────────────────────────────────────────────────────

    const commitText = () => {
        if (!textValue.trim()) { setTextInput({ ...textInput, visible: false }); return; }
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (textInput.x - rect.left) * scaleX;
        const cy = (textInput.y - rect.top) * scaleY;
        const fontSize = Math.max(20, lineWidth * 8);
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';
        ctx.fillText(textValue, cx, cy);
        ctx.textBaseline = 'alphabetic';
        setTextInput({ ...textInput, visible: false });
        saveSnapshot();
    };

    // ─── Crop Apply ──────────────────────────────────────────────────────────

    const applyCrop = () => {
        if (!cropRect) return;
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        const { x, y, w, h } = cropRect;
        const cropped = ctx.getImageData(x, y, w, h);
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        ctx.putImageData(cropped, 0, 0);
        setCropRect(null);
        saveSnapshot();
    };

    // ─── Download ────────────────────────────────────────────────────────────

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `proscreen-${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
    };

    // ─── S3 Upload ───────────────────────────────────────────────────────────

    const handleSaveUpload = async () => {
        if (!canvasRef.current) return;
        let settings: Settings;
        try { settings = await getSettings(); } catch { handleDownload(); return; }

        if (settings.s3.mode !== 'custom' || !settings.s3.endpoint) {
            handleDownload();
            return;
        }

        setUploadState('uploading');
        setUploadProgress(0);

        try {
            const format: ImageFormat = settings.imageFormat || 'png';
            const blob = await canvasToBlob(canvasRef.current, format, settings.imageQuality);
            const filename = generateFilename(format);
            const result = await uploadToS3(settings.s3, filename, blob, (p) => setUploadProgress(p.percentage));

            // Save to history
            await addHistoryItem({
                id: generateId(),
                url: result.url,
                filename,
                size: result.size,
                type: 'screenshot',
                timestamp: Date.now(),
            });

            if (settings.autoCopyLink) await copyToClipboard(result.url);
            setUploadUrl(result.url);
            setUploadState('done');
        } catch {
            setUploadState('error');
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    const canUndo = historyIdx > 0;
    const canRedo = historyIdx < history.length - 1;

    return (
        <div className="editor-container">
            <header className="editor-toolbar">
                <div className="toolbar-tools">
                    {TOOLS.map((t) => (
                        <button key={t.key} className={`tool-btn ${activeTool === t.key ? 'active' : ''}`}
                            onClick={() => setActiveTool(t.key)} title={t.label}>
                            {I[t.key]}
                        </button>
                    ))}
                </div>
                <div className="toolbar-separator" />
                <div className="toolbar-actions-left">
                    <button className={`tool-btn ${!canUndo ? 'disabled' : ''}`} onClick={handleUndo} title="Undo">{I.undo}</button>
                    <button className={`tool-btn ${!canRedo ? 'disabled' : ''}`} onClick={handleRedo} title="Redo">{I.redo}</button>
                </div>
                <div className="toolbar-separator" />
                <div className="toolbar-props">
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color" />
                    <input type="range" min={1} max={12} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} title="Width" />
                    <span className="prop-value">{lineWidth}px</span>
                </div>
                <div className="toolbar-separator" />
                <div className="toolbar-actions">
                    <button className="action-btn" onClick={handleDownload}>{I.download}<span>Download</span></button>
                    <button className="action-btn primary" onClick={handleSaveUpload} disabled={uploadState === 'uploading'}>
                        {I.upload}<span>{uploadState === 'uploading' ? `${uploadProgress}%` : 'Save & Upload'}</span>
                    </button>
                </div>
            </header>

            {/* Upload status bar */}
            {uploadState === 'uploading' && (
                <div className="upload-bar"><div className="upload-bar-fill" style={{ width: `${uploadProgress}%` }} /></div>
            )}
            {uploadState === 'done' && (
                <div className="upload-toast success" onClick={() => { copyToClipboard(uploadUrl); setUploadState('idle'); }}>
                    Uploaded! Click to copy: {uploadUrl.slice(0, 60)}...
                </div>
            )}
            {uploadState === 'error' && (
                <div className="upload-toast error" onClick={() => setUploadState('idle')}>
                    Upload failed. Check S3 settings. Click to dismiss.
                </div>
            )}

            {/* Crop confirmation */}
            {cropRect && (
                <div className="crop-confirm">
                    <button className="action-btn primary" onClick={applyCrop}>Apply Crop</button>
                    <button className="action-btn" onClick={() => { setCropRect(null); if (snapshotBeforeDraw.current && getCtx()) getCtx()!.putImageData(snapshotBeforeDraw.current, 0, 0); }}>Cancel</button>
                </div>
            )}

            {/* Text input overlay */}
            {textInput.visible && (
                <input ref={textRef} className="text-overlay-input" value={textValue}
                    autoFocus
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput({ ...textInput, visible: false }); }}
                    onBlur={() => { setTimeout(commitText, 100); }}
                    style={{ left: textInput.x, top: textInput.y, color, fontSize: `${Math.max(14, lineWidth * 4)}px` }}
                />
            )}

            <main className="editor-canvas-wrapper">
                {!imageLoaded && <div className="editor-loading">Loading capture...</div>}
                <canvas ref={canvasRef} className="editor-canvas"
                    style={{ display: imageLoaded ? 'block' : 'none', cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
                    onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
                />
            </main>
        </div>
    );
};

export default Editor;
