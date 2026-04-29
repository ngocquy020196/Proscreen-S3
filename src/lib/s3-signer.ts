import type { S3Config } from '../types';

// ─── AWS Signature V4 — Presigned URL Generator ─────────────────────────────
// Zero-dependency implementation using Web Crypto API.
// Compatible with: AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces.

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';
const REQUEST_TYPE = 'aws4_request';

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return arrayBufferToHex(hash);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function getDateStamp(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function getAmzDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

async function getSigningKey(
    secretKey: string,
    dateStamp: string,
    region: string
): Promise<ArrayBuffer> {
    const kDate = await hmacSha256(
        new TextEncoder().encode(`AWS4${secretKey}`).buffer as ArrayBuffer,
        dateStamp
    );
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, SERVICE);
    return hmacSha256(kService, REQUEST_TYPE);
}

export async function createPresignedPutUrl(
    config: S3Config,
    key: string,
    contentType: string,
    expiresIn: number = 3600
): Promise<string> {
    const date = new Date();
    const dateStamp = getDateStamp(date);
    const amzDate = getAmzDate(date);
    const region = config.region || 'us-east-1';
    const credential = `${config.accessKeyId}/${dateStamp}/${region}/${SERVICE}/${REQUEST_TYPE}`;

    // Build endpoint URL
    const endpoint = config.endpoint.replace(/\/$/, '');
    const host = new URL(endpoint).host;
    const path = `/${config.bucket}/${key}`;

    // Query parameters for presigned URL
    const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': ALGORITHM,
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': 'content-type;host',
    });

    // Sort query params
    queryParams.sort();
    const canonicalQueryString = queryParams.toString();

    // Canonical request
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
    const signedHeaders = 'content-type;host';

    const canonicalRequest = [
        'PUT',
        path,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    // String to sign
    const scope = `${dateStamp}/${region}/${SERVICE}/${REQUEST_TYPE}`;
    const canonicalRequestHash = await sha256Hex(canonicalRequest);
    const stringToSign = [ALGORITHM, amzDate, scope, canonicalRequestHash].join('\n');

    // Signature
    const signingKey = await getSigningKey(config.secretAccessKey, dateStamp, region);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = arrayBufferToHex(signatureBuffer);

    return `${endpoint}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

export function getPublicUrl(config: S3Config, key: string): string {
    if (config.publicUrl) {
        const base = config.publicUrl.replace(/\/$/, '');
        return `${base}/${key}`;
    }
    const endpoint = config.endpoint.replace(/\/$/, '');
    return `${endpoint}/${config.bucket}/${key}`;
}
