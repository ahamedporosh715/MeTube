/* MeTube Lite — KaiOS 2.5 Premium UI. ES5 only, Firefox 48 (B2G) compatible. */
(function () {
'use strict';

var API = '../';
var POLL_MS = 7000;
var HIST_KEY = 'metube_lite_history';
var YTHIST_KEY = 'metube_lite_ythist';

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function enc(s) { return encodeURIComponent(String(s)); }

function showMsg(text, isError) {
  var v = $('view');
  var box = document.createElement('div');
  box.className = 'msg ' + (isError ? 'err' : 'ok');
  box.innerHTML = esc(text);
  v.insertBefore(box, v.firstChild);
  setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 2800);
}

function apiGet(path, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API + path, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var data = null;
    try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
    if (xhr.status >= 200 && xhr.status < 300 && data) cb(null, data);
    else cb((data && data.msg) || ('HTTP ' + xhr.status), data);
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
    else cb((data && data.msg) || ('HTTP ' + xhr.status), data);
  };
  xhr.send(JSON.stringify(obj));
}

function fmtCount(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
function fmtDur(s) {
  s = Number(s) || 0;
  var m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

/* Focus engine */
var Focus = {
  list: [], idx: -1, parent: null,
  setList: function (els, startIdx) {
    this.list = [];
    for (var i = 0; i < els.length; i++) this.list.push(els[i]);
    this.idx = -1;
    if (this.list.length) this.move(startIdx || 0);
  },
  move: function (n) {
    if (!this.list.length) return;
    if (n < 0) n = 0;
    if (n >= this.list.length) n = this.list.length - 1;
    for (var i = 0; i < this.list.length; i++)
      this.list[i].className = this.list[i].className.replace(/\s*focused/g, '');
    this.idx = n;
    var el = this.list[n];
    el.className += ' focused';
    if (this.parent) {
      var top = el.offsetTop, h = el.offsetHeight,
          pT = this.parent.scrollTop, pH = this.parent.clientHeight;
      if (top < pT) this.parent.scrollTop = top - 4;
      else if (top + h > pT + pH) this.parent.scrollTop = top + h - pH + 4;
    }
    if (el.focus) el.focus();
  },
  up: function () { if (this.idx > 0) this.move(this.idx - 1); },
  down: function () { if (this.idx < this.list.length - 1) this.move(this.idx + 1); },
  current: function () { return this.list[this.idx] || null; },
  clickCurrent: function () {
    var c = this.current(); if (!c) return;
    if (c.onclick) c.onclick();
    else {
      var ev = document.createEvent('MouseEvents');
      ev.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
      c.dispatchEvent(ev);
    }
  }
};

/* Player */
var Player = {
  audio: $('player'), queue: [], idx: -1, playing: false,
  init: function () {
    var self = this;
    this.audio.addEventListener('play', function () { self.playing = true; self.refreshNP(); });
    this.audio.addEventListener('pause', function () { self.playing = false; self.refreshNP(); });
    this.audio.addEventListener('ended', function () { self.next(); });
    this.audio.addEventListener('timeupdate', function () { self.updateProg(); });
    this.audio.addEventListener('loadedmetadata', function () { self.updateProg(); });
    this.audio.addEventListener('error', function () { showMsg('Playback error', true); self.playing = false; self.refreshNP(); });
  },
  load: function (track, autoplay) {
    this.queue = [track]; this.idx = 0;
    this.audio.src = track.url; this.audio.load();
    if (autoplay) this.audio.play();
    this.refreshNP(); this.showBar(true);
  },
  playAll: function (list, startAt) {
    this.queue = list.slice(); this.idx = startAt || 0;
    this.audio.src = this.queue[this.idx].url; this.audio.load();
    this.audio.play(); this.refreshNP(); this.showBar(true);
  },
  toggle: function () {
    if (!this.queue.length) return;
    if (this.audio.paused) this.audio.play(); else this.audio.pause();
  },
  next: function () {
    if (!this.queue.length) return;
    this.idx++;
    if (this.idx >= this.queue.length) { this.idx = 0; this.audio.pause(); return; }
    this.audio.src = this.queue[this.idx].url; this.audio.load(); this.audio.play(); this.refreshNP();
  },
  current: function () { return this.queue[this.idx] || null; },
  showBar: function (on) {
    $('npbar').style.display = on ? 'block' : 'none';
    $('npprog').style.display = on ? 'block' : 'none';
    $('view').className = 'view' + (on ? ' with-np' : '');
  },
  refreshNP: function () {
    var t = this.current();
    $('npTitle').innerHTML = t ? esc(t.title) : '--';
    $('npSub').innerHTML = t ? esc(t.artist || '') : '--';
    $('npToggle').innerHTML = this.playing ? '&#10074;&#10074;' : '&#9654;';
    this.updateProg();
  },
  updateProg: function () {
    var d = this.audio.duration;
    var pct = d > 0 ? (this.audio.currentTime / d) * 100 : 0;
    $('npprogFill').style.width = pct + '%';
  }
};

/* Tabs */
var TABS = [
  { id: 'add', label: 'Add', render: renderAdd },
  { id: 'search', label: 'Search', render: renderSearch },
  { id: 'yt', label: 'YTMusic', render: renderYT },
  { id: 'library', label: 'Library', render: renderLibrary },
  { id: 'trending', label: 'Trend', render: renderTrending },
  { id: 'downloads', label: 'DLs', render: renderDownloads },
  { id: 'player', label: 'Playing', render: renderPlayer }
];
var currentTab = 0;

function renderTabs() {
  var tb = $('tabbar'); tb.innerHTML = '';
  for (var i = 0; i < TABS.length; i++) {
    var a = document.createElement('a');
    a.className = 'tab' + (i === currentTab ? ' on' : '');
    a.innerHTML = esc(TABS[i].label);
    a.href = '#';
    (function (idx) { a.onclick = function (e) { if (e) e.preventDefault(); switchTab(idx); return false; }; })(i);
    tb.appendChild(a);
  }
}
function switchTab(idx) {
  if (idx < 0) idx = TABS.length - 1;
  if (idx >= TABS.length) idx = 0;
  currentTab = idx; renderTabs();
  var v = $('view'); v.innerHTML = '<p class="dim">Loading...</p>'; v.scrollTop = 0;
  Focus.setList([], 0);
  $('sbTitle').innerHTML = 'MeTube - ' + TABS[idx].label;
  TABS[idx].render();
}
function setSoftkeys(lsk, csk, rsk) {
  $('skLeft').innerHTML = lsk || 'Options';
  $('skCenter').innerHTML = csk || 'Select';
  $('skRight').innerHTML = rsk || 'Back';
}

function loadArr(key) {
  try {
    if (!window.localStorage) return [];
    var raw = localStorage.getItem(key), arr = raw ? JSON.parse(raw) : [];
    return (Object.prototype.toString.call(arr) === '[object Array]') ? arr : [];
  } catch (e) { return []; }
}
function saveArr(key, arr) {
  try { if (window.localStorage) localStorage.setItem(key, JSON.stringify(arr.slice(0, 12))); } catch (e) {}
}
function pushHist(key, q) {
  var h = loadArr(key), out = [];
  for (var i = 0; i < h.length; i++) if (h[i] !== q) out.push(h[i]);
  out.unshift(q); saveArr(key, out);
}

/* Add */
function renderAdd() {
  var v = $('view');
  v.innerHTML = '<div class="card"><h2>Add URL</h2>' +
    '<input id="addUrl" type="url" placeholder="Paste video/audio URL...">' +
    '<div class="row">' +
    '<select id="addType"><option value="video">Video</option><option value="audio" selected>Audio</option></select>' +
    '<select id="addQuality"><option value="best">Best</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option><option value="360">360p</option></select>' +
    '<select id="addFmt"></select></div>' +
    '<div class="row"><button class="primary" id="addBtn">Download</button></div></div>';
  var t = $('addType'), q = $('addQuality'), f = $('addFmt');
  function syncFmt() {
    var audio = t.value === 'audio';
    q.style.display = audio ? 'none' : 'inline-block';
    var opts = audio
      ? [['mp3','MP3'],['m4a','M4A'],['opus','Opus'],['wav','WAV'],['flac','FLAC']]
      : [['any','Any'],['mp4','MP4']];
    f.innerHTML = '';
    for (var i = 0; i < opts.length; i++) {
      var o = document.createElement('option'); o.value = opts[i][0]; o.innerHTML = opts[i][1]; f.appendChild(o);
    }
  }
  syncFmt(); t.onchange = syncFmt;
  $('addBtn').onclick = function () {
    var url = $('addUrl').value.trim();
    if (!url) { showMsg('Enter a URL first', true); return; }
    var isAudio = t.value === 'audio';
    var body = { url: url, download_type: t.value, codec: 'auto',
      quality: isAudio ? 'best' : q.value, format: f.value, auto_start: true };
    apiPost('add', body, function (err, data) {
      if (err || (data && data.status === 'error')) showMsg('Error: ' + (err || data.msg), true);
      else { showMsg(data.msg || 'Added to queue', false); $('addUrl').value=''; refreshDownloadsOnce(); }
    });
  };
  var focusable = v.getElementsByTagName('input'), f2 = v.getElementsByTagName('select'),
      f3 = v.getElementsByTagName('button'), list = [];
  for (var i = 0; i < focusable.length; i++) list.push(focusable[i]);
  for (var i = 0; i < f2.length; i++) list.push(f2[i]);
  for (var i = 0; i < f3.length; i++) list.push(f3[i]);
  Focus.parent = v; Focus.setList(list, 0); setSoftkeys('', 'OK', '');
}

/* Search */
var searchType = 'video';
function renderSearch() {
  var v = $('view');
  v.innerHTML = '<div class="card"><h2>Search YouTube</h2>' +
    '<input id="q" type="search" placeholder="Search videos...">' +
    '<div class="row">' +
    '<button class="pick" data-t="video">Videos</button>' +
    '<button class="pick" data-t="channel">Channels</button>' +
    '<button class="pick" data-t="playlist">Playlists</button>' +
    '<button class="primary" id="searchBtn">Go</button></div>' +
    '<div class="chip-row" id="history"></div></div>' +
    '<ul class="list" id="results"><li class="dim">Type a query to search</li></ul>';
  renderHistChips(loadArr(HIST_KEY));
  var picks = v.getElementsByClassName('pick');
  for (var i = 0; i < picks.length; i++) {
    if (picks[i].getAttribute('data-t') === searchType) picks[i].className += ' on';
    (function (btn) { btn.onclick = function () {
      searchType = btn.getAttribute('data-t');
      for (var j = 0; j < picks.length; j++)
        picks[j].className = 'pick' + (picks[j].getAttribute('data-t') === searchType ? ' on' : '');
    }; })(picks[i]);
  }
  $('searchBtn').onclick = doSearch;
  $('q').onkeydown = function (ev) { var kc = ev.keyCode || ev.which; if (kc === 13) { doSearch(); return false; } };
  var inputs = v.getElementsByTagName('input'), list = [];
  for (var a = 0; a < inputs.length; a++) list.push(inputs[a]);
  for (var a = 0; a < picks.length; a++) list.push(picks[a]);
  list.push($('searchBtn'));
  Focus.parent = v; Focus.setList(list, 0); setSoftkeys('', 'Search', '');
}
function renderHistChips(h) {
  var box = $('history'); if (!box) return;
  if (!h.length) { box.innerHTML = ''; return; }
  var html = '';
  for (var i = 0; i < h.length; i++)
    html += '<button class="chip" data-q="' + esc(h[i]) + '">' + esc(h[i].length > 14 ? h[i].substring(0,14)+'...' : h[i]) + '</button>';
  box.innerHTML = html;
  var cs = box.getElementsByClassName('chip');
  for (var j = 0; j < cs.length; j++)
    (function (b) { b.onclick = function () { $('q').value = b.getAttribute('data-q'); doSearch(); }; })(cs[j]);
}
function doSearch() {
  var q = $('q').value.trim();
  if (!q) return;
  $('results').innerHTML = '<li class="dim">Searching...</li>';
  apiGet('search?q=' + enc(q) + '&type=' + searchType + '&max=15', function (err, data) {
    if (err || !data || data.status === 'error') { $('results').innerHTML = '<li class="dim">Search failed</li>'; return; }
    pushHist(HIST_KEY, q); renderHistChips(loadArr(HIST_KEY));
    renderVidRows('results', data.results || []);
  });
}
function renderVidRows(boxId, list) {
  var box = $(boxId);
  if (!box) return;
  if (!list.length) { box.innerHTML = '<li class="dim">No results</li>'; Focus.setList([],0); return; }
  box.innerHTML = '';
  for (var i = 0; i < list.length; i++) {
    var r = list[i], li = document.createElement('li'); li.className = 'li li-row';
    var badge = r.is_live ? '<span class="badge live">LIVE</span>'
      : r.duration_string ? '<span class="badge">' + esc(r.duration_string) + '</span>'
      : r.video_count ? '<span class="badge">' + esc(String(r.video_count)) + '</span>' : '';
    var thumb = r.thumbnail ? '<img src="' + esc(r.thumbnail) + '" alt="">' : '<span class="noimg">IMG</span>';
    var meta = r.uploader || r.channel || r.handle || '';
    if (r.view_count) meta += ' - ' + fmtCount(r.view_count) + ' views';
    else if (r.subscriber_count) meta += ' - ' + fmtCount(r.subscriber_count) + ' subs';
    li.innerHTML = '<div class="li-thumb">' + thumb + badge + '</div>' +
      '<div class="li-body"><span class="li-title">' + esc(r.title) + '</span>' +
      '<span class="li-meta">' + esc(meta) + '</span>' +
      '<span class="li-actions">[DL] Video  [MP3] Audio</span></div><div style="clear:both"></div>';
    li.setAttribute('data-url', r.url); box.appendChild(li);
  }
  var items = box.getElementsByClassName('li'), arr = [];
  for (var k = 0; k < items.length; k++) arr.push(items[k]);
  Focus.parent = box.parentElement || $('view'); Focus.setList(arr, 0);
  for (var k = 0; k < items.length; k++)
    (function (node, url) { node.onclick = function () { quickAdd(url, 'mp3'); }; })(items[k], items[k].getAttribute('data-url'));
  setSoftkeys('Opts', 'DL MP3', 'Back');
}

/* YT Music */
var ytFilter = 'songs';
function renderYT() {
  var v = $('view');
  v.innerHTML = '<div class="card"><h2>YouTube Music</h2>' +
    '<input id="ytq" type="search" placeholder="Search songs, artists...">' +
    '<div class="row">' +
    '<button class="pick ypick" data-f="songs">Songs</button>' +
    '<button class="pick ypick" data-f="videos">Videos</button>' +
    '<button class="pick ypick" data-f="albums">Albums</button>' +
    '<button class="primary" id="ytBtn">Search</button></div>' +
    '<div class="chip-row" id="ythist"></div></div>' +
    '<ul class="list" id="ytresults"><li class="dim">Search to play or download MP3</li></ul>';
  var picks = v.getElementsByClassName('ypick');
  for (var i = 0; i < picks.length; i++) {
    if (picks[i].getAttribute('data-f') === ytFilter) picks[i].className += ' on';
    (function (btn) { btn.onclick = function () {
      ytFilter = btn.getAttribute('data-f');
      for (var j = 0; j < picks.length; j++)
        picks[j].className = 'pick ypick' + (picks[j].getAttribute('data-f') === ytFilter ? ' on' : '');
    }; })(picks[i]);
  }
  renderYtChips(loadArr(YTHIST_KEY));
  $('ytBtn').onclick = doYtSearch;
  $('ytq').onkeydown = function (ev) { var kc = ev.keyCode || ev.which; if (kc === 13) { doYtSearch(); return false; } };
  var inputs = v.getElementsByTagName('input'), list = [];
  for (var a = 0; a < inputs.length; a++) list.push(inputs[a]);
  for (var a = 0; a < picks.length; a++) list.push(picks[a]);
  list.push($('ytBtn'));
  Focus.parent = v; Focus.setList(list, 0); setSoftkeys('', 'Play', 'Back');
}
function renderYtChips(h) {
  var box = $('ythist'); if (!box) return;
  if (!h.length) { box.innerHTML=''; return; }
  var html = '';
  for (var i = 0; i < h.length; i++)
    html += '<button class="chip" data-q="' + esc(h[i]) + '">' + esc(h[i].length > 12 ? h[i].substring(0,12)+'...' : h[i]) + '</button>';
  box.innerHTML = html;
  var cs = box.getElementsByClassName('chip');
  for (var j = 0; j < cs.length; j++)
    (function (b) { b.onclick = function () { $('ytq').value = b.getAttribute('data-q'); doYtSearch(); }; })(cs[j]);
}
function doYtSearch() {
  var q = $('ytq').value.trim();
  if (!q) return;
  $('ytresults').innerHTML = '<li class="dim">Searching...</li>';
  apiGet('music/ytsearch?q=' + enc(q) + '&filter=' + enc(ytFilter) + '&limit=20', function (err, data) {
    if (err || !data || data.status === 'error') { $('ytresults').innerHTML = '<li class="dim">YT Music failed</li>'; return; }
    pushHist(YTHIST_KEY, q); renderYtChips(loadArr(YTHIST_KEY));
    renderYtRows(data.results || []);
  });
}
function renderYtRows(list) {
  var box = $('ytresults');
  if (!box) return;
  if (!list.length) { box.innerHTML = '<li class="dim">No results</li>'; Focus.setList([],0); return; }
  box.innerHTML = '';
  for (var i = 0; i < list.length; i++) {
    var r = list[i], li = document.createElement('li'); li.className = 'li li-row';
    var thumb = r.thumbnail ? '<img src="' + esc(r.thumbnail) + '" alt="">' : '<span class="noimg">YT</span>';
    var meta = r.artist || '';
    if (r.duration_string) meta += (meta ? ' - ' : '') + r.duration_string;
    if (r.is_explicit) meta += ' [E]';
    var badge = r.duration_string ? '<span class="badge">' + esc(r.duration_string) + '</span>' : '';
    li.innerHTML = '<div class="li-thumb">' + thumb + badge + '</div>' +
      '<div class="li-body"><span class="li-title">' + esc(r.title) + '</span>' +
      '<span class="li-meta">' + esc(meta) + '</span>' +
      '<span class="li-actions">[PL] Play  [DL] MP3</span></div><div style="clear:both"></div>';
    li.setAttribute('data-id', r.id); li.setAttribute('data-title', r.title);
    li.setAttribute('data-artist', r.artist || ''); li.setAttribute('data-thumb', r.thumbnail || '');
    li.setAttribute('data-rtype', r.type || 'song');
    li.setAttribute('data-url', r.url); box.appendChild(li);
  }
  var items = box.getElementsByClassName('li'), arr = [];
  for (var k = 0; k < items.length; k++) arr.push(items[k]);
  Focus.parent = box.parentElement || $('view'); Focus.setList(arr, 0);
  for (var k = 0; k < items.length; k++)
    (function (node) {
      node.onclick = function () {
        var rt = node.getAttribute('data-rtype');
        if (rt === 'song' || rt === 'video') {
          Player.load({
            id: node.getAttribute('data-id'), title: node.getAttribute('data-title'),
            artist: node.getAttribute('data-artist') || 'YouTube Music',
            url: API + 'music/ytstream/' + enc(node.getAttribute('data-id')),
            art: node.getAttribute('data-thumb')
          }, true);
          showMsg('Playing', false); switchTab(6);
        } else {
          quickAdd(node.getAttribute('data-url'), 'mp3');
        }
      };
    })(items[k]);
  setSoftkeys('DL MP3', 'Play', 'Back');
}
function quickAdd(url, kind) {
  var body = kind === 'mp3'
    ? { url: url, download_type: 'audio', codec: 'auto', quality: 'best', format: 'mp3', auto_start: true }
    : { url: url, download_type: 'video', codec: 'auto', quality: 'best', format: 'any', auto_start: true };
  apiPost('add', body, function (err, data) {
    if (err) showMsg('Error: ' + err, true); else showMsg('Added to queue', false);
  });
}

/* Library */
var libItems = [];
function renderLibrary() {
  var v = $('view');
  v.innerHTML = '<div class="card"><h2>My Music</h2>' +
    '<input id="libq" type="search" placeholder="Filter library..."></div>' +
    '<ul class="list" id="liblist"><li class="dim">Loading...</li></ul>';
  apiGet('music/library', function (err, data) {
    if (err || !data) { $('liblist').innerHTML = '<li class="dim">Failed to load</li>'; return; }
    libItems = data.items || [];
    $('libq').oninput = function () { renderLibList(this.value.toLowerCase()); };
    renderLibList('');
  });
  var inputs = v.getElementsByTagName('input'), list = [];
  for (var a = 0; a < inputs.length; a++) list.push(inputs[a]);
  Focus.parent = v; Focus.setList(list, 0); setSoftkeys('PlayAll', 'Play', 'Back');
}
function renderLibList(filter) {
  var box = $('liblist'), items = [];
  for (var i = 0; i < libItems.length; i++) {
    var it = libItems[i];
    if (!filter) { items.push(it); continue; }
    var hay = ((it.title||'') + ' ' + (it.artist||'') + ' ' + (it.album||'') + ' ' + (it.filename||'')).toLowerCase();
    if (hay.indexOf(filter) >= 0) items.push(it);
  }
  if (!items.length) { box.innerHTML = '<li class="dim">No tracks</li>'; Focus.setList([],0); return; }
  box.innerHTML = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i], li = document.createElement('li'); li.className = 'li li-row';
    var thumb = it.art_url ? '<img src="' + esc(API + it.art_url) + '" alt="">' : '<span class="noimg">&#9835;</span>';
    var meta = '';
    if (it.artist) meta += esc(it.artist);
    if (it.duration) meta += (meta ? ' - ' : '') + fmtDur(it.duration);
    li.innerHTML = '<div class="li-thumb">' + thumb + '</div>' +
      '<div class="li-body"><span class="li-title">' + esc(it.title || it.filename) + '</span>' +
      '<span class="li-meta">' + meta + '</span>' +
      '<span class="li-actions">[PL] Play  [DL] Save</span></div><div style="clear:both"></div>';
    li._it = it; li._allItems = items; box.appendChild(li);
  }
  var nodes = box.getElementsByClassName('li'), arr = [];
  for (var k = 0; k < nodes.length; k++) arr.push(nodes[k]);
  Focus.parent = box.parentElement || $('view'); Focus.setList(arr, 0);
  for (var k = 0; k < nodes.length; k++)
    (function (node) {
      node.onclick = function () {
        var tracks = [], its = node._allItems, idx = -1;
        for (var j = 0; j < its.length; j++) {
          tracks.push({ id: its[j].relpath, title: its[j].title || its[j].filename,
            artist: its[j].artist, url: its[j].url,
            art: its[j].art_url ? (API + its[j].art_url) : '' });
          if (its[j] === node._it) idx = j;
        }
        Player.playAll(tracks, idx < 0 ? 0 : idx); switchTab(6);
      };
    })(nodes[k]);
}

