"""YouTube Music search via the ``ytmusicapi`` library.

Provides an endpoint to search songs/artists/albums on YouTube Music. Results
can be downloaded directly through MeTube's existing download pipeline
(building a ``https://music.youtube.com/watch?v=...`` URL that yt-dlp handles).
"""

import logging
import os
from functools import lru_cache

log = logging.getLogger('ytmusic_search')


class YTMusicError(Exception):
    pass


@lru_cache(maxsize=1)
def _get_client():
    """Lazily construct a YTMusic client (anon or authed)."""
    try:
        from ytmusicapi import YTMusic
    except ImportError as e:
        raise YTMusicError(
            'ytmusicapi is not installed. Install it with `pip install ytmusicapi`.'
        ) from e

    auth_file = os.environ.get('YTMUSIC_AUTH_FILE', '').strip()
    try:
        if auth_file and os.path.exists(auth_file):
            log.info('Initializing YTMusic with auth file: %s', auth_file)
            return YTMusic(auth_file)
        log.info('Initializing YTMusic in anonymous mode')
        return YTMusic()
    except Exception as e:
        log.warning('YTMusic client init failed (%s); trying anonymous', e)
        try:
            return YTMusic()
        except Exception as e2:
            raise YTMusicError(f'Could not initialize YTMusic: {e2}') from e2


_SEARCH_FILTERS = {
    'songs': 'songs',
    'videos': 'videos',
    'albums': 'albums',
    'artists': 'artists',
    'playlists': 'community_playlists',
    'featured_playlists': 'featured_playlists',
}


def _best_thumb(thumbs) -> str | None:
    if not thumbs:
        return None
    best = None
    best_pixels = -1
    for t in thumbs:
        if not isinstance(t, dict) or not t.get('url'):
            continue
        w = t.get('width', 0) or 0
        h = t.get('height', 0) or 0
        pixels = w * h
        if pixels >= best_pixels:
            best_pixels = pixels
            best = t['url']
    return best or (thumbs[-1].get('url') if isinstance(thumbs[-1], dict) else None)


def _dur(secs) -> str | None:
    try:
        s = int(secs)
    except (TypeError, ValueError):
        return None
    if s < 0:
        return None
    m, sec = divmod(s, 60)
    h, m = divmod(m, 60)
    if h:
        return f'{h}:{m:02d}:{sec:02d}'
    return f'{m}:{sec:02d}'


def search(query: str, filter_name: str = 'songs', limit: int = 20) -> list[dict]:
    """Search YouTube Music and return a JSON-friendly list of results."""
    client = _get_client()
    filter_name = (filter_name or 'songs').lower()
    if filter_name not in _SEARCH_FILTERS:
        raise ValueError(f'unknown filter {filter_name!r}; valid: {sorted(_SEARCH_FILTERS)}')
    scope = _SEARCH_FILTERS[filter_name]
    limit = max(1, min(int(limit or 20), 50))

    try:
        results = client.search(query, filter=scope, limit=limit)
    except Exception as e:
        raise YTMusicError(str(e)) from e

    items = []
    for r in results or []:
        if not isinstance(r, dict):
            continue
        category = (r.get('category') or '').lower()
        result_type = r.get('resultType') or category
        video_id = r.get('videoId') or r.get('browseId')
        if not video_id:
            continue

        if result_type in ('song', 'video'):
            url = f'https://music.youtube.com/watch?v={video_id}'
        else:
            url = f'https://music.youtube.com/browse/{video_id}'

        duration_s = r.get('duration_seconds')
        item = {
            'id': video_id,
            'type': result_type,
            'title': r.get('title'),
            'url': url,
            'thumbnail': _best_thumb(r.get('thumbnails')),
            'duration': duration_s if isinstance(duration_s, int) else None,
            'duration_string': r.get('duration') or _dur(duration_s),
            'is_explicit': bool(r.get('isExplicit')),
        }

        artists = r.get('artists') or []
        if artists and isinstance(artists, list):
            item['artist'] = ', '.join(
                a.get('name', '') for a in artists if isinstance(a, dict)
            )
            item['artists'] = [
                {'name': a.get('name'), 'id': a.get('id')}
                for a in artists if isinstance(a, dict) and a.get('name')
            ]
        else:
            item['artist'] = r.get('artists') or r.get('author') or ''

        if result_type == 'album':
            item['year'] = r.get('year')
        if result_type in ('artist',):
            item['subscribers'] = r.get('subscribers')
        if result_type in ('playlist', 'community_playlist', 'featured_playlist'):
            item['item_count'] = r.get('itemCount')
            item['author'] = r.get('author')

        items.append(item)
    return items


def get_stream_url(video_id: str) -> dict:
    """Get direct stream URL for a song (for in-browser playback)."""
    client = _get_client()
    try:
        song = client.get_song(video_id)
    except Exception as e:
        raise YTMusicError(str(e)) from e

    sd = song.get('streamingData') if isinstance(song, dict) else None
    formats = []
    if sd:
        formats = sd.get('adaptiveFormats') or sd.get('formats') or []
    audio_formats = [
        f for f in formats
        if isinstance(f, dict) and str(f.get('mimeType', '')).startswith('audio/')
    ]
    if not audio_formats:
        raise YTMusicError(f'No audio formats available for {video_id}')
    audio_formats.sort(key=lambda f: int(f.get('bitrate') or 0), reverse=True)
    best = audio_formats[0]
    return {
        'url': best.get('url'),
        'mime_type': best.get('mimeType', '').split(';')[0] or 'audio/mp4',
        'bitrate': best.get('bitrate'),
        'expires': sd.get('expiresInSeconds') if sd else None,
    }
