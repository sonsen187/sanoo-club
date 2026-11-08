const express = require('express');
const ProfanityFilter = require('./public/js/profanity-filter.js');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { analyzeAudioFile } = require('./scripts/audio_analyzer');
const WebSocket = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load playlist
let playlist = [];
try {
  const playlistData = fs.readFileSync(path.join(__dirname, 'public/assets/playlist.json'), 'utf8');
  playlist = JSON.parse(playlistData);
} catch (e) {
  console.error('Failed to load playlist.json:', e);
}

// In-memory Game State
const state = {
  currentTrackIndex: 0,
  isPlaying: true,
  volume: 0.8,
  bpm: 128,
  topGifters: {}, // username -> { username, nickname, avatar, coins, giftsCount }
  dancers: {}, // id/username -> { id, username, nickname, avatar, charType, x, y, score, lastActive }
  tiktokConnection: {
    status: 'disconnected', // 'connected' | 'connecting' | 'disconnected' | 'error'
    username: '',
    roomInfo: null,
    error: null
  },
  stats: {
    totalCoins: 0,
    totalGifts: 0,
    totalLikes: 0,
    activeDancers: 0
  },
  autoSimulator: {
    status: 'off', // 'off' | 'slow' | 'medium' | 'fast'
    sentCount: 0,
    enableChat: true,
    enableLikes: true,
    enableGifts: true
  },
  settings: {
    maxDancers: 60,
    transparentBg: false,
    autoJoinOnChat: true,
    autoJoinOnGift: true,
    autoLeaveInactive60s: true,
    chatBubbleDuration: 5000,
    effectsDuration: 4000,
    characterTheme: 'cats', // 100% Cats on dance floor (Only DJ is human)
    audioMode: 'glass_room' // 'glass_room' | 'main_floor' | 'outside_door'
  }
};

// WebSocket broadcast helper
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg, err => {
        if (err) console.warn('WS send error:', err.message);
      });
    }
  });
}

// Top Gifters List sorted descending
function getTopGiftersList(limit = 5) {
  return Object.values(state.topGifters)
    .sort((a, b) => b.coins - a.coins)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// LOCAL STORAGE & PERSISTENCE FOR LEADERBOARD (BXH TOP ĐẠI GIA)
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const TOP_GIFTERS_FILE = path.join(DATA_DIR, 'top_gifters.json');

function loadTopGiftersFromDisk() {
  try {
    if (fs.existsSync(TOP_GIFTERS_FILE)) {
      const raw = fs.readFileSync(TOP_GIFTERS_FILE, 'utf8');
      const saved = JSON.parse(raw);
      if (saved && typeof saved.topGifters === 'object') {
        state.topGifters = saved.topGifters;
        if (typeof saved.totalCoins === 'number') state.stats.totalCoins = saved.totalCoins;
        if (typeof saved.totalGifts === 'number') state.stats.totalGifts = saved.totalGifts;
        console.log(`[Storage] Restored ${Object.keys(state.topGifters).length} top gifters from local storage file.`);
      }
    }
  } catch (err) {
    console.error('[Storage] Error reading top_gifters.json:', err.message);
  }
}

function saveTopGiftersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const dataToSave = {
      updatedAt: new Date().toISOString(),
      totalCoins: state.stats.totalCoins,
      totalGifts: state.stats.totalGifts,
      topGifters: state.topGifters
    };
    fs.writeFileSync(TOP_GIFTERS_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (err) {
    console.error('[Storage] Error saving top_gifters.json:', err.message);
  }
}

// Restore top gifters on server initialization
loadTopGiftersFromDisk();

// ---------------------------------------------------------------------------
// YOUTUBE AUDIO DOWNLOADER & PLAYLIST INTEGRATION
// ---------------------------------------------------------------------------
const YT_DIR = path.join(__dirname, 'public', 'assets', 'music', 'youtube');
const YT_TRACKS_FILE = path.join(DATA_DIR, 'youtube_tracks.json');

if (!fs.existsSync(YT_DIR)) {
  fs.mkdirSync(YT_DIR, { recursive: true });
}

function loadCustomYouTubeTracks() {
  try {
    if (fs.existsSync(YT_TRACKS_FILE)) {
      const raw = fs.readFileSync(YT_TRACKS_FILE, 'utf8');
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        saved.forEach(item => {
          if (!playlist.some(t => t.youtubeId === item.youtubeId || t.url === item.url)) {
            item.id = playlist.length + 1;
            playlist.push(item);
          }
        });
        console.log(`[YouTube] Loaded ${saved.length} custom YouTube tracks into playlist.`);
      }
    }
  } catch (err) {
    console.error('[YouTube] Error reading youtube_tracks.json:', err.message);
  }
}

function saveCustomYouTubeTracks() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const ytTracks = playlist.filter(t => t.isYouTube);
    fs.writeFileSync(YT_TRACKS_FILE, JSON.stringify(ytTracks, null, 2), 'utf8');
  } catch (err) {
    console.error('[YouTube] Error saving youtube_tracks.json:', err.message);
  }
}

function downloadYouTubeTrack(url) {
  return new Promise((resolve, reject) => {
    const pyScript = path.join(__dirname, 'scripts', 'download_youtube.py');
    const proc = spawn('python', ['-X', 'utf8', pyScript, url, YT_DIR], {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8'
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
    proc.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });

    proc.on('close', code => {
      // Search lines backwards for valid JSON result
      let parsedData = null;
      const combined = stdout.trim() + '\n' + stderr.trim();
      const lines = combined.split(/\r?\n/);
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const data = JSON.parse(line);
            if (data && typeof data.success === 'boolean') {
              parsedData = data;
              break;
            }
          } catch (_) {}
        }
      }

      if (parsedData) {
        if (parsedData.success) {
          return resolve(parsedData);
        }
        if (parsedData.error) {
          return reject(new Error(parsedData.error));
        }
      }

      if (code !== 0) {
        const fallbackMsg = (stderr || stdout || 'Lỗi khi tải bài hát từ YouTube').trim();
        return reject(new Error(fallbackMsg));
      }
      reject(new Error('Dữ liệu YouTube trả về không hợp lệ: ' + stdout));
    });
  });
}

