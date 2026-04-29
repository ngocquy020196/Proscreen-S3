// Cloud API client stub for managed storage mode (Phase 3+)
// This module will be implemented when the backend is ready.

export interface CloudAuthResult {
    token: string;
    expiresAt: number;
}

export interface CloudPresignedResult {
    uploadUrl: string;
    publicUrl: string;
    key: string;
}

export async function cloudLogin(
    _apiUrl: string,
    _email: string,
    _password: string
): Promise<CloudAuthResult> {
    throw new Error('Cloud mode is not yet available. Use Custom S3 mode.');
}

export async function getCloudPresignedUrl(
    _apiUrl: string,
    _token: string,
    _filename: string,
    _contentType: string
): Promise<CloudPresignedResult> {
    throw new Error('Cloud mode is not yet available. Use Custom S3 mode.');
}
