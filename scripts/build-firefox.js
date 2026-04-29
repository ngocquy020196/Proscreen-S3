#!/usr/bin/env node
/**
 * Build script for Firefox extension.
 * Copies dist/ → dist-firefox/ and transforms manifest.json for Firefox MV3.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');
const DIST_FF = path.resolve(__dirname, '..', 'dist-firefox');
const GECKO_ID = 'proscreen-s3@ngocquy';

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function main() {
    if (!fs.existsSync(DIST)) {
        console.error('dist/ not found. Run "npm run build" first.');
        process.exit(1);
    }

    if (fs.existsSync(DIST_FF)) {
        fs.rmSync(DIST_FF, { recursive: true });
    }
    copyDir(DIST, DIST_FF);
    console.log('Copied dist/ → dist-firefox/');

    const manifestPath = path.join(DIST_FF, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // Shorten name for Firefox (max 45 chars)
    manifest.name = 'ProScreen — Screenshot & Recording S3';

    // Convert service_worker → background scripts
    if (manifest.background?.service_worker) {
        const sw = manifest.background.service_worker;
        manifest.background = { scripts: [sw] };
    }

    // Remove Chrome-only permissions
    manifest.permissions = manifest.permissions.filter(
        (p) => !['offscreen', 'desktopCapture'].includes(p)
    );

    // Add Firefox-specific settings
    manifest.browser_specific_settings = {
        gecko: {
            id: GECKO_ID,
            strict_min_version: '109.0',
        },
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));
    console.log('Transformed manifest.json for Firefox');
    console.log(`  gecko.id: ${GECKO_ID}`);
    console.log('dist-firefox/ is ready!');
}

main();
