# yt-dlp বাংলা চিট-শিট 🎬

**Video • Audio/MP3 • Playlist** — দরকারি সব কমান্ড এক জায়গায়।

> ⚖️ নোট: শুধু নিজের ভিডিও, কপিরাইট-মুক্ত বা অনুমতিপ্রাপ্ত কনটেন্ট ডাউনলোড করুন।

---

## 1️⃣ ভিডিও ডাউনলোড

```bash
# সবচেয়ে ভালো কোয়ালিটি (স্বয়ংক্রিয়ভাবে ভিডিও+অডিও জোড়া লাগে*)
yt-dlp "VIDEO_URL"

# Full HD 1080p পর্যন্ত (ফাইল সাইজ একটু কম চাইলে)
yt-dlp -f "bv*[height<=1080]+ba/b[height<=1080]" "VIDEO_URL"

# HD 720p (মোবাইল/কম ডেটার জন্য ভালো)
yt-dlp -f "bv*[height<=720]+ba/b[height<=720]" "VIDEO_URL"

# MP4 ফরম্যাটে বাধ্য করা (প্লেয়ারে চালানোর জন্য সুবিধা)
yt-dlp -f "bv*+ba/b" --merge-output-format mp4 "VIDEO_URL"
```

> ℹ️ `*` জোড়া লাগাতে (merge) PC-তে **ffmpeg** লাগে। ffmpeg ছাড়া 720p-এর বেশি অনেক সময় আলাদা ফাইল নামে।

### কোয়ালিটি তালিকা দেখে বেছে নেওয়া

```bash
# কী কী কোয়ালিটি/ফরম্যাট আছে দেখুন
yt-dlp -F "VIDEO_URL"

# তারপর ID দিয়ে ডাউনলোড (উদাহরণ: 22 = 720p mp4)
yt-dlp -f 22 "VIDEO_URL"

# ভিডিও ID + অডিও ID আলাদা করে জোড়া (উদাহরণ)
yt-dlp -f "137+140" "VIDEO_URL"
```

---

## 2️⃣ অডিও / MP3 ডাউনলোড 🎵

```bash
# MP3 গান (সেরা কোয়ালিটি)
yt-dlp -x --audio-format mp3 --audio-quality 0 "VIDEO_URL"

# ছোট সাইজের MP3 (128k, পডকাস্ট/লেকচারের জন্য যথেষ্ট)
yt-dlp -x --audio-format mp3 --audio-quality 128K "VIDEO_URL"

# কনভার্ট ছাড়া সেরা অডিও (দ্রুত, m4a/opus যেটা পাওয়া যায়)
yt-dlp -f "ba" -x "VIDEO_URL"

# গানের তথ্য (title/artist) + থাম্বনেইল অডিওতে ঢুকিয়ে নেওয়া
yt-dlp -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata "VIDEO_URL"
```

---

## 3️⃣ প্লেলিস্ট / চ্যানেল ডাউনলোড 📚

```bash
# পুরো প্লেলিস্ট (প্রতিটা ভিডিও সুন্দর নামে সাজিয়ে)
yt-dlp --yes-playlist -o "%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s" "PLAYLIST_URL"

# প্লেলিস্টের প্রথম 10টা ভিডিও
yt-dlp --yes-playlist --playlist-end 10 "PLAYLIST_URL"

# 5 নম্বর থেকে 15 নম্বর ভিডিও
yt-dlp --yes-playlist --playlist-start 5 --playlist-end 15 "PLAYLIST_URL"

# পুরো চ্যানেলের সব ভিডিও
yt-dlp "https://www.youtube.com/@CHANNELNAME/videos"

# ⚠️ প্লেলিস্টের লিংক থেকে শুধু ১টা ভিডিও চাইলে
yt-dlp --no-playlist "VIDEO_URL"
```

### প্লেলিস্ট MP3 (গানের অ্যালবাম/ওয়াজ/লেকচার সিরিজ)

```bash
yt-dlp --yes-playlist -x --audio-format mp3 --audio-quality 0 \
  -o "%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s" "PLAYLIST_URL"
```

