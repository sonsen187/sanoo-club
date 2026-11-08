// DJ Club Admin Dashboard Logic (Resident DJ: Sanoo)
(function () {
  'use strict';

  let ws = null;
  let playlist = [];
  let currentTrackIndex = 0;
  let isPlaying = false;
  let currentDancersCount = 0;

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

  const activeCatsBadge = document.getElementById('active-cats-badge');
  const vipLiveList = document.getElementById('vip-live-list');
  const vipLiveCount = document.getElementById('vip-live-count');
  const btnQuickRave = document.getElementById('btn-quick-rave');

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
        if (data.topGiftersList) updateVIPList(data.topGiftersList);
        if (data.dancers) updateDancersCount(Object.keys(data.dancers).length);
        if (data.settings) {
          const bgCheck = document.getElementById('chk-transparent-bg');
          if (bgCheck) bgCheck.checked = !!data.settings.transparentBg;
          if (data.settings.audioMode) updateAudioModeAdminUI(data.settings.audioMode);
          if (data.settings.autoLeaveInactive60s !== undefined) updateAutoLeaveUI(data.settings.autoLeaveInactive60s);
        }
        if (data.autoSimulator) {
          updateAutoSimAdminUI(data.autoSimulator);
        }
        break;

      case 'settings_updated':
        if (data.autoLeaveInactive60s !== undefined) updateAutoLeaveUI(data.autoLeaveInactive60s);
        if (data.transparentBg !== undefined) {
          const bg = document.getElementById('chk-transparent-bg');
          if (bg) bg.checked = !!data.transparentBg;
        }
        break;

      case 'auto_sim_update':
        updateAutoSimAdminUI(data);
        break;

      case 'audio_mode_changed':
        if (data && data.mode) {
          updateAudioModeAdminUI(data.mode);
        }
        break;

      case 'tiktok_status':
        updateTikTokStatus(data);
        break;

      case 'live_session_reset':
      case 'reset_top_gifters':
        updateVIPList([]);
        try {
          localStorage.removeItem('sanoo_club_top_gifters');
        } catch (e) {}
        break;

      case 'top_gifters':
        updateVIPList(Array.isArray(data) ? data : []);
        break;

      case 'gift':
        if (data.topGifters) updateVIPList(data.topGifters);
        break;

      case 'dancers_sync':
        updateDancersCount(Object.keys(data || {}).length);
        break;

      case 'dancer_update':
        currentDancersCount = Math.max(1, currentDancersCount + 1);
        updateDancersCount(currentDancersCount);
        break;

      case 'remove_dancer':
        currentDancersCount = Math.max(0, currentDancersCount - 1);
        updateDancersCount(currentDancersCount);
        break;

      case 'dancers_cleared':
        updateDancersCount(0);
        break;

      case 'playlist_updated':
        playlist = data || [];
        renderPlaylist(playlist);
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

  function updateDancersCount(cnt) {
    currentDancersCount = cnt;
    if (activeCatsBadge) {
      activeCatsBadge.textContent = `${cnt} Mèo đang quẩy 🐱`;
    }
  }

  function updateVIPList(vips) {
    if (!vipLiveList || !vipLiveCount) return;
    const podiumNames = [
      { rank: 1, label: 'TOP 1 • ĐẠI GIA', color: '#ffd700', icon: '👑 🦁' },
      { rank: 2, label: 'TOP 2 • THIẾU GIA', color: '#00f0ff', icon: '🥈 🛥️' },
      { rank: 3, label: 'TOP 3 • CÔNG TỬ', color: '#ff914d', icon: '🥉 🏎️' }
    ];

    const activeVips = (vips || []).slice(0, 3);
    vipLiveCount.textContent = `${activeVips.length}/3 bục có chủ`;

    if (activeVips.length === 0) {
      vipLiveList.innerHTML = `<div style="color: var(--text-muted); font-style: italic;">Chưa có đại gia nào lên bục. Nhấn các nút trên để test!</div>`;
      return;
    }

    vipLiveList.innerHTML = '';
    activeVips.forEach((v, idx) => {
      const p = podiumNames[idx] || { rank: idx + 1, label: `TOP ${idx + 1}`, color: '#fff', icon: '⭐' };
      const row = document.createElement('div');
      row.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.04); border-radius: 6px; border-left: 4px solid ${p.color};`;
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px;">${p.icon}</span>
          <strong style="color: ${p.color};">${p.label}:</strong>
          <span style="color: #fff; font-weight: 600;">${v.nickname || v.username}</span>
        </div>
        <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: #ffe600; font-size: 14px;">
          ${(v.coins || 0).toLocaleString()}
        </div>
      `;
      vipLiveList.appendChild(row);
    });
  }

  function renderPlaylist(tracks) {
    if (!playlistBody) return;
    playlistBody.innerHTML = '';

    const musicCardTitle = document.getElementById('music-card-title');
    if (musicCardTitle && tracks) {
      musicCardTitle.textContent = `PHÒNG ĐIỀU KHIỂN ÂM NHẠC DJ (${tracks.length} BÀI)`;
    }

    tracks.forEach((track, i) => {
      // Find actual index in main playlist array
      const actualIndex = playlist.findIndex(t => t.id === track.id);
      const targetIndex = actualIndex !== -1 ? actualIndex : i;

      const tr = document.createElement('tr');
      tr.id = `track-row-${targetIndex}`;
      if (targetIndex === currentTrackIndex) tr.className = 'active';

      const bpmBadge = track.bpm ? `<span style="display:inline-block; margin-left: 8px; background: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: bold;">${track.bpm} BPM</span>` : '';
      const ytBadge = track.isYouTube ? `<span style="display:inline-block; margin-left: 6px; background: rgba(255, 0, 0, 0.25); color: #ff4d4d; border: 1px solid rgba(255, 68, 68, 0.5); border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: bold;">🔴 YouTube</span>` : '';
      tr.innerHTML = `
        <td style="width: 50px;">#${track.id}</td>
        <td>${track.title} ${bpmBadge}${ytBadge}</td>
        <td style="width: 80px; text-align: right;">
          <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11px;">▶ Phát</button>
        </td>
      `;

      tr.addEventListener('click', () => {
        sendWS('track_select', { index: targetIndex, requestedBy: 'Admin' });
        showToast(`🎵 Đang phát bài #${track.id}: ${track.title}`);
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
  function togglePlayPause() {
    if (isPlaying) {
      sendWS('track_pause');
    } else {
      sendWS('track_play');
    }
  }

  function playNextTrack() {
    sendWS('track_next');
  }

  function playPrevTrack() {
    sendWS('track_prev');
  }

  if (btnPlayPause) btnPlayPause.addEventListener('click', togglePlayPause);
  if (btnPrev) btnPrev.addEventListener('click', playPrevTrack);
  if (btnNext) btnNext.addEventListener('click', playNextTrack);

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
  function triggerStageEffect(effect) {
    sendWS('trigger_effect', { effect, triggerBy: 'Admin' });
    if (effect === 'rave') {
      showToast('⚡ ĐÃ KÍCH HOẠT SIÊU QUẨY HYPE (ALL FX)!');
    } else {
      showToast(`Đã kích hoạt hiệu ứng: ${effect}`);
    }
  }

  document.querySelectorAll('[data-effect]').forEach(btn => {
    btn.addEventListener('click', () => {
      const effect = btn.getAttribute('data-effect');
      triggerStageEffect(effect);
    });
  });

  if (btnQuickRave) {
    btnQuickRave.addEventListener('click', () => {
      triggerStageEffect('rave');
    });
  }

  // DJ Sound Effect Buttons (Preview in Admin too!)
  function playSoundEffect(sound) {
    sfx.init();
    if (sound === 'airhorn') sfx.playAirhorn();
    else if (sound === 'scratch') sfx.playScratch();
    else if (sound === 'siren') sfx.playSiren();
    else if (sound === 'bassdrop') sfx.playBassDrop();
    else if (sound === 'cheer') sfx.playCheer();

    // Broadcast to overlay stream as well
    sendWS('trigger_effect', { effect: sound, triggerBy: 'Admin' });
  }

  document.querySelectorAll('[data-sfx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sound = btn.getAttribute('data-sfx');
      playSoundEffect(sound);
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
      showToast(`🎁 Đã gửi: ${giftName} (${coins.toLocaleString()} Xu) từ ${sender}`);
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
      showToast(`🎁 Đã gửi: ${g} (${c.toLocaleString()} Xu) từ ${u}`);
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

  // Quick Command buttons (1, !meo1, !dance 1, !skip, !fire, etc.)
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
      showToast(`💬 Đã gửi lệnh chat: ${cmd}`);
    });
  });

  // ---------------------------------------------------------------------------
  // VIP PODIUM SIMULATION & CONTROLS
  // ---------------------------------------------------------------------------
  document.querySelectorAll('[data-sim-vip]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rank = parseInt(btn.getAttribute('data-sim-vip'), 10);
      sendWS('simulate_vip', { rank });
      const titles = { 1: 'Top 1 Đại Gia (Sư Tử 29,999 Xu)', 2: 'Top 2 Thiếu Gia (Du Thuyền 9,999 Xu)', 3: 'Top 3 Công Tử (Siêu Xe 2,999 Xu)' };
      showToast(`👑 Đã đưa đại gia vào ${titles[rank] || rank}!`);
    });
  });

  function handleResetLiveSession() {
    if (confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN ĐẶT LẠI PHIÊN LIVE?\n\n- Toàn bộ Bảng Xếp Hạng & Bục VIP sẽ trở về ban đầu.\n- Điểm quà tặng đã lưu trong Local Storage & server sẽ được xóa sạch.\n- Sẵn sàng vinh danh các đại gia mới cho phiên livestream này!')) {
      sendWS('reset_live_session');
      try {
        localStorage.removeItem('sanoo_club_top_gifters');
      } catch (e) {}
      updateVIPList([]);
      showToast('🔄 Đã đặt lại thành công! Bảng Xếp Hạng sẵn sàng cho Phiên Live mới.');
    }
  }

  const btnResetNav = document.getElementById('btn-reset-session-nav');
  if (btnResetNav) {
    btnResetNav.addEventListener('click', handleResetLiveSession);
  }

  const btnResetVipCard = document.getElementById('btn-reset-vip-card');
  if (btnResetVipCard) {
    btnResetVipCard.addEventListener('click', handleResetLiveSession);
  }

  // ---------------------------------------------------------------------------
  // CAT CROWD SPAWNER & FLOOR MANAGEMENT
  // ---------------------------------------------------------------------------
  document.querySelectorAll('[data-spawn-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const typeVal = btn.getAttribute('data-spawn-cat');
      if (typeVal === 'random') {
        sendWS('spawn_crowd', { count: 20 });
        showToast('🎉 Đã thêm 20 Mèo Quẩy ngẫu nhiên lên sàn!');
      } else {
        const catType = parseInt(typeVal, 10);
        const catNames = { 1: 'Mèo Đen Rave', 2: 'Mèo Vàng Shuffle', 3: 'Mèo Xám Hands Up' };
        sendWS('spawn_crowd', { count: 5, charType: catType, danceStyle: catType });
        showToast(`🐱 Đã thêm 5 ${catNames[catType] || 'Mèo'} lên sàn!`);
      }
    });
  });

  const btnClearFloor = document.getElementById('btn-clear-floor');
  if (btnClearFloor) {
    btnClearFloor.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn xóa tất cả vũ công khỏi sàn nhảy?')) {
        sendWS('clear_dancers');
        showToast('🧹 Đã xóa sạch vũ công khỏi sàn');
      }
    });
  }

  // Shuffle & Set Dance Styles for the whole floor
  // Auto Leave Inactive 60s Toggle
  let autoLeaveInactive = true;
  const btnToggleAutoLeave = document.getElementById('btn-toggle-auto-leave');

  function updateAutoLeaveUI(enabled) {
    autoLeaveInactive = !!enabled;
    if (!btnToggleAutoLeave) return;
    if (autoLeaveInactive) {
      btnToggleAutoLeave.classList.add('active-audio-mode');
      btnToggleAutoLeave.style.borderColor = 'var(--neon-cyan)';
      btnToggleAutoLeave.innerHTML = '⏱️ ĐANG BẬT (60s)';
    } else {
      btnToggleAutoLeave.classList.remove('active-audio-mode');
      btnToggleAutoLeave.style.borderColor = 'rgba(255,255,255,0.2)';
      btnToggleAutoLeave.innerHTML = '⏹️ ĐÃ TẮT';
    }
  }

  if (btnToggleAutoLeave) {
    btnToggleAutoLeave.addEventListener('click', () => {
      autoLeaveInactive = !autoLeaveInactive;
      updateAutoLeaveUI(autoLeaveInactive);
      sendWS('update_settings', { autoLeaveInactive60s: autoLeaveInactive });
      showToast(autoLeaveInactive ? 'Đã BẬT tự động rời sàn sau 60s' : 'Đã TẮT tự động rời sàn');
    });
  }

  const btnShuffleDances = document.getElementById('btn-shuffle-dances');
  if (btnShuffleDances) {
    btnShuffleDances.addEventListener('click', () => {
      sendWS('shuffle_dances');
      showToast('🔀 Đã trộn ngẫu nhiên 3 vũ đạo phong phú cho toàn bộ vũ công!');
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
      showToast(`Toàn sàn đã đồng bộ: ${names[styleId] || styleId}`);
    });
  });

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
      const modeNames = {
        glass_room: '🍸 Phòng Kính Bar (VIP)',
        main_floor: '🔊 Sàn Nhảy Chính',
        outside_door: '🚪 Ngoài Cửa Bar'
      };
      showToast(`Âm thanh chuyển sang: ${modeNames[mode] || mode}`);
    });
  });

  // ---------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS / HOTKEYS (When not typing in inputs)
  // ---------------------------------------------------------------------------
  window.addEventListener('keydown', e => {
    const activeTag = (document.activeElement && document.activeElement.tagName) || '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
      return; // Typing in form, don't trigger hotkeys
    }

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'KeyN') {
      e.preventDefault();
      playNextTrack();
    } else if (e.code === 'KeyP') {
      e.preventDefault();
      playPrevTrack();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      triggerStageEffect('flame');
    } else if (e.code === 'KeyS') {
      e.preventDefault();
      triggerStageEffect('smoke');
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      triggerStageEffect('rave');
    } else if (e.code === 'Digit1') {
      e.preventDefault();
      playSoundEffect('airhorn');
    } else if (e.code === 'Digit2') {
      e.preventDefault();
      playSoundEffect('scratch');
    } else if (e.code === 'Digit3') {
      e.preventDefault();
      playSoundEffect('siren');
    } else if (e.code === 'Digit4') {
      e.preventDefault();
      playSoundEffect('bassdrop');
    } else if (e.code === 'Digit5') {
      e.preventDefault();
      playSoundEffect('cheer');
    }
  });

  // ---------------------------------------------------------------------------
  // AUTO INTERACTION & CHAT SIMULATOR (3 SPEED LEVELS: SLOW, MEDIUM, FAST)
  // ---------------------------------------------------------------------------
  let currentSimSpeed = 'off';

  function updateAutoSimAdminUI(simData) {
    if (!simData) return;
    currentSimSpeed = simData.status || 'off';

    // Update active speed button
    document.querySelectorAll('[data-sim-speed]').forEach(btn => {
      if (btn.getAttribute('data-sim-speed') === currentSimSpeed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update status badge
    const badge = document.getElementById('auto-sim-status-badge');
    if (badge) {
      const badgeConfigs = {
        off: { cls: 'status-badge disconnected', text: '⏹️ ĐANG TẮT' },
        slow: { cls: 'status-badge connected', text: '🐢 CHẬM (6-10s)' },
        medium: { cls: 'status-badge connected', text: '⚡ VỪA (2.5-4.5s)' },
        fast: { cls: 'status-badge connected', text: '🔥 NHANH (0.8-1.6s)' }
      };
      const b = badgeConfigs[currentSimSpeed] || badgeConfigs.off;
      badge.className = b.cls;
      badge.textContent = b.text;
    }

    // Update stats text
    const counterEl = document.getElementById('sim-stats-counter');
    if (counterEl) {
      counterEl.textContent = `Đã gửi: ${simData.sentCount || 0} tương tác`;
    }
    const speedEl = document.getElementById('sim-stats-speed');
    if (speedEl) {
      const labels = { off: 'Đang tắt', slow: 'Chậm (6-10s)', medium: 'Vừa (2.5-4.5s)', fast: 'Nhanh (0.8-1.6s)' };
      speedEl.textContent = `Mức độ: ${labels[currentSimSpeed] || currentSimSpeed}`;
    }

    // Update checkboxes
    const chkChat = document.getElementById('chk-sim-chat');
    if (chkChat && simData.enableChat !== undefined) chkChat.checked = !!simData.enableChat;
    const chkLikes = document.getElementById('chk-sim-likes');
    if (chkLikes && simData.enableLikes !== undefined) chkLikes.checked = !!simData.enableLikes;
    const chkGifts = document.getElementById('chk-sim-gifts');
    if (chkGifts && simData.enableGifts !== undefined) chkGifts.checked = !!simData.enableGifts;
  }

  function sendAutoSimSettings(speed) {
    const chkChat = document.getElementById('chk-sim-chat');
    const chkLikes = document.getElementById('chk-sim-likes');
    const chkGifts = document.getElementById('chk-sim-gifts');

    sendWS('set_auto_sim', {
      speed: speed !== undefined ? speed : currentSimSpeed,
      enableChat: chkChat ? chkChat.checked : true,
      enableLikes: chkLikes ? chkLikes.checked : true,
      enableGifts: chkGifts ? chkGifts.checked : true
    });
  }

  document.querySelectorAll('[data-sim-speed]').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = btn.getAttribute('data-sim-speed');
      sendAutoSimSettings(speed);
      const labels = {
        off: 'Đã tắt giả lập tự động',
        slow: 'Bật giả lập mức CHẬM (6-10s/lượt)',
        medium: 'Bật giả lập mức VỪA (2.5-4.5s/lượt)',
        fast: 'Bật giả lập mức NHANH (0.8-1.6s/lượt)'
      };
      showToast(labels[speed] || speed);
    });
  });

  ['chk-sim-chat', 'chk-sim-likes', 'chk-sim-gifts'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        sendAutoSimSettings(currentSimSpeed);
      });
    }
  });

  // ============================================================================
  // AI MC & LIVESTREAM TTS CONTROLS
  // ============================================================================
  let ttsEnabled = true;
  const btnToggleTTS = document.getElementById('btn-toggle-tts');
  const ttsStatusBadge = document.getElementById('tts-status-badge');
  const ttsVoiceSelect = document.getElementById('tts-voice-select');
  const ttsVolumeSlider = document.getElementById('tts-volume-slider');
  const ttsVolVal = document.getElementById('tts-vol-val');
  const btnTestGiftTTS = document.getElementById('btn-test-gift-tts');
  const btnTestTopTTS = document.getElementById('btn-test-top-tts');
  const btnTestHypeTTS = document.getElementById('btn-test-hype-tts');

  if (btnToggleTTS) {
    btnToggleTTS.addEventListener('click', () => {
      ttsEnabled = !ttsEnabled;
      if (ttsEnabled) {
        btnToggleTTS.classList.add('active-audio-mode');
        btnToggleTTS.style.borderColor = 'var(--neon-cyan)';
        btnToggleTTS.innerHTML = '🎙️ Trạng Thái: ĐANG BẬT';
        if (ttsStatusBadge) {
          ttsStatusBadge.textContent = 'Đang Bật';
          ttsStatusBadge.style.color = 'var(--neon-cyan)';
        }
        showToast('Đã BẬT giọng đọc AI MC');
      } else {
        btnToggleTTS.classList.remove('active-audio-mode');
        btnToggleTTS.style.borderColor = 'rgba(255,255,255,0.2)';
        btnToggleTTS.innerHTML = '🔇 Trạng Thái: ĐÃ TẮT';
        if (ttsStatusBadge) {
          ttsStatusBadge.textContent = 'Đã Tắt';
          ttsStatusBadge.style.color = '#a0aec0';
        }
        showToast('Đã TẮT giọng đọc AI MC');
      }
      sendWS('tts_config', { enabled: ttsEnabled });
    });
  }

  const ttsSpeedSelect = document.getElementById('tts-speed-select');
  if (ttsSpeedSelect) {
    ttsSpeedSelect.addEventListener('change', () => {
      sendWS('tts_config', { speed: parseFloat(ttsSpeedSelect.value) });
      showToast('Đã chỉnh tốc độ MC: ' + ttsSpeedSelect.value + 'x');
    });
  }

  if (ttsVoiceSelect) {
    ttsVoiceSelect.addEventListener('change', () => {
      sendWS('tts_config', { voiceAccent: ttsVoiceSelect.value });
      showToast('Đã đổi giọng: ' + (ttsVoiceSelect.value === 'north' ? 'Miền Bắc' : 'Miền Nam'));
    });
  }

  if (ttsVolumeSlider) {
    ttsVolumeSlider.addEventListener('input', () => {
      const vol = parseInt(ttsVolumeSlider.value, 10);
      if (ttsVolVal) ttsVolVal.textContent = vol + '%';
      sendWS('tts_config', { volume: vol / 100 });
    });
  }

  if (btnTestGiftTTS) {
    btnTestGiftTTS.addEventListener('click', () => {
      sendWS('simulate_gift', {
        username: 'Minh_Rave',
        nickname: 'Minh Rave',
        giftName: 'Hoa Hồng',
        repeatCount: 1,
        diamondCount: 1,
        fxType: 'fireworks'
      });
      showToast('🎁 Đã đưa quà vào Queue: Minh Rave tặng Hoa Hồng');
    });
  }

  if (btnTestTopTTS) {
    btnTestTopTTS.addEventListener('click', () => {
      sendWS('simulate_vip', {
        rank: 1,
        username: 'Minh_Rave'
      });
      showToast('👑 Đang đưa Top 1 vào Queue: Minh Rave');
    });
  }

  if (btnTestHypeTTS) {
    btnTestHypeTTS.addEventListener('click', () => {
      sendWS('tts_hype', {});
      showToast('Đang phát thử: Hô MC khuấy động');
    });
  }

  setupWebSocket();
})();


  // ---------------------------------------------------------------------------
  // YOUTUBE LINK AUDIO PLAYER & FETCHER
  // ---------------------------------------------------------------------------
  const ytUrlInput = document.getElementById('yt-url-input');
  const btnYtPlayNow = document.getElementById('btn-yt-play-now');
  const btnYtAddPlaylist = document.getElementById('btn-yt-add-playlist');
  const ytLoadingIndicator = document.getElementById('yt-loading-indicator');
  const ytLoadingText = document.getElementById('yt-loading-text');
  const ytStatusBadge = document.getElementById('yt-status-badge');

  function setYtLoading(loading, message = '') {
    if (ytLoadingIndicator) {
      ytLoadingIndicator.style.display = loading ? 'flex' : 'none';
      if (ytLoadingText && message) ytLoadingText.textContent = message;
    }
    if (btnYtPlayNow) btnYtPlayNow.disabled = loading;
    if (btnYtAddPlaylist) btnYtAddPlaylist.disabled = loading;
    if (ytStatusBadge) {
      ytStatusBadge.textContent = loading ? 'Đang tải...' : 'Sẵn sàng';
      ytStatusBadge.style.color = loading ? '#ffd700' : '#a0aec0';
    }
  }

  async function handleYouTubeAction(action) {
    if (!ytUrlInput) return;
    const url = ytUrlInput.value.trim();
    if (!url) {
      alert('Vui lòng dán link video hoặc shorts YouTube!');
      ytUrlInput.focus();
      return;
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      alert('Link không đúng định dạng YouTube (cần chứa youtube.com hoặc youtu.be)!');
      return;
    }

    setYtLoading(true, action === 'play' ? '⚡ Đang tải & tách âm thanh YouTube để phát ngay...' : '➕ Đang tải & thêm bài hát vào danh sách...');

    try {
      const endpoint = action === 'play' ? '/api/youtube/play' : '/api/youtube/add';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Lỗi khi xử lý YouTube');
      }

      setYtLoading(false);
      ytUrlInput.value = '';

      if (action === 'play') {
        showToast(`🎉 Đang phát bài YouTube: ${data.track.title}`);
      } else {
        if (data.alreadyExists) {
          showToast(`ℹ️ Bài hát đã có trong Playlist: #${data.track.id} ${data.track.title}`);
        } else {
          showToast(`✅ Đã thêm bài hát YouTube vào Playlist: #${data.track.id} ${data.track.title}`);
        }
      }
    } catch (err) {
      setYtLoading(false);
      alert('Không thể tải bài hát từ link YouTube này:\n' + err.message);
    }
  }

  if (btnYtPlayNow) {
    btnYtPlayNow.addEventListener('click', () => handleYouTubeAction('play'));
  }
  if (btnYtAddPlaylist) {
    btnYtAddPlaylist.addEventListener('click', () => handleYouTubeAction('add'));
  }
  if (ytUrlInput) {
    ytUrlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleYouTubeAction('play');
      }
    });
  }
