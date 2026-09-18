import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, output
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCircleCheck, faCirclePlay, faDownload, faExternalLinkAlt, faFire, faListUl,
  faMagnifyingGlass, faSpinner, faTowerBroadcast
} from '@fortawesome/free-solid-svg-icons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { SearchService } from '../services/search.service';
import { ToastService } from '../services/toast.service';
import { SearchResult, SearchTabId, SearchType } from '../interfaces/search';

interface SearchTab {
  id: SearchTabId;
  label: string;
}

interface HistoryEntry {
  q: string;
  type: SearchType;
}

@Component({
  selector: 'app-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FontAwesomeModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.sass',
})
export class SearchComponent {
  private static readonly HISTORY_KEY = 'metube_search_history';
  private static readonly HISTORY_MAX = 12;

  private searchService = inject(SearchService);
  private toasts = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  readonly downloadRequested = output<string>();
  readonly downloadMp3Requested = output<string>();

  faCircleCheck = faCircleCheck;
  faCirclePlay = faCirclePlay;
  faDownload = faDownload;
  faExternalLinkAlt = faExternalLinkAlt;
  faFire = faFire;
  faListUl = faListUl;
  faMagnifyingGlass = faMagnifyingGlass;
  faSpinner = faSpinner;
  faTowerBroadcast = faTowerBroadcast;

  readonly tabs: SearchTab[] = [
    { id: 'video', label: 'Videos' },
    { id: 'channel', label: 'Channels' },
    { id: 'playlist', label: 'Playlists' },
    { id: 'trending', label: 'Trending' },
  ];

  query = '';
  activeTab: SearchTabId = 'video';
  results: SearchResult[] = [];
  history: HistoryEntry[] = this.loadHistory();
  searching = false;
  searched = false;

  search(): void {
    const tab = this.activeTab;
    if (tab === 'trending') {
      this.loadTrending();
      return;
    }
    const q = this.query.trim();
    if (!q || this.searching) {
      return;
    }
    this.searching = true;
    this.cdr.markForCheck();
    this.searchService.search(q, tab).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.searching = false;
        this.cdr.markForCheck();
      })
    ).subscribe((res) => {
      this.searched = true;
      if (res.status === 'error') {
        this.toasts.error(res.msg || 'Search failed');
        this.results = [];
      } else {
        this.results = res.results;
        this.pushHistory(q, tab);
      }
      this.cdr.markForCheck();
    });
  }

  loadTrending(): void {
    if (this.searching) {
      return;
    }
    this.searching = true;
    this.cdr.markForCheck();
    this.searchService.trending().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.searching = false;
        this.cdr.markForCheck();
      })
    ).subscribe((res) => {
      this.searched = true;
      if (res.status === 'error') {
        this.toasts.error(res.msg || 'Trending failed');
        this.results = [];
      } else {
        this.results = res.results;
      }
      this.cdr.markForCheck();
    });
  }

  selectTab(tab: SearchTabId): void {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    this.results = [];
    this.searched = false;
    if (tab === 'trending') {
      this.loadTrending();
    } else if (this.query.trim()) {
      this.search();
    } else {
      this.cdr.markForCheck();
    }
  }

  selectHistory(entry: HistoryEntry): void {
    this.query = entry.q;
    this.activeTab = entry.type;
    this.search();
  }

  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this.cdr.markForCheck();
  }

  download(result: SearchResult): void {
    if (result.url) {
      this.downloadRequested.emit(result.url);
    }
  }

  mp3(result: SearchResult): void {
    if (result.url) {
      this.downloadMp3Requested.emit(result.url);
    }
  }

  trackById(_index: number, item: SearchResult): string {
    return item.id || item.url;
  }

  trackHistory(_index: number, entry: HistoryEntry): string {
    return entry.type + ':' + entry.q;
  }

  formatCount(value?: number): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return `${value}`;
  }

  private pushHistory(q: string, type: SearchType): void {
    this.history = [{ q, type }, ...this.history.filter((e) => !(e.q === q && e.type === type))]
      .slice(0, SearchComponent.HISTORY_MAX);
    this.saveHistory();
  }

  private loadHistory(): HistoryEntry[] {
    try {
      const raw = localStorage.getItem(SearchComponent.HISTORY_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((e): e is HistoryEntry => {
        if (typeof e !== 'object' || e === null) {
          return false;
        }
        const type = (e as HistoryEntry).type;
        return typeof (e as HistoryEntry).q === 'string' &&
          (type === 'video' || type === 'channel' || type === 'playlist');
      });
    } catch {
      return [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(SearchComponent.HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      // Private mode etc: history just won't persist.
    }
  }
}