loadCustomYouTubeTracks();


// Helper to robustly extract TikTok Avatar from various live event structures
function extractTikTokAvatar(event) {
  if (!event) return '';
  if (typeof event.profilePictureUrl === 'string' && event.profilePictureUrl.trim()) return event.profilePictureUrl.trim();
  if (event.userDetails) {
    if (Array.isArray(event.userDetails.profilePictureUrls) && event.userDetails.profilePictureUrls[0]) {
      return event.userDetails.profilePictureUrls[0].trim();
    }
    if (typeof event.userDetails.profilePictureUrl === 'string' && event.userDetails.profilePictureUrl.trim()) {
      return event.userDetails.profilePictureUrl.trim();
    }
  }
  if (event.user && typeof event.user.profilePictureUrl === 'string' && event.user.profilePictureUrl.trim()) {
    return event.user.profilePictureUrl.trim();
  }
  if (typeof event.avatar === 'string' && event.avatar.trim()) return event.avatar.trim();
  return '';
}

// Add or update a dancer on the floor
function addOrUpdateDancer(user) {
  const username = user.username || user.uniqueId || `guest_${Math.floor(Math.random() * 9000 + 1000)}`;
  const nickname = user.nickname || username;
  const avatar = extractTikTokAvatar(user);

  // 🐱 ALL DANCERS ARE 100% CATS (Only DJ is human)
  const charCategory = 'cat';
  let charType = user.charType || Math.floor(Math.random() * 3) + 1;
  let danceStyle = user.danceStyle || Math.floor(Math.random() * 3) + 1;
  if (!state.dancers[username]) {
    // Enforce max dancers limit: evict least recently active non-VIP dancer if floor is full
    const dancerKeys = Object.keys(state.dancers);
    const maxDancers = state.settings.maxDancers || 60;
    if (dancerKeys.length >= maxDancers) {
      const top3Users = new Set(getTopGiftersList(3).map(g => g.username));
      const candidates = dancerKeys.filter(k => !top3Users.has(k));
      if (candidates.length > 0) {
        candidates.sort((a, b) => (state.dancers[a].lastActive || 0) - (state.dancers[b].lastActive || 0));
        const toRemove = candidates[0];
        delete state.dancers[toRemove];
        broadcast('remove_dancer', { username: toRemove, id: toRemove });
      }
    }

    // New dancer: spawn position
    state.dancers[username] = {
      id: username,
      username,
      nickname,
      avatar,
      charCategory: 'cat',
      charType,
      danceStyle: danceStyle || 1,
      x: 0.15 + Math.random() * 0.7, // normalized 0..1
      y: 0.59 + Math.random() * 0.28, // lower dance floor close to podiums
      score: 0,
      joinedAt: Date.now(),
      lastActive: Date.now()
    };
  } else {
    state.dancers[username].lastActive = Date.now();
    if (user.charCategory) state.dancers[username].charCategory = user.charCategory;
    if (user.gender) state.dancers[username].gender = user.gender;
    if (user.charType) state.dancers[username].charType = user.charType;
    if (user.danceStyle) state.dancers[username].danceStyle = user.danceStyle;
  }

  state.stats.activeDancers = Object.keys(state.dancers).length;
  broadcast('dancer_update', state.dancers[username]);
  return state.dancers[username];
}

// Auto-clean dancers who left live or have been inactive for > 60s
setInterval(() => {
  if (!state.settings || !state.settings.autoLeaveInactive60s) return;
  const now = Date.now();
  const timeoutMs = 60 * 1000;
  const top3Users = new Set(getTopGiftersList(3).map(g => g.username));

  const toRemove = [];
  for (const [id, dancer] of Object.entries(state.dancers)) {
    if (top3Users.has(id)) continue; // Keep VIPs on podiums
    const lastActive = dancer.lastActive || dancer.joinedAt || 0;
    if (now - lastActive > timeoutMs) {
      toRemove.push(id);
    }
  }

  if (toRemove.length > 0) {
    toRemove.forEach(id => {
      delete state.dancers[id];
      broadcast('remove_dancer', { username: id, id });
    });
    state.stats.activeDancers = Object.keys(state.dancers).length;
    broadcast('crowd_count', { count: state.stats.activeDancers });
  }
}, 3000);