### ডাউনলোড হিসাব রাখা (আবার চালালে নতুনগুলোই শুধু নামবে)

```bash
yt-dlp --yes-playlist --download-archive downloaded.txt "PLAYLIST_URL"
```

---

## 4️⃣ দরকারি অপশন ⭐

```bash
# বাংলা+ইংরেজি সাবটাইটেলসহ ডাউনলোড
yt-dlp --write-subs --sub-langs "bn,en" --embed-subs "VIDEO_URL"

# থাম্বনেইল ছবিটাও সেভ করা
yt-dlp --write-thumbnail "VIDEO_URL"

# Sponsor অংশ (বিজ্ঞাপন) কেটে ফেলা
yt-dlp --sponsorblock-remove all "VIDEO_URL"

# ফাইলের নাম নিজের মতো (উদাহরণ)
yt-dlp -o "%(title)s.%(ext)s" "VIDEO_URL"

# Facebook / Instagram / TikTok পাবলিক ভিডিও (একই নিয়ম!)
yt-dlp "FB_VIDEO_URL"
```

### Private / Age-restricted / Login লাগে এমন ভিডিও

```bash
# PC-র Chrome ব্রাউজারের login ব্যবহার করা
yt-dlp --cookies-from-browser chrome "VIDEO_URL"
```

---

## 5️⃣ ইনস্টল ছাড়া ওয়েব থেকে ব্যবহার 🌐 (আপনার জন্য!)

yt-dlp মূলত কমান্ড-লাইনের টুল, ব্রাউজারে সরাসরি চলে না। তবে ইনস্টল ছাড়া উপায় আছে:

| উপায় | বিবরণ |
|---|---|
| **cobalt.tools** | ব্রাউজারে লিংক পেস্ট → ডাউনলোড। সবচেয়ে সহজ, ইনস্টল লাগে না ✅ |
| **নিজের ওয়েব UI (MeTube / yt-dlp Web UI)** | নিজের PC/সার্ভারে চালিয়ে ফোন+PC দুটো থেকেই ব্যবহার করা যায় |
| **এই চ্যাটেই ওয়েব UI বানিয়ে নেওয়া** | আমি আপনার জন্য এখানে একটা সহজ ডাউনলোডার পেজ বানিয়ে দিতে পারি — লিংক পেস্ট → Video/Audio বাছাই → Download 🚀 |

> ⚠️ সতর্কতা: গুগলে পাওয়া র‍্যান্ডম "YouTube to MP3" সাইটে নকল Download বাটন, পপ-আপ ও ম্যালওয়্যার থাকে। অপরিচিত সাইটে ক্লিক করার আগে সাবধান!

---

## 🆘 সমস্যা হলে

```bash
# yt-dlp আপডেট করা (বেশিরভাগ এরর এতেই ঠিক হয়!)
yt-dlp -U

# কী সমস্যা হচ্ছে বিস্তারিত দেখা
yt-dlp -v "VIDEO_URL"
```

**সবচেয়ে কমন এরর:** `Sign in to confirm you're not a bot` — এর মানে YouTube বট-চেক চাইছে। সমাধান: `--cookies-from-browser chrome` ব্যবহার করুন, অথবা cobalt.tools-এর মতো ওয়েব উপায়ে চেষ্টা করুন।

---

*আরও কিছু জানতে চাইলে শুধু জিজ্ঞেস করুন — যেমন "ফেসবুক রিলস কিভাবে নামাবো?" বা "৪কে ভিডিও কিভাবে নামাবো?" 🙂*

---

## 6️⃣ MeTube — ব্রাউজার থেকে yt-dlp 🌐 (সবচেয়ে সহজ!)

**MeTube** হলো yt-dlp-এর ওয়েব UI — কোনো কমান্ড ছাড়াই ব্রাউজারে লিংক পেস্ট করে ডাউনলোড!

### নিজের PC-তে চালানো (Docker দিয়ে — মাত্র ১ লাইন!)

```bash
docker run -d -p 8081:8081 -v /path/to/downloads:/downloads ghcr.io/alexta69/metube
```

তারপর ব্রাউজারে খুলুন: **http://localhost:8081**

