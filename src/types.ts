// ─── Capture Types ───────────────────────────────────────────────────────────

export type CaptureMode = 'visible' | 'area' | 'fullpage';
export type RecordingState = 'idle' | 'recording' | 'paused';
export type StorageMode = 'custom' | 'cloud' | 'local';
export type Language = 'en' | 'vi';
export type Theme = 'dark' | 'light';
export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type AudioSource = 'none' | 'mic' | 'system' | 'both';
export type WebcamPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type VideoQuality = 'low' | 'medium' | 'high';

// ─── S3 Configuration ────────────────────────────────────────────────────────

export interface S3Config {
    mode: StorageMode;
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    publicUrl: string;
    pathPrefix: string;
    cloudApiUrl: string;
    cloudToken: string;
}

// ─── Recording Configuration ─────────────────────────────────────────────────

export interface RecordingConfig {
    audioSource: AudioSource;
    webcamEnabled: boolean;
    webcamPosition: WebcamPosition;
    maxDuration: number;
    videoQuality: VideoQuality;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface Settings {
    defaultCaptureMode: CaptureMode;
    imageFormat: ImageFormat;
    imageQuality: number;
    s3: S3Config;
    recording: RecordingConfig;
    autoCopyLink: boolean;
    showNotification: boolean;
    language: Language;
    theme: Theme;
}

// ─── Upload History ──────────────────────────────────────────────────────────

export interface UploadHistoryItem {
    id: string;
    url: string;
    filename: string;
    size: number;
    type: 'screenshot' | 'recording';
    timestamp: number;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_S3_CONFIG: S3Config = {
    mode: 'local',
    endpoint: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    region: 'auto',
    publicUrl: '',
    pathPrefix: 'proscreen/',
    cloudApiUrl: '',
    cloudToken: '',
};

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
    audioSource: 'none',
    webcamEnabled: false,
    webcamPosition: 'bottom-right',
    maxDuration: 0,
    videoQuality: 'high',
};

export const DEFAULT_SETTINGS: Settings = {
    defaultCaptureMode: 'visible',
    imageFormat: 'png',
    imageQuality: 0.92,
    s3: DEFAULT_S3_CONFIG,
    recording: DEFAULT_RECORDING_CONFIG,
    autoCopyLink: true,
    showNotification: true,
    language: 'en',
    theme: 'light',
};
