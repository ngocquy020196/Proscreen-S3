<div align="center">
  <img src="public/icons/icon128.png" alt="ProScreen S3 Logo" width="128" />
  <h1>ProScreen S3</h1>
  <p><strong>Screenshot & Recording with Custom S3 Upload</strong></p>
</div>

<p align="center">
  Open-source browser extension for capturing screenshots, recording screen, annotating, and uploading to your own S3-compatible storage.
</p>

## Key Features

- **Screenshot** — Capture visible tab, select area, or full page
- **Screen Recording** — Record screen with system/mic audio, pause/resume, timer badge
- **Video Preview** — Dedicated player page to review videos before saving/uploading
- **Annotation Editor** — Draw, arrow, rectangle, text, blur, crop with undo/redo
- **S3 Upload** — Upload directly to AWS S3, Cloudflare R2, MinIO, or any S3-compatible storage
- **Optimized Storage** — Uses IndexedDB to store raw binary video blobs (no memory limits)
- **Privacy-first** — Your keys stay in your browser. No server. No tracking.
- **Upload History** — Keep track of your uploads with an optimized local history
- **Manifest V3** — Built with the latest Chrome, Edge & Firefox extension standard
- **Automated CI/CD** — Fully automated GitHub Actions pipeline for releases

## How It Works

1. Install the extension
2. Click the extension icon to open the popup or use keyboard shortcuts
3. Choose to capture a screenshot or start a screen recording
4. Annotate your screenshot in the built-in Editor if needed
5. The image/video is uploaded directly to your configured S3 bucket
6. The public URL is automatically copied to your clipboard
7. Customize settings in the Options page:
   - Configure S3 endpoint, bucket, and credentials
   - View your upload history
   - Change upload path and file naming conventions

## Tech Stack

| Technology | Purpose |
|---|---|
| **Vite** | Fast multi-target build tooling |
| **React 19** | Popup, Options & Editor UI |
| **TypeScript** | Type-safe codebase |
| **Manifest V3** | Chrome, Edge & Firefox extension platform |
| **Web Crypto API** | AWS Signature V4 for secure S3 uploads |
| **Offscreen Document** | Manifest V3 standard `getDisplayMedia` screen recording |
| **IndexedDB** | Optimized raw binary video blob storage |
| **Canvas 2D** | Lightweight annotation system |

## Project Structure

```
proscreen-s3/
├── public/
│   ├── icons/                  # Extension icons (16, 48, 128px)
│   ├── _locales/               # i18n language files
│   └── manifest.json           # Extension manifest (Chrome & Edge)
├── src/
│   ├── background/
│   │   └── index.ts            # Service worker
│   ├── content/
│   │   ├── capture-overlay.ts  # Area selection & recording widget
│   │   └── content.css         # Content script styles
│   ├── editor/
│   │   ├── Editor.tsx          # Annotation editor (canvas-based)
│   │   ├── main.tsx            # Editor entry point
│   │   └── editor.css          # Editor styles
│   ├── offscreen/
│   │   ├── recorder.ts         # Screen recording (MediaRecorder)
│   │   └── index.html          # Offscreen document
│   ├── options/
│   │   ├── Options.tsx         # Settings page & history
│   │   ├── main.tsx            # Options entry point
│   │   └── options.css         # Options styles
│   ├── popup/
│   │   ├── App.tsx             # Extension popup UI
│   │   ├── main.tsx            # Popup entry point
│   │   └── popup.css           # Popup styles
│   ├── lib/                    # S3 signer, uploader, history
│   ├── hooks/                  # useSettings hook
│   ├── i18n/                   # Chrome native i18n wrapper
│   ├── constants/              # Message types, external links
│   ├── utils/                  # Storage, clipboard, image helpers
│   └── types.ts                # TypeScript definitions & default settings
├── popup.html                  # Popup HTML shell
├── options.html                # Options page HTML shell
├── editor.html                 # Editor page HTML shell
├── scripts/
│   └── build-firefox.js        # Firefox manifest generator
├── vite.config.ts              # Vite config (multi-target builds)
├── tsconfig.json
└── package.json
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [npm](https://www.npmjs.com/) >= 9

### Install Dependencies

```bash
npm install
```

### Build for Production

```bash
# Chrome & Edge
npm run build

# Firefox
npm run build:firefox
```

This builds the extension into the `dist/` directory (Chrome/Edge) or `dist-firefox/` (Firefox).

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Click the extension icon and configure your S3 settings.

### Load in Microsoft Edge

1. Open `edge://extensions/`
2. Enable **Developer mode** (left sidebar)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. The extension works the same as in Chrome!

### Load in Firefox

1. Run `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `dist-firefox/manifest.json`
5. Click the extension icon and configure your S3 settings.

### Development

```bash
# Dev build with watch
npm run dev

# Build production
npm run build

# Build Firefox version
npm run build:firefox

# Create distribution zip files
npm run zip
npm run zip:firefox
```

## Settings & Configuration

| Setting | Description | Default |
|---|---|---|
| Upload Mode | Cloud Server (coming soon) or Custom S3 | Custom S3 |
| S3 Endpoint | The S3 API endpoint URL | *Empty* |
| S3 Region | The S3 bucket region | *Empty* |
| S3 Bucket | The S3 bucket name | *Empty* |
| S3 Access Key | Your S3 Access Key ID | *Empty* |
| S3 Secret Key | Your S3 Secret Access Key | *Empty* |
| Upload Path | Custom path/folder in your bucket | `uploads/` |
| Public URL Format | Custom public URL (e.g., CDN domain) | *Auto-generated* |

> **Note:** ProScreen S3 is compatible with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2, Wasabi, and any standard S3-compatible object storage.

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Capture Visible Tab | `Alt+S` |
| Capture Area | `Alt+A` |
| Start/Stop Recording | `Alt+R` |

You can customize these shortcuts at `chrome://extensions/shortcuts`, `edge://extensions/shortcuts`, or Firefox's `about:addons` → Manage Extension Shortcuts.

## Contributing

Contributions are welcome! Feel free to:

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Author

**Quy Nguyen**

- Website: [ngocquy.dev](https://ngocquy.dev/?ref=github-proscreen-s3)
- Email: [contact@ngocquy.dev](mailto:contact@ngocquy.dev)

<a href="https://buymeacoffee.com/ngocquy.dev/?ref=github-proscreen-s3" target="_blank">
  <img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" >
</a>

---
