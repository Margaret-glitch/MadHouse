export interface VideoItem {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  views: string;
  viewCount: number;
  timestamp: string;
  duration: string;
  lengthSeconds: number;
  likes: string;
  thumbnail: string;
  avatar: string;
  description?: string;
  badgeTag?: string;
}

export interface StreamFormat {
  url: string;
  qualityLabel?: string;
  quality?: string;
  type?: string;
  container?: string;
  bitrate?: number;
}

export interface StreamDetails {
  id: string;
  title: string;
  author: string;
  authorId: string;
  authorThumbnails?: { url: string; width: number; height: number }[];
  lengthSeconds: number;
  viewCount: number;
  description: string;
  thumbnails?: { url: string; quality: string }[];
  publishedText: string;
  progressive: StreamFormat[];
  bestProgressive: StreamFormat | null;
  bestAudio?: StreamFormat | null;
  adaptiveVideo: StreamFormat[];
  adaptiveAudio: StreamFormat[];
  captions?: Array<{ label: string; languageCode: string; url: string }>;
  recommended: any[];
  embedUrl?: string;
  downloads?: Array<{ label: string; quality: string; format: string; size_human: string; url: string }>;
}

export type NavTab = 'home' | 'youtube' | 'history' | 'profile';
