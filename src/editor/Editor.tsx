import React, { useEffect, useRef, useState } from 'react';
import { getSettings } from '../utils/storage';
import { uploadToS3 } from '../lib/s3-upload';
import { addHistoryItem, generateId } from '../lib/history';
import { copyToClipboard } from '../utils/clipboard';
import { canvasToBlob, generateFilename } from '../utils/image';
import { loadImageBlob, clearImageBlob } from '../lib/image-store';
import type { Settings, ImageFormat } from '../types';

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const I = {
    pen: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>,
    arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19L19 5"/><path d="M19 5v10"/><path d="M19 5H9"/></svg>,
    rect: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
    text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
    blur: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/></svg>,
    crop: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>,
    download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
    check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    undo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
    redo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>,
};

type ToolKey = 'pen' | 'arrow' | 'rect' | 'text' | 'blur' | 'crop';
const TOOLS: { key: ToolKey; label: string }[] = [
    { key: 'pen', label: 'Pen' },
    { key: 'arrow', label: 'Arrow' },
    { key: 'rect', label: 'Rectangle' },
    { key: 'text', label: 'Text' },
    { key: 'blur', label: 'Blur' },
    { key: 'crop', label: 'Crop' },
];

// ─── Component ───────────────────────────────────────────────────────────────

