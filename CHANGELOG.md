# Changelog

All notable changes to ProScreen will be documented in this file.

## v0.0.4 - 2026-05-05

### Performance
- Optimized: Full-page capture now stitches directly into canvas instead of accumulating dataUrl strings — **reduces memory usage by ~80MB** on long pages
- Optimized: Editor undo/redo history now stores compressed PNG blobs instead of raw ImageData — **reduces RAM from ~400MB to ~10MB** for 50 undo steps
- Fixed: `ImageBitmap.close()` called after use to prevent memory leaks in capture and crop flows
- Fixed: `AudioContext.close()` called when screen recording stops to free audio resources

### Architecture
- Refactored: Split `background/index.ts` (355 LOC) into 3 focused modules: `index.ts` (router), `capture.ts`, `recording.ts`
- Refactored: Created generic `idb-store.ts` factory — `image-store.ts` and `video-store.ts` reduced from 102 LOC to 14 LOC total
- Added: `openEditorBlob()` helper to skip unnecessary `dataUrl → fetch → blob` roundtrips

### Cleanup
- Removed: Dead `cloud-api.ts` stub (unused)
- Removed: 6 unused message constants (`CAPTURE_RESULT`, `UPLOAD_START`, `UPLOAD_PROGRESS`, `UPLOAD_COMPLETE`, `SETTINGS_CHANGED`, `CAPTURE_DESKTOP`)
- Removed: Unused `dataUrlToBlob()` and `blobToDataUrl()` utilities
- Reduced: Bundle sizes across all targets (background.js -2%, editor.js -4%, video.js -9%)

## v0.0.3 - 2026-05-05

### Changed
- Improved: Updated app name and description for better branding
- SEO: Added sitemap and robots.txt to landing page
- Landing Page: Updated hero copy text and formatting



## v0.0.2 - 2026-05-04

### Changed
- Fixed: Keyboard shortcuts (Alt+S, Alt+A, Alt+R) now work correctly on macOS and inside the popup
- Optimized: Migrated screenshot storage from `chrome.storage.local` to `IndexedDB` to handle massive full-page captures without `QuotaExceededError`
- Optimized: Offscreen document is now properly closed after recording to free up RAM
- Fixed: Limited `OffscreenCanvas` height to `16384px` to prevent browser crashes on extremely long pages
- Improved: Video recordings are no longer auto-deleted upon loading, preventing accidental loss when refreshing the editor tab
- UI: Used shorter app name in popup and options headers for better aesthetics

## v0.0.1 - 2026-04-30

### Added
- Video preview page (`video.html`) with direct download and S3 upload
- IndexedDB storage for efficient raw binary video blob handling (no memory limits)
- Screen recording timer badge on extension icon (MM:SS)
- New premium transparent icon suite (16px to 128px)
- Automated CI/CD pipeline via GitHub Actions (auto zip, artifact, and release)
- Screenshot: Capture visible tab, area selection, full page
- Annotation Editor: Pen, arrow, rectangle, text, blur, crop tools
- Undo/Redo with snapshot history (max 50 steps)
- Screen Recording via Manifest V3 standard `getDisplayMedia` (Offscreen Document)
- Recording controls widget: timer, pause/resume, stop (draggable)
- S3 Upload: AWS Signature V4, zero dependencies
- Upload progress bar with auto-copy link
- Upload history (100 entries FIFO)
- Custom S3 support: AWS S3, Cloudflare R2, MinIO, etc.
- Options page: S3 config, recording settings, theme toggle
- Dark/Light theme
- Chrome native i18n (English, Vietnamese)
- Keyboard shortcuts: Alt+S, Alt+A, Alt+R
- Context menu integration
- Firefox compatibility via build script