### কীভাবে ব্যবহার করবেন

1. ভিডিও/প্লেলিস্টের লিংক পেস্ট করুন (YouTube / Facebook / TikTok / Instagram...)
2. **Video / Audio / Playlist** বেছে নিন + কোয়ালিটি ঠিক করুন
3. **Add** চাপুন — শেষ হলে ডাউনলোড লিংক পাবেন! ⬇️

### 🔍 অ্যাপের ভেতরেই YouTube সার্চ (নতুন ফিচার!)

VidMate/SnapTube-এর মতো MeTube-তেই সরাসরি সার্চ করা যায়:

1. হোমপেজে **Search YouTube** বক্সে লিখুন (যেমন: `lofi music`)
2. ট্যাব বেছে নিন: **Videos | Channels | Playlists**
3. থাম্বনেইল + ভিউ/সাবস্ক্রাইবার দেখে **Download** চাপুন — বর্তমান সেটিংস (কোয়ালিটি/ফরম্যাট) অনুযায়ী ডাউনলোড শুরু হবে! ⬇️

> 💡 টিপ: কোনো চ্যানেলের সব ভিডিও চাইলে Channels ট্যাব থেকে চ্যানেলে Download চাপুন।

### YouTube "Sign in to confirm you're not a bot" এলে 🤖

1. ব্রাউজারে কুকি-এক্সপোর্টার এক্সটেনশন ইনস্টল করুন ([Firefox](https://addons.mozilla.org/en-US/firefox/addon/export-cookies-txt/) / [Chrome](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc))
2. youtube.com-এর কুকি `cookies.txt` হিসেবে সেভ করুন
3. MeTube-তে **Advanced Options → Upload Cookies** দিয়ে ফাইলটা আপলোড করুন ✅

### Cloudflare 403 / "anti-bot challenge" এলে 🛡️

কিছু সাইট yt-dlp-কে বট ভেবে আটকে দেয় (`Got HTTP Error 403 caused by Cloudflare anti-bot challenge`)। সমাধান — Chrome ব্রাউজারের মতো করে রিকোয়েস্ট পাঠানো:

```bash
# MeTube (Docker) — environment variable হিসেবে দিন:
-e 'YTDL_OPTIONS={"impersonate":"chrome"}'
```

```bash
# কমান্ড-লাইনে সরাসরি:
yt-dlp --impersonate chrome "URL"
```

### দরকারি ফিচার

- 📚 প্লেলিস্ট/চ্যানেল + 🔔 **Subscribe** (নতুন ভিডিও এলে অটো-ডাউনলোড!)
- 🎵 Audio-only (MP3/M4A/Opus/WAV/FLAC), 📝 সাবটাইটেল, 🖼️ থাম্বনেইল
- 📱 ফোন থেকে ব্যবহার: Android-এ [MeTube Mobile](https://github.com/sagheerys/metube-mobile) অ্যাপ, iPhone-এ শেয়ার-মেনু শর্টকাট

---

## 7️⃣ Pro ফিচার + পুরনো ব্রাউজার সাপোর্ট 🌟

### 🔥 Trending / 🕘 Recent / 🎵 MP3
- **Trending ট্যাব**: YouTube-এর ট্রেন্ডিং ভিডিও সরাসরি অ্যাপে দেখে ডাউনলোড
- **Recent**: আগের সার্চগুলো এক ক্লিকে আবার চালানো যায় (ব্রাউজারে সেভ থাকে)
- **MP3 বাটন**: প্রতিটা রেজাল্টে এক-ক্লিকে MP3 ডাউনলোড

### 🦊 Firefox 48-এর জন্য Lite UI
পুরনো ব্রাউজারে (যেমন Firefox 48) মূল পেজ খুললেই **স্বয়ংক্রিয়ভাবে** Lite UI-তে (`/lite`) নিয়ে যাবে। মাত্র ~16KB, কোনো ফ্রেমওয়ার্ক ছাড়া খাঁটি JavaScript — সার্চ + Trending + ডাউনলোড + queue ম্যানেজমেন্ট সব চলে!
