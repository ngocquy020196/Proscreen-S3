# Privacy Policy — ProScreen

**Last updated:** April 30, 2026

## Overview

ProScreen is an open-source browser extension that captures screenshots, records screen, and uploads files to S3-compatible storage. We are committed to protecting your privacy.

## Data Collection

**ProScreen does NOT collect, store, or transmit any personal data.** 

Specifically:

- No analytics or tracking
- No telemetry
- No third-party SDKs
- No server-side components
- No account required

## Data Storage

All data is stored locally in your browser using `chrome.storage` and `IndexedDB`:

| Data | Storage | Purpose |
|---|---|---|
| S3 credentials | `chrome.storage.local` | Connect to your own storage |
| Settings | `chrome.storage.sync` | User preferences |
| Upload history | `chrome.storage.local` | Recent upload links |
| Video files | `IndexedDB` | Temporary storage for video before upload/download |

**Your S3 keys never leave your browser.** They are only used to sign upload requests directly from the extension to your storage endpoint.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save settings and history |
| `tabs` | Capture visible tab |
| `activeTab` | Access current page for area selection |
| `contextMenus` | Right-click capture menu |
| `offscreen` | Screen recording (`getDisplayMedia` API) |
| `desktopCapture` | Screen recording source selection |
| `downloads` | Save recorded videos |
| `host_permissions: <all_urls>` | Upload to user's S3 endpoint (any domain) |

## Custom S3 Mode

When you use **Custom S3 mode**, upload requests go directly from your browser to your configured endpoint. ProScreen does not proxy, inspect, or log these requests.

## Open Source

The full source code is available at:  
https://github.com/ngocquy020196/proscreen-s3

You can audit the code to verify these claims.

## Contact

For privacy questions: contact@ngocquy.dev

## Changes

We may update this policy. Changes will be reflected in this document with an updated date.
