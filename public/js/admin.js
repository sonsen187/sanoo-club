// DJ Club Admin Dashboard Logic
(function () {
  'use strict';

  let ws = null;
  let playlist = [];
  let currentTrackIndex = 0;
  let isPlaying = false;

  // Sound effects instance for Admin preview
  const sfx = new DJSoundEffects();
  window.addEventListener('click', () => sfx.resume(), { once: true });

  // DOM Elements
  const tiktokStatusBadge = document.getElementById('tiktok-status-badge');
  const tiktokUserInput = document.getElementById('tiktok-username-input');
  const btnConnectTikTok = document.getElementById('btn-connect-tiktok');
  const btnDisconnectTikTok = document.getElementById('btn-disconnect-tiktok');

  const nowPlayingAdminText = document.getElementById('now-playing-admin-text');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const volumeSlider = document.getElementById('volume-slider');
  const musicSearchInput = document.getElementById('music-search-input');
  const playlistBody = document.getElementById('playlist-body');

  // WebSocket Connection
  function setupWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
      console.log('Admin WebSocket connected');
    };

    ws.onmessage = evt => {
      try {
        const msg = JSON.parse(evt.data);
        handleWsMessage(msg);
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    ws.onclose = () => {
      console.warn('WS disconnected, reconnecting in 2s...');
      setTimeout(setupWebSocket, 2000);
    };
  }

  function sendWS(type, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  }

  function handleWsMessage(msg) {
    const { type, data } = msg;

    switch (type) {
      case 'init_state':
        playlist = data.playlist || [];
        currentTrackIndex = data.currentTrackIndex || 0;
        isPlaying = data.isPlaying || false;
        renderPlaylist(playlist);
        updatePlaybackUI(data.currentTrack, isPlaying);
        updateTikTokStatus(data.tiktokConnection);
        if (data.settings) {
          const bgCheck = document.getElementById('chk-transparent-bg');
          if (bgCheck) bgCheck.checked = !!data.settings.transparentBg;
          if (data.settings.characterTheme) updateCharThemeUI(data.settings.characterTheme);
          if (data.settings.audioMode) updateAudioModeAdminUI(data.settings.audioMode);
        }
        break;

      case 'settings_updated':
        if (data.characterTheme) updateCharThemeUI(data.characterTheme);
        if (data.transparentBg !== undefined) {
          const bg = document.getElementById('chk-transparent-bg');
          if (bg) bg.checked = !!data.transparentBg;
        }
        break;

      case 'audio_mode_changed':
        if (data && data.mode) {
          updateAudioModeAdminUI(data.mode);
        }
        break;

      case 'tiktok_status':
        updateTikTokStatus(data);
        break;

      case 'track_change':
        currentTrackIndex = data.index;
        isPlaying = true;
        updatePlaybackUI(data.track, true);
        highlightActiveRow(currentTrackIndex);
        break;

      case 'track_state':
        isPlaying = data.isPlaying;
        updatePlayPauseButton(isPlaying);
        break;

      case 'volume_change':
        if (volumeSlider) volumeSlider.value = data.volume * 100;
        break;
    }
  }

  function updateTikTokStatus(conn) {
    if (!conn || !tiktokStatusBadge) return;
    tiktokStatusBadge.className = `status-badge ${conn.status}`;

    if (conn.status === 'connected') {
      tiktokStatusBadge.textContent = `🟢 Đã kết nối (@${conn.username})`;
      btnConnectTikTok.style.display = 'none';
      btnDisconnectTikTok.style.display = 'inline-flex';
    } else if (conn.status === 'connecting') {
      tiktokStatusBadge.textContent = `🟡 Đang kết nối...`;
    } else if (conn.status === 'error') {
      tiktokStatusBadge.textContent = `🔴 Lỗi: ${conn.error || 'Thất bại'}`;
      btnConnectTikTok.style.display = 'inline-flex';
      btnDisconnectTikTok.style.display = 'none';
    } else {
      tiktokStatusBadge.textContent = `⚪ Chưa kết nối`;
      btnConnectTikTok.style.display = 'inline-flex';
      btnDisconnectTikTok.style.display = 'none';
    }
  }

  function renderPlaylist(tracks) {
    if (!playlistBody) return;
    playlistBody.innerHTML = '';

    tracks.forEach((track, i) => {
      const tr = document.createElement('tr');
      tr.id = `track-row-${track.id - 1}`;
      if (track.id - 1 === currentTrackIndex) tr.className = 'active';

      const bpmBadge = track.bpm ? `<span style="display:inline-block; margin-left: 8px; background: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: bold;">${track.bpm} BPM</span>` : '';
      tr.innerHTML = `
        <td style="width: 50px;">#${track.id}</td>
        <td>${track.title} ${bpmBadge}</td>
        <td style="width: 80px; text-align: right;">
          <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11px;">▶ Phát</button>
        </td>
      `;

      tr.addEventListener('click', () => {
        sendWS('track_select', { index: track.id - 1, requestedBy: 'Admin' });
      });

      playlistBody.appendChild(tr);
    });
  }

  function highlightActiveRow(idx) {
    if (!playlistBody) return;
    const rows = playlistBody.querySelectorAll('tr');
    rows.forEach(r => r.classList.remove('active'));
    const activeRow = document.getElementById(`track-row-${idx}`);
    if (activeRow) {
      activeRow.classList.add('active');
      activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function updatePlaybackUI(track, playing) {
    if (nowPlayingAdminText && track) {
      const bpmInfo = track.bpm ? ` [${track.bpm} BPM]` : '';
      nowPlayingAdminText.textContent = `#${track.id}. ${track.title}${bpmInfo}`;
    }
    updatePlayPauseButton(playing);
  }

  function updatePlayPauseButton(playing) {
    if (!btnPlayPause) return;
    btnPlayPause.textContent = playing ? '⏸ Tạm dừng' : '▶ Tiếp tục';
  }

  // Event Listeners: TikTok Connect
  if (btnConnectTikTok) {
    btnConnectTikTok.addEventListener('click', () => {
      const user = (tiktokUserInput.value || '').trim();
      if (!user) {
        alert('Vui lòng nhập TikTok username!');
        return;
      }
      fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user })
      });
    });
  }

  if (btnDisconnectTikTok) {
    btnDisconnectTikTok.addEventListener('click', () => {
      fetch('/api/tiktok/disconnect', { method: 'POST' });
    });
  }

  // Music Player Events
  if (btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
      if (isPlaying) {
        sendWS('track_pause');
      } else {
        sendWS('track_play');
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => sendWS('track_prev'));
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => sendWS('track_next'));
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', e => {
      sendWS('track_volume', { volume: e.target.value / 100 });
    });
  }

  // Playlist Search Filter
  if (musicSearchInput) {
    musicSearchInput.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = playlist.filter(t => t.title.toLowerCase().includes(q) || t.id.toString().includes(q));
      renderPlaylist(filtered);
    });
  }

  // Stage FX Buttons
  document.querySelectorAll('[data-effect]').forEach(btn => {
    btn.addEventListener('click', () => {
      const effect = btn.getAttribute('data-effect');
      sendWS('trigger_effect', { effect, triggerBy: 'Admin' });
    });
  });

  // DJ Sound Effect Buttons (Preview in Admin too!)
  document.querySelectorAll('[data-sfx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sound = btn.getAttribute('data-sfx');
      sfx.init();
      if (sound === 'airhorn') sfx.playAirhorn();
      else if (sound === 'scratch') sfx.playScratch();
      else if (sound === 'siren') sfx.playSiren();
      else if (sound === 'bassdrop') sfx.playBassDrop();
      else if (sound === 'cheer') sfx.playCheer();

      // Broadcast to overlay stream as well
      sendWS('trigger_effect', { effect: sound, triggerBy: 'Admin' });
    });
  });

  // Simulation Gift Buttons
  document.querySelectorAll('[data-sim-gift]').forEach(btn => {
    btn.addEventListener('click', () => {
      const giftName = btn.getAttribute('data-sim-gift');
      const coins = parseInt(btn.getAttribute('data-coins'), 10) || 1;
      const sampleSenders = ['Đại_Gia_99', 'Hải_Quay_Xe', 'Bé_Mèo', 'Hoàng_Tử_DJ', 'Trùm_TikTok'];
      const sender = sampleSenders[Math.floor(Math.random() * sampleSenders.length)];

      sendWS('simulate_gift', {
        username: sender,
        nickname: sender,
        giftName,
        repeatCount: 1,
        diamondCount: coins
      });
    });
  });

  // Custom Gift Form
  const btnSendCustomGift = document.getElementById('btn-send-custom-gift');
  if (btnSendCustomGift) {
    btnSendCustomGift.addEventListener('click', () => {
      const u = document.getElementById('sim-gift-user').value || 'Đại_Gia';
      const g = document.getElementById('sim-gift-name').value || 'Quà đặc biệt';
      const c = parseInt(document.getElementById('sim-gift-coins').value, 10) || 10;
      sendWS('simulate_gift', {
        username: u,
        nickname: u,
        giftName: g,
        repeatCount: 1,
        diamondCount: c
      });
    });
  }

  // Custom Chat Form
  const btnSendCustomChat = document.getElementById('btn-send-custom-chat');
  const simChatComment = document.getElementById('sim-chat-comment');
  if (btnSendCustomChat) {
    btnSendCustomChat.addEventListener('click', () => {
      const u = document.getElementById('sim-chat-user').value || 'Viewer';
      const msg = simChatComment.value.trim() || 'Quẩy lên nào!';
      sendWS('simulate_chat', {
        username: u,
        nickname: u,
        comment: msg
      });
      simChatComment.value = '';
    });
  }

  // Quick Command buttons (1, !join, !song 5, etc.)
  document.querySelectorAll('[data-quick-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-quick-cmd');
      const sampleUsers = ['DJ_Linh', 'Quang_Club', 'Vũ_Beat', 'Thảo_Dance', 'Khánh_Rave'];
      const u = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
      sendWS('simulate_chat', {
        username: u,
        nickname: u,
        comment: cmd
      });
    });
  });

  // Character Theme UI Update
  function updateCharThemeUI(theme) {
    const badge = document.getElementById('char-theme-badge');
    if (badge) {
      if (theme === 'cats') {
        badge.textContent = '🐱 Mèo (Cats)';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = '#f59e0b';
      } else if (theme === 'all') {
        badge.textContent = '🌟 Hỗn Hợp (Mixed)';
        badge.style.color = '#a855f7';
        badge.style.borderColor = '#a855f7';
      } else {
        badge.textContent = '🧑‍🎤 Người (Nam & Nữ)';
        badge.style.color = '#38bdf8';
        badge.style.borderColor = '#38bdf8';
      }
    }

    document.querySelectorAll('[data-char-theme]').forEach(btn => {
      if (btn.getAttribute('data-char-theme') === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Character Theme Button Clicks
  document.querySelectorAll('[data-char-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-char-theme');
      updateCharThemeUI(theme);
      sendWS('update_settings', { characterTheme: theme });
    });
  });

  // Crowd Spawn Buttons (supports count, gender, category)
  document.querySelectorAll('[data-spawn-crowd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const count = parseInt(btn.getAttribute('data-spawn-crowd'), 10);
      const gender = btn.getAttribute('data-gender') || undefined;
      const category = btn.getAttribute('data-category') || undefined;
      sendWS('spawn_crowd', { count, gender, category });
    });
  });

  const btnClearFloor = document.getElementById('btn-clear-floor');
  if (btnClearFloor) {
    btnClearFloor.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn xóa tất cả vũ công khỏi sàn nhảy?')) {
        sendWS('clear_dancers');
      }
    });
  }

  // Toast Notification for Admin Actions
  function showToast(message) {
    let container = document.getElementById('admin-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'admin-toast-container';
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.style.cssText = 'background:linear-gradient(90deg,#00f0ff,#ff007f);color:#060914;font-weight:700;font-size:13px;padding:10px 18px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.5);opacity:0;transform:translateY(10px);transition:all 0.3s ease;';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (toast.parentNode === container) container.removeChild(toast);
      }, 300);
    }, 2500);
  }

  // Shuffle & Set Dance Styles for the whole floor
  const btnShuffleDances = document.getElementById('btn-shuffle-dances');
  if (btnShuffleDances) {
    btnShuffleDances.addEventListener('click', () => {
      sendWS('shuffle_dances');
      showToast('Đã trộn ngẫu nhiên 3 vũ đạo phong phú cho toàn bộ vũ công!');
    });
  }

  document.querySelectorAll('.btn-set-dance').forEach(btn => {
    btn.addEventListener('click', () => {
      const styleId = parseInt(btn.dataset.dance, 10);
      sendWS('set_dance_style', { style: styleId });
      const names = {
        1: 'Vũ đạo 1: Rave Wave (Quơ Que Sáng)',
        2: 'Vũ đạo 2: Shuffle Dance (Giậm Chân & Lắc Hông)',
        3: 'Vũ đạo 3: Hands Up (Hai Tay Giơ Cao & Nhảy Bật)'
      };
      showToast(`Toàn sàn đã chuyển sang: ${names[styleId] || styleId}`);
    });
  });

  const btnResetVIP = document.getElementById('btn-reset-vip');
  if (btnResetVIP) {
    btnResetVIP.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn đặt lại Bảng Xếp Hạng Đại Gia?')) {
        sendWS('reset_top_gifters');
      }
    });
  }

  // Transparent BG setting
  const chkTransparentBg = document.getElementById('chk-transparent-bg');
  if (chkTransparentBg) {
    chkTransparentBg.addEventListener('change', e => {
      sendWS('update_settings', { transparentBg: e.target.checked });
    });
  }

  // Copy OBS URL Button
  const btnCopyObsUrl = document.getElementById('btn-copy-obs-url');
  if (btnCopyObsUrl) {
    btnCopyObsUrl.addEventListener('click', () => {
      const url = `${location.protocol}//${location.host}/`;
      navigator.clipboard.writeText(url).then(() => {
        btnCopyObsUrl.textContent = '✅ Đã sao chép!';
        setTimeout(() => { btnCopyObsUrl.textContent = '📋 Sao chép Link Overlay (OBS)'; }, 2000);
      });
    });
  }

  
  // ---------------------------------------------------------------------------
  // BAR ACOUSTIC AUDIO MODE CONTROLS
  // ---------------------------------------------------------------------------
  function updateAudioModeAdminUI(mode) {
    document.querySelectorAll('[data-audio-mode]').forEach(btn => {
      if (btn.getAttribute('data-audio-mode') === mode) {
        btn.classList.add('active-audio-mode');
      } else {
        btn.classList.remove('active-audio-mode');
      }
    });
  }

  document.querySelectorAll('[data-audio-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-audio-mode');
      updateAudioModeAdminUI(mode);
      sendWS('set_audio_mode', { mode });
    });
  });

  setupWebSocket();
})();
