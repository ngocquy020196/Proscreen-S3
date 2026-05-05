import type { ImageFormat } from '../types';


export function canvasToBlob(
    canvas: HTMLCanvasElement,
    format: ImageFormat,
    quality: number
): Promise<Blob> {
    const mimeMap: Record<ImageFormat, string> = {
        png: 'image/png',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
    };

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to create blob from canvas'));
            },
            mimeMap[format],
            quality
        );
    });
}


export function generateFilename(format: ImageFormat): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    return `${date}/${time}-${rand}.${format}`;
}

export function generateVideoFilename(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    return `${date}/${time}-${rand}.webm`;
}