// Process incoming gift
function processGift(giftEvent) {
  const username = giftEvent.uniqueId || giftEvent.username || 'Anonymous';
  const nickname = giftEvent.nickname || username;
  const avatar = extractTikTokAvatar(giftEvent);
  const giftName = giftEvent.giftName || 'Gift';
  const giftPictureUrl = giftEvent.giftPictureUrl || 
                         (giftEvent.giftDetails && giftEvent.giftDetails.giftImage) || 
                         giftEvent.giftImage || 
                         giftEvent.giftUrl || '';
  const repeatCount = giftEvent.repeatCount || 1;
  const diamondCount = (giftEvent.diamondCount || 1) * repeatCount;

  // Update gifter stats (always preserve or update real TikTok avatar)
  if (!state.topGifters[username]) {
    state.topGifters[username] = {
      username,
      nickname,
      avatar,
      coins: 0,
      giftsCount: 0
    };
  } else {
    state.topGifters[username].nickname = nickname;
    if (avatar) state.topGifters[username].avatar = avatar;
  }
  state.topGifters[username].coins += diamondCount;
  state.topGifters[username].giftsCount += repeatCount;
  state.stats.totalCoins += diamondCount;
  state.stats.totalGifts += repeatCount;
  saveTopGiftersToDisk();

  // Add/ensure dancer is on floor
  if (state.settings.autoJoinOnGift) {
    addOrUpdateDancer({ username, nickname, avatar });
  }

  // Trigger FX according to gift value
  let fxType = 'cheer';
  if (diamondCount >= 1000) {
    fxType = 'mega_rave'; // Full fire, laser, fireworks, rave mode
    broadcast('trigger_effect', { effect: 'rave', triggerBy: nickname });
    broadcast('trigger_effect', { effect: 'airhorn', triggerBy: nickname });
  } else if (diamondCount >= 100) {
    fxType = 'fireworks';
    broadcast('trigger_effect', { effect: 'fireworks', triggerBy: nickname });
    broadcast('trigger_effect', { effect: 'airhorn', triggerBy: nickname });
  } else if (diamondCount >= 30) {
    fxType = 'flame';
    broadcast('trigger_effect', { effect: 'flame', triggerBy: nickname });
  } else if (diamondCount >= 10) {
    fxType = 'smoke';
    broadcast('trigger_effect', { effect: 'smoke', triggerBy: nickname });
  } else if (diamondCount >= 5) {
    fxType = 'confetti';
    broadcast('trigger_effect', { effect: 'confetti', triggerBy: nickname });
  } else {
    fxType = 'sparkles';
  }

  const payload = {
    username,
    nickname,
    avatar,
    giftName,
    giftPictureUrl,
    repeatCount,
    diamondCount,
    fxType,
    topGifters: getTopGiftersList(5)
  };

  broadcast('gift', payload);
  broadcast('top_gifters', getTopGiftersList(5));
}

// Process chat command / message
function processChat(chatEvent) {
  const username = chatEvent.uniqueId || chatEvent.username || 'User';
  const nickname = chatEvent.nickname || username;
  const avatar = chatEvent.profilePictureUrl || chatEvent.avatar || '';
  const comment = (chatEvent.comment || '').trim();

  if (state.settings.autoJoinOnChat) {
    addOrUpdateDancer({ username, nickname, avatar });
  }

  // Command parsing
  const lower = comment.toLowerCase();

  // 1. Gia nhập sàn nhảy: Chat "1" (hoặc !join)
  if (lower === '1' || lower === '!join' || lower === 'join') {
    addOrUpdateDancer({ username, nickname, avatar });
    broadcast('chat_command', { username, command: 'join', message: `${nickname} đã gia nhập sàn nhảy!` });
  }
  // 2. Chọn Mèo & Vũ đạo cá nhân: !1 / !meo1, !2 / !meo2, !3 / !meo3
  else if (lower === '!1' || lower === '!meo1' || lower === '!dance 1') {
    addOrUpdateDancer({ username, nickname, avatar, charCategory: 'cat', charType: 1, danceStyle: 1 });
    broadcast('chat_command', { username, command: 'avatar_change', message: `${nickname} chọn Mèo Đen Rave Que Sáng 🐱⚡!` });
  }
  else if (lower === '!2' || lower === '!meo2' || lower === '!dance 2') {
    addOrUpdateDancer({ username, nickname, avatar, charCategory: 'cat', charType: 2, danceStyle: 2 });
    broadcast('chat_command', { username, command: 'avatar_change', message: `${nickname} chọn Mèo Vàng Shuffle 🐱👟!` });
  }
  else if (lower === '!3' || lower === '!meo3' || lower === '!dance 3') {
    addOrUpdateDancer({ username, nickname, avatar, charCategory: 'cat', charType: 3, danceStyle: 3 });
    broadcast('chat_command', { username, command: 'avatar_change', message: `${nickname} chọn Mèo Xám Hands Up 🐱🚀!` });
  }

    if (state.dancers[username]) state.dancers[username].lastActive = Date.now();

  // Broadcast chat message for dancer speech bubble & overlay chat log
  broadcast('chat', {
    username,
    nickname,
    avatar,
    comment
  });
}

// TikTok Live Connector Instance
let tiktokLiveConnection = null;

function connectTikTok(username) {
  if (tiktokLiveConnection) {
    try {
      tiktokLiveConnection.disconnect();
    } catch (e) {}
    tiktokLiveConnection = null;
  }

  const cleanUser = username.replace(/^@/, '').trim();
  if (!cleanUser) return;

  state.tiktokConnection.status = 'connecting';
  state.tiktokConnection.username = cleanUser;
  state.tiktokConnection.error = null;
  broadcast('tiktok_status', state.tiktokConnection);

  tiktokLiveConnection = new WebcastPushConnection(cleanUser, {
    enableExtendedGiftInfo: true
  });

  tiktokLiveConnection.connect().then(roomState => {
    state.tiktokConnection.status = 'connected';
    state.tiktokConnection.roomInfo = {
      roomId: roomState.roomId,
      title: roomState.title,
      roomUserCount: roomState.roomUserCount
    };
    broadcast('tiktok_status', state.tiktokConnection);
    console.log(`[TikTok] Connected to @${cleanUser}`);
  }).catch(err => {
    state.tiktokConnection.status = 'error';
    state.tiktokConnection.error = err.message || 'Lỗi kết nối TikTok Live';
    broadcast('tiktok_status', state.tiktokConnection);
    console.error(`[TikTok] Connection error:`, err);
  });

  // Listen to TikTok events
  tiktokLiveConnection.on('chat', data => {
    processChat(data);
  });

  tiktokLiveConnection.on('gift', data => {
    // Only process finished gift combos or non-streakable gifts
    if (data.giftType === 1 && !data.repeatEnd) {
      // Streak in progress, optionally broadcast streak
      return;
    }
    processGift(data);
  });

  tiktokLiveConnection.on('like', data => {
    state.stats.totalLikes += (data.likeCount || 1);
    broadcast('like', {
      username: data.uniqueId,
      nickname: data.nickname,
      likeCount: data.likeCount,
      totalLikes: state.stats.totalLikes
    });
  });

  tiktokLiveConnection.on('member', data => {
    broadcast('member_join', {
      username: data.uniqueId,
      nickname: data.nickname,
      avatar: data.profilePictureUrl
    });
  });

  tiktokLiveConnection.on('disconnected', () => {
    state.tiktokConnection.status = 'disconnected';
    broadcast('tiktok_status', state.tiktokConnection);
    console.log('[TikTok] Disconnected');
  });

  tiktokLiveConnection.on('error', err => {
    state.tiktokConnection.status = 'error';
    state.tiktokConnection.error = err.message || 'TikTok Error';
    broadcast('tiktok_status', state.tiktokConnection);
  });
}

