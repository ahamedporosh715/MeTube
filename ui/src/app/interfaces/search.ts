export type SearchType = 'video' | 'channel' | 'playlist';

export type SearchTabId = SearchType | 'trending';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  uploader?: string;
  uploader_url?: string;
  duration?: number;
  duration_string?: string;
  view_count?: number;
  is_live?: boolean;
  handle?: string;
  subscriber_count?: number;
  verified?: boolean;
  video_count?: number;
  channel?: string;
}

export interface SearchResponse {
  status: string;
  msg?: string;
  query: string;
  type: SearchType;
  results: SearchResult[];
}
