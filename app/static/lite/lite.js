/* MeTube Lite logic. Plain ES5 with XHR and callbacks, polling for status. */
(function () {
'use strict';

var API = '../';
var POLL_MS = 5000;
var HIST_KEY = 'metube_lite_history';
var searchType = 'video';

var VIDEO_FORMATS = [['any', 'Any format'], ['mp4', 'MP4'], ['ios', 'iOS']];
var AUDIO_FORMATS = [['mp3', 'MP3'], ['m4a', 'M4A'], ['opus', 'Opus'], ['wav', 'WAV'], ['flac', 'FLAC']];

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(text, isError) {
  var box = $('msg');
  box.className = 'msg ' + (isError ? 'err' : 'ok');
  box.innerHTML = esc(text);
}

function apiGet(path, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API + path, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var data = null;
    try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
    if (xhr.status >= 200 && xhr.status < 300 && data) cb(null, data);
    else cb((data && data.msg) || ('Request failed (' + xhr.status + ')'), data);
  };
  xhr.send();
}

function apiPost(path, obj, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', API + path, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var data = null;
    try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
    if (xhr.status >= 200 && xhr.status < 300 && data) cb(null, data);
    else cb((data && data.msg) || ('Request failed (' + xhr.status + ')'), data);
  };
  xhr.send(JSON.stringify(obj));
}

function formatCount(n) {
  if (n === null || n === undefined) return '';
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function loadHistory() {
  try {
    var raw = window.localStorage ? localStorage.getItem(HIST_KEY) : null;
    var arr = raw ? JSON.parse(raw) : [];
    return Object.prototype.toString.call(arr) === '[object Array]' ? arr : [];
  } catch (e) { return []; }
}

function saveHistory(arr) {
  try {
    if (window.localStorage) localStorage.setItem(HIST_KEY, JSON.stringify(arr.slice(0, 15)));
  } catch (e) { /* storage unavailable: history just won't persist */ }
}

function pushHistory(q, t) {
  var h = loadHistory();
  var kept = [];
  for (var i = 0; i < h.length; i++) {
    if (!(h[i] && h[i].q === q && h[i].t === t)) kept.push(h[i]);
  }
  kept.unshift({ q: q, t: t });
  saveHistory(kept);
  renderHistory();
}

function renderHistory() {
  var h = loadHistory();
  var box = $('history');
  if (!h.length) { box.innerHTML = ''; return; }
  var html = '<span class="hist-label">Recent:</span> ';
  for (var i = 0; i < h.length; i++) {
    html += '<button class="chip" data-q="' + esc(h[i].q) + '" data-t="' + esc(h[i].t) + '">' + esc(h[i].q) + '</button> ';
  }
  html += '<button class="chip clear" id="histClear">Clear</button>';
  box.innerHTML = html;
  var chips = box.getElementsByClassName('chip');
  for (var j = 0; j < chips.length; j++) {
    if (chips[j].id === 'histClear') continue;
    chips[j].onclick = (function (b) {
      return function () {
        $('q').value = b.getAttribute('data-q');
        setType(b.getAttribute('data-t'));
        doSearch();
      };
    })(chips[j]);
  }
  $('histClear').onclick = function () { saveHistory([]); renderHistory(); };
}

function setType(t) {
  searchType = t;
  var tabs = document.getElementsByClassName('tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].className = tabs[i].getAttribute('data-t') === t ? 'tab on' : 'tab';
  }
}

function metaLine(r, type) {
  if (type === 'channel') {
    var s = r.handle || r.uploader || '';
    if (r.verified) s += ' [v]';
    if (r.subscriber_count) s += ' - ' + formatCount(r.subscriber_count) + ' subs';
    return s;
  }
  if (type === 'playlist') {
    var p = r.channel || r.uploader || '';
    if (r.video_count) p += ' - ' + r.video_count + ' videos';
    return p;
  }
  var v = r.uploader || '';
  if (r.view_count) v += ' - ' + formatCount(r.view_count) + ' views';
  return v;
}

function rowHtml(r, type) {
  var badge = '';
  if (r.is_live) badge = '<span class="badge live">LIVE</span>';
  else if (r.duration_string) badge = '<span class="badge">' + esc(r.duration_string) + '</span>';
  else if (r.video_count) badge = '<span class="badge">' + esc(String(r.video_count)) + ' videos</span>';
  var thumb = r.thumbnail
    ? '<img src="' + esc(r.thumbnail) + '" alt="" loading="lazy">'
    : '<span class="noimg">No image</span>';
  var html = '';
  html += '<div class="rowitem">';
  html += '<a class="thumb" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + thumb + badge + '</a>';
  html += '<div class="rbody">';
  html += '<a class="rtitle" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a>';
  html += '<div class="rmeta">' + esc(metaLine(r, type)) + '</div>';
  html += '<div class="rbtns">';
  html += '<button data-act="video" data-url="' + esc(r.url) + '">Download</button> ';
  html += '<button data-act="mp3" data-url="' + esc(r.url) + '">MP3</button> ';
  html += '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">Open</a>';
  html += '</div></div><div class="clear"></div></div>';
  return html;
}

function wireButtons(box, attr, fn) {
  var btns = box.getElementsByTagName('button');
  for (var j = 0; j < btns.length; j++) {
    btns[j].onclick = (function (b) {
      return function () { fn(b); };
    })(btns[j]);
  }
}

function renderRows(boxId, list, type) {
  var box = $(boxId);
  if (!list || !list.length) { box.innerHTML = '<p class="dim">No results.</p>'; return; }
  var html = '';
  for (var i = 0; i < list.length; i++) html += rowHtml(list[i], type);
  box.innerHTML = html;
  wireButtons(box, 0, function (b) {
    quickAdd(b.getAttribute('data-url'), b.getAttribute('data-act'));
  });
}

function quickAdd(url, act) {
  if (!url) return;
  var body = act === 'mp3'
    ? { url: url, download_type: 'audio', codec: 'auto', quality: 'best', format: 'mp3' }
    : { url: url, download_type: 'video', codec: 'auto', quality: 'best', format: 'any' };
  apiPost('add', body, function (err, data) {
    if (err || !data || data.status === 'error') {
      showMsg('Error: ' + (err || (data && data.msg) || 'failed'), true);
    } else {
      showMsg(data.msg || 'Added to queue.', false);
      refreshDownloads();
    }
  });
}

function doSearch() {
  var q = $('q').value.trim();
  if (!q) return;
  $('results').innerHTML = '<p class="dim">Searching...</p>';
  apiGet('search?q=' + encodeURIComponent(q) + '&type=' + searchType + '&max=12', function (err, data) {
    if (err || !data || data.status === 'error') {
      $('results').innerHTML = '<p class="dim">Search failed: ' + esc(err || (data && data.msg) || '') + '</p>';
      return;
    }
    pushHistory(q, searchType);
    renderRows('results', data.results, searchType);
  });
}

function loadTrending() {
  $('trendingResults').innerHTML = '<p class="dim">Loading...</p>';
  apiGet('trending?max=12', function (err, data) {
    if (err || !data || data.status === 'error') {
      $('trendingResults').innerHTML = '<p class="dim">Trending failed.</p>';
      return;
    }
    renderRows('trendingResults', data.results, 'video');
  });
}

function delRow(where, id) {
  apiPost('delete', { where: where, ids: [id] }, function () { refreshDownloads(); });
}

function refreshDownloads() {
  apiGet('history', function (err, data) {
    if (err || !data) return;
    renderQueue(data.queue || []);
    renderDone(data.done || []);
  });
}

function renderQueue(list) {
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    var pct = (d.percent !== null && d.percent !== undefined) ? Math.floor(d.percent) + '%' : (d.status || 'queued');
    html += '<div class="dl"><span class="dltitle">' + esc(d.title || d.url) + '</span> ';
    html += '<span class="dim">' + esc(pct) + '</span> ';
    html += '<button class="small" data-id="' + esc(d.url) + '">x</button></div>';
  }
  var box = $('queueList');
  box.innerHTML = html || '<p class="dim">Empty.</p>';
  wireButtons(box, 0, function (b) { delRow('queue', b.getAttribute('data-id')); });
}