const Editor: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [activeTool, setActiveTool] = useState<ToolKey>('pen');
    const [color, setColor] = useState('#ff3b30');
    const [lineWidth, setLineWidth] = useState(3);

    // Drawing state (refs — no re-render needed)
    const isDrawing = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const lastPenPoint = useRef<{ x: number; y: number } | null>(null);
    const snapshotBeforeDraw = useRef<ImageData | null>(null);

    // History via refs to avoid stale-closure bugs in saveSnapshot
    type HistoryEntry = { blob: Blob; w: number; h: number };
    const historyStack = useRef<HistoryEntry[]>([]);
    const historyIdx = useRef(-1);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Upload
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadUrl, setUploadUrl] = useState('');
    const [urlCopied, setUrlCopied] = useState(false);
    const [storageMode, setStorageMode] = useState<'local' | 'upload'>('local');

    // Text input — canvasX/Y captured at click time to avoid scroll-drift in commitText
    const [textInput, setTextInput] = useState<{ x: number; y: number; canvasX: number; canvasY: number; visible: boolean }>({ x: 0, y: 0, canvasX: 0, canvasY: 0, visible: false });
    const [textValue, setTextValue] = useState('');
    const textRef = useRef<HTMLInputElement>(null);
    const textCommittedRef = useRef(false); // prevents double-commit from Enter + onBlur

    // Crop
    const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // ─── Load Image ──────────────────────────────────────────────────────────

    useEffect(() => {
        getSettings().then((s) => {
            setStorageMode(s.s3.mode === 'custom' && !!s.s3.endpoint ? 'upload' : 'local');
        });
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = 'dark';
        loadImageBlob().then((blob) => {
            if (!blob || !canvasRef.current) return;
            const dataUrl = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current!;
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
                ctx.drawImage(img, 0, 0);
                setImageLoaded(true);
                saveSnapshot();
                URL.revokeObjectURL(dataUrl);
                clearImageBlob().catch(() => {});
            };
            img.src = dataUrl;
        });
    }, []);

    // Focus text input after React commits the DOM — autoFocus on conditional render is unreliable
    useEffect(() => {
        if (textInput.visible) {
            textRef.current?.focus();
        }
    }, [textInput.visible, textInput.x, textInput.y]);

    // ─── History (ref-based, compressed PNG blobs) ───────────────────────────

    const pushHistoryBlob = (blob: Blob, w: number, h: number) => {
        const newStack = historyStack.current.slice(0, historyIdx.current + 1);
        newStack.push({ blob, w, h });
        if (newStack.length > 50) newStack.shift();
        historyStack.current = newStack;
        historyIdx.current = newStack.length - 1;
        setCanUndo(historyIdx.current > 0);
        setCanRedo(false);
    };

    const saveSnapshot = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
        const offCtx = offscreen.getContext('2d')!;
        offCtx.drawImage(canvas, 0, 0);
        const blob = await offscreen.convertToBlob({ type: 'image/png' });
        pushHistoryBlob(blob, canvas.width, canvas.height);
    };

    const restoreEntry = async (entry: HistoryEntry) => {
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        const bitmap = await createImageBitmap(entry.blob);
        canvasRef.current.width = entry.w;
        canvasRef.current.height = entry.h;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
    };

    const handleUndo = async () => {
        if (historyIdx.current <= 0) return;
        historyIdx.current--;
        await restoreEntry(historyStack.current[historyIdx.current]);
        setCanUndo(historyIdx.current > 0);
        setCanRedo(true);
    };

    const handleRedo = async () => {
        if (historyIdx.current >= historyStack.current.length - 1) return;
        historyIdx.current++;
        await restoreEntry(historyStack.current[historyIdx.current]);
        setCanUndo(true);
        setCanRedo(historyIdx.current < historyStack.current.length - 1);
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const getCtx = () => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;

    const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    // ─── Pointer Events ──────────────────────────────────────────────────────

    const onPointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getCanvasPos(e);
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;

        if (activeTool === 'text') {
            textCommittedRef.current = false;
            const canvasPos = getCanvasPos(e);
            setTextInput({ x: e.clientX, y: e.clientY, canvasX: canvasPos.x, canvasY: canvasPos.y, visible: true });
            setTextValue('');
            return;
        }

        isDrawing.current = true;
        startPos.current = pos;
        snapshotBeforeDraw.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (activeTool === 'pen') {
            lastPenPoint.current = pos;
        }
    };

    const onPointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        const pos = getCanvasPos(e);
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        const s = startPos.current;

        if (activeTool === 'pen') {
            // Draw only the new segment — avoids re-stroking the full path
            const last = lastPenPoint.current ?? s;
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            lastPenPoint.current = pos;
            return;
        }

        // Restore snapshot before redrawing shape preview
        if (snapshotBeforeDraw.current) {
            ctx.putImageData(snapshotBeforeDraw.current, 0, 0);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (activeTool === 'arrow') {
            drawArrow(ctx, s.x, s.y, pos.x, pos.y);
        } else if (activeTool === 'rect') {
            ctx.strokeRect(s.x, s.y, pos.x - s.x, pos.y - s.y);
        } else if (activeTool === 'blur') {
            const bx = Math.min(s.x, pos.x), by = Math.min(s.y, pos.y);
            const bw = Math.abs(pos.x - s.x), bh = Math.abs(pos.y - s.y);
            if (bw > 4 && bh > 4) {
                applyPixelBlur(ctx, bx, by, bw, bh);
            }
            // Show selection border
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(bx, by, bw, bh);
            ctx.setLineDash([]);
        } else if (activeTool === 'crop') {
            const cx = Math.min(s.x, pos.x), cy = Math.min(s.y, pos.y);
            const cw = Math.abs(pos.x - s.x), ch = Math.abs(pos.y - s.y);
            // Dim everything outside crop
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            if (snapshotBeforeDraw.current) {
                ctx.putImageData(snapshotBeforeDraw.current, 0, 0, cx, cy, cw, ch);
            }
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(cx, cy, cw, ch);
            ctx.setLineDash([]);
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
        } else if (activeTool === 'blur') {
            // Restore clean snapshot, re-apply blur without the selection border
            if (snapshotBeforeDraw.current) ctx.putImageData(snapshotBeforeDraw.current, 0, 0);
            const bx = Math.min(s.x, pos.x), by = Math.min(s.y, pos.y);
            const bw = Math.abs(pos.x - s.x), bh = Math.abs(pos.y - s.y);
            if (bw > 4 && bh > 4) applyPixelBlur(ctx, bx, by, bw, bh);
            saveSnapshot();
        } else if (activeTool === 'pen') {
            lastPenPoint.current = null;
            saveSnapshot();
        } else {
            saveSnapshot();
        }
    };

    // ─── Drawing Helpers ─────────────────────────────────────────────────────

    function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
        const headLen = Math.max(12, lineWidth * 4);
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

    function applyPixelBlur(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
        const pixelSize = Math.max(4, Math.round(Math.min(w, h) / 10));
        const tmp = document.createElement('canvas');
        tmp.width = Math.max(1, Math.round(w / pixelSize));
        tmp.height = Math.max(1, Math.round(h / pixelSize));
        const tmpCtx = tmp.getContext('2d')!;
        tmpCtx.imageSmoothingEnabled = false;
        tmpCtx.drawImage(ctx.canvas, x, y, w, h, 0, 0, tmp.width, tmp.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, h);
        ctx.imageSmoothingEnabled = true;
    }

    // ─── Text Commit ─────────────────────────────────────────────────────────

    const commitText = () => {
        if (textCommittedRef.current) return; // guard against Enter + onBlur double-fire
        if (!textValue.trim()) { setTextInput((prev) => ({ ...prev, visible: false })); return; }

        textCommittedRef.current = true;
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        const cx = textInput.canvasX;
        const cy = textInput.canvasY;
        const fontSize = Math.max(20, lineWidth * 8);
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';
        ctx.fillText(textValue, cx, cy);
        ctx.textBaseline = 'alphabetic';
        setTextInput((prev) => ({ ...prev, visible: false }));
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

        const canUpload = settings.s3.mode === 'custom' && !!settings.s3.endpoint;

        if (!canUpload) {
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

    const handleCopyUrl = async () => {
        await copyToClipboard(uploadUrl);
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
    };

    // ─── Render ──────────────────────────────────────────────────────────────

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
                        {storageMode === 'upload' ? I.upload : I.download}
                        <span>{uploadState === 'uploading' ? `${uploadProgress}%` : storageMode === 'upload' ? 'Save & Upload' : 'Save'}</span>
                    </button>
                </div>
            </header>

            {/* Upload progress bar */}
            {uploadState === 'uploading' && (
                <div className="upload-bar"><div className="upload-bar-fill" style={{ width: `${uploadProgress}%` }} /></div>
            )}

            {/* Persistent URL bar — stays visible until next upload */}
            {uploadState === 'done' && (
                <div className="upload-url-bar">
                    <span className="upload-url-label">Uploaded:</span>
                    <input
                        className="upload-url-input"
                        readOnly
                        value={uploadUrl}
                        onFocus={(e) => e.target.select()}
                    />
                    <button className="upload-url-copy" onClick={handleCopyUrl} title="Copy URL">
                        {urlCopied ? I.check : I.copy}
                        <span>{urlCopied ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <button className="upload-url-close" onClick={() => setUploadState('idle')} title="Dismiss">×</button>
                </div>
            )}

            {/* Upload error */}
            {uploadState === 'error' && (
                <div className="upload-toast error" onClick={() => setUploadState('idle')}>
                    Upload failed. Check S3 settings in Options. Click to dismiss.
                </div>
            )}

            {/* Crop confirmation */}
            {cropRect && (
                <div className="crop-confirm">
                    <button className="action-btn primary" onClick={applyCrop}>Apply Crop</button>
                    <button className="action-btn" onClick={() => {
                        setCropRect(null);
                        if (snapshotBeforeDraw.current) getCtx()?.putImageData(snapshotBeforeDraw.current, 0, 0);
                    }}>Cancel</button>
                </div>
            )}

            {/* Text input overlay */}
            {textInput.visible && (
                <input
                    ref={textRef}
                    className="text-overlay-input"
                    type="text"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitText(); }
                        if (e.key === 'Escape') { textCommittedRef.current = true; setTextInput((prev) => ({ ...prev, visible: false })); }
                    }}
                    onBlur={() => { setTimeout(commitText, 80); }}
                    style={{ left: textInput.x, top: textInput.y, color, fontSize: `${Math.max(14, lineWidth * 4)}px` }}
                />
            )}

            <main className="editor-canvas-wrapper">
                {!imageLoaded && <div className="editor-loading">Loading capture...</div>}
                <canvas
                    ref={canvasRef}
                    className="editor-canvas"
                    style={{ display: imageLoaded ? 'block' : 'none', cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
                    onMouseDown={onPointerDown}
                    onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}
                    onMouseLeave={onPointerUp}
                />
            </main>
        </div>
    );
};

export default Editor;
