// DJ Club TikTok Live - 9:16 Vertical Game Engine & Visualizer
(function () {
  'use strict';

  // Canvas & Context
  const canvas = document.getElementById('stage-canvas');
  const ctx = canvas.getContext('2d');

  // Internal logical resolution (Full HD 9:16)
  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;

  // Sound Effects engine
  const sfx = new DJSoundEffects();

  // Web Audio Context & Analyser for real-time music reactive beat analysis
  let audioCtx = null;
  let audioSource = null;
  let analyser = null;
  let freqData = null;
  const audioElement = new Audio();
  audioElement.crossOrigin = 'anonymous';
  audioElement.preload = 'auto';

  // Game & Stream State
  let playlist = [];
  let currentTrack = null;
  let isPlaying = false;
  let dancers = []; window.__DJ_DANCERS__ = dancers; // Array of Dancer instances
  let topGifters = [];
  let particles = [];
  let lasers = [];
  let flames = [];
  let fogs = [];
  let floatingHearts = [];
  let speechBubbles = []; // Active speech bubbles

  // Audio metrics
  let bassIntensity = 0;
  let midIntensity = 0;
  let beatCounter = 0;
  let currentBpm = 128;
  let lastBeatTime = 0;

  // Character Theme Setting ('humans' | 'cats' | 'all')
  let currentTheme = 'humans';

  // Asset Sprite Caches
  const spriteCache = {
    char1: [],
    char2: [],
    char3: [],
    human_male: [],
    speaker: null,
    discoLight: null
  };

  let assetsLoaded = false;

  // Preload character frame sequences (Only cats: 14 + 13 + 14 = 41 frames)
  function preloadAssets(callback) {
    let toLoad = 14 + 13 + 14 + 1; // 42 assets total (Cats & Speaker, Gogo Dancers are 100% Smooth Vector)
    let loaded = 0;
    let finished = false;

    function checkDone() {
      loaded++;
      if (loaded >= toLoad && !finished) {
        finished = true;
        assetsLoaded = true;
        if (callback) callback();
      }
    }

    setTimeout(() => {
      if (!finished) {
        finished = true;
        assetsLoaded = true;
        if (callback) callback();
      }
    }, 2000);

    // Char 1: 14 frames
    for (let i = 1; i <= 14; i++) {
      const img = new Image();
      img.src = `/assets/characters/char1/${i}.png?v=clean2`;
      img.onload = checkDone;
      img.onerror = checkDone;
      spriteCache.char1.push(img);
    }

    // Char 2: 13 frames
    for (let i = 1; i <= 13; i++) {
      const img = new Image();
      img.src = `/assets/characters/char2/${i}.png?v=clean2`;
      img.onload = checkDone;
      img.onerror = checkDone;
      spriteCache.char2.push(img);
    }

    // Char 3: 14 frames
    for (let i = 1; i <= 14; i++) {
      const img = new Image();
      img.src = `/assets/characters/char3/${i}.png?v=clean2`;
      img.onload = checkDone;
      img.onerror = checkDone;
      spriteCache.char3.push(img);
    }


    // Speaker texture
    const spk = new Image();
    spk.src = '/assets/textures/speaker.png';
    spk.onload = () => {
      spriteCache.speaker = spk;
      checkDone();
    };
    spk.onerror = () => {
      checkDone();
    };
  }

  // Audio setup & Unlock handlers
  const unlockOverlay = document.getElementById('audio-unlock-overlay');

  function checkAudioUnlocked() {
    if (unlockOverlay) {
      if (audioCtx && audioCtx.state === 'running' && !audioElement.paused && audioElement.currentTime > 0) {
        unlockOverlay.style.display = 'none';
      } else if (isPlaying) {
        unlockOverlay.style.display = 'flex';
      }
    }
  }

  function unlockAudio() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (audioElement.src && audioElement.paused) {
      audioElement.play().catch(e => console.log('Audio unlock wait:', e));
    }
    if (unlockOverlay) unlockOverlay.style.display = 'none';
  }

  window.addEventListener('click', unlockAudio);
  if (unlockOverlay) {
    unlockOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudio();
    });
  }


  // ---------------------------------------------------------------------------
  // BAR VIP GLASS ROOM AUDIO EFFECTS ENGINE SYNC
  // ---------------------------------------------------------------------------
  let currentAudioMode = 'glass_room';

  function updateAudioModeUI(mode) {
    currentAudioMode = mode;
    const btn = document.getElementById('btn-audio-mode');
    if (!btn) return;
    const textEl = document.getElementById('audio-mode-text');
    const iconEl = btn.querySelector('.audio-mode-icon');

    btn.className = 'audio-mode-pill mode-' + mode;
    if (window.BarAudioEffects) {
      const info = window.BarAudioEffects.getModeInfo(mode);
      if (textEl) textEl.textContent = info.shortName;
      if (iconEl) iconEl.textContent = info.icon;
      btn.title = info.name + ' - ' + info.desc + ' (Bấm để đổi chế độ)';
    }
  }

  function toggleAudioMode() {
    if (window.BarAudioEffects) {
      const nextMode = window.BarAudioEffects.toggleMode();
      updateAudioModeUI(nextMode);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'set_audio_mode', data: { mode: nextMode } }));
      }
    }
  }

  // Hype Drop Quick Button
  const btnHypeDrop = document.getElementById('btn-hype-drop');
  if (btnHypeDrop) {
    btnHypeDrop.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('⚡ User triggered manual SIÊU QUẨY drop!');
      beatEngine.forceHypeDrop(14);
    });
  }

  const btnAudioMode = document.getElementById('btn-audio-mode');
  if (btnAudioMode) {
    btnAudioMode.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAudioMode();
    });
  }

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // Precision 2048-point FFT for sub-bass kick punch isolation (23.4Hz/bin)
      analyser.smoothingTimeConstant = 0.55;
      freqData = new Uint8Array(analyser.frequencyBinCount);

      audioSource = audioCtx.createMediaElementSource(audioElement);
      audioSource.connect(analyser); // Keep beat detection at full raw signal
      if (window.BarAudioEffects) {
        BarAudioEffects.init(audioCtx, audioSource, audioCtx.destination);
        BarAudioEffects.setMode(currentAudioMode || 'glass_room', 0.05);
      } else {
        audioSource.connect(audioCtx.destination);
      }

      sfx.init(audioCtx);
      if (window.TTSMCManager) {
        TTSMCManager.init(audioCtx, audioElement);
      }
      console.log('Audio Context & Analyser initialized successfully (fftSize 512)');
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }

  // Play a track
  function playTrack(track, offsetSec = 0) {
    if (!track) return;
    currentTrack = track;
    audioElement.src = track.url;
    audioElement.currentTime = offsetSec;
    smoothPlayTime = offsetSec;
    lastAudioTime = -1;
    audioClockRunning = false;
    initAudio();

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    audioElement.play().then(() => {
      isPlaying = true;
      updateTrackUI(track);
      if (unlockOverlay) unlockOverlay.style.display = 'none';
    }).catch(e => {
      console.log('Audio playback waiting for interaction:', e);
      isPlaying = true;
      updateTrackUI(track);
      if (unlockOverlay) unlockOverlay.style.display = 'flex';
    });
  }

  function updateTrackUI(track) {
    const titleEl = document.getElementById('now-playing-title');
    const labelEl = document.getElementById('now-playing-label');
    if (titleEl && track) {
      titleEl.textContent = `${track.id}. ${track.title}`;
    }
    if (labelEl && track) {
      labelEl.textContent = track.isYouTube ? `DJ SANOO • YOUTUBE #${track.id}` : `DJ SANOO • BÀI #${track.id}`;
    }
  }

  // Dynamic Stage Lighting Engine (Curated Club Palettes & Strobe Flash)
  const stageLighting = {
    colorIndex: 0,
    flashIntensity: 0,
    chillPalette: [
      { hex: '#00f5d4', r: 0,   g: 245, b: 212 }, // Laser Cyan
      { hex: '#7209b7', r: 114, g: 9,   b: 183 }, // Deep Violet
      { hex: '#00b4d8', r: 0,   g: 180, b: 216 }, // Electric Blue
      { hex: '#f72585', r: 247, g: 37,  b: 133 }, // Hot Magenta
      { hex: '#4361ee', r: 67,  g: 97,  b: 238 }  // Indigo
    ],
    dropPalette: [
      { hex: '#ff007f', r: 255, g: 0,   b: 127 }, // Neon Pink
      { hex: '#00f0ff', r: 0,   g: 240, b: 255 }, // Laser Cyan
      { hex: '#ffe600', r: 255, g: 230, b: 0 },   // Strobe Gold
      { hex: '#00ff88', r: 0,   g: 255, b: 136 }, // Acid Green
      { hex: '#b5179e', r: 181, g: 23,  b: 158 }  // Purple Flare
    ],

    getCurrentColor(offset = 0) {
      const palette = beatEngine.isBassActive ? this.dropPalette : this.chillPalette;
      const idx = (Math.floor(this.colorIndex) + offset) % palette.length;
      return (palette[idx >= 0 ? idx : 0] || palette[0]).hex;
    },

    getRgb(offset = 0) {
      const palette = beatEngine.isBassActive ? this.dropPalette : this.chillPalette;
      const idx = (Math.floor(this.colorIndex) + offset) % palette.length;
      const c = palette[idx >= 0 ? idx : 0] || palette[0];
      return { r: c.r, g: c.g, b: c.b };
    },

    update(dt) {
      const cycleSpeed = beatEngine.isBassActive
        ? (beatEngine.bpm / 120) * (0.8 + beatEngine.bassLevel * 1.4)
        : (beatEngine.bpm / 120) * 0.25;

      this.colorIndex = (this.colorIndex + dt * cycleSpeed) % 60;
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 3.5);
    },

    onBeatHit(bpm, bassLevel) {
      this.colorIndex = (this.colorIndex + 1) % 60;
      this.flashIntensity = Math.min(1.0, 0.35 + bassLevel * 0.65);
    }
  };

  // 6 Pro Volumetric Moving Heads on Ceiling Truss Rigging (y=135)
  let movingHeads = [];
  function initMovingHeads() {
    movingHeads = [
      { x: 130, y: 135, baseAngle: 0.38, sweepRange: 0.38, speed: 0.95, colorOffset: 0 },
      { x: 290, y: 135, baseAngle: 0.22, sweepRange: 0.30, speed: -1.15, colorOffset: 2 },
      { x: 450, y: 135, baseAngle: 0.08, sweepRange: 0.25, speed: 1.05, colorOffset: 4 },
      { x: 630, y: 135, baseAngle: 0.08, sweepRange: 0.25, speed: -1.05, colorOffset: 1 },
      { x: 790, y: 135, baseAngle: 0.22, sweepRange: 0.30, speed: 1.15, colorOffset: 3 },
      { x: 950, y: 135, baseAngle: 0.38, sweepRange: 0.38, speed: -0.95, colorOffset: 5 }
    ];
  }

  // Floating Club Atmosphere Motes (Catching moving head beams)
  let clubAtmosphereMotes = [];
  function initClubAtmosphere() {
    clubAtmosphereMotes = [];
    for (let i = 0; i < 35; i++) {
      clubAtmosphereMotes.push({
        x: Math.random() * W,
        y: H * 0.15 + Math.random() * (H * 0.75),
        vx: (Math.random() - 0.5) * 8,
        vy: -10 - Math.random() * 16,
        size: 2 + Math.random() * 3.5,
        alpha: 0.2 + Math.random() * 0.5,
        hue: Math.floor(Math.random() * 360)
      });
    }
  }

  // Disco Mirror Ball Sparkles drifting across dance floor
  let discoSparkles = [];
  function initDiscoSparkles() {
    discoSparkles = [];
    for (let i = 0; i < 40; i++) {
      discoSparkles.push({
        angle: Math.random() * Math.PI * 2,
        speed: (0.0006 + Math.random() * 0.0014) * (Math.random() < 0.5 ? 1 : -1),
        orbitRadius: 30 + Math.random() * 240,
        floorX: 0.10 + Math.random() * 0.80,
        floorY: 0.52 + Math.random() * 0.44,
        size: 3 + Math.random() * 4,
        colorOffset: Math.floor(Math.random() * 5)
      });
    }
  }

  let bassRipples = [];

  function initLasers() {
    initMovingHeads();
    initClubAtmosphere();
    initDiscoSparkles();
  }

  // Smooth 60 FPS Audio Clock (eliminates Chromium 250ms currentTime stutter)
  let smoothPlayTime = 0;
  let lastAudioTime = -1;
  let audioClockRunning = false;

  function getSmoothPlayTime(dt) {
    if (!audioElement || audioElement.paused || audioElement.currentTime <= 0) {
      audioClockRunning = false;
      return 0;
    }

    const cur = audioElement.currentTime;
    if (!audioClockRunning || lastAudioTime < 0) {
      smoothPlayTime = cur;
      lastAudioTime = cur;
      audioClockRunning = true;
      return smoothPlayTime;
    }

    if (cur !== lastAudioTime) {
      lastAudioTime = cur;
      const drift = cur - smoothPlayTime;
      if (Math.abs(drift) > 0.15) {
        smoothPlayTime = cur; // Snap on seek
      } else {
        smoothPlayTime += drift * 0.25; // Gentle alignment
      }
    }

    smoothPlayTime += dt;
    return smoothPlayTime;
  }

  // Real-Time Music Beat & Isolated Sub-Bass Engine (Dual-Layer: Precomputed Profile + Live Dynamic FFT)
  const beatEngine = {
    bpm: 128,
    beatDuration: 60 / 128,
    beatProgress: 0,
    beatPhase: 0,        // 0.0 to 1.0 within current beat (0 = kick impact)
    danceCycle: 0,       // 0.0 to 1.0 across 2 beats (1 complete arm swing cycle: left -> right -> left)
    bassIntensity: 0,
    bassLevel: 0,        // Dynamic visual meter value 0..1 (pulsates with kicks!)
    bassFloor: 0.1,      // Running floor tracker for kick detection
    danceEnergy: 0,      // 0.0 = chill, 1.0 = drop
    isBassActive: false, // True if genuine kick/bass is pounding
    isBeatHit: false,    // True on instant kick drop
    kickPower: 0,
    lastBeatTime: 0,
    orbitAngle: 0,
    orbitSpeed: 0.45,

    update(now, dt) {
      // 1. Sync Tempo and BPM from Current Track
      const trackBpm = (currentTrack && currentTrack.bpm) ? currentTrack.bpm : 128;
      const beatOffset = (currentTrack && currentTrack.beatOffset) ? currentTrack.beatOffset : 0;
      this.bpm = trackBpm;
      this.beatDuration = 60 / this.bpm;

      const isAudioActive = audioElement && !audioElement.paused && audioElement.currentTime > 0;

      if (isAudioActive) {
        // Continuous, butter-smooth 60 FPS play time aligned to the track's beat grid
        const playTime = getSmoothSmoothTime(dt, beatOffset, this.beatDuration);
        this.beatProgress = playTime / this.beatDuration;
        this.beatPhase = ((this.beatProgress % 1.0) + 1.0) % 1.0;
        this.danceCycle = ((this.beatProgress / 2) % 1.0 + 1.0) % 1.0; // 2 beats = 1 full swing cycle!

        // 2. Frequency Analysis (Kick Drum Punch: bins 2..4, 46Hz - 117Hz at 2048 FFT)
        let kickBand = 0;
        let midEnergy = 0;
        if (analyser && freqData && audioCtx && audioCtx.state === 'running') {
          analyser.getByteFrequencyData(freqData);
          // Strictly isolate genuine sub-bass kick drum punch (46Hz - 117Hz)
          // Bin 2: ~47Hz, Bin 3: ~70Hz, Bin 4: ~94Hz
          // Avoid DC rumble (bin 0) and avoid synth melody/vocals (bins 8+)
          const kickRaw = (freqData[2] * 1.6 + freqData[3] * 1.5 + freqData[4] * 1.0) / (4.1 * 255);
          kickBand = kickRaw;

          let midSum = 0;
          for (let i = 8; i <= 36; i++) midSum += freqData[i];
          midEnergy = midSum / (29 * 255);
          this.midIntensity = midEnergy;
        }

        // Running floor tracker
        this.bassFloor += (kickBand - this.bassFloor) * 0.05;
        // Kick Spike above floor (must be a genuine punch above the ambient floor)
        const kickSpike = Math.max(0, kickBand - this.bassFloor * 1.15);

        // Precalculated precision bass profile at current second (from 110Hz lowpass filter)
        const curSec = Math.floor(smoothPlayTime);
        const profileBass = (currentTrack && currentTrack.bassProfile && currentTrack.bassProfile[curSec] !== undefined)
          ? currentTrack.bassProfile[curSec]
          : 0.0;

        // Is bass active? (Profile must indicate genuine kick >= 0.28)
        // In intro / dạo nhạc, profileBass is typically 0.00 - 0.12, so isBassActive will be strictly FALSE!
        if (currentTrack && currentTrack.bassProfile && currentTrack.bassProfile.length > 0) {
          this.isBassActive = (profileBass >= 0.28);
        } else {
          // Live audio fallback: require solid kick punch
          this.isBassActive = (kickBand >= 0.35 && kickSpike > 0.08);
        }

        // Dynamic visual meter target:
        // - In intro / dạo nhạc: stays strictly low between 4% and 16% (KHÔNG BAO GIỜ ĐẦY CÂY!)
        // - In active bass drop: bounces dynamically between 28% and 85%-100% on each kick!
        const beatPulse = Math.pow(Math.max(0, 1.0 - this.beatPhase * 2.2), 2.2);
        const targetMeter = this.isBassActive
          ? Math.min(1.0, 0.22 + profileBass * 0.32 + (kickSpike * 1.8 + beatPulse * 0.35) * 0.5)
          : Math.max(0.04, Math.min(0.16, profileBass * 0.35 + kickBand * 0.15));

        // Fast attack on kick hit, snappy falloff between beats (so you SEE the meter bounce!)
        if (targetMeter > this.bassLevel) {
          this.bassLevel += (targetMeter - this.bassLevel) * 0.70;
        } else {
          this.bassLevel += (targetMeter - this.bassLevel) * 0.22;
        }
        this.bassLevel = Math.max(0, Math.min(1.0, this.bassLevel));

        // Dance energy smooth transition
        if (this.isBassActive) {
          this.danceEnergy = Math.min(1.0, this.danceEnergy + dt * 4.5);
        } else {
          this.danceEnergy = Math.max(0.0, this.danceEnergy - dt * 3.5);
        }

        // Beat hit detection (Kick spike on downbeat)
        const timeSinceLast = (now - this.lastBeatTime) / 1000;
        if (this.isBassActive && (this.beatPhase < 0.16 || this.beatPhase > 0.84) && timeSinceLast > (this.beatDuration * 0.72)) {
          this.isBeatHit = true;
          this.kickPower = Math.min(1.0, this.bassLevel * 1.5);
          this.lastBeatTime = now;

          // Trigger stage light flash & color shift
          stageLighting.onBeatHit(this.bpm, this.bassLevel);

          // Spawn 2.5D Bass Ripple shockwave on the dance floor
          if (bassRipples.length < 8) {
            bassRipples.push({
              x: W / 2,
              y: H * 0.48, // Horizon
              radius: 12,
              maxRadius: W * 0.98,
              speed: 400 + (this.bpm / 128) * 200,
              alpha: 0.95,
              color: stageLighting.getCurrentColor()
            });
          }
        } else {
          this.isBeatHit = false;
        }

        // Update stage lighting color transition
        stageLighting.update(dt);

      } else {
        // Idle / Paused simulation: Keep gentle lively pulse so stage NEVER looks dead!
        this.bassIntensity = 0.08;
        this.bassLevel = 0.08 + Math.sin(now * 0.004) * 0.04;
        this.danceEnergy = 0.10;
        this.isBassActive = false;
        this.isBeatHit = false;
        this.beatProgress += dt / this.beatDuration;
        this.beatPhase = ((this.beatProgress % 1.0) + 1.0) % 1.0;
        this.danceCycle = ((this.beatProgress / 2) % 1.0 + 1.0) % 1.0;
        stageLighting.update(dt);
      }

      // 💥 FORCED HYPE MODE (Manual Trigger or Test)
      if (this.forcedDropUntil && now < this.forcedDropUntil) {
        this.isBassActive = true;
        this.bassLevel = Math.max(this.bassLevel, 0.78 + Math.sin(this.beatPhase * Math.PI) * 0.22);
        this.danceEnergy = 1.0;
      }

      // 💥 AUTOMATIC DROP IMPACT DETECTION & HYPE STAGE EXPLOSION
      if (this.isBassActive && !this._lastBassActiveState) {
        // 1. Twin CO2 Cryo Geysers shooting skyward!
        triggerSmoke();
        // 2. Twin Stage Flame Cannons firing!
        triggerFlame();
        // 3. Confetti Shower
        triggerConfetti();
        // 4. Synchronized Crowd Rave Jump!
        dancers.forEach(d => { d.isJumping = true; });
        setTimeout(() => {
          dancers.forEach(d => { d.isJumping = false; });
        }, 4200);
        // 5. Fullscreen Light Strobe
        stageLighting.flashIntensity = 1.0;
        const strobe = document.getElementById('strobe-fx');
        if (strobe) {
          strobe.classList.remove('active');
          void strobe.offsetWidth;
          strobe.classList.add('active');
        }
      }
      this._lastBassActiveState = this.isBassActive;

      // Periodic Auto Stage Pyro / CO2 on continuous heavy bass drops
      if (this.isBassActive && this.bassLevel > 0.65) {
        if (!this._lastAutoFxTime || (now - this._lastAutoFxTime > 6200)) {
          this._lastAutoFxTime = now;
          if (Math.random() > 0.45) {
            triggerFlame();
          } else {
            triggerSmoke();
          }
        }
      }

      // Update Real-Time HUD Bass Meter
      const fillEl = document.getElementById('bass-bar-fill');
      const textEl = document.getElementById('bass-mode-text');
      if (fillEl) {
        fillEl.style.width = Math.min(100, Math.round(this.bassLevel * 100)) + '%';
      }
      if (textEl) {
        if (this.isBassActive) {
          textEl.textContent = `🔥 BASS DỒN DẬP • [${this.bpm} BPM]`;
          textEl.className = 'bass-mode-text active';
        } else {
          textEl.textContent = `💤 NHẠC DẠO / CHILL • [${this.bpm} BPM]`;
          textEl.className = 'bass-mode-text';
        }
      }

      // =========================================================================
      // 5. Dynamic VIP Orbit Rotation Velocity synced to Sub-Bass and Beat:
      // - Khi KHÔNG CÓ BASS (Nhạc dạo / Intro / Chill): Xoay lững lờ cực chậm (~0.40 rad/s)
      // - Khi CÓ BASS:
      //   + Cú đập Kick Drum (Downbeat): Tốc độ bùng nổ vút cực nhanh (lên tới 12 ~ 16 rad/s)!
      //   + Khoảng nghỉ giữa 2 nhịp kick: Tốc độ hãm chậm lại rõ rệt (~1.2 rad/s)
      //   => Tạo cảm giác vòng xoay "VÚT NHANH RỒI HÃM CHẬM" đúng từng nhịp bass của bài!
      // =========================================================================
      const safeDt = Math.min(dt || 0.016, 0.05);
      if (!this.isBassActive || this.danceEnergy < 0.15) {
        // Nhạc dạo / Không có bass: trôi chậm rãi
        const idleSpeed = 0.40;
        this.orbitSpeed = (this.orbitSpeed || 0.4) + (idleSpeed - (this.orbitSpeed || 0.4)) * 0.15;
      } else {
        // Có bass: Tốc độ tỷ lệ trực tiếp với mức độ Bass và xung nhịp Kick
        const kickSnap = Math.pow(Math.max(0, 1.0 - this.beatPhase * 2.2), 2.2);
        const peakSurge = kickSnap * (6.5 + this.bassLevel * 8.5);
        const baseGlide = 1.0 + this.bassLevel * 1.5;
        const targetSpeed = baseGlide + peakSurge;
        this.orbitSpeed = (this.orbitSpeed || 1.0) + (targetSpeed - (this.orbitSpeed || 1.0)) * (targetSpeed > this.orbitSpeed ? 0.70 : 0.35);
      }
      this.orbitAngle = ((this.orbitAngle || 0) + this.orbitSpeed * safeDt) % (Math.PI * 20000);
    },

    forceHypeDrop(durationSec = 14) {
      this.forcedDropUntil = performance.now() + durationSec * 1000;
      triggerRave();
      dancers.forEach(d => { d.isJumping = true; });
      setTimeout(() => {
        dancers.forEach(d => { d.isJumping = false; });
      }, 4500);
    }
  };

  function getSmoothSmoothTime(dt, beatOffset, beatDuration) {
    const rawTime = getSmoothPlayTime(dt);
    if (!beatDuration || beatDuration <= 0) return rawTime;
    const phaseOffset = (beatOffset || 0) % beatDuration;
    return rawTime - phaseOffset;
  }

  // Utility to draw a sharp 4-pointed sparkle star with glow
  function drawSparkleStar(ctx, x, y, radius, fillColor, glowColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.quadraticCurveTo(0, 0, 0, radius);
    ctx.quadraticCurveTo(0, 0, -radius, 0);
    ctx.quadraticCurveTo(0, 0, 0, -radius);
    ctx.closePath();
    ctx.fillStyle = fillColor || '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  // Utility to draw an 8-pointed royal celestial star flare (for Top 1 Emperor)
  function drawSparkleStar8(ctx, x, y, radius, colorOuter, colorCore, rotAngle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotAngle || 0);

    // 1. Center soft radial glow
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 0.7);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, colorOuter || '#ffe600');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 2. 4 Main Cardinal Spikes (Long & Piercing)
    ctx.fillStyle = colorCore || '#ffffff';
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.quadraticCurveTo(radius * 0.08, 0, 0, radius);
      ctx.quadraticCurveTo(-radius * 0.08, 0, 0, -radius);
      ctx.fill();
      ctx.restore();
    }

    // 3. 4 Diagonal Spikes
    const diagR = radius * 0.52;
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate(Math.PI / 4 + i * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -diagR);
      ctx.quadraticCurveTo(diagR * 0.09, 0, 0, diagR);
      ctx.quadraticCurveTo(-diagR * 0.09, 0, 0, -diagR);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // Utility to draw a Cyber Sci-Fi Anamorphic Lens Flare (for Top 2 Cyber Overlord)
  function drawCyberSciFiFlare(ctx, x, y, radius, colorOuter) {
    ctx.save();
    ctx.translate(x, y);

    // Anamorphic horizontal laser streak
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 2.4, radius * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vertical sharp streak
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.12, radius * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cyan soft glow
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 0.8);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, colorOuter || '#00f0ff');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Utility to draw jumping golden plasma lightning sparks (for Top 1 Emperor)
  function drawPlasmaSparks(ctx, x1, y1, x2, y2, seed, color, width) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const steps = 4;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const jitter = (Math.sin(seed * 11.7 + s * 4.3) * 2 - 1) * 7;
      const nx = -(y2 - y1);
      const ny = (x2 - x1);
      const len = Math.hypot(nx, ny) || 1;
      ctx.lineTo(x1 + (x2 - x1) * t + (nx / len) * jitter, y1 + (y2 - y1) * t + (ny / len) * jitter);
    }
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }


  // 3D Beat-Synced Orbiting Celestial Halo & Orbs for VIP Top 1, 2, 3 (Clean, Elegant Single Ring)
  function drawVIPOrbitEffect(ctx, vipRank, catCenterY, catVisualW, curNow, beatEngine, kickImpulse, isFrontPass) {
    if (!vipRank || vipRank < 1 || vipRank > 3) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // Additive concert lighting glow

    const bass = beatEngine.bassLevel || 0;
    const kick = kickImpulse || 0;
    const orbitAngle = (beatEngine && beatEngine.orbitAngle !== undefined)
      ? beatEngine.orbitAngle
      : (curNow * 0.002);
    const orbitSpeed = (beatEngine && beatEngine.orbitSpeed !== undefined)
      ? beatEngine.orbitSpeed
      : 1.0;
    const beatPhase = (beatEngine && beatEngine.beatPhase !== undefined) ? beatEngine.beatPhase : 0;
    const kickSnap = Math.pow(Math.max(0, 1.0 - beatPhase * 2.2), 2.2);

    const startArc = isFrontPass ? 0 : Math.PI;
    const endArc = isFrontPass ? Math.PI : Math.PI * 2;

    let orbCount = 4;
    let baseAngle = orbitAngle;
    let dir = 1;
    let tilt = -0.20;
    let rx = catVisualW * 0.94 * (1.0 + bass * 0.14 + kick * 0.08);
    let ry = catVisualW * 0.38 * (1.0 + bass * 0.10);
    let ringOuterColor = 'rgba(255, 215, 0, 0.45)';
    let ringCoreColor = 'rgba(255, 255, 220, 0.90)';
    let orbOuterColor = '#ffe600';
    let orbCoreColor = '#ffffff';
    let orbBaseSize = 7.5;

    if (vipRank === 1) {
      // 👑 TOP 1: Imperial Gold (1 Vòng Hoàng Kim Tinh Tế, 4 Ngọc Mặt Trời, Ngầu & Sang Nhất)
      orbCount = 4;
      dir = 1;
      tilt = -0.20;
      rx = catVisualW * 0.96 * (1.0 + bass * 0.15 + kick * 0.08);
      ry = catVisualW * 0.38 * (1.0 + bass * 0.10);
      baseAngle = orbitAngle;
      ringOuterColor = `rgba(255, 215, 0, ${0.40 + bass * 0.30 + kickSnap * 0.18})`;
      ringCoreColor = `rgba(255, 255, 225, ${0.85 + bass * 0.15})`;
      orbOuterColor = '#ffe600';
      orbCoreColor = '#ffffff';
      orbBaseSize = 7.5;
    } else if (vipRank === 2) {
      // 💎 TOP 2: Electric Cyan Diamond (1 Vòng Kim Cương Neon, 3 Tinh Thể Xoay)
      orbCount = 3;
      dir = -1;
      tilt = 0.20;
      rx = catVisualW * 0.88 * (1.0 + bass * 0.13 + kick * 0.06);
      ry = catVisualW * 0.35 * (1.0 + bass * 0.09);
      baseAngle = -orbitAngle;
      ringOuterColor = `rgba(0, 240, 255, ${0.35 + bass * 0.30 + kickSnap * 0.15})`;
      ringCoreColor = `rgba(220, 250, 255, ${0.85 + bass * 0.15})`;
      orbOuterColor = '#00f0ff';
      orbCoreColor = '#ffffff';
      orbBaseSize = 6.6;
    } else if (vipRank === 3) {
      // 🔥 TOP 3: Warm Amber Flame (1 Vòng Hổ Phách Ấm, 3 Quả Cầu Lửa)
      orbCount = 3;
      dir = 1;
      tilt = -0.15;
      rx = catVisualW * 0.82 * (1.0 + bass * 0.12 + kick * 0.05);
      ry = catVisualW * 0.32 * (1.0 + bass * 0.08);
      baseAngle = orbitAngle + Math.PI;
      ringOuterColor = `rgba(255, 140, 0, ${0.35 + bass * 0.30 + kickSnap * 0.15})`;
      ringCoreColor = `rgba(255, 235, 175, ${0.80 + bass * 0.20})`;
      orbOuterColor = '#ff8c00';
      orbCoreColor = '#ffffff';
      orbBaseSize = 6.0;
    }

    // 1. Draw Single Clean Ring (Back Arc: PI -> 2PI in back pass; Front Arc: 0 -> PI in front pass)
    ctx.save();
    // A. Soft Neon Glow
    ctx.beginPath();
    ctx.ellipse(0, catCenterY, rx, ry, tilt, startArc, endArc);
    ctx.lineWidth = (isFrontPass ? 4.5 : 2.5) + bass * 2.2 + kickSnap * 1.8;
    ctx.strokeStyle = ringOuterColor;
    ctx.stroke();

    // B. Sharp Bright Core Filament
    ctx.beginPath();
    ctx.ellipse(0, catCenterY, rx, ry, tilt, startArc, endArc);
    ctx.lineWidth = (isFrontPass ? 1.8 : 1.0) + bass * 0.6;
    ctx.strokeStyle = ringCoreColor;
    ctx.stroke();
    ctx.restore();

    // 2. Draw Orbiting Orbs and Sleek Motion Trails
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);

    for (let i = 0; i < orbCount; i++) {
      const orbAngle = baseAngle + (i * (Math.PI * 2 / orbCount));
      const normAngle = ((orbAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const isFront = Math.sin(normAngle) >= 0;

      // Depth culling: only draw during matching pass (back pass: behind body; front pass: in front of body)
      if (isFront !== isFrontPass) continue;

      const z = Math.sin(normAngle); // -1 (deep behind) to +1 (front center)
      const depthScale = 1.0 + z * 0.30; // 0.70x in back to 1.30x in front

      // A. Smooth Comet Motion Trail (3 clean motes)
      const trailSpacing = 0.05 + Math.min(0.10, orbitSpeed * 0.008);
      for (let t = 3; t >= 1; t--) {
        const trailAngle = orbAngle - dir * (t * trailSpacing);
        const trailNorm = ((trailAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if ((Math.sin(trailNorm) >= 0) === isFrontPass) {
          const tu = rx * Math.cos(trailAngle);
          const tv = ry * Math.sin(trailAngle);
          const tx = tu * cosTilt - tv * sinTilt;
          const ty = catCenterY + tu * sinTilt + tv * cosTilt;
          const trailAlpha = (1 - t / 4) * (0.35 + bass * 0.40);
          const trailR = orbBaseSize * depthScale * (1 - t * 0.22);

          ctx.save();
          ctx.beginPath();
          ctx.arc(tx, ty, Math.max(1, trailR), 0, Math.PI * 2);
          ctx.fillStyle = ringOuterColor;
          ctx.globalAlpha = trailAlpha;
          ctx.fill();
          ctx.restore();
        }
      }

      // B. Main Orbiting Orb Coordinates
      const u = rx * Math.cos(orbAngle);
      const v = ry * Math.sin(orbAngle);
      const ox = u * cosTilt - v * sinTilt;
      const oy = catCenterY + u * sinTilt + v * cosTilt;
      const curSize = orbBaseSize * depthScale * (1.0 + bass * 0.20 + kickSnap * 0.15);

      ctx.save();
      // Outer Soft Radiant Halo
      const haloR = curSize * 2.6 * (1.0 + bass * 0.30 + kickSnap * 0.20);
      const haloGrad = ctx.createRadialGradient(ox, oy, curSize * 0.2, ox, oy, haloR);
      haloGrad.addColorStop(0, orbOuterColor);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(ox, oy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Core Solid Shape
      if (vipRank === 2) {
        // Top 2: Diamond Crystal Shape (Rhombus)
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(Math.PI / 4 + curNow * 0.003);
        ctx.beginPath();
        const dR = curSize * 1.15;
        ctx.rect(-dR * 0.7, -dR * 0.7, dR * 1.4, dR * 1.4);
        ctx.fillStyle = orbCoreColor;
        ctx.shadowColor = orbOuterColor;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      } else {
        // Top 1 & Top 3: Luminous Sphere
        ctx.beginPath();
        ctx.arc(ox, oy, curSize, 0, Math.PI * 2);
        ctx.fillStyle = orbCoreColor;
        ctx.shadowColor = orbOuterColor;
        ctx.shadowBlur = 12;
        ctx.fill();
      }

      // Sparkle Cross Flare on Front Pass (Crisp & Subtle)
      if (isFrontPass) {
        const starRadius = (curSize * 1.5 + Math.sin(curNow * 0.012 + i) * 2.0) * (1.0 + bass * 0.35 + kickSnap * 0.25);
        drawSparkleStar(ctx, ox, oy, starRadius, '#ffffff', orbOuterColor);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // Dancer Class
  class Dancer {
    constructor(data) {
      this.id = data.id || data.username;
      this.username = data.username || 'VIP';
      this.nickname = data.nickname || this.username;
      this.avatar = data.avatar || '';
      this.charCategory = data.charCategory || (currentTheme === 'cats' ? 'cat' : (currentTheme === 'humans' ? 'human' : (Math.random() < 0.35 ? 'cat' : 'human')));
      this.gender = data.gender || (Math.random() < 0.5 ? 'male' : 'female');
      this.charType = data.charType || (Math.floor(Math.random() * 3) + 1); // 1, 2, or 3
      this.danceStyle = data.danceStyle || (Math.floor(Math.random() * 3) + 1); // 1: Rave Wave, 2: Shuffle Footwork, 3: Hands Up
      // Floor coordinates (Normalized: x in 0.12..0.88, y in 0.52..0.92)
      this.x = data.x !== undefined ? data.x : (0.15 + Math.random() * 0.7);
      this.y = data.y !== undefined ? data.y : (0.54 + Math.random() * 0.38);
      this.targetX = this.x;
      this.targetY = this.y;
      this.score = data.score || 0;
      this.hue = Math.floor(Math.random() * 360);
      this.frameIndex = 0;
      this.scale = 0.48 + (this.y - 0.65) * 0.12; // Perspective scaling for crowd (smaller, cute chibi)
      this.isJumping = false;
      this.jumpOffset = 0;
      this.bounceY = 0;
      this.swayAngle = 0;
      this.squash = 1;
      this.kickImpulse = 0;
      this.isVip = false;
      this.vipRank = data.vipRank || 0; // 0 = crowd, 1 = Top 1, 2 = Top 2, 3 = Top 3
    }

    getFrames() {
      const catList = spriteCache[`char${this.charType}`] || spriteCache.char1;
      return (catList && catList.length > 0) ? catList : (spriteCache.char1 || []);
    }
    getUniformTier() {
      if (this.vipRank === 1) return 'top1';
      if (this.vipRank === 2) return 'top2';
      if (this.vipRank === 3) return 'top3';
      return 'regular';
    }

    getAdaptiveFrame(totalFrames, beatEngine) {
      if (beatEngine.danceEnergy < 0.12) {
        return 0; // Chill mode: rest frame
      }

      const bpm = beatEngine.bpm;
      const bassLevel = beatEngine.bassLevel;
      const danceCycle = beatEngine.danceCycle; // 0..1 over 2 beats

      // Quyết định: Cắt bớt frame (Fast-Cut Rave) hay Tăng frame/Giữ đủ (Smooth Groove)
      const isFastDrop = (bassLevel > 0.55) || (bpm >= 145);

      if (isFastDrop) {
        // ========================================================
        // ⚡ CẮT BỚT FRAME (SNAPPY KEYFRAME RAVE):
        // Bỏ qua các frame trung gian, tạo cú chém tay dứt khoát
        // theo từng cú đập trống Kick, cực bốc và sắc nét!
        // ========================================================
        const half = (danceCycle * 2) % 1.0; // 0..1 trong 1 nhịp beat
        const side = danceCycle < 0.5 ? 0 : 1;
        const snap = Math.pow(half, 0.65); // Snap rapidly to apex

        if (this.charCategory === 'human') {
          return Math.floor(danceCycle * totalFrames) % totalFrames;
        } else if (this.charType === 2) {
          // char2 (13 frame): Cắt bớt, chỉ lấy 4 keyframe chính mỗi bên
          const keys0 = [0, 2, 4, 6];
          const keys1 = [6, 8, 10, 12];
          const arr = side === 0 ? keys0 : keys1;
          const kIdx = Math.min(arr.length - 1, Math.floor(snap * arr.length));
          return arr[kIdx];
        } else if (this.charType === 1) {
          // char1 (14 frame): Cắt bớt, chỉ giữ keyframe đỉnh
          const keys0 = [1, 4, 7];
          const keys1 = [7, 10, 13];
          const arr = side === 0 ? keys0 : keys1;
          const kIdx = Math.min(arr.length - 1, Math.floor(snap * arr.length));
          return arr[kIdx];
        } else {
          // char3 (14 frame):
          const keys0 = [0, 2, 5];
          const keys1 = [7, 10, 13];
          const arr = side === 0 ? keys0 : keys1;
          const kIdx = Math.min(arr.length - 1, Math.floor(snap * arr.length));
          return arr[kIdx];
        }

      } else {
        // ========================================================
        // 🌊 TĂNG FRAME / GIỮ ĐỦ BỘ FRAME MƯỢT MÀ (SMOOTH GROOVE):
        // Đi trọn vẹn toàn bộ 14 frame với đường cong Swing uốn nhịp
        // để chuyển động khoan thai, dẻo dai, không bị giật
        // ========================================================
        const swing = (Math.sin((danceCycle - 0.25) * Math.PI * 2) + 1) * 0.5;
        return Math.floor(swing * totalFrames) % totalFrames;
      }
    }

    update(dt, beatEngine, now) {
      // Smooth movement towards target (keeps position on dance floor)
      this.x += (this.targetX - this.x) * 0.05;
      this.y += (this.targetY - this.y) * 0.05;

      // Scale hierarchy: Top 1 (TO NHẤT: 1.38) > Top 2 (VỪA VẶN TRÊN BỤC BẠC: 0.88) > Top 3 (VỪA VẶN TRÊN BỤC ĐỒNG: 0.78) > Không có top (NHỎ NHẤT: 0.48 ~ 0.52)
      if (this.vipRank === 1) {
        this.scale = 1.38; // Top 1: TO NHẤT (Vĩ đại, áp đảo sàn nhảy!)
      } else if (this.vipRank === 2) {
        this.scale = 0.88; // Top 2: TO NHÌ (Nhỏ hơn Top 1 ~36%, vừa vặn hoàn hảo trên bục bạc)
      } else if (this.vipRank === 3) {
        this.scale = 0.78; // Top 3: TO BA (Nhỏ hơn Top 2 ~11%, vừa vặn hoàn hảo trên bục đồng)
      } else {
        // Không có top: NHỎ NHẤT (Khán giả chibi quẩy dưới sàn)
        this.scale = 0.48 + Math.max(0, (this.y - 0.65)) * 0.10; // Dao động 0.48 đến 0.52
      }

      const frames = this.getFrames();
      const totalFrames = frames && frames.length > 0 ? frames.length : 14;

      if (beatEngine.danceEnergy < 0.18 || !beatEngine.isBassActive) {
        // ========================================================
        // 💤 CHILL MODE: ĐOẠN KHÔNG CÓ BASS / NHẠC DẠO
        // "Trường hợp không có bass vẫn nên nhúng nhẹ nhàng, không quơ gậy"
        // 1. Không quơ gậy: Khóa cố định Frame 0 (gậy sáng giữ yên trước ngực, KHÔNG VUNG TAY)
        // 2. Nhúng nhẹ nhàng: Nhún người hạ thấp xuống 24px (dip down) nhịp nhàng theo BPM bài hát
        // 3. Đàn hồi nhún chân (squash 12%): Hạ thấp người, nén dẹt và bật dậy rõ rệt trên từng nhịp
        // 4. Lắc lư nhẹ nhàng (sway ±2°): Thân mình nghiêng nhẹ nhàng theo phách nhạc
        // ========================================================
        this.frameIndex = 0;
        const dip = Math.sin(beatEngine.beatPhase * Math.PI);
        this.bounceY = dip * (this.vipRank > 0 ? 8 : 16); // Nhún người nhịp nhàng trên mặt sàn/bục!
        this.squash = 1.0 - (dip * 0.12); // Nén gối đàn hồi 12% rõ rệt
        this.swayAngle = Math.sin(beatEngine.beatProgress * Math.PI) * 0.035; // Lắc lư thân mình
        this.kickImpulse = 0;

      } else {
        // ========================================================
        // 🔥 BASS DỒN DẬP: TẤT CẢ VŨ CÔNG ĐỒNG BỘ 100% THEO NHỊP BASS
        // ========================================================
        // 1. Quơ tay với Tốc độ & Bộ Frame Thích ứng (Cắt bớt / Tăng frame):
        this.frameIndex = this.getAdaptiveFrame(totalFrames, beatEngine);

        // 2. TĂNG GIẢM ĐỘ NHÚNG THEO BASS (Dynamic Bass Bounce Scaling):
        // Khi Bass nhẹ (bassLevel ~0.2) -> nhún nhẹ nhàng 5px - 9px.
        // Khi Bass vừa (bassLevel ~0.5) -> nhún vừa phải 14px - 20px.
        // Khi Bass dồn dập (bassLevel ~0.8 - 1.0) -> nhún nảy cực bốc 32px - 45px!
        const dynamicHeight = (4 + Math.pow(beatEngine.bassLevel, 1.35) * 32) * beatEngine.danceEnergy;
        const bounceCurve = Math.sin(beatEngine.beatPhase * Math.PI);
        this.bounceY = bounceCurve * dynamicHeight + (this.kickImpulse * 14);

        // Squash đàn hồi: Bass càng mạnh thì nén người tiếp đất càng sâu (tới 18%)
        const dynamicSquash = 0.05 + beatEngine.bassLevel * 0.12;
        this.squash = 1.0 - (bounceCurve * dynamicSquash * beatEngine.danceEnergy) + (this.kickImpulse * 0.08);

        // 3. Lắc lư thân mình theo góc vung que sáng (Sway ±6 độ):
        this.swayAngle = Math.sin(beatEngine.danceCycle * Math.PI * 2) * (0.04 + beatEngine.bassLevel * 0.07) * beatEngine.danceEnergy;

        // 4. Loa & hiệu ứng nảy trên nhịp đập:
        if (beatEngine.isBeatHit) {
          this.kickImpulse = 1.0;
        }
        this.kickImpulse *= 0.85;
      }

      // Jump physics for gifts
      if (this.isJumping) {
        this.jumpOffset = Math.abs(Math.sin((now || performance.now()) * 0.016)) * 45;
      } else {
        this.jumpOffset = 0;
      }
    }

    render(ctx, now) {
      const frames = this.getFrames();
      if (!frames || frames.length === 0) return;

      const curNow = now || performance.now();
      const fIdx = this.frameIndex % frames.length;
      const img = frames[fIdx];
      if (!img) return;
      if (img.complete !== undefined && (!img.complete || img.naturalWidth === 0)) return;

      const charKey = 'char' + (this.charType || 1);
      const metaList = CAT_SPRITE_META[charKey] || CAT_SPRITE_META.char1;
      const meta = (metaList && metaList[fIdx % metaList.length]) || [160, 175, 95, 128];
      const bodyCX = meta[0];
      const bodyBottomY = meta[1];
      const bodyH = meta[2];
      const bodyCY = meta[3];

      // Normalize char3 (which has a 1.58x native resolution) to match char1 & char2 perfectly
      const charScaleMultiplier = this.charType === 3 ? 0.65 : 1.0;
      const drawScale = this.scale * 1.1 * charScaleMultiplier;
      const screenX = this.x * W;
      const totalYOffset = this.jumpOffset + this.bounceY;
      const screenY = this.y * H - totalYOffset;

      const catVisualW = 145 * drawScale;
      const catVisualH = (this.charType === 3 ? bodyH * 0.65 : bodyH) * (this.scale * 1.1);
      const catCenterY = -(bodyBottomY - (bodyBottomY - bodyH / 2)) * drawScale;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.swayAngle);
      ctx.scale(1 / this.squash, this.squash);

      // Floor Shadow: Drawn exactly at feet contact (y = 0)
      ctx.save();
      ctx.scale(this.squash, 1 / this.squash);
      ctx.rotate(-this.swayAngle);
      ctx.beginPath();
      const shadowScale = Math.max(0.45, 1 - (totalYOffset / 110));
      ctx.ellipse(0, 0, (catVisualW * 0.45) * shadowScale, (catVisualW * 0.16) * shadowScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowScale})`;
      ctx.fill();
      ctx.restore();

      // ========================================================
      // 1. VIP AURAS (Centered on cat body center)
      // ========================================================
      if (this.vipRank === 1) {
        // TOP 1: Super Saiyan Imperial Golden Aura
        ctx.save();
        const auraR = catVisualW * 0.95 * (1.0 + beatEngine.bassLevel * 0.18);
        const auraGrad = ctx.createRadialGradient(0, catCenterY, catVisualW * 0.2, 0, catCenterY, auraR);
        auraGrad.addColorStop(0, 'rgba(255, 240, 100, 0.45)');
        auraGrad.addColorStop(0.5, 'rgba(255, 193, 7, 0.3)');
        auraGrad.addColorStop(1, 'rgba(255, 111, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, catCenterY, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (this.vipRank === 2) {
        // TOP 2: Electric Cyan / Silver Overlord Aura
        ctx.save();
        const auraR = catVisualW * 0.88 * (1.0 + beatEngine.bassLevel * 0.14);
        const auraGrad = ctx.createRadialGradient(0, catCenterY, catVisualW * 0.15, 0, catCenterY, auraR);
        auraGrad.addColorStop(0, 'rgba(0, 240, 255, 0.42)');
        auraGrad.addColorStop(0.6, 'rgba(0, 140, 255, 0.22)');
        auraGrad.addColorStop(1, 'rgba(0, 60, 180, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, catCenterY, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (this.vipRank === 3) {
        // TOP 3: Warm Amber Bronze Warrior Aura
        ctx.save();
        const auraR = catVisualW * 0.80 * (1.0 + beatEngine.bassLevel * 0.12);
        const auraGrad = ctx.createRadialGradient(0, catCenterY, catVisualW * 0.12, 0, catCenterY, auraR);
        auraGrad.addColorStop(0, 'rgba(255, 140, 0, 0.4)');
        auraGrad.addColorStop(0.6, 'rgba(217, 119, 6, 0.2)');
        auraGrad.addColorStop(1, 'rgba(120, 53, 15, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, catCenterY, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (this.isVip) {
        ctx.beginPath();
        ctx.arc(0, catCenterY, catVisualW * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 230, 0, 0.22)';
        ctx.fill();
      }

      // Draw Back Half of 3D Orbiting Halo & Orbs (BEHIND Cat Body)
      if (this.vipRank >= 1 && this.vipRank <= 3) {
        drawVIPOrbitEffect(ctx, this.vipRank, catCenterY, catVisualW, curNow, beatEngine, this.kickImpulse, false);
      }

      // ========================================================
      // 2. Draw Cat Sprite (Exact Body Center at x=0, Feet at y=0)
      // ========================================================
      const imgX = -bodyCX * drawScale;
      const imgY = -bodyBottomY * drawScale;
      ctx.drawImage(img, imgX, imgY, img.width * drawScale, img.height * drawScale);

      // Glowstick pulse on beat impact for char 2
      if (this.charType === 2 && this.kickImpulse > 0.15) {
        ctx.save();
        ctx.globalAlpha = this.kickImpulse * 0.7;
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(-catVisualW * 0.35, catCenterY, 16 * this.kickImpulse, 0, Math.PI * 2);
        ctx.arc(catVisualW * 0.35, catCenterY, 16 * this.kickImpulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Front Half of 3D Orbiting Halo & Orbs (IN FRONT OF Cat Body)
      if (this.vipRank >= 1 && this.vipRank <= 3) {
        drawVIPOrbitEffect(ctx, this.vipRank, catCenterY, catVisualW, curNow, beatEngine, this.kickImpulse, true);
      }

      // ========================================================
      // 3. FLOATING NAME TAG (Neatly above cat ears)
      // ========================================================
      ctx.save();
      ctx.rotate(-this.swayAngle);
      let nameText = this.nickname;
      let badgePrefix = '';
      // Increased font size for EVERYONE (thẻ tên mọi người to lên rõ ràng!)
      let fontSize = 18; // Regular crowd increased from 15px -> 18px
      let tagHeight = 31; // Increased from 26px
      let textPadY = 22;

      if (this.vipRank === 1) {
        badgePrefix = '👑 '; // Removed "TOP 1 • " as requested
        fontSize = 25;      // Increased from 21px -> 25px
        tagHeight = 42;     // Increased from 36px
        textPadY = 29;
      } else if (this.vipRank === 2) {
        badgePrefix = '🥈 '; // Removed "TOP 2 • " as requested
        fontSize = 21;      // Increased from 17px -> 21px
        tagHeight = 36;     // Increased from 30px
        textPadY = 25;
      } else if (this.vipRank === 3) {
        badgePrefix = '🥉 '; // Removed "TOP 3 • " as requested
        fontSize = 21;      // Increased from 17px -> 21px
        tagHeight = 36;     // Increased from 30px
        textPadY = 25;
      }

      ctx.font = `bold ${fontSize}px "Rajdhani", sans-serif`;
      const fullText = badgePrefix + nameText;
      const textWidth = ctx.measureText(fullText).width;
      const tagWidth = Math.max(textWidth + 28, 98);
      // Stable reference height (102px body height) so tag doesn't jitter
      const standardHeadHeight = 102 * (this.scale * 1.1);
      const tagY = -standardHeadHeight - tagHeight - 6;

      // Tag Background
      let tagBg, tagBorder, tagTextCol;
      if (this.vipRank === 1) {
        tagBg = ctx.createLinearGradient(-tagWidth / 2, tagY, tagWidth / 2, tagY + tagHeight);
        tagBg.addColorStop(0, '#ffe600');
        tagBg.addColorStop(1, '#ff9900');
        tagBorder = '#ffffff';
        tagTextCol = '#000000';
      } else if (this.vipRank === 2) {
        tagBg = ctx.createLinearGradient(-tagWidth / 2, tagY, tagWidth / 2, tagY + tagHeight);
        tagBg.addColorStop(0, '#e0f7fa');
        tagBg.addColorStop(1, '#00b4d8');
        tagBorder = '#ffffff';
        tagTextCol = '#000000';
      } else if (this.vipRank === 3) {
        tagBg = ctx.createLinearGradient(-tagWidth / 2, tagY, tagWidth / 2, tagY + tagHeight);
        tagBg.addColorStop(0, '#ffedd5');
        tagBg.addColorStop(1, '#d97706');
        tagBorder = '#ffffff';
        tagTextCol = '#000000';
      } else {
        tagBg = this.isVip ? 'rgba(255, 215, 0, 0.9)' : 'rgba(15, 20, 40, 0.85)';
        tagBorder = this.isVip ? '#ffffff' : 'rgba(0, 240, 255, 0.8)';
        tagTextCol = this.isVip ? '#000000' : '#ffffff';
      }

      ctx.fillStyle = tagBg;
      ctx.strokeStyle = tagBorder;
      ctx.lineWidth = (this.vipRank > 0) ? 2.5 : 1.8;
      ctx.beginPath();
      ctx.roundRect(-tagWidth / 2, tagY, tagWidth, tagHeight, 8);
      ctx.fill();
      ctx.stroke();

      // Name Text
      ctx.fillStyle = tagTextCol;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `bold ${fontSize}px "Rajdhani", sans-serif`;
      ctx.fillText(fullText, 0, tagY + textPadY);
      ctx.restore();

      ctx.restore();
    }
  }

  // Particle Generators (Concert Stage Flame Cannons & CO2 Cryo Geysers)
  function triggerFlame() {
    sfx.playBassDrop();
    const stageY = H * 0.36;
    for (let k = 0; k < 2; k++) {
      const originX = k === 0 ? 220 : 860;
      const originY = stageY + 50;
      for (let i = 0; i < 48; i++) {
        const spread = (Math.random() - 0.5) * 0.25;
        const speed = 20 + Math.random() * 28;
        flames.push({
          x: originX + (Math.random() - 0.5) * 40,
          y: originY,
          vx: Math.sin(spread) * speed * 0.35,
          vy: -Math.cos(spread) * speed,
          size: 32 + Math.random() * 45,
          color: Math.random() > 0.35 ? '#ff3b00' : '#ffe600',
          alpha: 1,
          decay: 0.022 + Math.random() * 0.018
        });
      }
    }
  }

  function triggerSmoke() {
    // Twin CO2 Cryo Cannons mounted beside DJ booth, blasting upward to the ceiling!
    const stageY = H * 0.36;
    for (let k = 0; k < 2; k++) {
      const originX = k === 0 ? 200 : 880;
      const originY = stageY + 50;
      for (let i = 0; i < 50; i++) {
        const spreadAngle = (Math.random() - 0.5) * 0.32 + (k === 0 ? 0.12 : -0.12);
        const speed = 22 + Math.random() * 28;
        fogs.push({
          x: originX + (Math.random() - 0.5) * 35,
          y: originY,
          vx: Math.sin(spreadAngle) * speed * 0.45,
          vy: -Math.cos(spreadAngle) * speed, // Blasts UPWARDS like genuine festival cryo jets!
          radius: 28 + Math.random() * 32,
          growth: 2.2,
          alpha: 0.85,
          decay: 0.011 + Math.random() * 0.007,
          color: Math.random() > 0.35 ? 'rgba(235, 250, 255, ' : 'rgba(0, 240, 255, '
        });
      }
    }
  }

  function triggerFireworks() {
    sfx.playFireworks();
    for (let b = 0; b < 3; b++) {
      const cx = 200 + Math.random() * 680;
      const cy = 250 + Math.random() * 400;
      const colors = ['#ff007f', '#00f0ff', '#ffe600', '#00ff66', '#b000ff'];
      const chosenColor = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 16;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: chosenColor,
          size: 4 + Math.random() * 6,
          alpha: 1,
          decay: 0.015 + Math.random() * 0.015,
          gravity: 0.25
        });
      }
    }
  }

  function triggerConfetti() {
    const colors = ['#ff007f', '#00f0ff', '#ffe600', '#00ff66', '#ffffff'];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * W,
        y: -20,
        vx: (Math.random() - 0.5) * 8,
        vy: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 8 + Math.random() * 10,
        alpha: 1,
        decay: 0.004,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        gravity: 0.1,
        isConfetti: true
      });
    }
  }

  function triggerRave() {
    triggerFlame();
    triggerSmoke();
    triggerFireworks();
    sfx.playAirhorn();
    const strobe = document.getElementById('strobe-fx');
    if (strobe) {
      strobe.classList.remove('active');
      void strobe.offsetWidth; // force reflow
      strobe.classList.add('active');
    }
  }

  function addFloatingHeart(x = W * 0.5) {
    floatingHearts.push({
      x: x + (Math.random() - 0.5) * 80,
      y: H - 100,
      vx: (Math.random() - 0.5) * 3,
      vy: -6 - Math.random() * 6,
      scale: 0.8 + Math.random() * 0.6,
      alpha: 1,
      decay: 0.012,
      emoji: ['❤️', '💖', '🔥', '✨', '💎'][Math.floor(Math.random() * 5)]
    });
  }

  // Helper to find dancer by any username or nickname variant
  function findDancerByAnyName(username, nickname) {
    if (!dancers || dancers.length === 0) return null;
    const u = (username || '').toLowerCase().trim();
    const n = (nickname || '').toLowerCase().trim();
    return dancers.find(d => {
      const du = (d.username || '').toLowerCase().trim();
      const dn = (d.nickname || '').toLowerCase().trim();
      const did = (d.id || '').toLowerCase().trim();
      return (du && (du === u || du === n)) ||
             (dn && (dn === u || dn === n)) ||
             (did && (did === u || did === n));
    });
  }

  // Active Speech Bubble floating directly above dancer's head/nametag
  function addSpeechBubble(username, nickname, text) {
    if (!text || typeof text !== 'string') return;
    const rawClean = text.trim();
    if (!rawClean) return;

    // Apply Client-Side Profanity Filter (Double defense against TikTok ban)
    const cleanText = (typeof ProfanityFilter !== 'undefined' && ProfanityFilter.clean)
      ? ProfanityFilter.clean(rawClean)
      : rawClean;

    let targetDancer = findDancerByAnyName(username, nickname);

    // Remove any existing active bubble for this user to avoid overlapping clutter
    for (let i = speechBubbles.length - 1; i >= 0; i--) {
      const b = speechBubbles[i];
      if ((b.username && b.username.toLowerCase() === (username || '').toLowerCase()) ||
          (b.nickname && b.nickname.toLowerCase() === (nickname || '').toLowerCase())) {
        speechBubbles.splice(i, 1);
      }
    }

    const defaultX = targetDancer ? targetDancer.x : 0.5;
    const defaultY = targetDancer ? targetDancer.y : 0.75;

    speechBubbles.push({
      username: username || '',
      nickname: nickname || username || '',
      text: cleanText,
      x: defaultX,
      y: defaultY,
      targetDancer,
      createdAt: performance.now(),
      duration: 5000 // 5 seconds duration
    });
  }

  // Synchronized Sequential Queue for DJ Screen Showcase + Voice Reading
  let activeDJScreenGift = null;

  class GiftShowcaseQueue {
    constructor() {
      this.queue = [];
      this.isProcessing = false;
    }

    enqueue(gift) {
      if (!gift) return;

      const userKey = gift.username || gift.nickname || 'guest';
      const giftName = gift.giftName || 'quà';
      const repeatCount = gift.repeatCount || 1;
      const diamondCount = gift.diamondCount || 0;

      // Smart aggregation: Combine repeats if already in queue waiting
      const existing = this.queue.find(
        g => (g.username === userKey || g.nickname === userKey) && g.giftName === giftName
      );

      if (existing) {
        existing.repeatCount = (existing.repeatCount || 1) + repeatCount;
        existing.diamondCount = (existing.diamondCount || 0) + diamondCount;
      } else {
        this.queue.push({
          username: gift.username || '',
          nickname: gift.nickname || gift.username || 'Đại Gia',
          avatar: gift.avatar || '',
          giftName: gift.giftName || 'Quà Tặng VIP',
          giftPictureUrl: gift.giftPictureUrl || gift.giftImage || '',
          repeatCount: repeatCount,
          diamondCount: diamondCount,
          fxType: gift.fxType || 'cheer'
        });
      }

      // Max 8 gifts in queue to keep it timely
      if (this.queue.length > 8) {
        this.queue.splice(2, this.queue.length - 8);
      }

      if (!this.isProcessing) {
        this.processNext();
      }
    }

    async processNext() {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        activeDJScreenGift = null; // Smoothly reverts DJ Screen back to 3 Top VIPs
        return;
      }

      this.isProcessing = true;
      const gift = this.queue.shift();

      // Display duration on DJ Screen: 3.5s minimum (or 2.6s if queue has backlog)
      const minDisplayTime = this.queue.length > 2 ? 2600 : 3600;
      const now = performance.now();

      // 1. Activate DJ Screen Showcase
      activeDJScreenGift = {
        ...gift,
        startTime: now,
        expiry: now + minDisplayTime + 8000
      };

      // 2. Play chime & trigger FX
      if (window.sfx && typeof sfx.playGiftChime === 'function') {
        sfx.playGiftChime();
      }
      this._triggerFX(gift.fxType);

      // 3. Make target dancer celebrate jump
      const gifterDancer = dancers.find(d => d.username === gift.username || d.nickname === gift.nickname);
      if (gifterDancer) {
        gifterDancer.isJumping = true;
        setTimeout(() => { if (gifterDancer) gifterDancer.isJumping = false; }, 2500);
      }

      // 4. Synchronized Voice Reading (Resolves strictly when audio ends)
      let ttsPromise = Promise.resolve();
      if (window.TTSMCManager && TTSMCManager.enabled) {
        if (typeof TTSMCManager.speakGiftAsync === 'function') {
          ttsPromise = TTSMCManager.speakGiftAsync(gift);
        }
      }

      // 5. Wait for BOTH reading to finish AND minimum screen display time
      const minTimerPromise = new Promise(r => setTimeout(r, minDisplayTime));
      await Promise.all([ttsPromise, minTimerPromise]);

      // 6. Brief 200ms visual buffer before displaying next gift
      await new Promise(r => setTimeout(r, 200));

      // 7. Proceed to next gift in queue!
      this.processNext();
    }

    _triggerFX(fxType) {
      if (fxType === 'mega_rave') triggerRave();
      else if (fxType === 'fireworks') triggerFireworks();
      else if (fxType === 'flame') triggerFlame();
      else if (fxType === 'smoke') triggerSmoke();
      else if (fxType === 'confetti') triggerConfetti();
      else triggerFireworks();
    }
  }

  const giftQueue = new GiftShowcaseQueue();

  function triggerDJScreenGift(gift) {
    giftQueue.enqueue(gift);
  }

  function showGiftBanner(gift) {
    giftQueue.enqueue(gift);
  }

  // Main Render Loop
  let lastTime = performance.now();
  let checkAudioFrame = 0;

  function renderLoop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (++checkAudioFrame % 45 === 0) {
      checkAudioUnlocked();
    }

    // 1. Real-Time Music Beat & Spectrum Analysis
    beatEngine.update(now, dt);
    bassIntensity = beatEngine.bassIntensity;
    midIntensity = beatEngine.midIntensity;

    if (beatEngine.isBeatHit) {
      beatCounter++;
    }

    // 2. Clear Canvas
    ctx.clearRect(0, 0, W, H);

    // 3. Draw Stage Background & Kaleidoscope LED Wall
    drawStageBackdrop(now);

    // 4. Draw DJ Stage Platform & Speakers
    drawDJStage(now);

    // 5. Draw 2.5D Dance Floor Grid
    drawDanceFloor(now);

    // 6. Draw 3 VIP Podiums (Top 1 Center Gold, Top 2 Left Silver, Top 3 Right Bronze)
    drawVIPPodiums(now);

    // 7. Draw Lasers & Lights
    drawLasers(now);

    // 8. Synchronize VIP Podiums & Dancers Ranks
    syncVIPRanksAndPodiums();
    if (window.TTSMCManager) {
      TTSMCManager.onTopGiftersUpdate(topGifters);
    }

    // 9. Update & Render Dancers (sorted by Y for proper 2.5D depth)
    dancers.sort((a, b) => a.y - b.y);
    dancers.forEach(d => {
      d.update(dt, beatEngine, now);
      d.render(ctx, now);
    });

    // 8. Render Speech Bubbles over dancers
    drawSpeechBubbles(now);

    // 9. Render Stage Effects (Smoke, Flame, Fireworks, Particles, Hearts)
    renderParticles(dt);

    requestAnimationFrame(renderLoop);
  }


  // =========================================================================
  // TOP 3 VIP AVATAR DISPLAY ON DJ LED SCREEN (BASS REACTIVE SHOWCASE)
  // =========================================================================
  const avatarImageCache = new Map();
  function getOrLoadAvatarImage(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') return null;
    const cleanUrl = url.trim();
    let item = avatarImageCache.get(cleanUrl);
    if (!item) {
      const img = new Image();
      // DO NOT set img.crossOrigin = 'anonymous' because TikTok CDN edge servers
      // do not always return CORS headers. Standard 2D Canvas drawImage() works
      // 100% reliably for cross-origin images without CORS!
      item = { img, loaded: false, error: false };
      img.onload = () => { item.loaded = true; };
      img.onerror = () => {
        console.warn('[Avatar] Failed to load avatar:', cleanUrl);
        item.error = true;
      };
      img.src = cleanUrl;
      avatarImageCache.set(cleanUrl, item);
    }
    return (item.loaded && !item.error && item.img.naturalWidth > 0) ? item.img : null;
  }

  function getTop3VIPUsers() {
    const result = [];
    // 1. Try topGifters
    for (let i = 0; i < 3; i++) {
      const g = topGifters[i];
      if (g && (g.username || g.nickname)) {
        result.push({
          rank: i + 1,
          username: g.username || `vip_${i + 1}`,
          nickname: g.nickname || g.username || `Đại Gia #${i + 1}`,
          avatar: g.avatar || g.profilePictureUrl || '',
          coins: g.coins || 0
        });
      }
    }

    // 2. Fill missing ranks from VIP podium dancers ONLY if they actually have gift points
    for (let r = 1; r <= 3; r++) {
      if (!result.some(v => v.rank === r)) {
        const d = (dancers || []).find(dancer => dancer.vipRank === r && (dancer.score || 0) > 0);
        if (d) {
          result.push({
            rank: r,
            username: d.username,
            nickname: d.nickname || d.username,
            avatar: d.avatar || '',
            coins: d.score || 0
          });
        }
      }
    }

    // 3. Fallback placeholders if room just opened
    for (let r = 1; r <= 3; r++) {
      if (!result.some(v => v.rank === r)) {
        result.push({
          rank: r,
          username: `vip_${r}`,
          nickname: r === 1 ? 'Chờ Đại Gia 👑' : (r === 2 ? 'Chờ Top 2 🥈' : 'Chờ Top 3 🥉'),
          avatar: '',
          coins: 0
        });
      }
    }

    result.sort((a, b) => a.rank - b.rank);
    return result;
  }

  function formatVipCoins(coins) {
    if (!coins || coins <= 0) return '';
    if (coins >= 1000000) return (coins / 1000000).toFixed(1) + 'M';
    if (coins >= 1000) return (coins / 1000).toFixed(1) + 'K';
    return coins.toString();
  }

  function drawCrown(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    const w = size;
    const h = size * 0.65;
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.lineTo(-w * 0.22, 0);
    ctx.lineTo(0, -h * 0.7);
    ctx.lineTo(w * 0.22, 0);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
    ctx.fillStyle = '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3 Jewels on crown tips
    const tips = [
      { tx: -w / 2, ty: -h / 2 },
      { tx: 0, ty: -h * 0.7 },
      { tx: w / 2, ty: -h / 2 }
    ];
    tips.forEach(t => {
      ctx.beginPath();
      ctx.arc(t.tx, t.ty, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0055';
      ctx.fill();
    });
    ctx.restore();
  }

  function drawSingleDJScreenAvatar(ctx, vip, cfg, now, beatEngine, kickSnap, bass) {
    const bobY = -kickSnap * (cfg.rank === 1 ? 8 : 6);
    const scale = 1.0 + (bass * 0.16) + (kickSnap * 0.15);
    const curX = cfg.x;
    const curY = cfg.y + bobY;
    const r = cfg.baseR * scale;

    ctx.save();

    // 1. Subwoofer Bass Shockwaves (Concentric Pulsing Waves radiating from Avatar)
    for (let w = 1; w <= 2; w++) {
      const waveProg = ((now * 0.0018 * (beatEngine.bpm / 120) + w * 0.45) % 1.0);
      const waveR = r + waveProg * (cfg.baseR * 1.3);
      const waveAlpha = (1.0 - waveProg) * (0.30 + bass * 0.40 + kickSnap * 0.35);
      ctx.save();
      ctx.beginPath();
      ctx.arc(curX, curY, waveR, 0, Math.PI * 2);
      ctx.strokeStyle = cfg.themeColor;
      ctx.globalAlpha = waveAlpha;
      ctx.lineWidth = 1.8 + kickSnap * 2.2;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Radial Audio Visualizer Spikes around Avatar Frame (Dancing with Beat)
    ctx.save();
    const spikeCount = cfg.rank === 1 ? 16 : 12;
    for (let k = 0; k < spikeCount; k++) {
      const ang = k * (Math.PI * 2 / spikeCount) + (now * 0.0006);
      const waveBounce = Math.sin(now * 0.012 + k * 0.8) * 2;
      const spikeLen = (3 + waveBounce + kickSnap * 9 + bass * 6);
      const x1 = curX + Math.cos(ang) * (r + 2);
      const y1 = curY + Math.sin(ang) * (r + 2);
      const x2 = curX + Math.cos(ang) * (r + 2 + spikeLen);
      const y2 = curY + Math.sin(ang) * (r + 2 + spikeLen);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = cfg.themeColor;
      ctx.globalAlpha = 0.5 + kickSnap * 0.5;
      ctx.lineWidth = 2.0 + kickSnap * 1.0;
      ctx.stroke();
    }
    ctx.restore();

    // 3. Avatar Image or High-Quality Thematic Fallback (Clipped to Circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(curX, curY, r, 0, Math.PI * 2);
    ctx.clip();

    const loadedImg = getOrLoadAvatarImage(vip.avatar);
    if (loadedImg) {
      ctx.drawImage(loadedImg, curX - r, curY - r, r * 2, r * 2);
    } else {
      // Cosmic dark gradient background
      const bgGrad = ctx.createRadialGradient(curX, curY, 0, curX, curY, r);
      bgGrad.addColorStop(0, '#1c2242');
      bgGrad.addColorStop(1, '#0b0f1c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(curX - r, curY - r, r * 2, r * 2);

      // Thematic Cat Mascot Avatar
      const catList = spriteCache[`char${cfg.rank}`];
      const catImg = (catList && catList[0] && catList[0].complete && catList[0].naturalWidth > 0) ? catList[0] : null;
      if (catImg) {
        ctx.drawImage(catImg, curX - r * 0.85, curY - r * 0.85, r * 1.7, r * 1.7);
      } else {
        ctx.font = `bold ${Math.round(r * 0.9)}px "Rajdhani", sans-serif`;
        ctx.fillStyle = cfg.themeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((vip.nickname || 'VIP')[0].toUpperCase(), curX, curY);
      }
    }
    ctx.restore();

    // 4. Outer Glowing Bezel & Border Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(curX, curY, r, 0, Math.PI * 2);
    ctx.lineWidth = (cfg.rank === 1 ? 4.5 : 3.2) + kickSnap * 1.8;
    ctx.strokeStyle = cfg.borderColor;
    ctx.shadowColor = cfg.themeColor;
    ctx.shadowBlur = 12 + kickSnap * 15;
    ctx.stroke();
    ctx.restore();

    // 5. Golden Crown for Top 1
    if (cfg.rank === 1) {
      drawCrown(ctx, curX, curY - r - 18, 40 + kickSnap * 6);
    }

    // 6. Mini Medal Badge on Avatar Corner
    ctx.save();
    const medalAng = -Math.PI * 0.75; // Top-left corner
    const mx = curX + Math.cos(medalAng) * (r * 0.88);
    const my = curY + Math.sin(medalAng) * (r * 0.88);
    ctx.beginPath();
    ctx.arc(mx, my, cfg.rank === 1 ? 16 : 13, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = cfg.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = (cfg.rank === 1 ? '16px' : '13px') + ' sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.medal, mx, my + 1);
    ctx.restore();

    // 7. Cyber Name Pill below Avatar (Larger & clearer typography)
    ctx.save();
    const pillW = cfg.rank === 1 ? 168 : 144;
    const pillH = cfg.rank === 1 ? 28 : 24;
    const pillY = curY + r + (cfg.rank === 1 ? 20 : 18);
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(curX - pillW / 2, pillY - pillH / 2, pillW, pillH, 8);
    } else {
      ctx.rect(curX - pillW / 2, pillY - pillH / 2, pillW, pillH);
    }
    ctx.fillStyle = 'rgba(8, 12, 28, 0.88)';
    ctx.fill();
    ctx.strokeStyle = cfg.borderColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Name text
    let displayName = vip.nickname || `Top ${cfg.rank}`;
    if (displayName.length > 14) {
      displayName = displayName.substring(0, 13) + '..';
    }
    ctx.font = `bold ${cfg.rank === 1 ? 16 : 14}px "Rajdhani", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = cfg.themeColor;
    ctx.shadowBlur = 6;
    ctx.fillText(displayName, curX, pillY);

    // Coins / Gift badge under pill if coins > 0
    if (vip.coins > 0) {
      ctx.font = `bold ${cfg.rank === 1 ? 12 : 11}px "Rajdhani", sans-serif`;
      ctx.fillStyle = cfg.themeColor;
      ctx.shadowBlur = 0;
      ctx.fillText(`${formatVipCoins(vip.coins)}`, curX, pillY + pillH * 0.75 + 2);
    }
    ctx.restore();

    ctx.restore();
  }

  function getGiftIcon(giftName) {
    if (!giftName || typeof giftName !== 'string') return '🎁';
    const lower = giftName.toLowerCase();
    if (lower.includes('sư tử') || lower.includes('lion')) return '🦁';
    if (lower.includes('du thuyền') || lower.includes('thuyền') || lower.includes('yacht')) return '🛥️';
    if (lower.includes('siêu xe') || lower.includes('xe') || lower.includes('car')) return '🏎️';
    if (lower.includes('hoa hồng') || lower.includes('hoa') || lower.includes('rose')) return '🌹';
    if (lower.includes('trái tim') || lower.includes('tim') || lower.includes('heart')) return '💖';
    if (lower.includes('súng tiền') || lower.includes('tiền') || lower.includes('money')) return '💸';
    if (lower.includes('bánh rán') || lower.includes('bánh') || lower.includes('donut')) return '🍩';
    if (lower.includes('pháo hoa') || lower.includes('pháo') || lower.includes('firework')) return '🎆';
    if (lower.includes('vương miện') || lower.includes('crown')) return '👑';
    if (lower.includes('kim cương') || lower.includes('diamond')) return '💎';
    if (lower.includes('cocktail') || lower.includes('rượu') || lower.includes('bia')) return '🍸';
    if (lower.includes('tên lửa') || lower.includes('rocket')) return '🚀';
    if (lower.includes('mèo') || lower.includes('cat')) return '🐱';
    return '🎁';
  }

  // Draw Gift Showcase on DJ Screen (Temporarily replaces 3 Top VIPs)
  function drawDJScreenGiftShowcase(ctx, sx, sy, sw, sh, now, beatEngine, gift) {
    const age = now - gift.startTime;
    const duration = gift.expiry - gift.startTime;
    if (age > duration) {
      activeDJScreenGift = null;
      return;
    }

    // Smooth Pop-in scale (first 250ms) and fade-out (last 600ms)
    let popScale = 1.0;
    if (age < 250) {
      const p = age / 250;
      popScale = 0.6 + 0.4 * Math.sin(p * Math.PI * 0.5);
    }
    const alpha = age > (duration - 600) ? Math.max(0, (duration - age) / 600) : 1.0;

    const bass = beatEngine.bassLevel || 0;
    const beatPhase = beatEngine.beatPhase || 0;
    const kickSnap = Math.pow(Math.max(0, 1.0 - beatPhase * 2.2), 2.2) * (beatEngine.isBassActive ? 1 : 0.2);

    const cx = sx + sw / 2;
    const bobY = -kickSnap * 10;
    const bounceScale = 1.0 + kickSnap * 0.14 + bass * 0.08;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Ambient Golden & Neon Magenta Radial Wash behind showcase
    const giftGlow = ctx.createRadialGradient(cx, sy + sh * 0.48, 30, cx, sy + sh * 0.48, sw * 0.52);
    giftGlow.addColorStop(0, `rgba(255, 0, 128, ${0.32 + bass * 0.22})`);
    giftGlow.addColorStop(0.5, `rgba(255, 215, 0, ${0.22 + kickSnap * 0.20})`);
    giftGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = giftGlow;
    ctx.fillRect(sx, sy, sw, sh);

    // 2. Animated Header Bar on LED Screen
    ctx.save();
    const headerY = sy + 30;
    const headerPulse = 1.0 + kickSnap * 0.05;
    ctx.translate(cx, headerY);
    ctx.scale(headerPulse, headerPulse);

    const headerW = 460;
    const headerH = 32;
    const headerGrad = ctx.createLinearGradient(-headerW / 2, 0, headerW / 2, 0);
    headerGrad.addColorStop(0, '#ff007f');
    headerGrad.addColorStop(0.5, '#ffe600');
    headerGrad.addColorStop(1, '#ff007f');

    ctx.fillStyle = 'rgba(12, 6, 24, 0.88)';
    ctx.strokeStyle = headerGrad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-headerW / 2, -headerH / 2, headerW, headerH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 16px "Rajdhani", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 8;
    ctx.fillText('🎁 ĐẠI GIA TẶNG QUÀ SANOO CLUB 🎁', 0, 1);
    ctx.restore();

    // Coordinates for Duo Showcase (Gifter Left, Gift Right)
    const gx = cx - 165;
    const qx = cx + 165;
    const gy = sy + 180 + bobY;
    const qy = sy + 180 + bobY;

    // -------------------------------------------------------------------------
    // 3. GIFTER AVATAR & NAME (LEFT SIDE)
    // -------------------------------------------------------------------------
    ctx.save();
    ctx.translate(gx, gy);
    ctx.scale(popScale, popScale);
    ctx.translate(-gx, -gy);

    const avR = 56 * bounceScale;

    // Subwoofer concentric shockwaves from avatar
    for (let w = 1; w <= 2; w++) {
      const waveProg = ((now * 0.002 * (beatEngine.bpm / 120) + w * 0.45) % 1.0);
      const waveR = avR + waveProg * 58;
      const waveAlpha = (1.0 - waveProg) * (0.35 + bass * 0.45 + kickSnap * 0.35);
      ctx.beginPath();
      ctx.arc(gx, gy, waveR, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffe600';
      ctx.globalAlpha = waveAlpha * alpha;
      ctx.lineWidth = 2 + kickSnap * 2;
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;

    // 16 Audio Visualizer Equalizer Spikes around Gifter
    for (let k = 0; k < 16; k++) {
      const ang = k * (Math.PI * 2 / 16) + (now * 0.0008);
      const spikeLen = 4 + Math.sin(now * 0.015 + k) * 3 + kickSnap * 10 + bass * 7;
      const x1 = gx + Math.cos(ang) * (avR + 3);
      const y1 = gy + Math.sin(ang) * (avR + 3);
      const x2 = gx + Math.cos(ang) * (avR + 3 + spikeLen);
      const y2 = gy + Math.sin(ang) * (avR + 3 + spikeLen);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // Outer Glowing Border Ring
    ctx.beginPath();
    ctx.arc(gx, gy, avR, 0, Math.PI * 2);
    ctx.fillStyle = '#100a26';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw Gifter Avatar image
    ctx.save();
    ctx.beginPath();
    ctx.arc(gx, gy, avR - 3, 0, Math.PI * 2);
    ctx.clip();

    let gifterLoaded = false;
    if (gift.avatar) {
      const item = getOrLoadAvatarImage(gift.avatar);
      if (item && item.loaded && !item.error) {
        ctx.drawImage(item.img, gx - avR, gy - avR, avR * 2, avR * 2);
        gifterLoaded = true;
      }
    }
    if (!gifterLoaded) {
      // Elegant VIP Profile Avatar Gradient
      const grad = ctx.createLinearGradient(gx - avR, gy - avR, gx + avR, gy + avR);
      grad.addColorStop(0, '#ffe600');
      grad.addColorStop(1, '#ff6600');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - avR, gy - avR, avR * 2, avR * 2);

      ctx.fillStyle = '#0a0d1e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.floor(avR * 0.7)}px "Rajdhani", sans-serif`;
      const initial = (gift.nickname || gift.username || 'VIP').substring(0, 2).toUpperCase();
      ctx.fillText(initial, gx, gy);
    }
    ctx.restore();

    // Crown on Top of Avatar
    ctx.font = `${Math.floor(26 * bounceScale)}px "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.fillText('👑', gx, gy - avR - 14);
    ctx.shadowBlur = 0;

    // Gifter Name Capsule
    const nameY = gy + avR + 22;
    const namePillW = 210;
    const namePillH = 34;

    ctx.fillStyle = 'rgba(14, 8, 28, 0.92)';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(gx - namePillW / 2, nameY - namePillH / 2, namePillW, namePillH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 18px "Rajdhani", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 6;
    ctx.fillText(gift.nickname || gift.username, gx, nameY);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 11px "Rajdhani", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('💎 NGƯỜI TẶNG QUÀ 💎', gx, nameY + 22);

    ctx.restore();

    // -------------------------------------------------------------------------
    // 4. CENTER CONNECTING ENERGY BEAM
    // -------------------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(gx + avR + 10, gy);
    ctx.lineTo(qx - avR - 10, qy);
    const beamGrad = ctx.createLinearGradient(gx + avR + 10, gy, qx - avR - 10, qy);
    beamGrad.addColorStop(0, '#ffd700');
    beamGrad.addColorStop(0.5, '#ffffff');
    beamGrad.addColorStop(1, '#ff007f');
    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = 3 + kickSnap * 3;
    ctx.stroke();

    // Repeat Count Badge in Dead Center
    ctx.save();
    ctx.translate(cx, gy);
    ctx.scale(1.0 + kickSnap * 0.15, 1.0 + kickSnap * 0.15);
    const countBadgeW = 76;
    const countBadgeH = 34;
    ctx.fillStyle = 'rgba(255, 0, 128, 0.9)';
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-countBadgeW / 2, -countBadgeH / 2, countBadgeW, countBadgeH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 22px "Rajdhani", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 8;
    ctx.fillText(`x${gift.repeatCount}`, 0, 1);
    ctx.restore();
    ctx.restore();

    // -------------------------------------------------------------------------
    // 5. GIFT IMAGE & DETAILS (RIGHT SIDE)
    // -------------------------------------------------------------------------
    ctx.save();
    ctx.translate(qx, qy);
    ctx.scale(popScale, popScale);
    ctx.translate(-qx, -qy);

    const giftR = 60 * bounceScale;

    // Rotating Star Halo around Gift
    const starCount = 8;
    for (let s = 0; s < starCount; s++) {
      const sAng = s * (Math.PI * 2 / starCount) + (now * 0.0015);
      const sxStar = qx + Math.cos(sAng) * (giftR + 12);
      const syStar = qy + Math.sin(sAng) * (giftR + 12);
      ctx.beginPath();
      ctx.arc(sxStar, syStar, 2.5 + kickSnap * 2, 0, Math.PI * 2);
      ctx.fillStyle = (s % 2 === 0) ? '#ffe600' : '#ff007f';
      ctx.fill();
    }

    // Outer Frame for Gift
    ctx.beginPath();
    ctx.arc(qx, qy, giftR, 0, Math.PI * 2);
    const giftBgGrad = ctx.createRadialGradient(qx, qy, 10, qx, qy, giftR);
    giftBgGrad.addColorStop(0, '#380b3d');
    giftBgGrad.addColorStop(1, '#0e0416');
    ctx.fillStyle = giftBgGrad;
    ctx.fill();
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Render Gift Image or High-res Icon
    let giftImgLoaded = false;
    if (gift.giftPictureUrl) {
      const gItem = getOrLoadAvatarImage(gift.giftPictureUrl);
      if (gItem && gItem.loaded && !gItem.error) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(qx, qy, giftR - 4, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(gItem.img, qx - giftR * 0.85, qy - giftR * 0.85, giftR * 1.7, giftR * 1.7);
        ctx.restore();
        giftImgLoaded = true;
      }
    }
    if (!giftImgLoaded) {
      const icon = getGiftIcon(gift.giftName);
      ctx.font = `${Math.floor(70 * bounceScale)}px "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 14;
      ctx.fillText(icon, qx, qy + 4);
      ctx.shadowBlur = 0;
    }

    // Gift Name Capsule
    const giftNameY = qy + giftR + 22;
    const giftPillW = 210;
    const giftPillH = 34;

    ctx.fillStyle = 'rgba(28, 6, 26, 0.92)';
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(qx - giftPillW / 2, giftNameY - giftPillH / 2, giftPillW, giftPillH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 18px "Rajdhani", sans-serif';
    ctx.fillStyle = '#ffe600';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 6;
    ctx.fillText(gift.giftName, qx, giftNameY);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 12px "Rajdhani", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`✨ ${gift.diamondCount} 💎 ✨`, qx, giftNameY + 22);

    ctx.restore();

    // -------------------------------------------------------------------------
    // 6. BOTTOM MARQUEE BAR (INSIDE LED SCREEN)
    // -------------------------------------------------------------------------
    ctx.save();
    const bottomY = sy + sh - 28;
    const barW = Math.min(sw - 60, 620);
    const barH = 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - barW / 2, bottomY - barH / 2, barW, barH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 15px "Rajdhani", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.fillText(`✨ CẢM ƠN ${gift.nickname.toUpperCase()} ĐÃ TẶNG ${gift.giftName.toUpperCase()} x${gift.repeatCount}! ✨`, cx, bottomY);
    ctx.restore();

    ctx.restore();
  }

  function drawDJScreenTop3VIP(ctx, sx, sy, sw, sh, now, beatEngine) {
    const vips = getTop3VIPUsers();
    const cx = sx + sw / 2;

    const bass = beatEngine.bassLevel || 0;
    const beatPhase = beatEngine.beatPhase || 0;
    const kickSnap = Math.pow(Math.max(0, 1.0 - beatPhase * 2.2), 2.2) * (beatEngine.isBassActive ? 1 : 0.2);

    // 1. Sleek Cyber Header Bar inside LED screen
    ctx.save();
    const headerY = sy + 22;
    const headerPulse = 1.0 + kickSnap * 0.06;
    ctx.translate(cx, headerY);
    ctx.scale(headerPulse, headerPulse);
    ctx.font = '900 16px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (beatEngine.isBassActive) {
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 8;
      ctx.fillText('⚡ VIP SPOTLIGHT • TOP 3 ĐẠI GIA SANOO CLUB ⚡', 0, 0);
    } else {
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.fillText('🎧 DJ SANOO • TOP 3 BẢNG VÀNG ĐẠI GIA 🎧', 0, 0);
    }
    ctx.restore();

    // 2. Positions of the 3 Avatars on the DJ Screen:
    // Placed comfortably in middle portion, generous breathing room below header
    const configs = [
      { rank: 1, x: cx, y: sy + 172, baseR: 58, themeColor: '#ffe600', borderColor: '#ffea00', medal: '🥇' },
      { rank: 2, x: cx - 215, y: sy + 185, baseR: 48, themeColor: '#00f0ff', borderColor: '#38bdf8', medal: '🥈' },
      { rank: 3, x: cx + 215, y: sy + 185, baseR: 46, themeColor: '#ff8c00', borderColor: '#fb923c', medal: '🥉' }
    ];

    configs.forEach(cfg => {
      const vip = vips.find(v => v.rank === cfg.rank) || { rank: cfg.rank, nickname: `Top ${cfg.rank}`, coins: 0 };
      drawSingleDJScreenAvatar(ctx, vip, cfg, now, beatEngine, kickSnap, bass);
    });
  }


  // Draw Stage Backdrop & Industrial Truss Framework
  function drawStageBackdrop(now) {
    const sx = W * 0.15;
    const sy = H * 0.15;
    const sw = W * 0.7;
    const sh = H * 0.22;

    ctx.save();

    // Ceiling & Stage Truss Framework (Industrial Aluminum Truss)
    ctx.strokeStyle = 'rgba(120, 140, 180, 0.45)';
    ctx.lineWidth = 3;
    // Top Horizontal Truss Beam
    ctx.strokeRect(W * 0.05, 120, W * 0.9, 26);
    // Cross-bracing in horizontal truss
    for (let x = W * 0.05; x < W * 0.95; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 120);
      ctx.lineTo(x + 40, 146);
      ctx.stroke();
    }
    // Vertical Support Columns (Left & Right - firmly supporting the stage!)
    ctx.strokeRect(W * 0.05, 146, 26, H * 0.28);
    ctx.strokeRect(W * 0.95 - 26, 146, 26, H * 0.28);

    // Par LED Chaser Lights along Truss
    const parCount = 10;
    const parSpacing = (W * 0.9) / parCount;
    const chaserStep = Math.floor((now * 0.006 * (beatEngine.bpm / 120))) % parCount;
    for (let p = 0; p < parCount; p++) {
      const px = W * 0.05 + p * parSpacing + 20;
      const isChaserActive = (p === chaserStep || (p + 1) % parCount === chaserStep);
      const parColor = isChaserActive ? stageLighting.getCurrentColor(p) : 'rgba(0, 240, 255, 0.3)';

      ctx.beginPath();
      ctx.arc(px, 133, isChaserActive ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = parColor;
      ctx.fill();
    }

    // LED Screen boundaries (Center Upper Stage Visualizer)
    ctx.fillStyle = '#040612';
    ctx.fillRect(sx, sy, sw, sh);
    const borderColor = stageLighting.getCurrentColor();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(sx, sy, sw, sh);

    // Clip graphics strictly inside the LED wall
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx + 4, sy + 4, sw - 8, sh - 8);
    ctx.clip();

    const cx = sx + sw / 2;
    const cy = sy + sh / 2;

    // 1. Subtle Cyber Dot Matrix Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let gx = sx + 15; gx < sx + sw; gx += 28) {
      for (let gy = sy + 15; gy < sy + sh; gy += 28) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }

    // 2. Concentric Cyber Octagons (Soundwave Tunnel)
    const tunnelRings = 5;
    for (let r = 0; r < tunnelRings; r++) {
      const ringProg = ((now * 0.0009 * (beatEngine.bpm / 120) + r / tunnelRings) % 1.0);
      const ringR = 25 + ringProg * (sw * 0.46);
      const ringAlpha = Math.sin(ringProg * Math.PI) * (0.28 + beatEngine.bassLevel * 0.42);
      const ringColor = stageLighting.getCurrentColor(r * 2);

      ctx.save();
      ctx.strokeStyle = ringColor;
      ctx.globalAlpha = ringAlpha;
      ctx.lineWidth = 2 + beatEngine.bassLevel * 3;
      
      ctx.beginPath();
      for (let a = 0; a < 8; a++) {
        const ang = a * (Math.PI / 4) + (now * 0.0006);
        const ax = cx + Math.cos(ang) * ringR;
        const ay = cy - 25 + Math.sin(ang) * (ringR * 0.65);
        if (a === 0) ctx.moveTo(ax, ay);
        else ctx.lineTo(ax, ay);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 3. Dynamic 36-Band Graphic Equalizer Spectrum (EQ Bars)
    const barCount = 36;
    const barSpacing = (sw - 40) / barCount;
    const barW = barSpacing * 0.72;
    const maxBarH = sh * 0.28;
    const baseBarY = sy + sh - 18;

    for (let b = 0; b < barCount; b++) {
      let mag = 0;
      if (analyser && freqData && audioCtx && audioCtx.state === 'running') {
        const binIdx = Math.min(freqData.length - 1, 2 + Math.floor(b * (freqData.length / 80)));
        mag = freqData[binIdx] / 255.0;
      } else {
        // High-energy energetic simulated wave
        const wave1 = Math.sin(now * 0.007 * (beatEngine.bpm / 120) + b * 0.38);
        const wave2 = Math.cos(now * 0.012 + b * 0.75);
        const beatBounce = (b < 10 ? Math.sin(beatEngine.beatPhase * Math.PI) * 0.5 : 0);
        mag = Math.max(0.08, 0.30 + wave1 * 0.28 + wave2 * 0.18 + beatBounce);
      }

      if (beatEngine.isBassActive) {
        mag = Math.min(1.0, mag * (1.1 + beatEngine.bassLevel * 0.55));
      } else {
        mag = Math.min(0.75, mag * 0.65);
      }

      const barH = Math.max(6, mag * maxBarH);
      const bx = sx + 20 + b * barSpacing;
      const by = baseBarY - barH;

      const barGrad = ctx.createLinearGradient(0, baseBarY, 0, by);
      barGrad.addColorStop(0, '#00f0ff');
      barGrad.addColorStop(0.5, '#ff007f');
      barGrad.addColorStop(0.85, '#ffe600');
      barGrad.addColorStop(1, '#ffffff');

      ctx.fillStyle = barGrad;
      ctx.fillRect(bx, by, barW, barH);

      // Peak Hold Cap
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, by - 3, barW, 2);
    }

    // 4. TOP 3 VIP AVATARS OR ACTIVE GIFT SHOWCASE ON DJ SCREEN
    if (activeDJScreenGift && now < activeDJScreenGift.expiry) {
      drawDJScreenGiftShowcase(ctx, sx, sy, sw, sh, now, beatEngine, activeDJScreenGift);
    } else {
      activeDJScreenGift = null;
      drawDJScreenTop3VIP(ctx, sx, sy, sw, sh, now, beatEngine);
    }

    // 5. Strobe Flash on Bass Hits
    if (stageLighting.flashIntensity > 0.08) {
      ctx.fillStyle = `rgba(255, 255, 255, ${stageLighting.flashIntensity * 0.55})`;
      ctx.fillRect(sx, sy, sw, sh);
    }

    ctx.restore();
    ctx.restore();
  }


          // =========================================================================
  // 2 SEXY CYBER RAVE GOGO DANCERS FLANKING RESIDENT DJ
  // 100% Procedural Vector Style matching Resident DJ Sanoo!
  // Curvaceous Tapered Legs (14px hip to 6px knee), Solid Sculpted High-Heel Boots,
  // Dynamic Contrapposto Dance Poses, NO STICKS!
  // Positioned close to DJ table (Left X: 310 | Right X: 770)
  // =========================================================================
  function drawGogoDancers(ctx, now, beatEngine) {
    const stageY = H * 0.36; // 691.2
    const podiumY = stageY + 70; // 761.2 (Stage wing surface)

    // Positioned CLOSE to DJ Booth (DJ table spans X: 350 to 730)
    const leftX = 310;
    const rightX = W - 310; // 770

    const bass = beatEngine.bassLevel || 0;
    const beatPhase = beatEngine.beatPhase || 0;
    const danceCycle = beatEngine.danceCycle || 0;
    const hype = Math.max(0, Math.min(1.0, (bass - 0.15) / 0.70));
    const isDrop = beatEngine.isBassActive || hype > 0.35;
    const kickSnap = Math.pow(Math.max(0, 1.0 - beatPhase * 2.2), 2.2) * (isDrop ? 1 : 0.2);

    // Smooth 60 FPS Kinematics
    const bobY = Math.sin(beatPhase * Math.PI) * (3 + hype * 12);
    const hipSway = Math.sin(danceCycle * Math.PI * 2) * (6 + hype * 10);
    const torsoTilt = Math.sin(danceCycle * Math.PI * 2) * 0.07;
    const hairLag = Math.sin((danceCycle - 0.12) * Math.PI * 2) * (8 + hype * 14);

    const dancersConfig = [
      {
        x: leftX,
        y: podiumY,
        flip: 1, // Facing inward / right toward DJ
        themeColor: '#ff007f', // Neon Pink
        secondaryColor: '#ffe600',
        hairColor: '#d946ef',
        hairHighlight: '#f472b6',
        topColor: '#ff007f',
        bootColor: '#1e2438',
        bootHighlight: '#3b486e'
      },
      {
        x: rightX,
        y: podiumY,
        flip: -1, // Facing inward / left toward DJ (Mirrored)
        themeColor: '#00f0ff', // Electric Cyan
        secondaryColor: '#00ff88',
        hairColor: '#06b6d4',
        hairHighlight: '#67e8f9',
        topColor: '#00f0ff',
        bootColor: '#1e2438',
        bootHighlight: '#3b486e'
      }
    ];

    dancersConfig.forEach(cfg => {
      ctx.save();
      ctx.translate(cfg.x, cfg.y);

      // =====================================================================
      // 1. COMPACT STAGE PODIUM (Beneath Feet, close to DJ table)
      // =====================================================================
      // A. Under-Podium Glow Spotlight Wash
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const haloGrad = ctx.createRadialGradient(0, 6, 4, 0, 6, 50);
      haloGrad.addColorStop(0, cfg.themeColor);
      haloGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = haloGrad;
      ctx.globalAlpha = 0.35 + bass * 0.35;
      ctx.beginPath();
      ctx.ellipse(0, 6, 52, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // B. 3D Metallic Cylinder Base
      ctx.fillStyle = '#080a14';
      ctx.beginPath();
      ctx.ellipse(0, 11, 38, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // C. Podium Top Face with Neon Rim
      ctx.fillStyle = '#141829';
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cfg.themeColor;
      ctx.lineWidth = 2.5 + kickSnap * 2;
      ctx.shadowColor = cfg.themeColor;
      ctx.shadowBlur = 8 + kickSnap * 8;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // D. Feet Contact Shadow
      ctx.beginPath();
      ctx.ellipse(0, -2, 28, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fill();

      // =====================================================================
      // 2. DANCER BODY HIERARCHY (Vector Curves, Natural Proportions)
      // =====================================================================
      ctx.save();
      ctx.scale(cfg.flip, 1);

      // Hips & Waist coordinates
      const hipX = hipSway * 0.45;
      const hipY = -86 - bobY;

      // Chest & Shoulder coordinates
      const chestX = hipSway * 0.25;
      const chestY = -118 - bobY;

      // Head coordinates
      const headX = hipSway * 0.12;
      const headY = -152 - bobY;

      // -------------------------------------------------------------------
      // 2.1 VOLUPTUOUS LEGS & SCULPTED HIGH-HEEL BOOTS
      // Feminine taper: 14px hip to 6.5px knee, 8.5px calf, 4.5px ankle!
      // Continuous solid high-heel boot shape with glossy highlight & neon trim.
      // -------------------------------------------------------------------
      const swayNorm = (hipSway / 10); // -1 to +1

      // 2 Legs: dir = -1 (outer/back leg), dir = 1 (inner/front leg)
      [-1, 1].forEach(dir => {
        const isWeight = (swayNorm * dir) >= -0.2;
        const kneeFlexY = isWeight ? 0 : 3.5;
        const heelLift = isWeight ? 0 : 3.0;

        // Hip joint attachment points
        const hipOuterX = hipX + dir * 14;
        const hipInnerX = hipX + dir * 1.5;

        // Knee coordinates
        const kneeCenterX = dir * 6 + (isWeight ? 0 : dir * 1.5) + hipX * 0.2;
        const kneeY = -48 - bobY * 0.35 + kneeFlexY;
        const kneeOuterX = kneeCenterX + dir * 3.5;
        const kneeInnerX = kneeCenterX - dir * 3.2;

        // Ankle coordinates
        const ankleCenterX = dir * 6.5 + (isWeight ? 0 : dir * 2.0);
        const ankleY = -14 - heelLift;
        const footY = 0 - heelLift;
        const ankleOuterX = ankleCenterX + dir * 2.5;
        const ankleInnerX = ankleCenterX - dir * 2.2;

        // Calf bulge coordinates (swells outward slightly)
        const calfY = (kneeY + ankleY) * 0.5;
        const calfOuterX = kneeOuterX + dir * 2.8;
        const calfInnerX = kneeInnerX - dir * 0.5;

        // --- A. EXPOSED SMOOTH THIGH (Skin tone #ffdd99) ---
        ctx.beginPath();
        // Inner edge: crotch to inner knee
        ctx.moveTo(hipInnerX, hipY + 4);
        ctx.quadraticCurveTo(kneeInnerX + dir * 0.5, (hipY + kneeY) * 0.5, kneeInnerX, kneeY);
        // Across knee
        ctx.lineTo(kneeOuterX, kneeY);
        // Outer edge: outer knee up to curvy hip
        ctx.quadraticCurveTo(hipOuterX + dir * 2.0, (hipY + kneeY) * 0.5, hipOuterX, hipY + 4);
        ctx.closePath();
        ctx.fillStyle = '#ffdd99';
        ctx.fill();
        ctx.strokeStyle = '#dfb572';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // --- B. SOLID SCULPTED THIGH-HIGH BOOT (Calf to Ankle) ---
        ctx.beginPath();
        // Inner edge
        ctx.moveTo(kneeInnerX, kneeY);
        ctx.quadraticCurveTo(calfInnerX, calfY, ankleInnerX, ankleY);
        // Across ankle
        ctx.lineTo(ankleOuterX, ankleY);
        // Outer edge with sexy curved calf bulge
        ctx.quadraticCurveTo(calfOuterX, calfY, kneeOuterX, kneeY);
        ctx.closePath();
        ctx.fillStyle = cfg.bootColor;
        ctx.fill();
        ctx.strokeStyle = cfg.themeColor;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // Glossy Specular Highlight Stripe down the front of the boot
        ctx.beginPath();
        ctx.moveTo(kneeCenterX, kneeY + 2);
        ctx.quadraticCurveTo(kneeCenterX + dir * 0.5, calfY, ankleCenterX, ankleY - 2);
        ctx.strokeStyle = cfg.bootHighlight;
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Glowing Boot Top Collar
        ctx.beginPath();
        ctx.moveTo(kneeInnerX - dir * 0.5, kneeY);
        ctx.lineTo(kneeOuterX + dir * 0.5, kneeY);
        ctx.strokeStyle = cfg.themeColor;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // --- C. SOLID SCULPTED HIGH-HEEL BOOT FOOT ---
        ctx.save();
        ctx.translate(ankleCenterX, footY);

        const toeDir = dir; // Point toe in leg direction
        const heelBackX = -toeDir * 3.5;
        const heelFrontX = -toeDir * 1.5;
        const toeTipX = toeDir * 7.5;
        const ballX = toeDir * 2.0;

        // Continuous solid high-heel boot shape:
        // Ankle top -> instep slope -> toe tip -> platform sole -> arch -> heel base -> heel back -> ankle
        ctx.beginPath();
        ctx.moveTo(ankleInnerX - ankleCenterX, ankleY - footY);
        ctx.quadraticCurveTo(0, (ankleY - footY) * 0.6, ballX, -4);
        ctx.lineTo(toeTipX, -2.5);
        ctx.lineTo(toeTipX - toeDir * 1.0, 0); // sole tip on floor
        ctx.lineTo(heelFrontX, 0);             // sole to heel
        ctx.lineTo(heelFrontX, -6);            // under-arch cutout
        ctx.lineTo(heelBackX, 0);              // heel base on floor
        ctx.lineTo(heelBackX, ankleY - footY); // back of ankle
        ctx.closePath();
        ctx.fillStyle = cfg.bootColor;
        ctx.fill();
        ctx.strokeStyle = cfg.themeColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Glowing Neon Sole Rim
        ctx.beginPath();
        ctx.moveTo(heelBackX, 0);
        ctx.lineTo(toeTipX - toeDir * 1.0, 0);
        ctx.strokeStyle = cfg.themeColor;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = cfg.themeColor;
        ctx.shadowBlur = 5;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.restore();
      });

      // -------------------------------------------------------------------
      // 2.2 Mini Pleated Rave Skirt / Cyber Hotpants
      // -------------------------------------------------------------------
      ctx.save();
      ctx.translate(hipX, hipY);
      ctx.rotate(torsoTilt * 0.6);

      // Skirt body (flared hourglass)
      ctx.beginPath();
      ctx.moveTo(-16, -11);
      ctx.lineTo(16, -11);
      ctx.lineTo(20, 6);
      ctx.lineTo(-20, 6);
      ctx.closePath();
      ctx.fillStyle = '#0f111a';
      ctx.fill();
      ctx.strokeStyle = '#22283a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glowing Neon Hem Trim
      ctx.beginPath();
      ctx.moveTo(-20, 6);
      ctx.lineTo(20, 6);
      ctx.strokeStyle = cfg.themeColor;
      ctx.lineWidth = 3 + kickSnap * 1.5;
      ctx.shadowColor = cfg.themeColor;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Glowing Cyber Belt
      ctx.beginPath();
      ctx.moveTo(-16, -9);
      ctx.lineTo(16, -9);
      ctx.strokeStyle = cfg.secondaryColor;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Belt buckle badge
      ctx.beginPath();
      ctx.arc(0, -9, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // -------------------------------------------------------------------
      // 2.3 Slender Waist & Exposed Midriff
      // -------------------------------------------------------------------
      ctx.beginPath();
      ctx.moveTo(hipX - 13, hipY - 11);
      ctx.quadraticCurveTo(chestX - 8, (hipY + chestY) * 0.5, chestX - 12, chestY + 5);
      ctx.lineTo(chestX + 12, chestY + 5);
      ctx.quadraticCurveTo(chestX + 8, (hipY + chestY) * 0.5, hipX + 13, hipY - 11);
      ctx.closePath();
      ctx.fillStyle = '#ffdd99';
      ctx.fill();
      ctx.strokeStyle = '#e2b876';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Cute navel / piercing dot
      ctx.beginPath();
      ctx.arc((hipX + chestX) * 0.5, (hipY + chestY) * 0.5 + 2, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = '#d99a5e';
      ctx.fill();

      // -------------------------------------------------------------------
      // 2.4 Sexy Halter-Neck Rave Crop Top & Bustline
      // -------------------------------------------------------------------
      ctx.save();
      ctx.translate(chestX, chestY);
      ctx.rotate(torsoTilt * 0.9);

      // Sweetheart crop top bust
      ctx.beginPath();
      ctx.moveTo(-13, 5);
      ctx.lineTo(13, 5);
      ctx.quadraticCurveTo(14, -8, 7, -12);
      ctx.quadraticCurveTo(0, -5, -7, -12);
      ctx.quadraticCurveTo(-14, -8, -13, 5);
      ctx.closePath();
      ctx.fillStyle = '#111322';
      ctx.fill();

      // Color panel inside crop top
      ctx.beginPath();
      ctx.moveTo(-10, 3);
      ctx.lineTo(10, 3);
      ctx.quadraticCurveTo(11, -6, 6, -9);
      ctx.quadraticCurveTo(0, -3, -6, -9);
      ctx.quadraticCurveTo(-11, -6, -10, 3);
      ctx.closePath();
      ctx.fillStyle = cfg.topColor;
      ctx.fill();

      // Top outer neon stroke
      ctx.strokeStyle = cfg.themeColor;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = cfg.themeColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Halter neck straps to neck
      ctx.beginPath();
      ctx.moveTo(-6, -9);
      ctx.lineTo(-3, -18);
      ctx.moveTo(6, -9);
      ctx.lineTo(3, -18);
      ctx.strokeStyle = '#0f111a';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Neon Choker collar
      ctx.beginPath();
      ctx.moveTo(-5, -18);
      ctx.lineTo(5, -18);
      ctx.strokeStyle = cfg.themeColor;
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -18, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // -------------------------------------------------------------------
      // 2.5 Cute Anime Cyber Face & Visor (Matching DJ Sanoo)
      // -------------------------------------------------------------------
      ctx.save();
      ctx.translate(headX, headY);

      // Flowing Back Hair (Twin Ponytails behind head)
      ctx.save();
      [-1, 1].forEach(side => {
        const ponyAnchorX = side * 13;
        const ponyAnchorY = -7;
        const ponyTipX = ponyAnchorX + (side * 16) + (hairLag * 0.7);
        const ponyTipY = ponyAnchorY + 42 + (bobY * 0.3);

        ctx.beginPath();
        ctx.moveTo(ponyAnchorX - 4, ponyAnchorY);
        ctx.quadraticCurveTo(ponyAnchorX + side * 14, ponyAnchorY + 20, ponyTipX, ponyTipY);
        ctx.quadraticCurveTo(ponyAnchorX + side * 4, ponyAnchorY + 26, ponyAnchorX + 4, ponyAnchorY + 5);
        ctx.closePath();
        ctx.fillStyle = cfg.hairColor;
        ctx.fill();
        ctx.strokeStyle = cfg.hairHighlight;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Glowing hair ribbon / band
        ctx.beginPath();
        ctx.arc(ponyAnchorX, ponyAnchorY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = cfg.themeColor;
        ctx.fill();
      });
      ctx.restore();

      // Face Base (Smooth Anime Jawline)
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdd99';
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Rosy Anime Cheeks (Blush)
      ctx.beginPath();
      ctx.ellipse(-8, 5, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.ellipse(8, 5, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 100, 150, 0.45)';
      ctx.fill();

      // Cute Smile
      ctx.beginPath();
      ctx.arc(0, 5, 6.5, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Cyber Visor / Glasses (Identical style to DJ!)
      const visW = 32;
      const visH = 13;
      const visX = -visW / 2;
      const visY = -5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(visX, visY, visW, visH, 3.5);
      else ctx.rect(visX, visY, visW, visH);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = cfg.themeColor;
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Mini Equalizer Bars inside Visor
      for (let b = 0; b < 3; b++) {
        const bx = visX + 5 + b * 8;
        const bH = 2 + Math.sin(now * 0.02 + b) * 3 + bass * 3.5;
        ctx.fillStyle = cfg.secondaryColor;
        ctx.fillRect(bx, visY + visH - 2.5 - bH, 5, bH);
      }

      // Cat-Ear Headphones on Top of Head
      [-1, 1].forEach(side => {
        // Ear cups
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(side * 16 - (side > 0 ? 0 : 5), -5, 5, 15, 2);
        else ctx.rect(side * 16 - (side > 0 ? 0 : 5), -5, 5, 15);
        ctx.fillStyle = '#1e2233';
        ctx.fill();
        ctx.strokeStyle = cfg.themeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Neon Cat Ears
        ctx.beginPath();
        ctx.moveTo(side * 7, -15);
        ctx.lineTo(side * 16, -27);
        ctx.lineTo(side * 18, -12);
        ctx.closePath();
        ctx.fillStyle = '#111322';
        ctx.fill();
        ctx.strokeStyle = cfg.themeColor;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = cfg.themeColor;
        ctx.shadowBlur = 7;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      });

      // Front Bangs Hair
      ctx.beginPath();
      ctx.arc(0, -8, 17, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(7, -4);
      ctx.lineTo(0, -6);
      ctx.lineTo(-7, -4);
      ctx.closePath();
      ctx.fillStyle = cfg.hairColor;
      ctx.fill();
      ctx.strokeStyle = cfg.hairHighlight;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.restore();

      // -------------------------------------------------------------------
      // 2.6 Dynamic 60 FPS Dancing Arms (NO STICKS - Pure Rave Poses!)
      // Natural 2-segment arms with elbows, hands, and neon wristbands
      // -------------------------------------------------------------------
      const shoulderLY = chestY - 9;
      const shoulderRY = chestY - 9;
      const shoulderLX = chestX - 14;
      const shoulderRX = chestX + 14;

      if (isDrop) {
        // 🔥 BASS RAVE MODE:
        // Outer Arm (RX): Raised high pumping to beat with Peace Sign (✌️)
        // Inner Arm (LX): Sexy hand resting on curvy hip
        const pumpProgress = Math.sin(beatPhase * Math.PI);
        const pumpY = pumpProgress * 22;

        // Outer Arm (Shoulder -> Elbow -> Hand)
        const rElbowX = shoulderRX + 11;
        const rElbowY = shoulderRY - 14 - pumpY * 0.4;
        const rHandX = shoulderRX + 13 + Math.sin(now * 0.003) * 3;
        const rHandY = headY - 24 - pumpY;

        ctx.beginPath();
        ctx.moveTo(shoulderRX, shoulderLY);
        ctx.lineTo(rElbowX, rElbowY);
        ctx.lineTo(rHandX, rHandY);
        ctx.strokeStyle = '#ffdd99';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Outer Neon Wristband
        ctx.beginPath();
        ctx.arc(rHandX, rHandY + 2, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = cfg.themeColor;
        ctx.shadowColor = cfg.themeColor;
        ctx.shadowBlur = 7;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Cute Hand with ✌️ Peace Sign
        ctx.save();
        ctx.translate(rHandX, rHandY);
        ctx.fillStyle = '#ffdd99';
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();

        // 2 Raised fingers
        ctx.strokeStyle = '#ffdd99';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-1.2, 0);
        ctx.lineTo(-2.8, -7);
        ctx.moveTo(1.2, 0);
        ctx.lineTo(2.8, -7);
        ctx.stroke();
        ctx.restore();

        // Inner Arm (LX): Sexy hand resting on hip/waist
        const lHandX = hipX - 12;
        const lHandY = hipY - 3;
        const lElbowX = shoulderLX - 10;
        const lElbowY = (shoulderLY + lHandY) * 0.5 + 2;

        ctx.beginPath();
        ctx.moveTo(shoulderLX, shoulderLY);
        ctx.lineTo(lElbowX, lElbowY);
        ctx.lineTo(lHandX, lHandY);
        ctx.strokeStyle = '#ffdd99';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Inner Hand resting on hip
        ctx.beginPath();
        ctx.arc(lHandX, lHandY, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd99';
        ctx.fill();

        // Inner Neon Wristband
        ctx.beginPath();
        ctx.arc(lHandX, lHandY - 2, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = cfg.secondaryColor;
        ctx.fill();

      } else {
        // 🎧 CHILL / GROOVE MODE:
        // Outer hand touches cat-ear headphones playfully, Inner hand dances at waist
        const waveAngle = danceCycle * Math.PI * 2;

        // Outer Arm (touches headphone/hair)
        const rElbowX = shoulderRX + 12;
        const rElbowY = shoulderRY - 7 + Math.sin(waveAngle) * 3;
        const rHandX = headX + 14;
        const rHandY = headY - 4 + Math.cos(waveAngle) * 3;

        ctx.beginPath();
        ctx.moveTo(shoulderRX, shoulderRY);
        ctx.lineTo(rElbowX, rElbowY);
        ctx.lineTo(rHandX, rHandY);
        ctx.strokeStyle = '#ffdd99';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rHandX, rHandY, 4.0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd99';
        ctx.fill();

        // Outer Wristband
        ctx.beginPath();
        ctx.arc(rHandX, rHandY + 2, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = cfg.themeColor;
        ctx.fill();

        // Inner Arm (poses gracefully at waist)
        const lHandX = hipX - 10 + Math.cos(waveAngle) * 3;
        const lHandY = hipY - 2 + Math.sin(waveAngle) * 3;
        const lElbowX = shoulderLX - 8;
        const lElbowY = (shoulderLY + lHandY) * 0.5 + 2;

        ctx.beginPath();
        ctx.moveTo(shoulderLX, shoulderLY);
        ctx.lineTo(lElbowX, lElbowY);
        ctx.lineTo(lHandX, lHandY);
        ctx.strokeStyle = '#ffdd99';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lHandX, lHandY, 4.0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd99';
        ctx.fill();

        // Inner Wristband
        ctx.beginPath();
        ctx.arc(lHandX, lHandY - 2, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = cfg.secondaryColor;
        ctx.fill();
      }

      ctx.restore();
      ctx.restore();
    });
  }


  // Draw DJ Booth Platform, Disco Mirror Ball, Superstar Resident DJ, Pioneer Mixer & Vibrating Speakers
  function drawDJStage(now) {
    const stageY = H * 0.36;

    ctx.save();

    // 1. Soft Theatrical Backlight Wash on Stage (Zero harsh polygon trapezoids!)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const djWashAlpha = 0.12 + beatEngine.bassLevel * 0.16;
    const djGlow = ctx.createRadialGradient(W / 2, stageY + 70, 20, W / 2, stageY + 70, 280);
    djGlow.addColorStop(0, `rgba(0, 240, 255, ${djWashAlpha * 0.8})`);
    djGlow.addColorStop(0.5, `rgba(112, 0, 255, ${djWashAlpha * 0.4})`);
    djGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = djGlow;
    ctx.beginPath();
    ctx.ellipse(W / 2, stageY + 70, 320, 120, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Disco Mirror Ball (Suspended from center ceiling)
    const ballX = W / 2;
    const ballY = 155;
    const ballRadius = 38;

    // Chain from ceiling
    ctx.beginPath();
    ctx.moveTo(ballX, 120);
    ctx.lineTo(ballX, ballY - ballRadius);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Metallic sphere
    const ballGrad = ctx.createRadialGradient(ballX - 12, ballY - 12, 4, ballX, ballY, ballRadius);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.3, '#e2e8f0');
    ballGrad.addColorStop(0.7, '#64748b');
    ballGrad.addColorStop(1, '#1e293b');

    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rotating mirror facets on the sphere
    const ballRot = now * 0.0012 * (beatEngine.bpm / 120);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.clip();
    for (let lat = -3; lat <= 3; lat++) {
      const fy = ballY + lat * 9;
      const rowRadius = Math.sqrt(Math.max(0, ballRadius * ballRadius - (fy - ballY) * (fy - ballY)));
      for (let lon = 0; lon < 8; lon++) {
        const fAngle = ballRot + lon * (Math.PI / 4);
        const fx = ballX + Math.sin(fAngle) * rowRadius;
        const facetAlpha = (Math.cos(fAngle) + 1) * 0.45;
        ctx.fillStyle = `rgba(255, 255, 255, ${facetAlpha})`;
        ctx.fillRect(fx - 4, fy - 3, 7, 6);
      }
    }
    ctx.restore();

    // Disco Ball Starfield Sparkles
    discoSparkles.forEach(s => {
      s.angle += s.speed * (beatEngine.bpm / 120);
      const sx = ballX + Math.cos(s.angle) * s.orbitRadius;
      const sy = ballY + Math.sin(s.angle) * (s.orbitRadius * 0.4);

      ctx.beginPath();
      ctx.arc(sx, sy, s.size * (0.8 + beatEngine.bassLevel * 0.5), 0, Math.PI * 2);
      const sparkleColor = stageLighting.getCurrentColor(s.colorOffset);
      ctx.fillStyle = sparkleColor;
      ctx.fill();
    });

    // 3. Stage Platform Base (Firmly connecting DJ stage to dance floor)
    ctx.beginPath();
    ctx.moveTo(W * 0.18, stageY + 70);
    ctx.lineTo(W * 0.82, stageY + 70);
    ctx.lineTo(W * 0.88, stageY + 140);
    ctx.lineTo(W * 0.12, stageY + 140);
    ctx.closePath();
    ctx.fillStyle = '#0c0f20';
    ctx.fill();
    ctx.strokeStyle = stageLighting.getCurrentColor(0);
    ctx.lineWidth = 3;
    ctx.stroke();

    // DJ Booth Table coordinates
    const tableW = 380;
    const tableH = 125;
    const tableX = (W - tableW) / 2;
    const tableY = stageY + 25;

    // 4. Resident DJ Character
    const djHype = Math.max(0, Math.min(1.0, (beatEngine.bassLevel - 0.18) / 0.65));
    const djBob = djHype > 0.08
      ? Math.sin(beatEngine.beatPhase * Math.PI) * (8 + djHype * 28)
      : Math.sin(now * 0.003) * 4;
    const djSway = Math.sin(beatEngine.danceCycle * Math.PI * 2) * (3 + djHype * 12);
    const djHeadX = W / 2 + djSway;
    const djHeadY = tableY - 58 + djBob;

    // DJ Body & Hoodie
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(djHeadX - 48, djHeadY + 28);
    ctx.lineTo(djHeadX + 48, djHeadY + 28);
    ctx.lineTo(djHeadX + 62, djHeadY + 105);
    ctx.lineTo(djHeadX - 62, djHeadY + 105);
    ctx.closePath();
    ctx.fillStyle = '#111322';
    ctx.fill();
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Turntables & Hands
    const deckLeftX = tableX + 85;
    const deckRightX = tableX + tableW - 85;
    const deckLeftY = tableY + 22;

    const isDJDropRave = beatEngine.isBassActive || djHype > 0.35;

    if (isDJDropRave) {
      // 🔥 BASS RAVE MODE: 1 TAY CHẠM TAI NGHE, 1 TAY GIƠ SỐ 2 (✌️) QUẨY THEO BEAT!
      const pumpProgress = Math.sin(beatEngine.beatPhase * Math.PI);
      const pumpOffset = pumpProgress * 42;

      // 1. Right Arm: Raised Up with Number 2 / Peace Sign (✌️)
      const rHandX = djHeadX + 68 + Math.sin(now * 0.002) * 4;
      const rHandY = djHeadY - 45 - pumpOffset;
      ctx.beginPath();
      ctx.moveTo(djHeadX + 44, djHeadY + 36);
      ctx.quadraticCurveTo(djHeadX + 68, djHeadY + 5, rHandX, rHandY);
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rHandX, rHandY, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdd99';
      ctx.fill();
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Neon wristband (Pink)
      ctx.beginPath();
      ctx.arc(rHandX, rHandY + 6, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ff007f';
      ctx.fill();

      // Number 2 / Peace sign (✌️ 2 fingers raised)
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = '#ffdd99';
      ctx.beginPath();
      ctx.moveTo(rHandX - 4, rHandY - 5);
      ctx.lineTo(rHandX - 10, rHandY - 26);
      ctx.moveTo(rHandX + 4, rHandY - 5);
      ctx.lineTo(rHandX + 6, rHandY - 28);
      ctx.stroke();

      // 2. Left Arm: Touching Left Headphone (Iconic Pro DJ Stance)
      const lHandX = djHeadX - 44;
      const lHandY = djHeadY + 10;
      const lElbowX = djHeadX - 74;
      const lElbowY = djHeadY + 34;

      ctx.beginPath();
      ctx.moveTo(djHeadX - 44, djHeadY + 36);
      ctx.quadraticCurveTo(lElbowX, lElbowY, lHandX, lHandY);
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Left hand palm cupping the headphone
      ctx.beginPath();
      ctx.arc(lHandX, lHandY, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdd99';
      ctx.fill();
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Neon wristband (Cyan) on left wrist
      ctx.beginPath();
      ctx.arc(lHandX - 5, lHandY + 9, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.fill();

      // Fingers cupping headphone outer shell
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffdd99';
      ctx.beginPath();
      ctx.moveTo(lHandX + 2, lHandY - 7);
      ctx.quadraticCurveTo(lHandX - 8, lHandY - 9, lHandX - 11, lHandY - 2);
      ctx.moveTo(lHandX + 2, lHandY - 1);
      ctx.quadraticCurveTo(lHandX - 8, lHandY - 3, lHandX - 11, lHandY + 4);
      ctx.stroke();

    } else {
      // 🎧 CHILL / GROOVE MODE: 2 TAY CHƠI DJ (CHÀ ĐĨA & XOAY NÚT TURNTABLE NHƯ CŨ)
      const scratchWobble = Math.sin(now * 0.015) * 8;
      const tweakKnob = Math.sin(now * 0.008) * 4;

      // Right hand on right turntable deck
      ctx.beginPath();
      ctx.moveTo(djHeadX + 44, djHeadY + 36);
      ctx.quadraticCurveTo(djHeadX + 65, tableY - 15, deckRightX + tweakKnob, deckLeftY);
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(deckRightX + tweakKnob, deckLeftY, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdd99';
      ctx.fill();
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Neon wristband (Pink)
      ctx.beginPath();
      ctx.arc(deckRightX + tweakKnob, deckLeftY - 6, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ff007f';
      ctx.fill();

      // Left hand on left turntable deck scratching back & forth
      ctx.beginPath();
      ctx.moveTo(djHeadX - 44, djHeadY + 36);
      ctx.quadraticCurveTo(djHeadX - 65, tableY - 15, deckLeftX + scratchWobble, deckLeftY);
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(deckLeftX + scratchWobble, deckLeftY, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdd99';
      ctx.fill();
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Neon wristband (Cyan)
      ctx.beginPath();
      ctx.arc(deckLeftX + scratchWobble, deckLeftY - 6, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
    }

    // DJ Head & Face
    ctx.beginPath();
    ctx.arc(djHeadX, djHeadY, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdd99';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Smile
    ctx.beginPath();
    ctx.arc(djHeadX, djHeadY + 8, 14, 0.15 * Math.PI, 0.85 * Math.PI, false);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Cyber DJ Visor / Glasses
    const visW = 56;
    const visH = 22;
    const visX = djHeadX - visW / 2;
    const visY = djHeadY - 4;
    ctx.beginPath();
    ctx.roundRect(visX, visY, visW, visH, 6);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Equalizer bars inside visor
    for (let b = 0; b < 4; b++) {
      const bx = visX + 8 + b * 11;
      const bHeight = 4 + Math.sin(now * 0.02 + b) * 5 + beatEngine.bassLevel * 6;
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(bx, visY + visH - 4 - bHeight, 7, bHeight);
    }

    // Professional DJ Studio Headphones
    const ecupW = 16;
    const ecupH = 34;
    const ecupY = djHeadY - 4;
    [-1, 1].forEach(side => {
      const ecX = djHeadX + side * 36 - (side > 0 ? 0 : ecupW);
      ctx.beginPath();
      ctx.roundRect(ecX, ecupY, ecupW, ecupH, 6);
      ctx.fillStyle = '#1e2233';
      ctx.fill();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    // Headband over head
    ctx.beginPath();
    ctx.arc(djHeadX, djHeadY - 14, 40, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = '#1e2233';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Snapback DJ Cap
    ctx.beginPath();
    ctx.arc(djHeadX, djHeadY - 16, 38, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#0f111a';
    ctx.fill();
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cap visor bill
    ctx.beginPath();
    ctx.ellipse(djHeadX, djHeadY - 16, 44, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1e2233';
    ctx.fill();
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 2;
    ctx.stroke();

    // "DJ" Gold Logo on Cap
    ctx.fillStyle = '#ffe600';
    ctx.font = '900 13px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SANOO', djHeadX, djHeadY - 26);
    ctx.restore();

    // 5. DJ Table Front Panel
    ctx.save();
    const tableGrad = ctx.createLinearGradient(tableX, tableY, tableX + tableW, tableY + tableH);
    tableGrad.addColorStop(0, '#090a14');
    tableGrad.addColorStop(0.5, '#121426');
    tableGrad.addColorStop(1, '#090a14');
    ctx.fillStyle = tableGrad;
    ctx.fillRect(tableX, tableY, tableW, tableH);
    ctx.strokeStyle = stageLighting.getCurrentColor(1);
    ctx.lineWidth = 3;
    ctx.strokeRect(tableX, tableY, tableW, tableH);

    // Glowing Neon Banner (Safely centered at tableY + 95, completely unobstructed!)
    ctx.font = '900 17px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('★ RESIDENT DJ SANOO ★', W / 2, tableY + 95);

    // Bottom Soundwave line across table
    ctx.beginPath();
    for (let wx = tableX + 15; wx < tableX + tableW - 15; wx += 4) {
      const wy = tableY + 115 + Math.sin(wx * 0.12 + now * 0.012) * (2 + beatEngine.bassLevel * 7);
      if (wx === tableX + 15) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.strokeStyle = stageLighting.getCurrentColor(2);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pioneer DJ Mixer & Turntables
    const mixerW = 76;
    const mixerH = 70;
    const mixerX = (W - mixerW) / 2;
    const mixerY = tableY + 5;
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(mixerX, mixerY, mixerW, mixerH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(mixerX, mixerY, mixerW, mixerH);

    // VU Meters
    for (let ch = 0; ch < 2; ch++) {
      const vuX = mixerX + 18 + ch * 24;
      const vuY = mixerY + 12;
      const vuH = 40;
      ctx.fillStyle = '#05070e';
      ctx.fillRect(vuX, vuY, 8, vuH);
      const activeH = Math.min(vuH, beatEngine.bassLevel * vuH * 1.25);
      const vuGrad = ctx.createLinearGradient(0, vuY + vuH, 0, vuY);
      vuGrad.addColorStop(0, '#00ff88');
      vuGrad.addColorStop(0.65, '#ffe600');
      vuGrad.addColorStop(0.9, '#ff0055');
      ctx.fillStyle = vuGrad;
      ctx.fillRect(vuX, vuY + vuH - activeH, 8, activeH);
    }

    // Crossfader
    const cfY = mixerY + mixerH - 14;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(mixerX + 14, cfY, 48, 5);
    const cfKnobX = mixerX + 38 + Math.sin(now * 0.003) * 16;
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(cfKnobX - 4, cfY - 3, 8, 11);

    // Left and Right Turntable Jog Wheels
    [-1, 1].forEach(side => {
      const dx = tableX + (side < 0 ? 85 : tableW - 85);
      const dy = tableY + 25;
      const dRadius = 38;

      ctx.beginPath();
      ctx.arc(dx, dy, dRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#080a14';
      ctx.fill();
      ctx.strokeStyle = stageLighting.getCurrentColor(side > 0 ? 2 : 4);
      ctx.lineWidth = 3;
      ctx.stroke();

      const spinAngle = now * 0.005 * side;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx + Math.cos(spinAngle) * (dRadius - 6), dy + Math.sin(spinAngle) * (dRadius - 6));
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(dx, dy, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.restore();

    // 5.5. 2 Sexy Stage Gogo Dancers on Left and Right Wings
    drawGogoDancers(ctx, now, beatEngine);

    // 6. Concert Speakers Left and Right
    const spkScale = 1.0 + (beatEngine.isBeatHit ? 0.06 * beatEngine.danceEnergy : 0);
    drawSpeaker(120, stageY + 20, spkScale, false);
    drawSpeaker(W - 120, stageY + 20, spkScale, true);

    ctx.restore();
  }

  // Draw Speaker unit
  function drawSpeaker(cx, cy, scale, isRight) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const sw = 100;
    const sh = 170;

    if (spriteCache.speaker && spriteCache.speaker.complete && spriteCache.speaker.naturalWidth > 0) {
      ctx.drawImage(spriteCache.speaker, -sw / 2, -sh / 2, sw, sh);
    } else {
      // Procedural fallback speaker
      ctx.fillStyle = '#10121f';
      ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);

      // Woofer cones
      [-35, 35].forEach(offsetY => {
        ctx.beginPath();
        ctx.arc(0, offsetY, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1d33';
        ctx.fill();
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, offsetY, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe600';
        ctx.fill();
      });
    }

    ctx.restore();
  }

  // 2.5D Perspective Dance Floor Grid with Floor Lights & Glossy Reflections
  function drawDanceFloor(now) {
    const horizonY = H * 0.48;
    const bottomY = H;
    const rows = 12;
    const cols = 10;

    ctx.save();

    // Perspective checkerboard floor
    for (let r = 0; r < rows; r++) {
      const t1 = r / rows;
      const t2 = (r + 1) / rows;
      const y1 = horizonY + (bottomY - horizonY) * Math.pow(t1, 1.6);
      const y2 = horizonY + (bottomY - horizonY) * Math.pow(t2, 1.6);

      const span1 = W * (0.65 + t1 * 0.35);
      const span2 = W * (0.65 + t2 * 0.35);
      const x1Start = (W - span1) / 2;
      const x2Start = (W - span2) / 2;

      for (let c = 0; c < cols; c++) {
        const u1 = c / cols;
        const u2 = (c + 1) / cols;

        const x1a = x1Start + span1 * u1;
        const x1b = x1Start + span1 * u2;
        const x2a = x2Start + span2 * u1;
        const x2b = x2Start + span2 * u2;

        const isOdd = (r + c) % 2 === 1;
        ctx.beginPath();
        ctx.moveTo(x1a, y1);
        ctx.lineTo(x1b, y1);
        ctx.lineTo(x2b, y2);
        ctx.lineTo(x2a, y2);
        ctx.closePath();

        const baseTileColor = isOdd ? 'rgba(12, 16, 36, 0.95)' : 'rgba(8, 10, 24, 0.95)';
        ctx.fillStyle = baseTileColor;
        ctx.fill();

        // Glowing floor neon grid lines
        const borderAlpha = 0.2 + (beatEngine.bassLevel * 0.45);
        ctx.strokeStyle = isOdd ? stageLighting.getCurrentColor(0) : stageLighting.getCurrentColor(2);
        ctx.globalAlpha = borderAlpha;
        ctx.lineWidth = 1.4 + t2 * 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }

    // Disco Ball Starfield Spots on Floor
    discoSparkles.forEach(s => {
      const fx = s.floorX * W;
      const fy = s.floorY * H;
      const fRadius = s.size * (0.7 + beatEngine.bassLevel * 0.6);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(fx, fy, fRadius * 1.8, fRadius * 0.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = stageLighting.getCurrentColor(s.colorOffset);
      ctx.globalAlpha = 0.35 + (beatEngine.bassLevel * 0.4);
      ctx.fill();
      ctx.restore();
    });

    // 2.5D Bass Ripple Shockwaves Expanding Across Dance Floor!
    const dt = 0.016;
    for (let i = bassRipples.length - 1; i >= 0; i--) {
      const r = bassRipples[i];
      r.radius += r.speed * dt;
      r.alpha -= dt * 0.9;
      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        bassRipples.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      const progress = r.radius / r.maxRadius;
      const centerY = r.y + progress * (H - r.y) * 0.96;
      const radiusX = r.radius;
      const radiusY = r.radius * (0.16 + progress * 0.28);

      ctx.ellipse(r.x, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5 * (1 - progress * 0.5);
      ctx.globalAlpha = r.alpha * 0.9;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawSinglePodium(ctx, cx, cy, tiers, colors, badgeText, rank, now) {
    ctx.save();

    // A. Soft Under-Glow Floor Halo (Floor Reflection Beneath Podium Base)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const underAlpha = 0.22 + (rank === 1 ? 0.12 : 0) + beatEngine.bassLevel * 0.18;
    const baseTier = tiers[0];
    const underGlow = ctx.createRadialGradient(cx, cy + baseTier.offsetY + baseTier.height, baseTier.rx * 0.3, cx, cy + baseTier.offsetY + baseTier.height, baseTier.rx * 1.25);
    underGlow.addColorStop(0, colors.rimColor);
    underGlow.addColorStop(0.6, colors.rimColor);
    underGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = underGlow;
    ctx.globalAlpha = underAlpha;
    ctx.beginPath();
    ctx.ellipse(cx, cy + baseTier.offsetY + baseTier.height + 4, baseTier.rx * 1.25, baseTier.ry * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // B. Draw Tiers from bottom (tier 0) to top platform
    for (let t = 0; t < tiers.length; t++) {
      const tier = tiers[t];
      const tierY = cy + tier.offsetY;

      // Wall gradient
      const wGrad = ctx.createLinearGradient(cx - tier.rx, tierY, cx + tier.rx, tierY);
      wGrad.addColorStop(0, colors.wallDark);
      wGrad.addColorStop(0.35, colors.wallLight);
      wGrad.addColorStop(0.7, colors.wallMid);
      wGrad.addColorStop(1, colors.wallDark);

      // Top face gradient
      const fGrad = ctx.createRadialGradient(cx, tierY, 5, cx, tierY, tier.rx);
      fGrad.addColorStop(0, colors.topCenter);
      fGrad.addColorStop(0.75, colors.topRim);
      fGrad.addColorStop(1, colors.topEdge);

      // Draw Cylindrical Wall
      ctx.beginPath();
      ctx.ellipse(cx, tierY + tier.height, tier.rx, tier.ry, 0, 0, Math.PI);
      ctx.lineTo(cx - tier.rx, tierY);
      ctx.ellipse(cx, tierY, tier.rx, tier.ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + tier.rx, tierY + tier.height);
      ctx.closePath();
      ctx.fillStyle = wGrad;
      ctx.fill();
      ctx.strokeStyle = colors.rimColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Draw Top Platform Face
      ctx.beginPath();
      ctx.ellipse(cx, tierY, tier.rx, tier.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = fGrad;
      ctx.fill();
      ctx.strokeStyle = colors.rimColor;
      ctx.lineWidth = (t === tiers.length - 1) ? 3 : 2;
      ctx.stroke();
    }

    // C. Neon Neon Rim Tube on Top Platform
    const topTier = tiers[tiers.length - 1];
    const topPlatformY = cy + topTier.offsetY;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, topPlatformY, topTier.rx, topTier.ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // D. Front Metallic Engraved Plaque on base wall
    const badgeW = rank === 1 ? 210 : 155;
    const badgeH = rank === 1 ? 30 : 28;
    const badgeY = cy + tiers[0].offsetY + tiers[0].height - (rank === 1 ? 20 : 18);

    ctx.save();
    const bGrad = ctx.createLinearGradient(cx - badgeW / 2, badgeY, cx + badgeW / 2, badgeY + badgeH);
    bGrad.addColorStop(0, colors.badgeBg0);
    bGrad.addColorStop(1, colors.badgeBg1);

    ctx.fillStyle = bGrad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    // Plaque Text
    ctx.fillStyle = colors.badgeTextColor;
    ctx.font = '900 13px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, cx, badgeY + badgeH / 2 + 1);
    ctx.restore();

    ctx.restore();
  }

  // 3 VIP Podiums Configurations (Shifted UP, Perfectly Spaced & Centered)
  
  // Exact Per-Frame Cat Body Bounding Box & Alignment Metadata [bodyCX, bodyBottomY, bodyH, bodyCY]
  // Ensures 100% mathematical center and feet contact alignment regardless of swinging glowsticks
  const CAT_SPRITE_META = {
    char1: [
      [141.5, 175, 99], [140, 175, 91], [138.5, 175, 77], [138.5, 175, 77],
      [160, 175, 99], [165, 175, 104], [167, 175, 94], [168, 175, 96],
      [170.5, 175, 91], [172.5, 175, 76], [164.5, 175, 88], [153.5, 175, 99],
      [145, 175, 105], [143, 175, 101]
    ],
    char2: [
      [186, 173, 88], [180, 173, 96], [174.5, 174, 89], [163.5, 174, 80],
      [164.5, 173, 104], [172.5, 173, 114], [176, 173, 113], [186.5, 173, 88],
      [180, 173, 96], [174.5, 174, 89], [160.5, 174, 92], [164.5, 173, 104],
      [172.5, 173, 114]
    ],
    char3: [
      [116.5, 237, 151], [119, 214, 140], [136.5, 197, 118], [150.5, 226, 135],
      [155.5, 253, 156], [121.5, 272, 166], [121.5, 272, 166], [109.5, 252, 149],
      [113.5, 219, 139], [122, 192, 118], [119.5, 219, 135], [115, 243, 154],
      [110.5, 259, 164], [110.5, 259, 164]
    ]
  };

  const PODIUM_CONFIG = {
    top1: {
      cx: W * 0.50, // 540px Center
      cy: H * 0.505, // Shifted UP naturally to 970px (was 0.54 = 1036px)
      tiers: [
        { offsetY: 48, height: 30, rx: 205, ry: 56 }, // Tier 0 (base)
        { offsetY: 24, height: 26, rx: 175, ry: 48 }, // Tier 1 (mid)
        { offsetY: 0,  height: 24, rx: 150, ry: 40 }  // Tier 2 (top platform face)
      ],
      colors: {
        spotLight: 'rgba(255, 230, 0, ALPHA)',
        wallDark: '#1a1302',
        wallLight: '#785408',
        wallMid: '#422e05',
        topCenter: '#fffbe6',
        topRim: '#f59e0b',
        topEdge: '#451a03',
        rimColor: '#ffe600',
        badgeBg0: '#ffe600',
        badgeBg1: '#b45309',
        badgeTextColor: '#000000'
      },
      plaqueText: '👑 TOP 1 ĐẠI GIA'
    },
    top2: {
      cx: W * 0.20, // 216px (Spaced wide to the left, zero overlap with Top 1)
      cy: H * 0.555, // 1065px (Shifted UP naturally, was 0.59 = 1132px)
      tiers: [
        { offsetY: 26, height: 24, rx: 132, ry: 36 }, // Tier 0 (base)
        { offsetY: 0,  height: 22, rx: 112, ry: 30 }  // Tier 1 (top platform face)
      ],
      colors: {
        spotLight: 'rgba(0, 240, 255, ALPHA)',
        wallDark: '#04121e',
        wallLight: '#1e4e75',
        wallMid: '#0e2b45',
        topCenter: '#e0f7fa',
        topRim: '#0284c7',
        topEdge: '#082f49',
        rimColor: '#00f0ff',
        badgeBg0: '#e0f7fa',
        badgeBg1: '#0284c7',
        badgeTextColor: '#000000'
      },
      plaqueText: '🥈 TOP 2 VIP'
    },
    top3: {
      cx: W * 0.80, // 864px (Spaced wide to the right, zero overlap with Top 1)
      cy: H * 0.555, // 1065px (Shifted UP naturally, was 0.59 = 1132px)
      tiers: [
        { offsetY: 26, height: 24, rx: 132, ry: 36 }, // Tier 0 (base)
        { offsetY: 0,  height: 22, rx: 112, ry: 30 }  // Tier 1 (top platform face)
      ],
      colors: {
        spotLight: 'rgba(255, 140, 0, ALPHA)',
        wallDark: '#1c0a02',
        wallLight: '#6e2b0a',
        wallMid: '#381605',
        topCenter: '#ffedd5',
        topRim: '#ea580c',
        topEdge: '#431407',
        rimColor: '#ff8c00',
        badgeBg0: '#ffedd5',
        badgeBg1: '#c2410c',
        badgeTextColor: '#000000'
      },
      plaqueText: '🥉 TOP 3 VIP'
    }
  };

  // 3 VIP Podiums on Dance Floor (Top 1 Center Gold, Top 2 Left Silver, Top 3 Right Bronze)
  function drawVIPPodiums(now) {
    drawSinglePodium(ctx, PODIUM_CONFIG.top1.cx, PODIUM_CONFIG.top1.cy, PODIUM_CONFIG.top1.tiers, PODIUM_CONFIG.top1.colors, PODIUM_CONFIG.top1.plaqueText, 1, now);
    drawSinglePodium(ctx, PODIUM_CONFIG.top2.cx, PODIUM_CONFIG.top2.cy, PODIUM_CONFIG.top2.tiers, PODIUM_CONFIG.top2.colors, PODIUM_CONFIG.top2.plaqueText, 2, now);
    drawSinglePodium(ctx, PODIUM_CONFIG.top3.cx, PODIUM_CONFIG.top3.cy, PODIUM_CONFIG.top3.tiers, PODIUM_CONFIG.top3.colors, PODIUM_CONFIG.top3.plaqueText, 3, now);
  }

  // Synchronize VIP Podiums and Dancer Rank Positions
  function syncVIPRanksAndPodiums() {
    if (!dancers || dancers.length === 0) return;

    // Reset VIP rank flags
    dancers.forEach(d => {
      d.vipRank = 0;
      d.isVip = false;
    });

    const assigned = new Set();

    // 1. Assign from topGifters list if available
    for (let r = 0; r < 3; r++) {
      const g = topGifters[r];
      if (g) {
        const found = dancers.find(d => !assigned.has(d) && (d.username === g.username || d.nickname === g.nickname));
        if (found) {
          found.vipRank = r + 1;
          found.isVip = true;
          assigned.add(found);
        }
      }
    }

    // 2. Podiums are reserved exclusively for Top Gifters
    // (If no gifters yet, podiums stay pristine waiting for donors)

    // 3. Anchor VIPs precisely to stand in the DEAD CENTER of each podium platform
    dancers.forEach(d => {
      d.charCategory = 'cat';
      if (!d.charType || d.charType > 3) {
        // VIP podiums default to majestic Rave lightsticks (charType 1) for full symmetry!
        d.charType = (d.vipRank > 0) ? 1 : (1 + Math.floor(Math.random() * 3));
      }

      if (d.vipRank === 1) {
        const p = PODIUM_CONFIG.top1;
        d.targetX = p.cx / W;
        d.targetY = p.cy / H; // Feet touch dead center of Tier 2 gold platform face
        d.x = d.targetX;
        d.y = d.targetY;
        d.vipPositioned = true;
        d.lastVipRank = 1;
      } else if (d.vipRank === 2) {
        const p = PODIUM_CONFIG.top2;
        d.targetX = p.cx / W;
        d.targetY = p.cy / H; // Feet touch dead center of silver platform face
        d.x = d.targetX;
        d.y = d.targetY;
        d.vipPositioned = true;
        d.lastVipRank = 2;
      } else if (d.vipRank === 3) {
        const p = PODIUM_CONFIG.top3;
        d.targetX = p.cx / W;
        d.targetY = p.cy / H; // Feet touch dead center of bronze platform face
        d.x = d.targetX;
        d.y = d.targetY;
        d.vipPositioned = true;
        d.lastVipRank = 3;
      } else {
        d.lastVipRank = 0;
        // Regular crowd (không có top): dance on floor starting right below podiums (y = 0.60 ~ 0.88)
        if (!d.crowdPositioned || d.targetY >= 0.67 || d.targetY < 0.59) {
          const str = d.id || d.username || 'user';
          let hash = 0;
          for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
          hash = Math.abs(hash);
          const row = hash % 18;
          d.targetY = 0.60 + row * 0.016;

          // Avoid standing directly on Top 2 or Top 3 podium bases in front rows (y < 0.63)
          if (d.targetY < 0.63) {
            if (d.targetX >= 0.08 && d.targetX <= 0.32) d.targetX = 0.38 + ((hash >> 3) % 4) * 0.04;
            if (d.targetX >= 0.68 && d.targetX <= 0.92) d.targetX = 0.62 - ((hash >> 3) % 4) * 0.04;
          }
          d.crowdPositioned = true;
        }
      }
    });
  }

  // ===========================================================================
  // PROFESSIONAL NIGHTCLUB LIGHTING RIG (Authentic Volumetric Moving Heads)
  // Clean, realistic concert beams: ZERO harsh geometric laser sticks!
  // ===========================================================================
  // 6 Volumetric Moving Heads, Liquid Sky & Club Atmosphere
  // ===========================================================================
  function drawLasers(now) {
    const sweepSpeed = beatEngine.isBassActive
      ? (now * 0.0022 * (beatEngine.bpm / 120))
      : (now * 0.0013 * (beatEngine.bpm / 120));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // Additive volumetric lighting

    // 1. 6 Pro Moving Heads mounted on top ceiling truss
    // Volumetric 3D Conical Beams (NOT squashed/flattened! Wide, full & atmospheric!)
    movingHeads.forEach((head, idx) => {
      const isLeft = idx < 3;
      const pairIdx = isLeft ? idx : (5 - idx);
      const wavePhase = sweepSpeed * head.speed + pairIdx * 0.55;
      const sweepAngle = (isLeft ? -1 : 1) * (head.baseAngle + Math.sin(wavePhase) * head.sweepRange);

      const colorRgb = stageLighting.getRgb(head.colorOffset);

      const originX = head.x;
      const originY = head.y + 14;

      const beamLength = 1450;
      const targetX = originX + Math.sin(sweepAngle) * beamLength;
      const targetY = originY + Math.cos(sweepAngle) * beamLength;

      // Generous, realistic conical beam width (Expanded from 145px -> 340px+ to eliminate flattened look)
      const endWidth = 340 + beatEngine.bassLevel * 120 + (stageLighting.flashIntensity * 90);
      const perpAngle = sweepAngle + Math.PI / 2;
      const topHalfW = 13; // 26px wide lens opening at truss
      const p1X = originX - Math.cos(perpAngle) * topHalfW;
      const p1Y = originY - Math.sin(perpAngle) * topHalfW;
      const p2X = originX + Math.cos(perpAngle) * topHalfW;
      const p2Y = originY + Math.sin(perpAngle) * topHalfW;
      const p3X = targetX + Math.cos(perpAngle) * (endWidth / 2);
      const p3Y = targetY + Math.sin(perpAngle) * (endWidth / 2);
      const p4X = targetX - Math.cos(perpAngle) * (endWidth / 2);
      const p4Y = targetY - Math.sin(perpAngle) * (endWidth / 2);

      const alphaBase = beatEngine.isBassActive
        ? (0.22 + beatEngine.bassLevel * 0.28 + stageLighting.flashIntensity * 0.25)
        : 0.13;

      // Layer A: Wide Volumetric Atmospheric Wash Cone
      const beamGrad = ctx.createLinearGradient(originX, originY, targetX, targetY);
      beamGrad.addColorStop(0, `rgba(255, 255, 255, ${alphaBase * 0.95})`);
      beamGrad.addColorStop(0.08, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.85})`);
      beamGrad.addColorStop(0.50, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.35})`);
      beamGrad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.moveTo(p1X, p1Y);
      ctx.lineTo(p2X, p2Y);
      ctx.lineTo(p3X, p3Y);
      ctx.lineTo(p4X, p4Y);
      ctx.closePath();
      ctx.fillStyle = beamGrad;
      ctx.fill();

      // Layer B: Intense Inner Core Beam (Gives beam cylindrical 3D roundness!)
      const coreEndW = endWidth * 0.42;
      const coreP3X = targetX + Math.cos(perpAngle) * (coreEndW / 2);
      const coreP3Y = targetY + Math.sin(perpAngle) * (coreEndW / 2);
      const coreP4X = targetX - Math.cos(perpAngle) * (coreEndW / 2);
      const coreP4Y = targetY - Math.sin(perpAngle) * (coreEndW / 2);

      const coreGrad = ctx.createLinearGradient(originX, originY, targetX, targetY);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${alphaBase * 1.1})`);
      coreGrad.addColorStop(0.12, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.95})`);
      coreGrad.addColorStop(0.60, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.25})`);
      coreGrad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.moveTo(p1X + Math.cos(perpAngle) * 4, p1Y + Math.sin(perpAngle) * 4);
      ctx.lineTo(p2X - Math.cos(perpAngle) * 4, p2Y - Math.sin(perpAngle) * 4);
      ctx.lineTo(coreP3X, coreP3Y);
      ctx.lineTo(coreP4X, coreP4Y);
      ctx.closePath();
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Floor Spotlight Reflection Pool (Full round perspective, NOT squashed flat!)
      const floorY = Math.min(targetY, H - 40);
      if (floorY > H * 0.48) {
        // Natural 3D perspective ellipse: Rx = 150-210, Ry = 90-130 (Ratio 0.60 instead of flat 0.34)
        const spotRx = 150 + beatEngine.bassLevel * 60;
        const spotRy = 90 + beatEngine.bassLevel * 40;

        ctx.save();
        ctx.translate(targetX, floorY);
        ctx.scale(1, spotRy / spotRx);

        const spotGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, spotRx);
        spotGrad.addColorStop(0, `rgba(255, 255, 255, ${alphaBase * 0.95})`);
        spotGrad.addColorStop(0.35, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.65})`);
        spotGrad.addColorStop(0.75, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.15})`);
        spotGrad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(0, 0, spotRx, 0, Math.PI * 2);
        ctx.fillStyle = spotGrad;
        ctx.fill();
        ctx.restore();
      }
    });

    // 2. Liquid Sky / Laser Fan Plane (Horizontal laser ceiling above crowd)
    const fanColor = stageLighting.getCurrentColor(1);
    const fanAlpha = 0.10 + beatEngine.bassLevel * 0.22 + stageLighting.flashIntensity * 0.20;
    const fanY = H * 0.47;
    const fanGrad = ctx.createLinearGradient(0, fanY - 26, 0, fanY + 26);
    fanGrad.addColorStop(0, 'transparent');
    fanGrad.addColorStop(0.5, fanColor);
    fanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fanGrad;
    ctx.globalAlpha = fanAlpha;
    ctx.beginPath();
    ctx.ellipse(W / 2, fanY, W * 0.48, 52 + beatEngine.bassLevel * 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // 3. Floating Atmospheric Club Haze Sparkles
    clubAtmosphereMotes.forEach(m => {
      m.y += m.vy * 0.016;
      m.x += Math.sin(now * 0.002 + m.hue) * 0.4;
      if (m.y < H * 0.12) {
        m.y = H * 0.88;
        m.x = Math.random() * W;
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${m.hue}, 90%, 65%, ${m.alpha * (0.35 + beatEngine.bassLevel * 0.55)})`;
      ctx.fill();
    });

    ctx.restore(); // Restore normal blend mode

    // Physical Moving Head Housings on Truss
    movingHeads.forEach(head => {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.fillStyle = '#161928';
      ctx.strokeStyle = '#3a4460';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-5, -12, 10, 12);
      ctx.strokeRect(-5, -12, 10, 12);

      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#111322';
      ctx.fill();
      ctx.stroke();

      const lensColor = stageLighting.getCurrentColor(head.colorOffset);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lensGrad = ctx.createRadialGradient(0, 4, 1, 0, 4, 12);
      lensGrad.addColorStop(0, '#ffffff');
      lensGrad.addColorStop(0.4, lensColor);
      lensGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = lensGrad;
      ctx.beginPath();
      ctx.arc(0, 4, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    });
  }

  // Word Wrapping Helper for Speech Bubbles (Max 3 lines, truncate with ... on overflow)
  function wrapSpeechBubbleText(ctx, text, maxLineWidth = 270, maxLines = 3) {
    if (!text || typeof text !== 'string') return [text || ''];
    const clean = text.trim();
    if (!clean) return [''];

    const words = clean.split(/\s+/);
    const lines = [];
    let curLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = curLine ? (curLine + ' ' + word) : word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth <= maxLineWidth) {
        curLine = testLine;
      } else {
        if (curLine) {
          lines.push(curLine);
          curLine = '';
        }

        // If we reached the final allowed line (line 3):
        if (lines.length === maxLines - 1) {
          let remaining = words.slice(i).join(' ');
          if (ctx.measureText(remaining).width <= maxLineWidth) {
            lines.push(remaining);
          } else {
            while (remaining.length > 0 && ctx.measureText(remaining + '...').width > maxLineWidth) {
              remaining = remaining.slice(0, -1).trimEnd();
            }
            lines.push((remaining || '') + '...');
          }
          return lines;
        }

        // If a single word is wider than maxLineWidth
        if (ctx.measureText(word).width > maxLineWidth) {
          let piece = '';
          for (const c of word) {
            if (ctx.measureText(piece + c).width <= maxLineWidth) {
              piece += c;
            } else {
              lines.push(piece);
              piece = c;
              if (lines.length === maxLines - 1) break;
            }
          }
          curLine = piece;
        } else {
          curLine = word;
        }
      }
    }

    if (curLine && lines.length < maxLines) {
      lines.push(curLine);
    }

    return lines;
  }

  // Draw Speech Bubbles Floating Perfectly Above Dancer Heads & Nametags
  function drawSpeechBubbles(now) {
    const curTime = (now && now > 0) ? now : performance.now();

    for (let i = speechBubbles.length - 1; i >= 0; i--) {
      const sb = speechBubbles[i];
      const age = curTime - sb.createdAt;

      // Only expire when age exceeds full duration.
      // (Never expire when age < 0 due to sub-millisecond RAF timestamp jitter!)
      if (age > sb.duration) {
        speechBubbles.splice(i, 1);
        continue;
      }
      const safeAge = Math.max(0, age);

      // Dynamically locate / re-bind dancer if not already bound
      if (!sb.targetDancer) {
        sb.targetDancer = findDancerByAnyName(sb.username, sb.nickname);
      }

      // Calculate exact visual anchor position on screen
      let screenX, screenY, headTopOffset, isVip = 0;
      if (sb.targetDancer) {
        const d = sb.targetDancer;
        const totalYOffset = (d.jumpOffset || 0) + (d.bounceY || 0);
        screenX = d.x * W;
        screenY = d.y * H - totalYOffset;
        const scale = d.scale || 0.5;
        const standardHeadHeight = 102 * (scale * 1.1);
        const tagHeight = (d.vipRank === 1) ? 42 : ((d.vipRank === 2 || d.vipRank === 3) ? 36 : 31);
        headTopOffset = standardHeadHeight + tagHeight + 10;
        isVip = d.vipRank || 0;
      } else {
        screenX = sb.x * W;
        screenY = sb.y * H;
        headTopOffset = 105;
      }

      // Pop-in spring animation (0 to 1 over first 180ms)
      let popScale = 1;
      if (safeAge < 180) {
        const p = safeAge / 180;
        popScale = 0.5 + 0.5 * Math.sin(p * Math.PI * 0.5);
      }

      // Smooth fade-out in the last 600ms
      const alpha = safeAge > (sb.duration - 600) ? Math.max(0, (sb.duration - safeAge) / 600) : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Typography & Multi-line Wrapping (Max 3 lines, overflow with ...)
      const fontSize = 18;
      ctx.font = `bold ${fontSize}px "Be Vietnam Pro", sans-serif`;

      const maxLineWidth = 270;
      const lines = wrapSpeechBubbleText(ctx, sb.text, maxLineWidth, 3);
      const maxTextW = Math.max(...lines.map(l => ctx.measureText(l).width));

      const padX = 20;
      const bw = Math.min(Math.max(maxTextW + padX * 2, 72), 340);
      const lineH = 24;
      const bh = 38 + (lines.length - 1) * lineH;

      // Speech bubble placement: sits above nametag
      const pointerTipY = screenY - headTopOffset;
      const bubbleBottomY = pointerTipY - 10;
      const bubbleTopY = bubbleBottomY - bh;
      const bx = Math.max(bw / 2 + 15, Math.min(W - bw / 2 - 15, screenX));

      // Border and glow color by VIP tier
      let strokeColor = '#ff007f'; // Neon Pink for crowd
      let glowColor = 'rgba(255, 0, 127, 0.45)';
      if (isVip === 1) {
        strokeColor = '#ffd700'; // Gold for Top 1
        glowColor = 'rgba(255, 215, 0, 0.65)';
      } else if (isVip === 2) {
        strokeColor = '#00f0ff'; // Cyan for Top 2
        glowColor = 'rgba(0, 240, 255, 0.55)';
      } else if (isVip === 3) {
        strokeColor = '#ff9100'; // Amber for Top 3
        glowColor = 'rgba(255, 145, 0, 0.55)';
      }

      ctx.translate(bx, bubbleBottomY);
      ctx.scale(popScale, popScale);
      ctx.translate(-bx, -bubbleBottomY);

      // Outer Neon Glow
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12;

      // White Speech Bubble Body
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(bx - bw / 2, bubbleTopY, bw, bh, 14);
      ctx.fill();
      ctx.stroke();

      // Reset shadow for tail & text
      ctx.shadowBlur = 0;

      // Bubble Pointer pointing down to nametag
      const tailX = Math.max(bx - bw / 2 + 18, Math.min(bx + bw / 2 - 18, screenX));
      ctx.beginPath();
      ctx.moveTo(tailX - 9, bubbleBottomY - 1);
      ctx.lineTo(tailX, pointerTipY);
      ctx.lineTo(tailX + 9, bubbleBottomY - 1);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Mask inner tail seam
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tailX - 7, bubbleBottomY - 2.5, 14, 4);

      // Text inside bubble (Bold, crisp dark charcoal, multi-line aware)
      ctx.fillStyle = '#0a0d1e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${fontSize}px "Be Vietnam Pro", sans-serif`;

      if (lines.length === 1) {
        ctx.fillText(lines[0], bx, bubbleTopY + bh / 2 + 1);
      } else {
        const startY = bubbleTopY + (bh - (lines.length - 1) * lineH) / 2;
        for (let li = 0; li < lines.length; li++) {
          ctx.fillText(lines[li], bx, startY + li * lineH);
        }
      }

      ctx.restore();
    }
  }

  // Particle updates & renders (Flames, Fog, Fireworks, Confetti, Hearts)
  function renderParticles(dt) {
    // 1. Stage Fire Cannons & CO2 Cryo Geysers in Glowing Additive Mode
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Flames (Stage Fire)
    for (let i = flames.length - 1; i >= 0; i--) {
      const p = flames[i];
      p.x += p.vx;
      p.y += p.vy;
      p.size *= 0.97;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.size <= 2) {
        flames.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }

    // 2. Smoke / CO2 Cryo Geysers (Cold White & Cyan Plumes)
    for (let i = fogs.length - 1; i >= 0; i--) {
      const p = fogs[i];
      p.x += p.vx;
      p.y += p.vy;
      p.radius += p.growth;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        fogs.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${p.alpha * 0.75})`;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }
    ctx.restore();

    // 3. Fireworks & Confetti
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.isConfetti) {
        p.rot += p.vRot;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Floating Hearts & Reactions
    for (let i = floatingHearts.length - 1; i >= 0; i--) {
      const h = floatingHearts[i];
      h.x += h.vx;
      h.y += h.vy;
      h.alpha -= h.decay;

      if (h.alpha <= 0) {
        floatingHearts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = h.alpha;
      ctx.font = `${Math.floor(36 * h.scale)}px Arial`;
      ctx.fillText(h.emoji, h.x, h.y);
      ctx.restore();
    }
  }

  // Update Top Gifters Leaderboard UI
  function updateTopGiftersUI(list) {
    topGifters = list || [];
    const listEl = document.getElementById('vip-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉', '4', '5'];

    for (let i = 0; i < 5; i++) {
      const g = topGifters[i];
      const item = document.createElement('div');
      item.className = `vip-item rank-${i + 1}`;

      if (g) {
        item.innerHTML = `
          <span class="vip-rank">${medals[i]}</span>
          <span class="vip-name">${g.nickname || g.username}</span>
          <span class="vip-coins">${(g.coins || 0).toLocaleString()}</span>
        `;
      } else {
        item.innerHTML = `
          <span class="vip-rank">${medals[i]}</span>
          <span class="vip-name" style="color: #666;">Chờ đại gia...</span>
          <span class="vip-coins">-</span>
        `;
      }
      listEl.appendChild(item);
    }

    // Save to browser LocalStorage for persistent leaderboard
    try {
      if (topGifters && topGifters.length > 0) {
        localStorage.setItem('sanoo_club_top_gifters', JSON.stringify(topGifters));
      } else {
        localStorage.removeItem('sanoo_club_top_gifters');
      }
    } catch (e) {}

    // Update VIP flag and synchronize podium positions on dancers
    syncVIPRanksAndPodiums();
  }

  // Live Chat Feed UI
  function appendChatFeed(chat) {
    const feed = document.getElementById('chat-feed');
    if (!feed) return;

    const row = document.createElement('div');
    row.className = 'chat-bubble-msg';
    row.innerHTML = `
      <span class="chat-username">${chat.nickname || chat.username}:</span>
      <span class="chat-text">${chat.comment}</span>
    `;

    feed.appendChild(row);

    // Auto-fade out and remove after 6s
    setTimeout(() => {
      row.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
      row.style.opacity = '0';
      row.style.transform = 'translateY(-8px)';
      setTimeout(() => {
        if (row.parentNode === feed) feed.removeChild(row);
      }, 600);
    }, 6000);

    // Keep max 5 items in chat feed
    while (feed.children.length > 5) {
      feed.removeChild(feed.firstChild);
    }
  }

  // WebSocket Connection
  function setupWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
      console.log('Overlay WebSocket connected!');
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

  function handleWsMessage(msg) {
    const { type, data } = msg;

    switch (type) {
      case 'init_state':
        playlist = data.playlist || [];
        updateTopGiftersUI(data.topGiftersList);
        if (data.settings && data.settings.characterTheme) {
          currentTheme = data.settings.characterTheme;
        }
        if (data.dancers) {
          dancers = Object.values(data.dancers).map(d => new Dancer(d));
        }
        if (data.currentTrack) {
          playTrack(data.currentTrack);
        }
        if (data.settings && data.settings.audioMode) {
          currentAudioMode = data.settings.audioMode;
          if (window.BarAudioEffects) {
            window.BarAudioEffects.setMode(currentAudioMode, 0.05);
          }
          updateAudioModeUI(currentAudioMode);
        }
        if (data.settings && data.settings.transparentBg) {
          document.body.classList.add('transparent-mode');
        }
        if (data.autoSimulator) {
          updateAutoSimOverlayUI(data.autoSimulator.status);
        }
        break;

      case 'playlist_updated':
        playlist = data || [];
        break;

      case 'track_change':
        playTrack(data.track);
        break;

      case 'track_state':
        if (data.isPlaying) {
          audioElement.play().catch(() => {});
          isPlaying = true;
        } else {
          audioElement.pause();
          isPlaying = false;
        }
        break;

      case 'volume_change':
        audioElement.volume = data.volume;
        break;

      case 'gift':
        triggerDJScreenGift(data);
        sfx.playGiftChime();
        // Trigger stage FX depending on gift level
        if (data.fxType === 'mega_rave') triggerRave();
        else if (data.fxType === 'fireworks') triggerFireworks();
        else if (data.fxType === 'flame') triggerFlame();
        else if (data.fxType === 'smoke') triggerSmoke();
        else if (data.fxType === 'confetti') triggerConfetti();
        else triggerFireworks();

        // Target dancer celebration jump
        const gifterDancer = dancers.find(d => d.username === data.username || d.nickname === data.nickname);
        if (gifterDancer) {
          gifterDancer.isJumping = true;
          setTimeout(() => { if (gifterDancer) gifterDancer.isJumping = false; }, 3000);
        }
        break;

            case 'top_gifters':
        updateTopGiftersUI(data);
        if (window.ClubTTSMC) {
          window.ClubTTSMC.onTopGiftersUpdate(data);
        }
        break;

      case 'live_session_reset':
      case 'reset_top_gifters':
        topGifters = [];
        try {
          localStorage.removeItem('sanoo_club_top_gifters');
        } catch (e) {}
        updateTopGiftersUI([]);
        giftQueue = [];
        isProcessingGift = false;
        currentGiftAnnouncement = null;
        currentGiftFx = null;
        if (dancers && dancers.length > 0) {
          dancers.forEach(d => {
            d.vipRank = 0;
            d.isVip = false;
          });
          syncVIPRanksAndPodiums();
        }
        if (window.ClubTTSMC) {
          window.ClubTTSMC.onTopGiftersUpdate([]);
        }
        console.log('[Overlay] Live session & Leaderboard reset.');
        break;

      case 'chat':
        addSpeechBubble(data.username, data.nickname, data.comment);
        break;

      case 'dancer_update':
        const existing = dancers.find(d => d.id === data.id || d.username === data.username);
        if (!existing) {
          dancers.push(new Dancer(data));
        } else {
          existing.nickname = data.nickname || existing.nickname;
          if (data.charCategory) existing.charCategory = data.charCategory;
          if (data.gender) existing.gender = data.gender;
          if (data.charType) existing.charType = data.charType;
          if (data.danceStyle) existing.danceStyle = data.danceStyle;
          existing.isJumping = true;
          setTimeout(() => { if (existing) existing.isJumping = false; }, 1500);
        }
        const crowdCountEl = document.getElementById('crowd-count');
        if (crowdCountEl) crowdCountEl.textContent = dancers.length;
        break;

      case 'dancers_sync':
        if (data) {
          Object.values(data).forEach(dData => {
            const match = dancers.find(d => d.id === dData.id || d.username === dData.username);
            if (match) {
              if (dData.charCategory) match.charCategory = dData.charCategory;
              if (dData.gender) match.gender = dData.gender;
              if (dData.charType) match.charType = dData.charType;
              if (dData.danceStyle) match.danceStyle = dData.danceStyle;
            } else {
              dancers.push(new Dancer(dData));
            }
          });
          const ccSync = document.getElementById('crowd-count');
          if (ccSync) ccSync.textContent = dancers.length;
        }
        break;

      case 'remove_dancer':
        dancers = dancers.filter(d => d.id !== data.id && d.username !== data.username);
        const ccRem = document.getElementById('crowd-count');
        if (ccRem) ccRem.textContent = dancers.length;
        break;

      case 'crowd_count':
        const ccCount = document.getElementById('crowd-count');
        if (ccCount) ccCount.textContent = data.count !== undefined ? data.count : dancers.length;
        break;

      case 'dancers_cleared':
        dancers = [];
        const cc = document.getElementById('crowd-count');
        if (cc) cc.textContent = 0;
        break;

      case 'tts_speak':
        if (window.TTSMCManager) TTSMCManager.speak(data.text, data.priority);
        break;

      case 'tts_hype':
        if (window.TTSMCManager) TTSMCManager.triggerRandomHype();
        break;

      case 'tts_config':
        if (window.TTSMCManager) {
          if (data.enabled !== undefined) TTSMCManager.setEnabled(data.enabled);
          if (data.style) TTSMCManager.setStyle(data.style);
          if (data.speed !== undefined) TTSMCManager.setSpeed(data.speed);
          if (data.voiceAccent) TTSMCManager.setStyle(data.voiceAccent === 'south' ? 'female_hype' : 'male_deep');
          if (data.volume !== undefined) {
            TTSMCManager.volume = data.volume;
            if (TTSMCManager.masterVocalGain) {
              TTSMCManager.masterVocalGain.gain.value = data.volume;
            }
          }
        }
        break;

      case 'trigger_effect':
        if (data.effect === 'flame') triggerFlame();
        else if (data.effect === 'smoke') triggerSmoke();
        else if (data.effect === 'fireworks') triggerFireworks();
        else if (data.effect === 'rave') triggerRave();
        else if (data.effect === 'confetti') triggerConfetti();
        else if (data.effect === 'airhorn') sfx.playAirhorn();
        else if (data.effect === 'scratch') sfx.playScratch();
        else if (data.effect === 'siren') sfx.playSiren();
        break;

      case 'like':
        addFloatingHeart();
        const likesCountEl = document.getElementById('likes-count');
        if (likesCountEl) likesCountEl.textContent = data.totalLikes || (parseInt(likesCountEl.textContent) + 1);
        break;

      case 'auto_sim_update':
        if (data && data.status) {
          updateAutoSimOverlayUI(data.status);
        }
        break;

      case 'audio_mode_changed':
        if (data && data.mode) {
          currentAudioMode = data.mode;
          if (window.BarAudioEffects) {
            window.BarAudioEffects.setMode(currentAudioMode);
          }
          updateAudioModeUI(currentAudioMode);
        }
        break;

      case 'settings_updated':
        if (data.characterTheme) {
          currentTheme = data.characterTheme;
        }
        if (data.transparentBg !== undefined) {
          if (data.transparentBg) {
            document.body.classList.add('transparent-mode');
          } else {
            document.body.classList.remove('transparent-mode');
          }
        }
        break;
    }
  }

  // Audio track ended -> auto play next
  audioElement.addEventListener('ended', () => {
    if (playlist.length > 0) {
      const curIdx = playlist.findIndex(t => t.id === (currentTrack && currentTrack.id));
      const nextIdx = curIdx !== -1 ? (curIdx + 1) % playlist.length : 0;
      playTrack(playlist[nextIdx]);
    }
  });

  // Immediate REST fallback for instant music start
  fetch('/api/status')
    .then(r => r.json())
    .then(data => {
      if (data.currentTrack && !currentTrack) {
        playlist = data.playlist || [];
        updateTrackUI(data.currentTrack);
        playTrack(data.currentTrack);
      }
    })
    .catch(e => console.warn('REST status fallback:', e));

  // Auto Simulator Button & Sync for Overlay
  let currentAutoSimSpeed = 'off';

  function updateAutoSimOverlayUI(speed) {
    currentAutoSimSpeed = speed || 'off';
    const btn = document.getElementById('btn-auto-sim');
    const txt = document.getElementById('auto-sim-text');
    if (!btn || !txt) return;

    btn.className = 'auto-sim-pill mode-' + currentAutoSimSpeed;
    const labels = {
      off: 'BOT: TẮT',
      slow: '🐢 BOT: CHẬM',
      medium: '⚡ BOT: VỪA',
      fast: '🔥 BOT: NHANH'
    };
    txt.textContent = labels[currentAutoSimSpeed] || 'BOT: TẮT';
    btn.title = `Giả lập tự động tương tác: ${labels[currentAutoSimSpeed]} (Bấm để đổi: Tắt / Chậm / Vừa / Nhanh)`;
  }

  const btnAutoSim = document.getElementById('btn-auto-sim');
  if (btnAutoSim) {
    btnAutoSim.addEventListener('click', () => {
      const cycle = {
        off: 'slow',
        slow: 'medium',
        medium: 'fast',
        fast: 'off'
      };
      const nextSpeed = cycle[currentAutoSimSpeed] || 'off';
      updateAutoSimOverlayUI(nextSpeed);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'set_auto_sim', data: { speed: nextSpeed } }));
      }
    });
  }

  // Initialization: Start graphics & network immediately without blocking
  // Restore Top Gifters from localStorage immediately to avoid UI flash
  try {
    const savedTop = localStorage.getItem('sanoo_club_top_gifters');
    if (savedTop) {
      const parsed = JSON.parse(savedTop);
      if (Array.isArray(parsed) && parsed.length > 0) {
        updateTopGiftersUI(parsed);
      }
    }
  } catch (err) {
    console.warn('[Storage] Could not restore top gifters:', err);
  }

  initLasers();
  setupWebSocket();
  requestAnimationFrame(renderLoop);

  preloadAssets(() => {
    console.log('All character sprites and stage assets loaded!');
  });

  // Automated Test Drop Support (for testing or direct query)
  if (window.location.search.includes('testDrop')) {
    beatEngine.forceHypeDrop(60);
  }

})();