function renderDone(list) {
  var html = '';
  for (var i = list.length - 1; i >= 0; i--) {
    var d = list[i];
    html += '<div class="dl"><span class="dltitle">' + esc(d.title || d.url) + '</span> ';
    html += '<span class="dim">' + esc(d.status || '') + '</span> ';
    /* Same-origin file URLs, mirroring the full UI (PUBLIC_HOST_URL not applied in lite). */
    if (d.filename) {
      var segs = d.download_type === 'audio' ? 'audio_download/' : 'download/';
      if (d.folder) {
        var parts = String(d.folder).split('/');
        for (var k = 0; k < parts.length; k++) {
          if (parts[k]) segs += encodeURIComponent(parts[k]) + '/';
        }
      }
      html += '<a href="' + esc(API + segs + encodeURIComponent(d.filename)) + '">Save file</a> ';
    }
    if (d.msg && d.status === 'error') html += '<span class="dim">' + esc(d.msg) + '</span> ';
    html += '<button class="small" data-id="' + esc(d.url) + '">x</button></div>';
  }
  var box = $('doneList');
  box.innerHTML = html || '<p class="dim">Empty.</p>';
  wireButtons(box, 0, function (b) { delRow('done', b.getAttribute('data-id')); });
}

function syncFormatOptions() {
  var type = $('addType').value;
  var fs = $('addFormat');
  var opts = type === 'audio' ? AUDIO_FORMATS : VIDEO_FORMATS;
  fs.options.length = 0;
  for (var i = 0; i < opts.length; i++) fs.options[fs.options.length] = new Option(opts[i][1], opts[i][0]);
  $('addQuality').style.display = type === 'audio' ? 'none' : '';
}

function submitAdd() {
  var url = $('addUrl').value.trim();
  if (!url) { showMsg('Paste a URL first.', true); return; }
  var type = $('addType').value;
  var body = {
    url: url, download_type: type, codec: 'auto',
    quality: type === 'audio' ? 'best' : $('addQuality').value,
    format: $('addFormat').value
  };
  apiPost('add', body, function (err, data) {
    if (err || !data || data.status === 'error') {
      showMsg('Error: ' + (err || (data && data.msg) || 'failed'), true);
      return;
    }
    showMsg(data.msg || 'Added to queue.', false);
    $('addUrl').value = '';
    refreshDownloads();
  });
}

function init() {
  var tabs = document.getElementsByClassName('tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].onclick = (function (b) {
      return function () {
        setType(b.getAttribute('data-t'));
        if ($('q').value.trim()) doSearch();
      };
    })(tabs[i]);
  }
  $('searchBtn').onclick = doSearch;
  $('q').onkeydown = function (ev) {
    ev = ev || window.event;
    if ((ev.keyCode || ev.which) === 13) { doSearch(); return false; }
  };
  $('trendingBtn').onclick = loadTrending;
  $('addBtn').onclick = submitAdd;
  $('addType').onchange = syncFormatOptions;
  $('refreshBtn').onclick = refreshDownloads;
  syncFormatOptions();
  renderHistory();
  loadTrending();
  refreshDownloads();
  setInterval(function () {
    if ($('autoRef').checked && !document.hidden) refreshDownloads();
  }, POLL_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