function disconnectTikTok() {
  if (tiktokLiveConnection) {
    try {
      const res = tiktokLiveConnection.disconnect();
      if (res && typeof res.catch === 'function') res.catch(() => {});
    } catch (e) {}
    tiktokLiveConnection = null;
  }
  state.tiktokConnection.status = 'disconnected';
  broadcast('tiktok_status', state.tiktokConnection);
}

// REST Endpoints
app.get('/api/playlist', (req, res) => {
  res.json({ playlist, currentTrackIndex: state.currentTrackIndex });
});

app.get('/api/status', (req, res) => {
  res.json({
    ...state,
    topGiftersList: getTopGiftersList(5),
    currentTrack: playlist[state.currentTrackIndex] || null
  });
});

// In-Memory TTS Cache (Max 250 items)
const ttsCache = new Map();

app.get('/api/tts', (req, res) => {
  const text = (req.query.text || '').trim();
  if (!text) return res.status(400).send('Text is required');
  if (text.length > 250) return res.status(400).send('Text exceeds 250 characters');

  const cacheKey = text.toLowerCase();
  if (ttsCache.has(cacheKey)) {
    const cachedBuffer = ttsCache.get(cacheKey);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': cachedBuffer.length,
      'Cache-Control': 'public, max-age=86400'
    });
    return res.end(cachedBuffer);
  }

  const encoded = encodeURIComponent(text);
  const ttsUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=' + encoded;

  const request = https.get(ttsUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/'
    },
    timeout: 6000
  }, (ttsRes) => {
    if (ttsRes.statusCode !== 200) {
      return res.status(ttsRes.statusCode).send('Failed to fetch TTS');
    }

    const chunks = [];
    ttsRes.on('data', chunk => chunks.push(chunk));
    ttsRes.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (ttsCache.size > 250) {
        const oldest = ttsCache.keys().next().value;
        ttsCache.delete(oldest);
      }
      ttsCache.set(cacheKey, buffer);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(buffer);
    });
  });

  request.on('error', err => {
    console.error('TTS proxy error:', err.message);
    if (!res.headersSent) res.status(500).send('TTS service error');
  });

  request.on('timeout', () => {
    request.destroy();
    if (!res.headersSent) res.status(504).send('TTS service timeout');
  });
});

app.post('/api/tiktok/connect', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  connectTikTok(username);
  res.json({ success: true, status: state.tiktokConnection });
});

app.post('/api/tiktok/disconnect', (req, res) => {
  disconnectTikTok();
  res.json({ success: true, status: state.tiktokConnection });
});