/* Trending */
function renderTrending() {
  var v = $('view');
  v.innerHTML = '<div class="card"><h2>Trending <button class="small" id="trendRef">Refresh</button></h2></div>' +
    '<ul class="list" id="trendlist"><li class="dim">Loading...</li></ul>';
  $('trendRef').onclick = loadTrend; loadTrend();
  Focus.parent = v; setSoftkeys('', 'DL MP3', 'Back');
}
function loadTrend() {
  $('trendlist').innerHTML = '<li class="dim">Loading...</li>';
  apiGet('trending?max=15', function (err, data) {
    if (err) { $('trendlist').innerHTML = '<li class="dim">Failed</li>'; return; }
    renderVidRows('trendlist', data.results || []);
  });
}

/* Downloads */
var autoRefresh = true, dlTimer = null;
function renderDownloads() {
  var v = $('view');
  v.innerHTML = '<div class="card"><h2>Downloads <button class="small" id="dlRef">Refresh</button> ' +
    '<label class="li-meta" style="display:inline;margin-left:6px;"><input type="checkbox" id="autoRef" checked> Auto</label></h2></div>' +
    '<div class="card"><h2>Queue</h2><ul class="list" id="qList"><li class="dim">Loading...</li></ul></div>' +
    '<div class="card"><h2>Completed</h2><ul class="list" id="dList"><li class="dim">Loading...</li></ul></div>';
  $('dlRef').onclick = refreshDownloads;
  $('autoRef').onchange = function () { autoRefresh = this.checked; schedulePoll(); };
  refreshDownloads(); schedulePoll();
  var btns = v.getElementsByTagName('button'), chks = v.getElementsByTagName('input'), list = [];
  for (var i = 0; i < btns.length; i++) list.push(btns[i]);
  for (var i = 0; i < chks.length; i++) list.push(chks[i]);
  Focus.parent = v; Focus.setList(list.length ? list : [], 0); setSoftkeys('', 'Select', 'Back');
}
function schedulePoll() {
  if (dlTimer) { clearInterval(dlTimer); dlTimer = null; }
  if (autoRefresh) dlTimer = setInterval(function () { if (currentTab === 5) refreshDownloads(); }, POLL_MS);
}
function refreshDownloadsOnce() { refreshDownloads(); }
function refreshDownloads() {
  apiGet('history', function (err, data) {
    if (err || !data) return;
    renderDlList('qList', data.queue || [], true);
    renderDlList('dList', data.done || [], false);
    $('sbCount').innerHTML = (data.queue||[]).length + '/' + (data.done||[]).length;
  });
}
function renderDlList(boxId, list, isQueue) {
  var box = $(boxId); if (!box) return;
  if (!list.length) { box.innerHTML = '<li class="dim">Empty</li>'; return; }
  box.innerHTML = '';
  for (var i = 0; i < list.length; i++) {
    var d = list[i], li = document.createElement('li'); li.className = 'li';
    var status = '';
    if (isQueue) {
      if (d.percent !== null && d.percent !== undefined && d.status === 'downloading')
        status = Math.floor(d.percent) + '%';
      else status = d.status || 'queued';
      if (d.speed) status += ' ' + fmtSpeed(d.speed);
    } else { status = d.status || ''; if (d.msg && d.status === 'error') status += ' ' + d.msg; }
    var actions = isQueue ? ' [X] Cancel'
      : d.filename ? ((d.download_type === 'audio') ? ' [PL] Play  [DL] Save' : ' [DL] Save') + '  [X] Del' : '';
    li.innerHTML = '<span class="li-title">' + esc(d.title || d.url) + '</span>' +
      '<span class="li-meta">' + esc(status) + actions + '</span>';
    li.setAttribute('data-id', d.id || d.url); li.setAttribute('data-url', d.url);
    li.setAttribute('data-filename', d.filename || '');
    li.setAttribute('data-dltype', d.download_type || 'video');
    li.setAttribute('data-status', d.status || '');
    li.setAttribute('data-title', d.title || d.url);
    box.appendChild(li);
  }
  var nodes = box.getElementsByClassName('li');
  for (var k = 0; k < nodes.length; k++)
    (function (node) {
      node.onclick = function () {
        if (isQueue) {
          apiPost('delete', { where: 'queue', ids: [node.getAttribute('data-id') || node.getAttribute('data-url')] },
            function () { refreshDownloads(); });
          showMsg('Cancelled', false);
        } else {
          var fn = node.getAttribute('data-filename'), dt = node.getAttribute('data-dltype'), st = node.getAttribute('data-status');
          if (fn && dt === 'audio' && st === 'finished') {
            Player.load({
              id: node.getAttribute('data-id') || fn,
              title: node.getAttribute('data-title'),
              url: API + 'audio_download/' + enc(fn), artist: ''
            }, true);
            switchTab(6);
          } else if (fn && st === 'finished') {
            window.location.href = API + 'download/' + enc(fn);
          } else {
            apiPost('delete', { where: 'done', ids: [node.getAttribute('data-id') || node.getAttribute('data-url')] },
              function () { refreshDownloads(); });
          }
        }
      };
    })(nodes[k]);
}
function fmtSpeed(bps) {
  if (!bps) return '';
  if (bps >= 1048576) return (bps/1048576).toFixed(1) + 'MB/s';
  if (bps >= 1024) return (bps/1024).toFixed(0) + 'KB/s';
  return bps + 'B/s';
}

