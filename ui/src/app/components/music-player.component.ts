import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faPlay, faPause, faStepForward, faStepBackward, faVolumeUp, faVolumeMute,
  faRandom, faRedo, faTimes, faMusic, faRedoAlt, faExpandAlt, faCompressAlt
} from '@fortawesome/free-solid-svg-icons';
import { MusicPlayerService } from '../services/music-player.service';

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

@Component({
  selector: 'app-music-player',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule],
  template: `
  @if (svc.isPlayerVisible() && svc.currentTrack()) {
  <div class="music-player-bar" [class.expanded]="expanded">
    <div class="mp-row">
      <div class="mp-art">
        @if (svc.currentTrack()?.art_url) { <img [src]="svc.currentTrack()!.art_url" alt="" loading="lazy"> }
        @else { <div class="mp-art-fallback"><fa-icon [icon]="faMusic" /></div> }
      </div>
      <div class="mp-info" (click)="expanded = !expanded">
        <div class="mp-title text-truncate">{{ svc.currentTrack()?.title || 'Unknown track' }}</div>
        <div class="mp-sub text-truncate text-muted small">
          {{ svc.currentTrack()?.artist || (svc.currentTrack()?.isYT ? 'YouTube Music' : 'Local library') }}
        </div>
        <div class="mp-progress">
          <span class="mp-time">{{ fmtTime(svc.currentTime()) }}</span>
          <input type="range" class="mp-seek" min="0" [max]="svc.duration() || 0" step="0.1"
            [value]="svc.currentTime()" (input)="onSeek($any($event.target).value)">
          <span class="mp-time">{{ fmtTime(svc.duration()) }}</span>
        </div>
      </div>
      <div class="mp-controls">
        <button class="mp-btn" (click)="svc.toggleShuffle()" [class.active]="svc.shuffle()" title="Shuffle">
          <fa-icon [icon]="faRandom" />
        </button>
        <button class="mp-btn" (click)="svc.prev()" title="Previous">
          <fa-icon [icon]="faStepBackward" />
        </button>
        <button class="mp-btn mp-play" (click)="svc.togglePlay()" [title]="svc.isPlaying() ? 'Pause' : 'Play'">
          <fa-icon [icon]="svc.isPlaying() ? faPause : faPlay" />
        </button>
        <button class="mp-btn" (click)="svc.next()" title="Next">
          <fa-icon [icon]="faStepForward" />
        </button>
        <button class="mp-btn" (click)="svc.toggleRepeat()" [class.active]="svc.repeat() !== 'off'"
          [title]="'Repeat: ' + svc.repeat()">
          @if (svc.repeat() === 'one') { <fa-icon [icon]="faRedoAlt" class="fa-stack-1x mp-repeat-one" /> }
          @else { <fa-icon [icon]="faRedo" /> }
        </button>
      </div>
      <div class="mp-volume">
        <button class="mp-btn" (click)="svc.toggleMute()" [title]="svc.muted() ? 'Unmute' : 'Mute'">
          <fa-icon [icon]="svc.muted() || svc.volume() === 0 ? faVolumeMute : faVolumeUp" />
        </button>
        <input type="range" class="mp-vol" min="0" max="1" step="0.01"
          [value]="svc.muted() ? 0 : svc.volume()"
          (input)="onVolume($any($event.target).value)">
      </div>
      <button class="mp-btn mp-close" (click)="svc.hidePlayer()" title="Close player">
        <fa-icon [icon]="faTimes" />
      </button>
    </div>
  </div>
  }
  @else if (svc.playlist().length > 0 && !svc.isPlayerVisible()) {
    <button class="mp-recall" (click)="svc.showPlayer()" title="Show music player">
      <fa-icon [icon]="faMusic" />&nbsp; Player
    </button>
  }
  `,
  styles: [`
  :host { display: block; }
  .mp-recall {
    position: fixed; bottom: 12px; right: 12px; z-index: 1049;
    padding: 8px 14px; border-radius: 999px;
    background: var(--bs-primary); color: #fff; border: none;
    box-shadow: 0 4px 14px rgba(0,0,0,.25); font-size: 0.9rem;
  }
  .music-player-bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 1050;
    background: var(--bs-body-bg, #fff);
    border-top: 1px solid var(--bs-border-color, rgba(0,0,0,.12));
    box-shadow: 0 -2px 12px rgba(0,0,0,.08);
    padding: 8px 12px;
    backdrop-filter: blur(8px);
  }
  .mp-row { display: flex; align-items: center; gap: 12px; }
  .mp-art {
    width: 48px; height: 48px; flex-shrink: 0; border-radius: 4px; overflow: hidden;
    background: var(--bs-secondary-bg); display: flex; align-items: center; justify-content: center;
  }
  .mp-art img { width: 100%; height: 100%; object-fit: cover; }
  .mp-art-fallback { color: var(--bs-secondary-color); opacity: 0.6; font-size: 20px; }
  .mp-info { flex: 1; min-width: 0; cursor: pointer; }
  .mp-title { font-weight: 600; }
  .mp-progress { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
  .mp-time { font-size: 0.72rem; color: var(--bs-secondary-color); min-width: 32px; text-align: center; font-variant-numeric: tabular-nums; }
  .mp-seek { flex: 1; cursor: pointer; }
  .mp-seek, .mp-vol { -webkit-appearance: none; appearance: none; height: 4px; background: var(--bs-secondary-bg); border-radius: 2px; outline: none; }
  .mp-seek::-webkit-slider-thumb, .mp-vol::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 12px; height: 12px;
    background: var(--bs-primary); border-radius: 50%; cursor: pointer;
  }
  .mp-seek::-moz-range-thumb, .mp-vol::-moz-range-thumb {
    width: 12px; height: 12px; background: var(--bs-primary); border-radius: 50%; cursor: pointer; border: none;
  }
  .mp-controls { display: flex; align-items: center; gap: 4px; }
  .mp-volume { display: flex; align-items: center; gap: 6px; }
  .mp-vol { width: 90px; }
  .mp-btn {
    background: transparent; border: none; color: var(--bs-body-color);
    padding: 6px; border-radius: 50%; cursor: pointer; display: inline-flex;
    align-items: center; justify-content: center; transition: background .15s;
  }
  .mp-btn:hover { background: var(--bs-secondary-bg); }
  .mp-btn.active { color: var(--bs-primary); }
  .mp-play {
    background: var(--bs-primary); color: #fff; width: 36px; height: 36px;
  }
  .mp-play:hover { background: var(--bs-primary-text-emphasis, #0a58ca); color: #fff; }
  .mp-close { color: var(--bs-secondary-color); }
  .mp-repeat-one { font-size: 0.8em; }
  body { padding-bottom: 80px; }
  @media (max-width: 768px) {
    .mp-volume { display: none; }
    .mp-art { width: 40px; height: 40px; }
    .mp-btn { padding: 5px; }
    .mp-play { width: 32px; height: 32px; }
  }
  `]
})
export class MusicPlayerComponent {
  svc = inject(MusicPlayerService);
  expanded = false;
  faPlay = faPlay; faPause = faPause; faStepForward = faStepForward; faStepBackward = faStepBackward;
  faVolumeUp = faVolumeUp; faVolumeMute = faVolumeMute; faRandom = faRandom; faRedo = faRedo; faRedoAlt = faRedoAlt;
  faTimes = faTimes; faMusic = faMusic; faExpandAlt = faExpandAlt; faCompressAlt = faCompressAlt;
  fmtTime = fmtTime;
  onSeek(v: string) { this.svc.seek(parseFloat(v)); }
  onVolume(v: string) { this.svc.setVolume(parseFloat(v)); }
}