// YouTube Audio Play & Add Endpoints
app.post('/api/youtube/play', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập link YouTube hợp lệ' });
  }

  try {
    const ytData = await downloadYouTubeTrack(url.trim());

    let trackIndex = playlist.findIndex(t => t.youtubeId === ytData.videoId || t.url === ytData.url);
    let track;

    if (trackIndex !== -1) {
      track = playlist[trackIndex];
      if (!track.bassProfile || track.bassProfile.length === 0) {
        try {
          const mp3AbsPath = path.join(__dirname, 'public', track.url.replace(/^\//, ''));
          const analysis = await analyzeAudioFile(mp3AbsPath);
          track.bpm = analysis.bpm;
          track.duration = analysis.duration;
          track.beatOffset = analysis.beatOffset;
          track.bassProfile = analysis.bassProfile;
          saveCustomYouTubeTracks();
        } catch (_) {}
      }
    } else {
      const mp3AbsPath = path.join(__dirname, 'public', ytData.url.replace(/^\//, ''));
      let analysis = { bpm: 128, duration: ytData.duration, beatOffset: 0, bassProfile: [] };
      try {
        console.log(`[YouTube] Running precision 110Hz sub-bass analysis for: ${ytData.title}`);
        analysis = await analyzeAudioFile(mp3AbsPath);
        console.log(`[YouTube] Detected BPM: ${analysis.bpm}, BeatOffset: ${analysis.beatOffset}s, Profile: ${analysis.bassProfile.length}s`);
      } catch (analysisErr) {
        console.warn('[YouTube Audio Analysis Warning]', analysisErr.message);
      }

      track = {
        id: playlist.length + 1,
        title: ytData.title,
        filename: ytData.filename,
        url: ytData.url,
        bpm: analysis.bpm || 128,
        duration: analysis.duration || ytData.duration,
        beatOffset: analysis.beatOffset || 0,
        bassProfile: analysis.bassProfile || [],
        isYouTube: true,
        youtubeId: ytData.videoId,
        youtubeUrl: url.trim(),
        uploader: ytData.uploader
      };
      playlist.push(track);
      trackIndex = playlist.length - 1;
      saveCustomYouTubeTracks();
      broadcast('playlist_updated', playlist);
    }

    state.currentTrackIndex = trackIndex;
    state.isPlaying = true;
    broadcast('track_change', {
      track: playlist[state.currentTrackIndex],
      index: state.currentTrackIndex,
      requestedBy: 'Admin'
    });

    res.json({ success: true, track, index: trackIndex });
  } catch (err) {
    console.error('[YouTube Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/youtube/add', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập link YouTube hợp lệ' });
  }

  try {
    const ytData = await downloadYouTubeTrack(url.trim());

    let trackIndex = playlist.findIndex(t => t.youtubeId === ytData.videoId || t.url === ytData.url);
    if (trackIndex !== -1) {
      return res.json({ success: true, alreadyExists: true, track: playlist[trackIndex], index: trackIndex });
    }

    const mp3AbsPath = path.join(__dirname, 'public', ytData.url.replace(/^\//, ''));
    let analysis = { bpm: 128, duration: ytData.duration, beatOffset: 0, bassProfile: [] };
    try {
      console.log(`[YouTube] Running precision 110Hz sub-bass analysis for: ${ytData.title}`);
      analysis = await analyzeAudioFile(mp3AbsPath);
      console.log(`[YouTube] Detected BPM: ${analysis.bpm}, BeatOffset: ${analysis.beatOffset}s, Profile: ${analysis.bassProfile.length}s`);
    } catch (analysisErr) {
      console.warn('[YouTube Audio Analysis Warning]', analysisErr.message);
    }

    const track = {
      id: playlist.length + 1,
      title: ytData.title,
      filename: ytData.filename,
      url: ytData.url,
      bpm: analysis.bpm || 128,
      duration: analysis.duration || ytData.duration,
      beatOffset: analysis.beatOffset || 0,
      bassProfile: analysis.bassProfile || [],
      isYouTube: true,
      youtubeId: ytData.videoId,
      youtubeUrl: url.trim(),
      uploader: ytData.uploader
    };
    playlist.push(track);
    saveCustomYouTubeTracks();
    broadcast('playlist_updated', playlist);

    res.json({ success: true, track, index: playlist.length - 1 });
  } catch (err) {
    console.error('[YouTube Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/api/youtube/delete', (req, res) => {
  const { id, youtubeId } = req.body;
  const trackIdx = playlist.findIndex(t => (id !== undefined && t.id === Number(id)) || (youtubeId && t.youtubeId === youtubeId));

  if (trackIdx === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy bài hát cần xóa' });
  }

  const trackToDelete = playlist[trackIdx];
  if (!trackToDelete.isYouTube) {
    return res.status(400).json({ success: false, error: 'Chỉ có thể xóa các bài hát được thêm từ YouTube' });
  }

  playlist.splice(trackIdx, 1);

  playlist.forEach((t, i) => {
    t.id = i + 1;
  });

  try {
    const filePath = path.join(__dirname, 'public', 'assets', 'music', trackToDelete.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[YouTube] Deleted audio file: ${trackToDelete.filename}`);
    }
  } catch (err) {
    console.warn('[YouTube] Could not delete file:', err.message);
  }

  saveCustomYouTubeTracks();

  if (state.currentTrackIndex === trackIdx) {
    if (playlist.length > 0) {
      state.currentTrackIndex = state.currentTrackIndex % playlist.length;
      state.isPlaying = true;
      broadcast('track_change', {
        track: playlist[state.currentTrackIndex],
        index: state.currentTrackIndex,
        requestedBy: 'System'
      });
    } else {
      state.isPlaying = false;
      broadcast('track_state', { isPlaying: false });
    }
  } else if (state.currentTrackIndex > trackIdx) {
    state.currentTrackIndex--;
  }

  broadcast('playlist_updated', playlist);
  res.json({ success: true, deletedTrack: trackToDelete, playlistCount: playlist.length });
});

app.post('/api/youtube/clear', (req, res) => {
  const toDelete = playlist.filter(t => t.isYouTube);
  playlist = playlist.filter(t => !t.isYouTube);

  playlist.forEach((t, i) => {
    t.id = i + 1;
  });

  toDelete.forEach(track => {
    try {
      const filePath = path.join(__dirname, 'public', 'assets', 'music', track.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}
  });

  saveCustomYouTubeTracks();

  if (state.currentTrackIndex >= playlist.length) {
    state.currentTrackIndex = 0;
  }
  if (playlist.length > 0) {
    broadcast('track_change', {
      track: playlist[state.currentTrackIndex],
      index: state.currentTrackIndex,
      requestedBy: 'System'
    });
  }

  broadcast('playlist_updated', playlist);
  res.json({ success: true, count: toDelete.length });
});

// WebSocket Connection Handler
wss.on('connection', ws => {
  // Send initial full game state
  ws.send(JSON.stringify({
    type: 'init_state',
    data: {
      ...state,
      playlist,
      topGiftersList: getTopGiftersList(5),
      currentTrack: playlist[state.currentTrackIndex] || null
    }
  }));

  ws.on('message', message => {
    try {
      const parsed = JSON.parse(message);
      handleClientMessage(parsed, ws);
    } catch (e) {
      console.error('Invalid WS message:', e);
    }
  });
});

function handleClientMessage(msg, ws) {
  if (!msg || typeof msg !== 'object') return;
  const { type } = msg;
  const data = msg.data || {};

  switch (type) {
    // Music Controls
    case 'track_play':
      state.isPlaying = true;
      broadcast('track_state', { isPlaying: true });
      break;
    case 'track_pause':
      state.isPlaying = false;
      broadcast('track_state', { isPlaying: false });
      break;
    case 'track_select':
      if (typeof data.index === 'number' && playlist[data.index]) {
        state.currentTrackIndex = data.index;
        state.isPlaying = true;
        broadcast('track_change', {
          track: playlist[state.currentTrackIndex],
          index: state.currentTrackIndex,
          requestedBy: data.requestedBy || 'Admin'
        });
      }
      break;
    case 'track_next':
      if (playlist.length === 0) break;
      state.currentTrackIndex = (state.currentTrackIndex + 1) % playlist.length;
      state.isPlaying = true;
      broadcast('track_change', {
        track: playlist[state.currentTrackIndex],
        index: state.currentTrackIndex,
        requestedBy: data.requestedBy || 'Admin'
      });
      break;
    case 'track_prev':
      if (playlist.length === 0) break;
      state.currentTrackIndex = (state.currentTrackIndex - 1 + playlist.length) % playlist.length;
      state.isPlaying = true;
      broadcast('track_change', {
        track: playlist[state.currentTrackIndex],
        index: state.currentTrackIndex,
        requestedBy: data.requestedBy || 'Admin'
      });
      break;
    case 'track_volume':
      if (typeof data.volume === 'number') {
        state.volume = Math.max(0, Math.min(1, data.volume));
        broadcast('volume_change', { volume: state.volume });
      }
      break;

    // Trigger Stage Effects
    case 'trigger_effect':
      broadcast('trigger_effect', {
        effect: data.effect, // 'flame' | 'smoke' | 'fireworks' | 'laser' | 'rave' | 'confetti' | 'airhorn' | 'scratch'
        triggerBy: data.triggerBy || 'Admin'
      });
      break;

    // Simulation from Admin
    case 'simulate_gift':
      processGift({
        uniqueId: data.username || 'Test_VIP',
        nickname: data.nickname || data.username || 'VIP Quẩy',
        avatar: data.avatar || '',
        giftName: data.giftName || 'Hoa hồng',
        giftPictureUrl: data.giftPictureUrl || '',
        repeatCount: data.repeatCount || 1,
        diamondCount: data.diamondCount || 1
      });
      break;

    case 'simulate_chat':
      processChat({
        uniqueId: data.username || 'Tester',
        nickname: data.nickname || data.username || 'Tester',
        avatar: data.avatar || '',
        comment: data.comment || 'Quẩy lên nào anh em ơi!'
      });
      break;

    case 'simulate_vip':
      const vRank = data.rank || 1;
      const vipPresets = {
        1: { name: 'Đại_Gia_Top1', giftName: 'Sư Tử Vàng VIP 🦁', coins: 29999 },
        2: { name: 'Thiếu_Gia_Top2', giftName: 'Du Thuyền Hoàng Gia 🛥️', coins: 9999 },
        3: { name: 'Công_Tử_Top3', giftName: 'Siêu Xe Thể Thao 🏎️', coins: 2999 }
      };
      const vPreset = vipPresets[vRank] || vipPresets[1];
      const vipUser = data.username || vPreset.name;
      processGift({
        uniqueId: vipUser,
        nickname: vipUser,
        avatar: '',
        giftName: data.giftName || vPreset.giftName,
        repeatCount: 1,
        diamondCount: data.coins || vPreset.coins
      });
      break;

    case 'spawn_crowd':
      const count = data.count || 10;
      const sampleNames = ['Tuấn_DJ', 'Linh_Cute', 'Bảo_Bass', 'Hương_Dance', 'Minh_Rave', 'Trang_Club', 'Đức_Vip', 'Phương_Baby', 'Huy_Beat', 'Mai_Quẩy', 'Khánh_EDM', 'Hà_Quẩy', 'Nam_Bass', 'My_Dance', 'Sơn_Rave', 'Trâm_Beat'];
      
      for (let i = 0; i < count; i++) {
        const id = `bot_${Math.floor(Math.random() * 90000 + 10000)}`;
        const nick = sampleNames[Math.floor(Math.random() * sampleNames.length)] + '_' + Math.floor(Math.random() * 100);
        
        // 100% Cat Dancers (Mèo 1: Đen, Mèo 2: Vàng, Mèo 3: Xám)
        const charType = data.charType ? parseInt(data.charType, 10) : ((i % 3) + 1);
        const danceStyle = data.danceStyle ? parseInt(data.danceStyle, 10) : charType;

        addOrUpdateDancer({
          username: id,
          nickname: nick,
          charCategory: 'cat',
          charType,
          danceStyle
        });
      }
      break;

    case 'shuffle_dances':
      // Đổi vũ đạo ngẫu nhiên cho toàn bộ dancer trên sàn
      Object.values(state.dancers).forEach((d, idx) => {
        d.danceStyle = (idx % 3) + 1;
        d.charType = (idx % 3) + 1;
      });
      broadcast('dancers_sync', state.dancers);
      break;

    case 'set_dance_style':
      // Gán 1 vũ đạo cụ thể cho toàn sàn (1, 2, hoặc 3)
      const targetStyle = data.style || 1;
      Object.values(state.dancers).forEach(d => {
        d.danceStyle = targetStyle;
        d.charType = targetStyle;
      });
      broadcast('dancers_sync', state.dancers);
      break;

    case 'audio_mode':
    case 'set_audio_mode':
      state.settings.audioMode = data.mode || msg.mode || 'glass_room';
      broadcast('audio_mode_changed', { mode: state.settings.audioMode });
      break;

    case 'tts_speak':
      broadcast('tts_speak', data);
      break;
    case 'tts_hype':
      broadcast('tts_hype', data);
      break;
    case 'tts_config':
      state.settings.tts = state.settings.tts || {};
      Object.assign(state.settings.tts, data);
      broadcast('tts_config', data);
      break;

    case 'clear_dancers':
      state.dancers = {};
      state.stats.activeDancers = 0;
      broadcast('dancers_cleared', {});
      break;

    case 'reset_live_session':
    case 'reset_top_gifters':
      state.topGifters = {};
      state.stats.totalCoins = 0;
      state.stats.totalGifts = 0;
      for (const id of Object.keys(state.dancers)) {
        if (id.includes('Đại_Gia') || id.includes('Thiếu_Gia') || id.includes('Công_Tử') || id.startsWith('vip_')) {
          delete state.dancers[id];
        } else {
          state.dancers[id].score = 0;
          state.dancers[id].vipRank = 0;
        }
      }
      state.stats.activeDancers = Object.keys(state.dancers).length;
      saveTopGiftersToDisk();
      broadcast('top_gifters', []);
      broadcast('dancers_sync', state.dancers);
      broadcast('live_session_reset', { timestamp: Date.now() });
      console.log('[Live Session] Leaderboard & VIP Podiums reset. Local storage cleared.');
      break;

    // Auto Interaction & Comment Simulator
    case 'set_auto_sim':
      if (data.speed !== undefined) {
        if (data.enableChat !== undefined) state.autoSimulator.enableChat = !!data.enableChat;
        if (data.enableLikes !== undefined) state.autoSimulator.enableLikes = !!data.enableLikes;
        if (data.enableGifts !== undefined) state.autoSimulator.enableGifts = !!data.enableGifts;
        startAutoSimulator(data.speed);
      }
      break;

    case 'update_settings':
      const prevTheme = state.settings.characterTheme;
      state.settings = { ...state.settings, ...data };

      // If character theme changed, immediately update all existing dancers on the floor!
      if (data.characterTheme && data.characterTheme !== prevTheme) {
        Object.values(state.dancers).forEach(d => {
          if (data.characterTheme === 'cats') {
            d.charCategory = 'cat';
            if (!d.charType) d.charType = Math.floor(Math.random() * 3) + 1;
          } else if (data.characterTheme === 'humans') {
            d.charCategory = 'cat';
            if (!d.gender) d.gender = Math.random() < 0.5 ? 'male' : 'female';
          } else if (data.characterTheme === 'all') {
            const r = Math.random();
            if (r < 0.35) {
              d.charCategory = 'cat';
              if (!d.charType) d.charType = Math.floor(Math.random() * 3) + 1;
            } else {
              d.charCategory = 'human';
              d.gender = r < 0.67 ? 'male' : 'female';
            }
          }
        });
        broadcast('dancers_sync', state.dancers);
      }

      broadcast('settings_updated', state.settings);
      break;

    default:
      console.log('Unhandled WS message type:', type);
  }
}

// =============================================================================
// AUTO INTERACTION & COMMENT SIMULATOR (3 SPEED LEVELS: SLOW, MEDIUM, FAST)
// =============================================================================
const SIMULATOR_CONFIGS = {
  off: { minInterval: 0, maxInterval: 0, label: 'TẮT' },
  slow: { minInterval: 6000, maxInterval: 10000, label: 'CHẬM (6-10s)' },   // 6s - 10s
  medium: { minInterval: 2500, maxInterval: 4500, label: 'VỪA (2.5-4.5s)' }, // 2.5s - 4.5s
  fast: { minInterval: 800, maxInterval: 1600, label: 'NHANH (0.8-1.6s)' }   // 0.8s - 1.6s
};

const AUTO_BOT_NAMES = [
  'Tuấn_Rave', 'Linh_Cute', 'Bảo_Bass', 'Hương_Dance', 'Minh_Quẩy', 'Trang_Club',
  'Đức_VIP', 'Phương_Baby', 'Huy_Beat', 'Mai_Rave', 'Khánh_EDM', 'Hà_Dance',
  'Nam_Sanoo', 'My_Cat', 'Sơn_Bass', 'Trâm_Quẩy', 'Phong_DJ', 'Lan_Ngọc',
  'Hoàng_Tử_Nhạc', 'Cô_Nàng_GenZ', 'Quẩy_Thủ_Bắc_Ninh', 'Dân_Chơi_Sài_Gòn',
  'Bé_Mèo_Đi_Bụi', 'DJ_Tài_Năng', 'Quỳnh_Anh', 'Việt_Hype', 'An_Nhiên',
  'Tiến_Dubstep', 'Yến_Nhi', 'Duy_Electronic', 'Ngọc_Trầm', 'Vinh_Techno',
  'Diệu_Linh', 'Hải_Đăng', 'Thùy_Dương', 'Hoàng_Bách', 'Thành_Remix', 'Vũ_Quẩy'
];

const AUTO_BOT_COMMENTS = [
  'Nhạc căng quá DJ Sanoo ơi 🔥🔥',
  'Bass dập rung cả tai nghe luôn 🎧',
  'Cho xin tên track này với chủ phòng!',
  'Drop dã man con ngan luôn 💣',
  'Đang nghe ở cty mà lắc lư theo =)))',
  'DJ đánh bài này cháy quá xá!',
  'Bật max volume quẩy ae ơiii 🚀',
  'Res DJ Sanoo mãi đỉnh 👑',
  'Nhạc cuốn không dứt ra được luôn á',
  'Mèo đen quẩy que sáng nhìn chiến đét 🐱⚡',
  'Mèo vàng shuffle dẻo vãi chưởng',
  '2 bé gogo dancer xinh quá trời ơi 💖',
  'Dàn mèo quẩy đồng bộ cute xỉu =)))',
  'Thích style mèo hands up quá đê',
  'Hello cả nhà yêu âm nhạc 👋',
  'Chào DJ và anh em Sanoo Club!',
  'Đã thả 50 tim cho live nha ❤️',
  'Mỗi tối đều phải vào đây nghe nhạc mới ngủ được',
  'Team quẩy đêm điểm danh nào ⚡',
  'Top 1 đại gia uy tín thế 👑',
  'Đẩy view lên nào anh em ơi 👥',
  'Quẩy sung quá bay màu mệt mỏi luôn!',
  'Đoạn drop này xuất sắc luôn idol',
  'Phòng kính bar nghe ấm và phê thật sự 🍸',
  'Ai ở Hà Nội quẩy điểm danh phát',
  'Sài Gòn đang nghe cùng DJ nhé 🌆',
  'Track này nghe nghiện thật sự ý',
  'Thả tim rụng tay luôn rồi nè ❤️❤️❤️',
  'Mèo quẩy đáng yêu số 1 TikTok 🐱',
  'Lên nóc nhà bắt con gà anh em ơiii 🚀'
];

const AUTO_BOT_COMMANDS = ['1', '2', '3'];

const AUTO_BOT_GIFTS = [
  { name: 'Hoa hồng', coins: 1, weight: 50 },
  { name: 'Trái tim', coins: 5, weight: 25 },
  { name: 'Bánh rán', coins: 30, weight: 15 },
  { name: 'Pháo hoa', coins: 100, weight: 6 },
  { name: 'Súng tiền', coins: 500, weight: 3 },
  { name: 'Siêu Xe DJ', coins: 1000, weight: 1 }
];

let autoSimTimer = null;

function startAutoSimulator(speed) {
  if (autoSimTimer) {
    clearTimeout(autoSimTimer);
    autoSimTimer = null;
  }

  if (!SIMULATOR_CONFIGS[speed] || speed === 'off') {
    state.autoSimulator.status = 'off';
    broadcast('auto_sim_update', state.autoSimulator);
    console.log('[AutoSimulator] Đã TẮT giả lập.');
    return;
  }

  state.autoSimulator.status = speed;
  broadcast('auto_sim_update', state.autoSimulator);
  console.log(`[AutoSimulator] ĐÃ BẬT giả lập ở mức: ${speed.toUpperCase()} (${SIMULATOR_CONFIGS[speed].label})`);

  scheduleNextAutoSimStep();
}

function scheduleNextAutoSimStep() {
  if (state.autoSimulator.status === 'off') return;

  const cfg = SIMULATOR_CONFIGS[state.autoSimulator.status];
  const delay = Math.floor(Math.random() * (cfg.maxInterval - cfg.minInterval + 1)) + cfg.minInterval;

  autoSimTimer = setTimeout(() => {
    runAutoSimulationStep();
    scheduleNextAutoSimStep();
  }, delay);
}

function runAutoSimulationStep() {
  if (state.autoSimulator.status === 'off') return;

  const randName = AUTO_BOT_NAMES[Math.floor(Math.random() * AUTO_BOT_NAMES.length)];
  const randNum = Math.floor(Math.random() * 900 + 100);
  const username = `${randName.toLowerCase()}_${randNum}`;
  const nickname = `${randName}_${randNum}`;

  // Decide action: Chat / Likes / Gifts
  const roll = Math.random() * 100;

  if (roll < 65 && state.autoSimulator.enableChat) {
    // 65%: Chat (Bình luận hoặc Lệnh)
    const isCommand = Math.random() < 0.45;
    let commentText;
    if (isCommand) {
      // 60% chance to join sàn ('1'), 40% chance to change style ('!1', '!2', '!3')
      commentText = Math.random() < 0.60 ? '1' : AUTO_BOT_COMMANDS[Math.floor(Math.random() * AUTO_BOT_COMMANDS.length)];
    } else {
      commentText = AUTO_BOT_COMMENTS[Math.floor(Math.random() * AUTO_BOT_COMMENTS.length)];
    }

    processChat({
      uniqueId: username,
      nickname: nickname,
      avatar: '',
      comment: commentText
    });
    state.autoSimulator.sentCount++;
  } else if (roll < 88 && state.autoSimulator.enableLikes) {
    // 23%: Like batch (Thả tim)
    const likeBatch = Math.floor(Math.random() * 25 + 5);
    state.stats.totalLikes += likeBatch;
    broadcast('like', {
      uniqueId: username,
      nickname: nickname,
      likeCount: likeBatch,
      totalLikes: state.stats.totalLikes
    });
    state.autoSimulator.sentCount++;
  } else if (state.autoSimulator.enableGifts) {
    // 12%: Gift (Tặng quà)
    const totalWeight = AUTO_BOT_GIFTS.reduce((sum, g) => sum + g.weight, 0);
    let r = Math.random() * totalWeight;
    let chosenGift = AUTO_BOT_GIFTS[0];
    for (const g of AUTO_BOT_GIFTS) {
      if (r < g.weight) {
        chosenGift = g;
        break;
      }
      r -= g.weight;
    }

    const repeat = (chosenGift.coins === 1) ? Math.floor(Math.random() * 5 + 1) : 1;
    processGift({
      uniqueId: username,
      nickname: nickname,
      avatar: '',
      giftName: chosenGift.name,
      repeatCount: repeat,
      diamondCount: chosenGift.coins
    });
    state.autoSimulator.sentCount++;
  }

  // Broadcast counter update
  if (state.autoSimulator.sentCount % 3 === 0) {
    broadcast('auto_sim_update', state.autoSimulator);
  }
}

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  DJ CLUB TIKTOK LIVE GAME SERVER STARTED!`);
  console.log(`  Overlay (9:16 for OBS / Studio): http://localhost:${PORT}/`);
  console.log(`  Admin Control Panel:             http://localhost:${PORT}/admin.html`);
  console.log(`====================================================`);
});