/* Player detail */
var playerTick = null;
function renderPlayer() {
  var v = $('view');
  v.innerHTML = '<div class="player-screen">' +
    '<div class="player-art" id="pArt"><div class="noart">&#9835;</div></div>' +
    '<div class="player-title" id="pTitle">Not playing</div>' +
    '<div class="player-artist" id="pArtist">Pick a song</div>' +
    '<div class="player-time" id="pTime">0:00 / 0:00</div>' +
    '<input type="range" class="player-seek" id="pSeek" min="0" max="100" value="0">' +
    '<div class="player-controls">' +
    '<button id="pPrev">&#9664;&#9664;</button>' +
    '<button class="bigplay" id="pPlay">&#9654;</button>' +
    '<button id="pNext">&#9654;&#9654;</button></div>' +
    '<p class="dim" style="margin-top:12px;">Queue: <span id="pqLen">0</span></p></div>';
  function upd() {
    if (currentTab !== 6) { if (playerTick) { clearInterval(playerTick); playerTick = null; } return; }
    var ct = Player.current();
    $('pTitle').innerHTML = ct ? esc(ct.title) : 'Not playing';
    $('pArtist').innerHTML = ct ? esc(ct.artist || '') : 'Pick a song';
    $('pPlay').innerHTML = Player.playing ? '&#10074;&#10074;' : '&#9654;';
    var d = Player.audio.duration, c = Player.audio.currentTime;
    $('pTime').innerHTML = fmtDur(c) + ' / ' + (d ? fmtDur(d) : '0:00');
    if (d) { $('pSeek').value = (c / d) * 100; $('pSeek').max = 100; }
    $('pqLen').innerHTML = String(Player.queue.length);
    var art = $('pArt');
    if (ct && (ct.art || ct.art_url)) {
      var src = ct.art || ct.art_url;
      if (art.firstChild && art.firstChild.tagName === 'IMG' && art.firstChild.src === src) {}
      else art.innerHTML = '<img src="' + esc(src) + '" alt="" onerror="this.parentNode.innerHTML=\'<div class=&quot;noart\">&#9835;</div>\'">';
    } else if (!art.firstChild || art.firstChild.className !== 'noart') {
      art.innerHTML = '<div class="noart">&#9835;</div>';
    }
  }
  upd();
  if (playerTick) clearInterval(playerTick);
  playerTick = setInterval(upd, 500);
  $('pPlay').onclick = function () { Player.toggle(); upd(); };
  $('pNext').onclick = function () { Player.next(); upd(); };
  $('pPrev').onclick = function () { Player.audio.currentTime = 0; upd(); };
  $('pSeek').onchange = function () {
    var d = Player.audio.duration;
    if (d) Player.audio.currentTime = (Number(this.value) / 100) * d;
  };
  var btns = v.getElementsByTagName('button'), list = [];
  for (var i = 0; i < btns.length; i++) list.push(btns[i]);
  list.push($('pSeek'));
  Focus.parent = v; Focus.setList(list, 1);
  setSoftkeys('', Player.playing ? 'Pause' : 'Play', 'Back');
}

