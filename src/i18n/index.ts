// ─── Chrome Native i18n Wrapper ──────────────────────────────────────────────
// Uses chrome.i18n.getMessage() which reads from public/_locales/{lang}/messages.json
// Chrome auto-detects browser language and falls back to default_locale (en).

export function t(key: string): string {
    return chrome.i18n.getMessage(key) || key;
}
