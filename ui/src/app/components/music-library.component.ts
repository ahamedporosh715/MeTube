import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faPlay, faPlus, faDownload, faMusic, faSearch, faTimesCircle,
  faFolderOpen, faSyncAlt, faChevronRight, faChevronDown
} from '@fortawesome/free-solid-svg-icons';
import { MusicPlayerService, Track, LibraryItem, YTSearchItem } from '../services/music-player.service';
import { DownloadsService, AddDownloadPayload } from '../services/downloads.service';
import { FileSizePipe } from '../pipes';

function fmtDuration(sec?: number): string {
  if (sec == null || !isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

@Component({
  selector: 'app-music-library',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, FileSizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="metube-section-header">
    <button type="button" class="metube-section-toggle" (click)="toggle()" [attr.aria-expanded]="!collapsed">
      <fa-icon [icon]="faMusic" class="me-2" />
      <span>Music Player</span>
      <fa-icon [icon]="collapsed ? faChevronRight : faChevronDown" class="metube-section-chevron" />
    </button>
  </div>

  @if (!collapsed) {
  <div class="p-3 border-bottom music-browser">
    <ul class="nav nav-pills mb-3">
      <li class="nav-item">
        <button class="nav-link" [class.active]="activeTab() === 'library'" (click)="switchTab('library')">
          <fa-icon [icon]="faFolderOpen" class="me-1" /> My Library ({{ items().length }})
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" [class.active]="activeTab() === 'ytmusic'" (click)="switchTab('ytmusic')">
          <fa-icon [icon]="faSearch" class="me-1" /> YouTube Music
        </button>
      </li>
      <li class="ms-auto">
        @if (activeTab() === 'library') {
          <button class="btn btn-sm btn-outline-secondary" (click)="refresh()" [disabled]="loading()">
            <fa-icon [icon]="faSyncAlt" [class.fa-spin]="loading()" /> Refresh
          </button>
        }
      </li>
    </ul>

    @if (activeTab() === 'library') {
      @if (loading()) { <div class="text-muted">Loading library...</div> }
      @else if (items().length === 0) {
        <div class="text-muted">
          <p>No audio files in your download directory yet.</p>
          <p class="small">Download audio (mp3/m4a/etc.) using MeTube above, and they will appear here to play.</p>
        </div>
      } @else {
        <div class="row g-2 mb-2">
          <div class="col-md-6">
            <input type="text" class="form-control form-control-sm"
              placeholder="Search library..." [(ngModel)]="libraryFilter" (ngModelChange)="onFilterChange()">
          </div>
          <div class="col-auto ms-auto text-muted small align-self-center">
            {{ filteredItems().length }} track{{ filteredItems().length === 1 ? '' : 's' }}
          </div>
        </div>
        <div class="music-list overflow-auto" style="max-height: 50vh;">
          @for (track of filteredItems(); track track.relpath) {
            <div class="music-row d-flex align-items-center gap-2 py-2 px-2 border-bottom" [class.playing]="isCurrent(track)">
              <div class="music-row-art flex-shrink-0">
                @if (track.art_url) { <img [src]="track.art_url" alt="" loading="lazy"> }
                @else { <div class="art-placeholder"><fa-icon [icon]="faMusic" /></div> }
              </div>
              <div class="music-row-info flex-grow-1 text-truncate">
                <div class="music-row-title text-truncate fw-semibold">{{ track.title || track.filename }}</div>
                <div class="music-row-sub small text-muted text-truncate">
                  @if (track.artist) { <span>{{ track.artist }}</span><span class="mx-1">•</span> }
                  @if (track.duration) { <span>{{ fmtDur(track.duration) }}</span> }
                  @if (track.size) { <span class="ms-2">{{ track.size | fileSize }}</span> }
                </div>
              </div>
              <div class="music-row-actions d-flex gap-1 flex-shrink-0">
                <button class="btn btn-sm btn-primary" (click)="playTrack(track)" title="Play"><fa-icon [icon]="faPlay" /></button>
                <button class="btn btn-sm btn-outline-secondary" (click)="enqueueTrack(track)" title="Queue"><fa-icon [icon]="faPlus" /></button>
                <a class="btn btn-sm btn-outline-secondary" [href]="track.url" target="_blank" title="Download"><fa-icon [icon]="faDownload" /></a>
              </div>
            </div>
          }
        </div>
      }
    } @else {
      <div class="d-flex gap-2 mb-3">
        <div class="flex-grow-1">
          <input type="text" class="form-control" placeholder="Search YouTube Music..." [(ngModel)]="ytQuery" (keydown.enter)="doSearch()">
        </div>
        <select class="form-select form-select-sm" style="width: auto;" [(ngModel)]="ytFilter">
          <option value="songs">Songs</option>
          <option value="videos">Videos</option>
          <option value="albums">Albums</option>
          <option value="artists">Artists</option>
        </select>
        <button class="btn btn-primary" (click)="doSearch()" [disabled]="ytLoading()"><fa-icon [icon]="faSearch" /></button>
      </div>
      @if (ytError()) { <div class="alert alert-warning py-2 small"><fa-icon [icon]="faTimesCircle" class="me-1" />{{ ytError() }}</div> }
      @if (ytLoading()) { <div class="text-muted">Searching...</div> }
      @else if (ytResults().length === 0 && ytSearched()) { <div class="text-muted">No results.</div> }
      @else if (ytResults().length > 0) {
        <div class="music-list overflow-auto" style="max-height: 55vh;">
          @for (r of ytResults(); track r.id) {
            <div class="music-row d-flex align-items-center gap-2 py-2 px-2 border-bottom">
              <div class="music-row-art flex-shrink-0">
                @if (r.thumbnail) { <img [src]="r.thumbnail" alt="" loading="lazy"> }
                @else { <div class="art-placeholder"><fa-icon [icon]="faMusic" /></div> }
              </div>
              <div class="music-row-info flex-grow-1 text-truncate">
                <div class="music-row-title text-truncate fw-semibold">
                  {{ r.title }}
                  @if (r.is_explicit) { <span class="badge bg-secondary ms-1" style="font-size:0.65rem;">E</span> }
                </div>
                <div class="music-row-sub small text-muted text-truncate">
                  @if (r.artist) { <span>{{ r.artist }}</span> }
                  @if (r.duration_string) { <span class="mx-1">•</span><span>{{ r.duration_string }}</span> }
                  <span class="mx-1">•</span><span class="badge bg-dark">{{ r.type }}</span>
                </div>
              </div>
              <div class="music-row-actions d-flex gap-1 flex-shrink-0">
                @if (r.type === 'song' || r.type === 'video') {
                  <button class="btn btn-sm btn-primary" (click)="playYT(r)" title="Play now"><fa-icon [icon]="faPlay" /></button>
                  <button class="btn btn-sm btn-outline-secondary" (click)="enqueueYT(r)" title="Queue"><fa-icon [icon]="faPlus" /></button>
                }
                <button class="btn btn-sm btn-success" (click)="downloadYT(r)" title="Download MP3"><fa-icon [icon]="faDownload" /></button>
              </div>
            </div>
          }
        </div>
      }
    }
  </div>
  }
  `,
  styles: [`
  .music-browser .nav-pills .nav-link { color: var(--bs-body-color); border-radius: 16px; padding: 0.3rem 0.8rem; font-size: 0.85rem; }
  .music-browser .nav-pills .nav-link.active { background: var(--bs-primary); }
  .music-row { transition: background 0.1s; cursor: default; }
  .music-row:hover { background: var(--bs-secondary-bg, rgba(0,0,0,0.03)); }
  .music-row.playing { background: var(--bs-primary-bg-subtle, rgba(13,110,253,0.12)); }
  .music-row-art { width: 44px; height: 44px; background: var(--bs-secondary-bg, rgba(0,0,0,0.08)); border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .music-row-art img { width: 100%; height: 100%; object-fit: cover; }
  .art-placeholder { color: var(--bs-secondary-color); opacity: 0.5; }
  .music-row-info { min-width: 0; }
  .music-row-actions .btn { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
  `]
})
export class MusicLibraryComponent implements OnInit {
  private player = inject(MusicPlayerService);
  private downloads = inject(DownloadsService);

  collapsed = false;
  activeTab = signal<'library' | 'ytmusic'>('library');
  loading = signal(false);
  items = signal<LibraryItem[]>([]);
  filteredItems = signal<LibraryItem[]>([]);
  libraryFilter = '';

  ytQuery = ''; ytFilter = 'songs';
  ytLoading = signal(false); ytError = signal<string | null>(null);
  ytResults = signal<YTSearchItem[]>([]); ytSearched = signal(false);

  faPlay = faPlay; faPlus = faPlus; faDownload = faDownload; faMusic = faMusic;
  faSearch = faSearch; faTimesCircle = faTimesCircle; faFolderOpen = faFolderOpen; faSyncAlt = faSyncAlt;
  faChevronRight = faChevronRight; faChevronDown = faChevronDown;

  ngOnInit(): void { this.refresh(); }
  toggle() { this.collapsed = !this.collapsed; }
  switchTab(t: 'library' | 'ytmusic') { this.activeTab.set(t); }
  fmtDur(s?: number) { return fmtDuration(s); }

  refresh() {
    this.loading.set(true);
    this.player.loadLibrary().subscribe({
      next: (res) => {
        const seen = new Set<string>();
        const list = (res.items || []).filter((i) => { if (seen.has(i.relpath)) return false; seen.add(i.relpath); return true; });
        this.items.set(list); this.onFilterChange(); this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
  onFilterChange() {
    const q = (this.libraryFilter || '').toLowerCase().trim();
    if (!q) { this.filteredItems.set(this.items()); return; }
    this.filteredItems.set(this.items().filter((t) =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.artist || '').toLowerCase().includes(q) ||
      (t.album || '').toLowerCase().includes(q) ||
      (t.filename || '').toLowerCase().includes(q)));
  }
  isCurrent(track: LibraryItem): boolean {
    const cur = this.player.currentTrack();
    return !!(cur && cur.id === track.relpath);
  }
  toTrack(item: LibraryItem): Track {
    return { id: item.relpath, title: item.title || item.filename, artist: item.artist,
      duration: item.duration, url: item.url, art_url: item.art_url, downloadUrl: item.url, isYT: false };
  }
  playTrack(item: LibraryItem) {
    const tracks = this.filteredItems().map((i) => this.toTrack(i));
    const idx = tracks.findIndex((t) => t.id === item.relpath);
    this.player.playNow(tracks, idx >= 0 ? idx : 0);
  }
  enqueueTrack(item: LibraryItem) { this.player.enqueue(this.toTrack(item)); }

  doSearch() {
    const q = (this.ytQuery || '').trim();
    if (!q) return;
    this.ytLoading.set(true); this.ytError.set(null); this.ytSearched.set(true);
    this.player.searchYTMusic(q, this.ytFilter, 30).subscribe({
      next: (res) => {
        if (res.status === 'error') { this.ytError.set('Search failed'); this.ytResults.set([]); }
        else this.ytResults.set(res.results || []);
        this.ytLoading.set(false);
      },
      error: (err) => {
        this.ytError.set(err?.message || 'Search failed'); this.ytResults.set([]); this.ytLoading.set(false);
      }
    });
  }
  toYTTrack(r: YTSearchItem): Track {
    return { id: r.id, title: r.title, artist: r.artist, duration: r.duration,
      duration_string: r.duration_string, url: `music/ytstream/${encodeURIComponent(r.id)}`,
      thumbnail: r.thumbnail, art_url: r.thumbnail, isYT: true };
  }
  playYT(r: YTSearchItem) { this.player.playNow([this.toYTTrack(r)], 0); }
  enqueueYT(r: YTSearchItem) { this.player.enqueue(this.toYTTrack(r)); }
  downloadYT(r: YTSearchItem) {
    this.downloads.add({ url: r.url, downloadType: 'audio', codec: 'auto', format: 'mp3', quality: 'best', autoStart: true } as AddDownloadPayload).subscribe();
  }
}
