# Changelog

All notable changes to ProScreen will be documented in this file.

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