/* Key navigation */
function handleKey(e) {
  var kc = e.keyCode || e.which, prevent = true;
  if (kc === 49) { switchTab(0); return; }        // 1 Add
  if (kc === 50) { switchTab(1); return; }        // 2 Search
  if (kc === 51) { switchTab(2); return; }        // 3 YTMusic
  if (kc === 52) { switchTab(3); return; }        // 4 Library
  if (kc === 53) { switchTab(6); return; }        // 5 Player
  if (kc === 55) { switchTab(4); return; }        // 7 Trending
  if (kc === 56) { switchTab(5); return; }        // 8 DLs
  if (kc === 48) { Player.toggle(); return; }     // 0 play/pause

  if (kc === 38) { Focus.up(); }
  else if (kc === 40) { Focus.down(); }
  else if (kc === 37) { switchTab(currentTab - 1); }
  else if (kc === 39) { switchTab(currentTab + 1); }
  else if (kc === 13) { var cur = Focus.current(); if (cur) Focus.clickCurrent(); else if (currentTab === 6) Player.toggle(); }
  else if (kc === 8 || kc === 27) { if (currentTab !== 0) switchTab(0); }
  else if (kc === 35) { Player.next(); }
  else if (kc === 36) { Player.audio.currentTime = 0; }
  else if (kc === 32) { Player.toggle(); }
  else { prevent = false; }

  if (prevent) { if (e.preventDefault) e.preventDefault(); return false; }
}

function wireNP() {
  $('npToggle').onclick = function (e) { if (e) e.stopPropagation(); Player.toggle(); };
  $('npNext').onclick = function (e) { if (e) e.stopPropagation(); Player.next(); };
  $('npbar').onclick = function (e) { if (e) e.stopPropagation(); switchTab(6); };
}

function init() {
  Player.init(); wireNP();
  renderTabs(); switchTab(0);
  document.addEventListener('keydown', handleKey, false);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
