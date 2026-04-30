import { defineConfig, type PluginOption } from 'vite';
import type { LibraryFormats, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';

const IIFE: LibraryFormats[] = ['iife'];

function copyContentCss(): PluginOption {
    return {
        name: 'copy-content-css',
        closeBundle() {
            const src = resolve(__dirname, 'src/content/content.css');
            const dest = resolve(__dirname, 'dist/content.css');
            if (existsSync(src)) {
                copyFileSync(src, dest);
            }
        },
    };
}

export default defineConfig((_env): UserConfig => {
    const buildTarget = process.env.BUILD_TARGET;

    // Background service worker build
    if (buildTarget === 'background') {
        return {
            build: {
                outDir: 'dist',
                emptyOutDir: false,
                target: 'chrome100',
                lib: {
                    entry: resolve(__dirname, 'src/background/index.ts'),
                    name: 'Background',
                    formats: IIFE,
                    fileName: () => 'background.js',
                },
            },
        };
    }

    // Content script build
    if (buildTarget === 'content') {
        return {
            plugins: [copyContentCss()],
            build: {
                outDir: 'dist',
                emptyOutDir: false,
                target: 'chrome100',
                cssCodeSplit: false,
                lib: {
                    entry: resolve(__dirname, 'src/content/capture-overlay.ts'),
                    name: 'ProScreenContent',
                    formats: IIFE,
                    fileName: () => 'content.js',
                },
                rollupOptions: {
                    output: {
                        globals: {},
                    },
                },
            },
        };
    }

    // Editor + Video page build
    if (buildTarget === 'editor') {
        return {
            plugins: [react(), tailwindcss()],
            base: './',
            build: {
                outDir: 'dist',
                emptyOutDir: false,
                rollupOptions: {
                    input: {
                        editor: resolve(__dirname, 'editor.html'),
                        video: resolve(__dirname, 'video.html'),
                    },
                    output: {
                        entryFileNames: '[name].js',
                        chunkFileNames: '[name]-[hash].js',
                        assetFileNames: 'assets/[name]-[hash][extname]',
                    },
                },
            },
        };
    }

    // Offscreen document build
    if (buildTarget === 'offscreen') {
        return {
            build: {
                outDir: 'dist',
                emptyOutDir: false,
                target: 'chrome100',
                lib: {
                    entry: resolve(__dirname, 'src/offscreen/recorder.ts'),
                    name: 'OffscreenRecorder',
                    formats: IIFE,
                    fileName: () => 'offscreen.js',
                },
            },
        };
    }

    // Default: popup + options build
    return {
        plugins: [react(), tailwindcss()],
        base: './',
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    popup: resolve(__dirname, 'popup.html'),
                    options: resolve(__dirname, 'options.html'),
                },
                output: {
                    entryFileNames: '[name].js',
                    chunkFileNames: '[name].js',
                    assetFileNames: 'assets/[name][extname]',
                },
            },
        },
    };
});
