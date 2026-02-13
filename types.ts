
export enum DownloadStatus {
  PENDING = 'PENDING',
  DOWNLOADING = 'DOWNLOADING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface DownloadItem {
  id: string;
  url: string;
  referer: string;
  destination: string;
  filename: string;
  format?: string;
  resolution?: string;
  extraArgs: string;
  status: DownloadStatus;
  progress: number;
  logs: string[];
  error?: string;
  sponsorBlock?: boolean;
  sponsorBlockCategories?: string[];
  timestamp: number;
}

export interface AppSettings {
  defaultDestination: string;
  defaultFilenameFormat: string;
  defaultArgs: string;
  presets: Preset[];
}

export interface Preset {
  id: string;
  name: string;
  args: string;
}

export type ViewMode = 'SINGLE' | 'QUEUE' | 'HISTORY';

export type DownloadStrategy = 'SEQUENTIAL' | 'SIMULTANEOUS';
