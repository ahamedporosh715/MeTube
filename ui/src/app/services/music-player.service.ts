import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  duration_string?: string;
  url: string; // audio stream URL (relative or absolute)
  art_url?: string;
  downloadUrl?: string;
  isYT?: boolean;
  thumbnail?: string;
}
export interface LibraryItem {
  relpath: string;
  filename: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  size?: number;
  bitrate?: number;
  has_art?: boolean;
  url: string;
  art_url?: string;
}
export interface YTSearchItem {
  id: string;
  type: 'song' | 'video' | 'album' | 'artist' | 'playlist' | 'featured_playlist';
  title: string;
  artist?: string;
  duration?: number;
  duration_string?: string;
  url: string;
  thumbnail?: string;
  is_explicit?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MusicPlayerService {
  private http = inject(HttpClient);
  private audio = new Audio();

  playlist = signal<Track[]>([]);
  currentIndex = signal<number>(-1);
  currentTrack = computed<Track | null>(() => {
    const idx = this.currentIndex();
    const list = this.playlist();
    return idx >= 0 && idx < list.length ? list[idx] : null;
  });
  isPlaying = signal(false);
  isBuffering = signal(false);
  currentTime = signal(0);
  duration = signal(0);
  volume = signal(0.9);
  muted = signal(false);
  shuffle = signal(false);
  repeat = signal<'off' | 'one' | 'all'>('off');
  isPlayerVisible = signal(false);

  private elHtml = '';

  constructor() {
    this.audio.preload = 'metadata';
    this.audio.addEventListener('play', () => this.isPlaying.set(true));
    this.audio.addEventListener('pause', () => this.isPlaying.set(false));
    this.audio.addEventListener('waiting', () => this.isBuffering.set(true));
    this.audio.addEventListener('canplay', () => this.isBuffering.set(false));
    this.audio.addEventListener('timeupdate', () => this.currentTime.set(this.audio.currentTime));
    this.audio.addEventListener('loadedmetadata', () => this.duration.set(this.audio.duration || 0));
    this.audio.addEventListener('durationchange', () => this.duration.set(this.audio.duration || 0));
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('error', () => { this.isBuffering.set(false); this.isPlaying.set(false); });
    this.audio.volume = this.volume();
  }

  showPlayer() { this.isPlayerVisible.set(true); }
  hidePlayer() { this.pause(); this.isPlayerVisible.set(false); }

  loadLibrary(): Observable<{ status: string; items: LibraryItem[] }> {
    return this.http.get<{ status: string; items: LibraryItem[] }>('music/library');
  }
  searchYTMusic(q: string, filter: string = 'songs', limit: number = 25): Observable<{ status: string; results: YTSearchItem[] }> {
    const params = new URLSearchParams({ q, filter, limit: String(limit) });
    return this.http.get<{ status: string; results: YTSearchItem[] }>(`music/ytsearch?${params.toString()}`);
  }

  libraryItemToTrack(item: LibraryItem): Track {
    return { id: item.relpath, title: item.title || item.filename, artist: item.artist,
      album: item.album, duration: item.duration, url: item.url,
      art_url: item.art_url, downloadUrl: item.url, isYT: false };
  }
  ytItemToTrack(r: YTSearchItem): Track {
    return { id: r.id, title: r.title, artist: r.artist, duration: r.duration,
      duration_string: r.duration_string, url: `music/ytstream/${encodeURIComponent(r.id)}`,
      art_url: r.thumbnail, thumbnail: r.thumbnail, isYT: true };
  }

  playNow(tracks: Track[], startIndex: number = 0) {
    this.playlist.set(tracks);
    this.currentIndex.set(Math.max(0, Math.min(startIndex, tracks.length - 1)));
    this.loadAndPlay();
  }
  playUrl(url: string, title: string) {
    const track: Track = { id: url, title, url, isYT: false };
    this.playlist.set([track]);
    this.currentIndex.set(0);
    this.loadAndPlay();
  }
  playLibraryItem(item: LibraryItem) {
    this.playNow([this.libraryItemToTrack(item)], 0);
  }
  enqueue(track: Track) {
    const list = [...this.playlist()];
    if (this.currentIndex() < 0) { this.playNow([track], 0); return; }
    list.splice(this.currentIndex() + 1, 0, track);
    this.playlist.set(list);
  }

  togglePlay() {
    if (!this.currentTrack()) return;
    if (this.audio.paused) this.audio.play().catch(() => {});
    else this.audio.pause();
  }
  pause() { this.audio.pause(); }
  next() {
    const list = this.playlist();
    if (!list.length) return;
    let nextIdx: number;
    if (this.shuffle()) { nextIdx = Math.floor(Math.random() * list.length); }
    else nextIdx = (this.currentIndex() + 1) % list.length;
    this.currentIndex.set(nextIdx); this.loadAndPlay();
  }
  prev() {
    if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    const list = this.playlist();
    if (!list.length) return;
    const prevIdx = (this.currentIndex() - 1 + list.length) % list.length;
    this.currentIndex.set(prevIdx); this.loadAndPlay();
  }
  seek(sec: number) {
    if (isFinite(sec) && this.audio.duration) {
      this.audio.currentTime = Math.max(0, Math.min(sec, this.audio.duration));
    }
  }
  setVolume(v: number) {
    this.volume.set(Math.max(0, Math.min(1, v)));
    this.audio.volume = this.volume();
    if (this.volume() > 0) this.muted.set(false);
    this.audio.muted = this.muted();
  }
  toggleMute() { this.muted.set(!this.muted()); this.audio.muted = this.muted(); }
  toggleShuffle() { this.shuffle.set(!this.shuffle()); }
  toggleRepeat() {
    const r = this.repeat();
    this.repeat.set(r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');
  }

  private loadAndPlay() {
    const t = this.currentTrack();
    if (!t) return;
    this.isPlayerVisible.set(true);
    this.audio.src = t.url;
    this.audio.load();
    this.audio.play().catch(() => {});
  }
  private onEnded() {
    const r = this.repeat();
    if (r === 'one') { this.audio.currentTime = 0; this.audio.play().catch(() => {}); return; }
    const list = this.playlist();
    if (!list.length) return;
    const nextIdx = this.shuffle()
      ? Math.floor(Math.random() * list.length)
      : this.currentIndex() + 1;
    if (nextIdx >= list.length) {
      if (r === 'all') { this.currentIndex.set(0); this.loadAndPlay(); }
      else { this.isPlaying.set(false); }
    } else {
      this.currentIndex.set(nextIdx); this.loadAndPlay();
    }
  }
}
