"""In-app YouTube search (videos, channels, playlists).

Powers the VidMate-style search box in the UI. Implemented on top of yt-dlp's
YouTube search-URL extractor (``YoutubeSearchURLIE``) with the documented
``sp`` filter params, so search needs no extra API keys and performs no
network egress beyond what yt-dlp itself does.
"""

import logging
from urllib.parse import urlencode

import yt_dlp
from yt_dlp.utils import DownloadError

log = logging.getLogger('search')

# YouTube search filter params ("sp"): videos / channels / playlists.
SEARCH_TYPES = {
    'video': 'EgIQAQ==',
    'channel': 'EgIQAg==',
    'playlist': 'EgIQAw==',
}

DEFAULT_MAX_RESULTS = 15
MAX_RESULTS_LIMIT = 30
_SEARCH_TIMEOUT = 30


class SearchError(Exception):
    """Raised when a search fails (network, extractor or YouTube-side error)."""


def _best_thumbnail(thumbnails):
    urls = [t.get('url') for t in (thumbnails or [])
            if isinstance(t, dict) and t.get('url')]
    return urls[-1] if urls else None


def _duration_string(seconds):
    try:
        total = int(seconds)
    except (TypeError, ValueError):
        return None
    if total < 0:
        return None
    hours, rem = divmod(total, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f'{hours}:{minutes:02d}:{secs:02d}'
    return f'{minutes}:{secs:02d}'


def _public_entry(entry, search_type):
    video_id = entry.get('id')
    url = entry.get('url') or entry.get('webpage_url')
    if not url and video_id and search_type == 'video':
        url = f'https://www.youtube.com/watch?v={video_id}'
    thumbnail = _best_thumbnail(entry.get('thumbnails'))
    if not thumbnail and video_id and search_type == 'video':
        thumbnail = f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg'
    duration = entry.get('duration')
    return {
        'id': video_id,
        'title': entry.get('title'),
        'url': url,
        'thumbnail': thumbnail,
        'uploader': entry.get('uploader') or entry.get('channel'),
        'uploader_url': entry.get('uploader_url') or entry.get('channel_url'),
        'duration': duration if isinstance(duration, (int, float)) else None,
        'duration_string': _duration_string(duration),
        'view_count': entry.get('view_count'),
        'is_live': entry.get('live_status') == 'is_live',
        # channel results
        'handle': entry.get('uploader_id'),
        'subscriber_count': entry.get('channel_follower_count'),
        'verified': entry.get('channel_is_verified'),
        # playlist results
        'video_count': entry.get('playlist_count'),
        'channel': entry.get('channel'),
    }


def _ytdl_params(max_results):
    params = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'playlistend': max_results,
        'socket_timeout': _SEARCH_TIMEOUT,
    }
    try:
        import curl_cffi  # noqa: F401
        import yt_dlp.networking.impersonate
        params['impersonate'] = yt_dlp.networking.impersonate.ImpersonateTarget.from_str('chrome')
    except ImportError:
        pass
    return params


def _extract_flat_entries(url, max_results):
    try:
        with yt_dlp.YoutubeDL(_ytdl_params(max_results)) as ydl:
            info = ydl.extract_info(url, download=False)
    except DownloadError as e:
        msg = str(e).strip()
        if msg.startswith('ERROR: '):
            msg = msg[len('ERROR: '):]
        raise SearchError(msg or 'Request failed') from e
    return [e for e in ((info or {}).get('entries') or []) if isinstance(e, dict)]


def search_youtube(query, search_type='video', max_results=DEFAULT_MAX_RESULTS):
    """Search YouTube; returns a list of JSON-serializable result dicts."""
    search_type = (search_type or 'video').lower()
    if search_type not in SEARCH_TYPES:
        raise ValueError(f'unknown search type: {search_type!r}')
    query = (query or '').strip()
    if not query:
        raise ValueError('empty search query')
    max_results = max(1, min(int(max_results or DEFAULT_MAX_RESULTS), MAX_RESULTS_LIMIT))

    url = 'https://www.youtube.com/results?' + urlencode({
        'search_query': query,
        'sp': SEARCH_TYPES[search_type],
    })
    entries = _extract_flat_entries(url, max_results)
    return [_public_entry(e, search_type) for e in entries]


# Ordering for the fallback query (popularity-flavored; exact semantics is
# YouTube's, but empirically surfaces viral recent videos).
TRENDING_FALLBACK_SP = 'CAISAhAB'


def get_trending(max_results=DEFAULT_MAX_RESULTS):
    """YouTube trending feed; same result dicts as search_youtube().

    Tries the real /feed/trending tab first (works on residential IPs);
    falls back to a popularity-ordered search on networks where YouTube
    withholds the trending tab (e.g. datacenter IPs get an empty page).
    """
    max_results = max(1, min(int(max_results or DEFAULT_MAX_RESULTS), MAX_RESULTS_LIMIT))
    try:
        entries = _extract_flat_entries('https://www.youtube.com/feed/trending', max_results)
    except SearchError as e:
        log.info('Direct trending feed failed (%s); using fallback', e)
        entries = []
    if entries:
        return [_public_entry(e, 'video') for e in entries]
    import datetime as _dt  # local import: keeps module import light
    query = str(_dt.datetime.now().year)
    url = 'https://www.youtube.com/results?' + urlencode({
        'search_query': query, 'sp': TRENDING_FALLBACK_SP})
    entries = _extract_flat_entries(url, max_results)
    return [_public_entry(e, 'video') for e in entries]
