"""Music library: scan AUDIO_DOWNLOAD_DIR and serve audio metadata + files.

Supports streaming raw mp3/audio files (Range requests for seeking) and reads
ID3/metadata via mutagen for title, artist, album, duration, and embedded art.
"""

import logging
import mimetypes
import os
import re
from pathlib import Path
from urllib.parse import quote

log = logging.getLogger('music_library')

# Audio extensions MeTube can produce (see VALID_AUDIO_FORMATS in main.py) plus
# a few common extra formats browsers can play natively.
AUDIO_EXTS = {'.mp3', '.m4a', '.opus', '.wav', '.flac', '.ogg', '.aac', '.webm', '.mka'}

_MIME_FALLBACKS = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.opus': 'audio/opus',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.aac': 'audio/aac',
    '.webm': 'audio/webm',
    '.mka': 'audio/x-matroska',
}


def _guess_mime(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in _MIME_FALLBACKS:
        return _MIME_FALLBACKS[ext]
    guess, _ = mimetypes.guess_type(str(path))
    return guess or 'application/octet-stream'


def _safe_join(base: str, rel: str) -> Path | None:
    """Join ``base`` with URL-decoded ``rel``, ensuring we stay inside ``base``."""
    rel = rel.lstrip('/')
    if '\x00' in rel or '..' in rel.replace('\\', '/').split('/'):
        return None
    candidate = (Path(base) / rel).resolve()
    base_resolved = Path(base).resolve()
    try:
        candidate.relative_to(base_resolved)
    except ValueError:
        return None
    return candidate


def _read_id3(path: Path) -> dict:
    """Return best-effort metadata dict via mutagen."""
    meta = {}
    try:
        from mutagen import File as MutagenFile
        audio = MutagenFile(str(path))
    except Exception as exc:
        log.debug('mutagen failed on %s: %s', path, exc)
        return meta
    if audio is None:
        return meta
    try:
        meta['duration'] = float(audio.info.length)
    except Exception:
        pass
    try:
        meta['bitrate'] = int(audio.info.bitrate)
    except Exception:
        pass
    tags = getattr(audio, 'tags', None) or {}

    def _first(*keys):
        for k in keys:
            for variant in (k, k.upper(), k.lower()):
                if variant in tags:
                    v = tags[variant]
                    if isinstance(v, list):
                        return str(v[0]) if v else None
                    return str(v)
        return None

    title = _first('title', 'TIT2', '\xa9nam')
    artist = _first('artist', 'TPE1', '\xa9ART')
    album = _first('album', 'TALB', '\xa9alb')
    track = _first('tracknumber', 'TRCK', 'trkn')
    if title:
        meta['title'] = title
    if artist:
        meta['artist'] = artist
    if album:
        meta['album'] = album
    if track:
        meta['track'] = str(track).split('/')[0]

    has_art = False
    try:
        if hasattr(audio, 'pictures'):
            has_art = bool(list(audio.pictures))
        elif tags:
            apic_keys = [k for k in tags if k.upper().startswith('APIC') or k == 'covr']
            has_art = bool(apic_keys)
    except Exception:
        has_art = False
    meta['has_art'] = has_art
    return meta


def list_audio_files(audio_dir: str) -> list[dict]:
    """Return a sorted list of audio files under ``audio_dir`` with metadata."""
    items = []
    base = Path(audio_dir)
    if not base.exists():
        return items
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if not d.startswith('.') and not d.startswith('@')]
        for fname in files:
            p = Path(root) / fname
            if p.suffix.lower() not in AUDIO_EXTS:
                continue
            rel = str(p.relative_to(base))
            stat = p.stat()
            entry = {
                'relpath': rel,
                'filename': fname,
                'size': stat.st_size,
                'mtime': stat.st_mtime,
                'mime': _guess_mime(p),
                'url': '',
                'art_url': '',
                'title': p.stem,
            }
            entry.update(_read_id3(p))
            items.append(entry)
    items.sort(key=lambda x: x.get('mtime', 0), reverse=True)
    return items


def extract_cover_art(path: Path) -> tuple[bytes, str] | None:
    """Extract the first embedded cover image (data, mime). Returns None on miss."""
    try:
        from mutagen import File as MutagenFile
        audio = MutagenFile(str(path))
    except Exception:
        return None
    if audio is None:
        return None

    # ID3 (mp3)
    try:
        tags = getattr(audio, 'tags', None) or {}
        for key in tags:
            if key.upper().startswith('APIC'):
                frame = tags[key]
                data = getattr(frame, 'data', None)
                mime = getattr(frame, 'mime', None) or 'image/jpeg'
                if data:
                    return bytes(data), str(mime)
                if isinstance(frame, list) and frame:
                    f0 = frame[0]
                    data = getattr(f0, 'data', None)
                    mime = getattr(f0, 'mime', None) or 'image/jpeg'
                    if data:
                        return bytes(data), str(mime)
    except Exception:
        pass

    # MP4 (m4a) — 'covr'
    try:
        tags = getattr(audio, 'tags', None) or {}
        covr = tags.get('covr')
        if covr and isinstance(covr, list) and covr:
            data = bytes(covr[0])
            fmt = getattr(covr[0], 'imageformat', None)
            if fmt == 0:
                mime = 'image/png'
            elif fmt == 13:
                mime = 'image/jpeg'
            else:
                mime = 'image/jpeg' if data[:3] == b'\xff\xd8\xff' else 'image/png'
            return data, mime
    except Exception:
        pass

    # FLAC/Vorbis
    try:
        pics = getattr(audio, 'pictures', None)
        if pics:
            p0 = pics[0]
            return bytes(p0.data), str(p0.mime or 'image/jpeg')
    except Exception:
        pass

    return None


_RANGE_RE = re.compile(r'bytes=(\d*)-(\d*)')


def parse_range(header: str, size: int) -> tuple[int, int] | None:
    if not header:
        return None
    m = _RANGE_RE.match(header.strip())
    if not m:
        return None
    s, e = m.group(1), m.group(2)
    if not s and not e:
        return None
    if s and e:
        start, end = int(s), int(e)
    elif s:
        start, end = int(s), size - 1
    else:
        suffix = int(e)
        start, end = max(0, size - suffix), size - 1
    if start > end or start >= size:
        return None
    return start, min(end, size - 1)
