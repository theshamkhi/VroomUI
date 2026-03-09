export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path?: string;
  validationErrors?: { [key: string]: string };
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export enum VideoStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
  DELETED = 'DELETED'
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  formattedFileSize: string;
  durationSeconds?: number;
  resolution?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  status: VideoStatus;
  uploadedBy: string;
  viewCount: number;
  isPublic: boolean;
  createdAt: string;
}
