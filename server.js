const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
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
  settings: {
    maxDancers: 60,
    transparentBg: false,
    autoJoinOnChat: true,
    autoJoinOnGift: true,
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

// Add or update a dancer on the floor
function addOrUpdateDancer(user) {
  const username = user.username || user.uniqueId || `guest_${Math.floor(Math.random() * 9000 + 1000)}`;
  const nickname = user.nickname || username;
  const avatar = user.avatar || user.profilePictureUrl || '';

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

// Process incoming gift
function processGift(giftEvent) {
  const username = giftEvent.uniqueId || giftEvent.username || 'Anonymous';
  const nickname = giftEvent.nickname || username;
  const avatar = giftEvent.profilePictureUrl || giftEvent.avatar || '';
  const giftName = giftEvent.giftName || 'Gift';
  const repeatCount = giftEvent.repeatCount || 1;
  const diamondCount = (giftEvent.diamondCount || 1) * repeatCount;

  // Update gifter stats
  if (!state.topGifters[username]) {
    state.topGifters[username] = {
      username,
      nickname,
      avatar,
      coins: 0,
      giftsCount: 0
    };
  }
  state.topGifters[username].coins += diamondCount;
  state.topGifters[username].giftsCount += repeatCount;
  state.stats.totalCoins += diamondCount;
  state.stats.totalGifts += repeatCount;

  // Add/ensure dancer is on floor
  if (state.settings.autoJoinOnGift) {
    addOrUpdateDancer({ username, nickname, avatar });
  }

  // Trigger FX according to gift value
  let fxType = 'cheer';
  if (diamondCount >= 1000) {
    fxType = 'mega_rave'; // Full fire, laser, fireworks, king mode
  } else if (diamondCount >= 100) {
    fxType = 'fireworks';
  } else if (diamondCount >= 30) {
    fxType = 'flame';
  } else if (diamondCount >= 10) {
    fxType = 'smoke';
  } else if (diamondCount >= 5) {
    fxType = 'confetti';
  } else {
    fxType = 'sparkles';
  }

  const payload = {
    username,
    nickname,
    avatar,
    giftName,
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

  // Join command
  if (lower === '!join' || lower === '1' || lower === '!nhay' || lower === 'join' || lower === 'nhay') {
    addOrUpdateDancer({ username, nickname, avatar });
    broadcast('chat_command', { username, command: 'join', message: `${nickname} đã gia nhập sàn nhảy!` });
  }
  // Change dance style: !dance 1 / !dance 2 / !dance 3 (hoặc !vudao 1, !style 1)
  else if (lower.startsWith('!dance') || lower.startsWith('!vudao') || lower.startsWith('!style') || lower.startsWith('!nv')) {
    const parts = lower.split(/\s+/);
    const styleId = parseInt(parts[1], 10);
    if ([1, 2, 3].includes(styleId)) {
      addOrUpdateDancer({ username, nickname, avatar, charType: styleId, danceStyle: styleId });
      const styleNames = {
        1: 'Rave Wave Quơ Que Sáng ⚡',
        2: 'Shuffle Dance Giậm Chân & Lắc Hông 👟',
        3: 'Hands Up Hai Tay Giơ Cao & Nhảy Bật 🚀'
      };
      broadcast('chat_command', {
        username,
        command: 'dance_change',
        charType: styleId,
        danceStyle: styleId,
        message: `${nickname} đổi vũ đạo ${styleId}: ${styleNames[styleId] || ''}!`
      });
    }
  }
  // Specific Cat selections: !cat1 / !meo1, !cat2 / !meo2, !cat3 / !meo3
  else if (lower === '!cat1' || lower === '!meo1') {
    addOrUpdateDancer({ username, nickname, avatar, charCategory: 'cat', charType: 1, danceStyle: 1 });
    broadcast('chat_command', { username, command: 'avatar_change', message: `${nickname} chọn Mèo Đen Rave Que Sáng 🐱⚡!` });
  }
  else if (lower === '!cat2' || lower === '!meo2') {
    addOrUpdateDancer({ username, nickname, avatar, charCategory: 'cat', charType: 2, danceStyle: 2 });
    broadcast('chat_command', { username, command: 'avatar_change', message: `${nickname} chọn Mèo Vàng Shuffle 🐱👟!` });
  }
  else if (lower === '!cat3' || lower === '!meo3') {
    addOrUpdateDancer({ username, nickname, avatar, charCategory: 'cat', charType: 3, danceStyle: 3 });
    broadcast('chat_command', { username, command: 'avatar_change', message: `${nickname} chọn Mèo Xám Hands Up 🐱🚀!` });
  }
  // Random Cat: !cat / !meo
  else if (lower === '!cat' || lower === '!meo') {
    const cType = Math.floor(Math.random() * 3) + 1;
    addOrUpdateDancer({ username, nickname, avatar, charCategory: 'cat', charType: cType, danceStyle: cType });
    broadcast('chat_command', { username, command: 'avatar_change', message: `${nickname} đổi loại Mèo quẩy 🐱!` });
  }
  // Human legacy commands inform that dancers are all cats
  else if (lower === '!male' || lower === '!nam' || lower === '!boy' || lower === '!female' || lower === '!nu' || lower === '!girl') {
    const cType = Math.floor(Math.random() * 3) + 1;
    addOrUpdateDancer({ username, nickname, avatar, charCategory: 'cat', charType: cType, danceStyle: cType });
    broadcast('chat_command', { username, command: 'avatar_change', message: `${nickname}: Toàn sàn đang dùng đội hình Mèo DJ Quẩy Cực Sung 🐱!` });
  }
  // Request song: !song <index or name>
  else if (lower.startsWith('!song') || lower.startsWith('!diembai') || lower.startsWith('!bai')) {
    if (playlist.length > 0) {
      const spaceIdx = comment.indexOf(' ');
      if (spaceIdx !== -1) {
        const query = comment.substring(spaceIdx + 1).trim();
        if (query) {
          let targetIndex = -1;
          const parsedNum = parseInt(query, 10);
          if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= playlist.length) {
            targetIndex = parsedNum - 1;
          } else {
            targetIndex = playlist.findIndex(p => p.title.toLowerCase().includes(query.toLowerCase()));
          }

          if (targetIndex !== -1) {
            state.currentTrackIndex = targetIndex;
            state.isPlaying = true;
            broadcast('track_change', {
              track: playlist[targetIndex],
              index: targetIndex,
              requestedBy: nickname
            });
          }
        }
      }
    }
  }
  // Skip track: !skip
  else if (lower === '!skip' || lower === '!next' || lower === 'chuyenbai') {
    if (playlist.length > 0) {
      state.currentTrackIndex = (state.currentTrackIndex + 1) % playlist.length;
      broadcast('track_change', {
        track: playlist[state.currentTrackIndex],
        index: state.currentTrackIndex,
        requestedBy: nickname
      });
    }
  }
  // Effect & Sound commands
  else if (lower === '!fire' || lower === '!lua') {
    broadcast('trigger_effect', { effect: 'flame', triggerBy: nickname });
  } else if (lower === '!smoke' || lower === '!khoi') {
    broadcast('trigger_effect', { effect: 'smoke', triggerBy: nickname });
  } else if (lower === '!rave' || lower === '!quay' || lower === '!all') {
    broadcast('trigger_effect', { effect: 'rave', triggerBy: nickname });
  } else if (lower === '!laser') {
    broadcast('trigger_effect', { effect: 'laser', triggerBy: nickname });
  } else if (lower === '!phao' || lower === '!firework' || lower === '!fireworks') {
    broadcast('trigger_effect', { effect: 'fireworks', triggerBy: nickname });
  } else if (lower === '!confetti' || lower === '!phaogiay') {
    broadcast('trigger_effect', { effect: 'confetti', triggerBy: nickname });
  } else if (lower === '!horn' || lower === '!coi') {
    broadcast('trigger_effect', { effect: 'airhorn', triggerBy: nickname });
  } else if (lower === '!scratch') {
    broadcast('trigger_effect', { effect: 'scratch', triggerBy: nickname });
  } else if (lower === '!siren') {
    broadcast('trigger_effect', { effect: 'siren', triggerBy: nickname });
  } else if (lower === '!bass' || lower === '!sub') {
    broadcast('trigger_effect', { effect: 'bassdrop', triggerBy: nickname });
  } else if (lower === '!cheer' || lower === '!ho') {
    broadcast('trigger_effect', { effect: 'cheer', triggerBy: nickname });
  }

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

    case 'clear_dancers':
      state.dancers = {};
      state.stats.activeDancers = 0;
      broadcast('dancers_cleared', {});
      break;

    case 'reset_top_gifters':
      state.topGifters = {};
      state.stats.totalCoins = 0;
      state.stats.totalGifts = 0;
      broadcast('top_gifters', []);
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

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  DJ CLUB TIKTOK LIVE GAME SERVER STARTED!`);
  console.log(`  Overlay (9:16 for OBS / Studio): http://localhost:${PORT}/`);
  console.log(`  Admin Control Panel:             http://localhost:${PORT}/admin.html`);
  console.log(`====================================================`);
});
