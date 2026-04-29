import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';

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

export default defineConfig(() => {
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
                    formats: ['iife'],
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
                    formats: ['iife'],
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

    // Editor page build
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
                    },
                    output: {
                        entryFileNames: 'editor.js',
                        chunkFileNames: 'editor-[name].js',
                        assetFileNames: 'assets/editor-[name][extname]',
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
                    formats: ['iife'],
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
