import type { S3Config } from '../types';
import { createPresignedPutUrl, getPublicUrl } from './s3-signer';

export interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export interface UploadResult {
    url: string;
    key: string;
    size: number;
}

export async function uploadToS3(
    config: S3Config,
    key: string,
    blob: Blob,
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
    const fullKey = `${config.pathPrefix}${key}`;
    const presignedUrl = await createPresignedPutUrl(config, fullKey, blob.type);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress({
                    loaded: e.loaded,
                    total: e.total,
                    percentage: Math.round((e.loaded / e.total) * 100),
                });
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve({
                    url: getPublicUrl(config, fullKey),
                    key: fullKey,
                    size: blob.size,
                });
            } else {
                reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Upload network error'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
        });

        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', blob.type);
        xhr.send(blob);
    });
}

export async function testS3Connection(config: S3Config): Promise<boolean> {
    try {
        const testKey = `${config.pathPrefix}.proscreen-test`;
        const testBlob = new Blob(['test'], { type: 'text/plain' });
        const presignedUrl = await createPresignedPutUrl(config, testKey, 'text/plain', 60);

        const response = await fetch(presignedUrl, {
            method: 'PUT',
            body: testBlob,
            headers: { 'Content-Type': 'text/plain' },
        });

        return response.ok;
    } catch {
        return false;
    }
}
