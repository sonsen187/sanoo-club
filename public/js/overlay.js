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
    human_female: [],
    speaker: null,
    discoLight: null
  };

  let assetsLoaded = false;

  // Preload character frame sequences
  function preloadAssets(callback) {
    let toLoad = 14 + 13 + 14 + 14 + 14 + 1; // 70 assets total
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

    // Safety timeout: if any asset stalls or takes > 2.5s, continue anyway!
    setTimeout(() => {
      if (!finished) {
        finished = true;
        assetsLoaded = true;
        console.log(`Asset preloading reached fallback timeout (${loaded}/${toLoad} loaded)`);
        if (callback) callback();
      }
    }, 2500);

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

    // Human Male Chibi: 14 frames PNG
    for (let i = 1; i <= 14; i++) {
      const img = new Image();
      img.src = `/assets/characters/human_male/${i}.png?v=chibi1`;
      img.onload = checkDone;
      img.onerror = checkDone;
      spriteCache.human_male.push(img);
    }

    // Human Female Chibi: 14 frames PNG
    for (let i = 1; i <= 14; i++) {
      const img = new Image();
      img.src = `/assets/characters/human_female/${i}.png?v=chibi1`;
      img.onload = checkDone;
      img.onerror = checkDone;
      spriteCache.human_female.push(img);
    }
    // Populate aliases so any legacy or tier lookup maps to chibi PNGs
    ['regular', 'top1', 'top2', 'top3'].forEach(tier => {
      ['style1', 'style2', 'style3'].forEach(style => {
        spriteCache[`human_male_${tier}_${style}`] = spriteCache.human_male;
        spriteCache[`human_female_${tier}_${style}`] = spriteCache.human_female;
      });
      spriteCache[`human_male_${tier}`] = spriteCache.human_male;
      spriteCache[`human_female_${tier}`] = spriteCache.human_female;
    });

    // Generate dynamic 3-style high-definition Cool DJ Sprite Cache if engine is loaded
    if (typeof HumanSpriteSystem !== 'undefined' && HumanSpriteSystem.generateSpriteCache) {
      try {
        HumanSpriteSystem.generateSpriteCache(spriteCache);
      } catch (err) {
        console.warn('Error generating dynamic human sprite cache:', err);
      }
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
      labelEl.textContent = `DJ VŨ TRƯỜNG • BÀI #${track.id}`;
    }
  }

  // Dynamic Stage Lighting Engine (Curated Club Palettes, Strobe Flash & Volumetric Colors)
  const stageLighting = {
    colorIndex: 0,
    flashIntensity: 0,
    // Modern High-End Club Palettes (Curated pairs and cohesive tonal transitions)
    chillPalette: [
      { hex: '#00f5d4', r: 0,   g: 245, b: 212 }, // Laser Cyan
      { hex: '#4361ee', r: 67,  g: 97,  b: 238 }, // Electric Indigo
      { hex: '#7209b7', r: 114, g: 9,   b: 183 }, // Ultra Violet
      { hex: '#f72585', r: 247, g: 37,  b: 133 }, // Hot Magenta
      { hex: '#00b4d8', r: 0,   g: 180, b: 216 }, // Deep Ocean
      { hex: '#fee440', r: 254, g: 228, b: 64 }   // Champagne
    ],
    dropPalette: [
      { hex: '#ff007f', r: 255, g: 0,   b: 127 }, // Neon Pink
      { hex: '#00f0ff', r: 0,   g: 240, b: 255 }, // Laser Cyan
      { hex: '#39ff14', r: 57,  g: 255, b: 20 },  // Acid Green
      { hex: '#ffe600', r: 255, g: 230, b: 0 },   // Strobe Gold
      { hex: '#b5179e', r: 181, g: 23,  b: 158 }, // Deep Violet
      { hex: '#ffffff', r: 255, g: 255, b: 255 }  // Pure White Flash
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

    getRgba(alpha = 1, offset = 0) {
      const rgb = this.getRgb(offset);
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    },

    update(dt) {
      const cycleSpeed = beatEngine.isBassActive
        ? (beatEngine.bpm / 120) * (0.8 + beatEngine.bassLevel * 1.5)
        : (beatEngine.bpm / 120) * 0.25;

      this.colorIndex = (this.colorIndex + dt * cycleSpeed) % 60;
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 3.8);
    },

    onBeatHit(bpm, bassLevel) {
      this.colorIndex = (this.colorIndex + 1) % 60;
      this.flashIntensity = Math.min(1.0, 0.40 + bassLevel * 0.60);
    }
  };

  // 6 Pro Volumetric Moving Heads Suspended on Ceiling Truss Rigging (y=125)
  let movingHeads = [];
  function initMovingHeads() {
    movingHeads = [
      { x: 160, y: 125, baseAngle: 0.32, sweepRange: 0.36, speed: 0.90, colorOffset: 0 },
      { x: 310, y: 125, baseAngle: 0.20, sweepRange: 0.32, speed: -1.05, colorOffset: 2 },
      { x: 460, y: 125, baseAngle: 0.08, sweepRange: 0.28, speed: 1.20, colorOffset: 4 },
      { x: 620, y: 125, baseAngle: 0.08, sweepRange: 0.28, speed: -1.20, colorOffset: 5 },
      { x: 770, y: 125, baseAngle: 0.20, sweepRange: 0.32, speed: 1.05, colorOffset: 1 },
      { x: 920, y: 125, baseAngle: 0.32, sweepRange: 0.36, speed: -0.90, colorOffset: 3 }
    ];
  }

  // Disco Mirror Ball Sparkles
  let discoSparkles = [];
  function initDiscoSparkles() {
    discoSparkles = [];
    for (let i = 0; i < 45; i++) {
      discoSparkles.push({
        angle: Math.random() * Math.PI * 2,
        speed: (0.0008 + Math.random() * 0.0016) * (Math.random() < 0.5 ? 1 : -1),
        orbitRadius: 35 + Math.random() * 260,
        floorX: 0.08 + Math.random() * 0.84,
        floorY: 0.42 + Math.random() * 0.52,
        size: 3 + Math.random() * 5,
        colorOffset: Math.floor(Math.random() * 6)
      });
    }
  }

  // 2.5D Expanding Bass Ripple Shockwaves on the Dance Floor
  let bassRipples = [];

  function initLasers() {
    initMovingHeads();
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
        this.bassIntensity = 0;
        this.bassLevel = 0;
        this.danceEnergy = 0;
        this.isBassActive = false;
        this.isBeatHit = false;
        this.beatProgress += dt / this.beatDuration;
        this.beatPhase = ((this.beatProgress % 1.0) + 1.0) % 1.0;
        this.danceCycle = ((this.beatProgress / 2) % 1.0 + 1.0) % 1.0;
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
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = radius * 1.6;
    }
    ctx.fillStyle = fillColor || '#ffffff';
    ctx.fill();
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
      this.scale = 0.62 + (this.y - 0.62) * 0.32; // Perspective scaling for crowd (smaller, cute chibi)
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
      if (this.charCategory === 'human') {
        const gender = this.gender === 'female' ? 'female' : 'male';
        const tier = this.getUniformTier();
        const styleKey = 'style' + (this.danceStyle || 1);

        // 1. Exact tier + dance style match (Dynamic high-def cache)
        if (spriteCache[`human_${gender}_${tier}_${styleKey}`] && spriteCache[`human_${gender}_${tier}_${styleKey}`].length > 0) {
          return spriteCache[`human_${gender}_${tier}_${styleKey}`];
        }
        // 2. Tier fallback
        if (spriteCache[`human_${gender}_${tier}`] && spriteCache[`human_${gender}_${tier}`].length > 0) {
          return spriteCache[`human_${gender}_${tier}`];
        }
        // 3. Static PNG array fallback
        const list = (gender === 'female' ? spriteCache.human_female : spriteCache.human_male);
        if (list && list.length > 0) return list;
      }
      const catList = spriteCache[`char${this.charType}`] || spriteCache.char1;
      if (catList && catList.length > 0) return catList;
      return (spriteCache.human_male && spriteCache.human_male.length > 0) ? spriteCache.human_male : (spriteCache.char1 || []);
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

      // Scale prestige based on VIP Rank vs floor perspective
      if (this.vipRank === 1) {
        this.scale = 1.48; // Top 1 is undeniably the biggest! (Champion VIP)
      } else if (this.vipRank === 2) {
        this.scale = 1.15; // Top 2 Silver
      } else if (this.vipRank === 3) {
        this.scale = 1.08; // Top 3 Bronze
      } else {
        this.scale = 0.62 + (this.y - 0.62) * 0.32; // Regular crowd is smaller (~0.65 - 0.73)
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
        this.bounceY = -dip * 24; // Nhún người hạ thấp xuống 24px trên mỗi nhịp beat!
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
      const isHuman = (this.charCategory === 'human');
      const frames = this.getFrames();
      if (!frames || frames.length === 0) return;

      const curNow = now || performance.now();
      const fIdx = this.frameIndex % frames.length;
      const img = frames[fIdx];
      if (!img) return;
      if (img.complete !== undefined && (!img.complete || img.naturalWidth === 0)) return;

      const screenX = this.x * W;
      const totalYOffset = this.jumpOffset + this.bounceY;
      const screenY = this.y * H - totalYOffset;
      const baseWidth = img.naturalWidth || img.width || (isHuman ? 320 : 300);
      const baseHeight = img.naturalHeight || img.height || (isHuman ? 240 : 200);
      const scaleMultiplier = isHuman ? 1.05 : 1.1;
      const drawWidth = baseWidth * this.scale * scaleMultiplier;
      const drawHeight = baseHeight * this.scale * scaleMultiplier;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.swayAngle);
      ctx.scale(1 / this.squash, this.squash);

      // Floor Shadow
      ctx.save();
      ctx.scale(this.squash, 1 / this.squash);
      ctx.rotate(-this.swayAngle);
      ctx.beginPath();
      const shadowScale = Math.max(0.45, 1 - (totalYOffset / 110));
      ctx.ellipse(0, drawHeight * 0.42 + totalYOffset, drawWidth * 0.35 * shadowScale, drawWidth * 0.12 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowScale})`;
      ctx.fill();
      ctx.restore();

      // ========================================================
      // 1. VIP AURAS (Drawn behind character sprite)
      // ========================================================
      if (this.vipRank === 1) {
        // TOP 1: Super Saiyan Imperial Golden Aura + Orbiting 4-Point Stars
        ctx.save();
        const auraR = drawWidth * 0.62 * (1.0 + beatEngine.bassLevel * 0.18);
        const auraGrad = ctx.createRadialGradient(0, 0, drawWidth * 0.2, 0, 0, auraR);
        auraGrad.addColorStop(0, 'rgba(255, 240, 100, 0.45)');
        auraGrad.addColorStop(0.5, 'rgba(255, 193, 7, 0.3)');
        auraGrad.addColorStop(1, 'rgba(255, 111, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, 0, auraR, 0, Math.PI * 2);
        ctx.fill();

        // 4 Golden Orbiting Sparkle Stars
        for (let s = 0; s < 4; s++) {
          const starAngle = curNow * 0.0025 + s * (Math.PI / 2);
          const starDist = drawWidth * 0.54;
          const sx = Math.cos(starAngle) * starDist;
          const sy = Math.sin(starAngle) * (starDist * 0.55);
          drawSparkleStar(ctx, sx, sy, 13 + Math.sin(curNow * 0.008 + s) * 4, '#ffffff', '#ffe600');
        }
        ctx.restore();

      } else if (this.vipRank === 2) {
        // TOP 2: Electric Cyan / Silver Overlord Aura + Orbiting Cyan Stars
        ctx.save();
        const auraR = drawWidth * 0.54 * (1.0 + beatEngine.bassLevel * 0.14);
        const auraGrad = ctx.createRadialGradient(0, 0, drawWidth * 0.15, 0, 0, auraR);
        auraGrad.addColorStop(0, 'rgba(0, 240, 255, 0.42)');
        auraGrad.addColorStop(0.6, 'rgba(0, 140, 255, 0.22)');
        auraGrad.addColorStop(1, 'rgba(0, 60, 180, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, 0, auraR, 0, Math.PI * 2);
        ctx.fill();

        // 3 Cyan Orbiting Stars
        for (let s = 0; s < 3; s++) {
          const starAngle = -curNow * 0.0022 + s * (Math.PI * 2 / 3);
          const starDist = drawWidth * 0.48;
          const sx = Math.cos(starAngle) * starDist;
          const sy = Math.sin(starAngle) * (starDist * 0.52);
          drawSparkleStar(ctx, sx, sy, 10, '#ffffff', '#00f0ff');
        }
        ctx.restore();

      } else if (this.vipRank === 3) {
        // TOP 3: Warm Amber Bronze Warrior Aura
        ctx.save();
        const auraR = drawWidth * 0.48 * (1.0 + beatEngine.bassLevel * 0.12);
        const auraGrad = ctx.createRadialGradient(0, 0, drawWidth * 0.12, 0, 0, auraR);
        auraGrad.addColorStop(0, 'rgba(255, 140, 0, 0.4)');
        auraGrad.addColorStop(0.6, 'rgba(217, 119, 6, 0.2)');
        auraGrad.addColorStop(1, 'rgba(120, 53, 15, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, 0, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (this.isVip) {
        // Fallback VIP Golden Glow
        ctx.beginPath();
        ctx.arc(0, 0, drawWidth * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 230, 0, 0.22)';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 25;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 2. Draw character sprite (centered at origin)
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

      // Glowstick rave trail / pulse on beat impact for char 2!
      if (this.charType === 2 && this.kickImpulse > 0.15) {
        ctx.save();
        ctx.globalAlpha = this.kickImpulse * 0.7;
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(-drawWidth * 0.28, -drawHeight * 0.12, 16 * this.kickImpulse, 0, Math.PI * 2);
        ctx.arc(drawWidth * 0.28, -drawHeight * 0.12, 16 * this.kickImpulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ========================================================
      // 3. FLOATING NAME TAG (Hierarchical VIP Badges)
      // ========================================================
      ctx.save();
      ctx.rotate(-this.swayAngle); // Keep text level
      ctx.font = 'bold 22px "Rajdhani", sans-serif';
      let nameText = this.nickname;
      let badgePrefix = '';
      if (this.vipRank === 1) badgePrefix = '👑 TOP 1 • ';
      else if (this.vipRank === 2) badgePrefix = '🥈 TOP 2 • ';
      else if (this.vipRank === 3) badgePrefix = '🥉 TOP 3 • ';

      const fullText = badgePrefix + nameText;
      const textWidth = ctx.measureText(fullText).width;
      const tagWidth = Math.max(textWidth + 30, 110);
      const tagHeight = 36;
      const tagY = isHuman ? (-drawHeight * 0.40 - 20) : (-drawHeight * 0.42 - 16);

      // Tag Background
      let tagBg, tagBorder, tagTextCol, tagGlow;
      if (this.vipRank === 1) {
        tagBg = ctx.createLinearGradient(-tagWidth / 2, tagY, tagWidth / 2, tagY + tagHeight);
        tagBg.addColorStop(0, '#ffe600');
        tagBg.addColorStop(1, '#ff9900');
        tagBorder = '#ffffff';
        tagTextCol = '#000000';
        tagGlow = '#ffe600';
      } else if (this.vipRank === 2) {
        tagBg = ctx.createLinearGradient(-tagWidth / 2, tagY, tagWidth / 2, tagY + tagHeight);
        tagBg.addColorStop(0, '#e0f7fa');
        tagBg.addColorStop(1, '#00b4d8');
        tagBorder = '#ffffff';
        tagTextCol = '#000000';
        tagGlow = '#00f0ff';
      } else if (this.vipRank === 3) {
        tagBg = ctx.createLinearGradient(-tagWidth / 2, tagY, tagWidth / 2, tagY + tagHeight);
        tagBg.addColorStop(0, '#ffedd5');
        tagBg.addColorStop(1, '#d97706');
        tagBorder = '#ffffff';
        tagTextCol = '#000000';
        tagGlow = '#ff8c00';
      } else {
        tagBg = this.isVip ? 'rgba(255, 215, 0, 0.9)' : 'rgba(15, 20, 40, 0.85)';
        tagBorder = this.isVip ? '#ffffff' : 'rgba(0, 240, 255, 0.8)';
        tagTextCol = this.isVip ? '#000000' : '#ffffff';
        tagGlow = this.isVip ? '#ffe600' : null;
      }

      ctx.fillStyle = tagBg;
      ctx.strokeStyle = tagBorder;
      ctx.lineWidth = (this.vipRank > 0) ? 2.5 : 2;
      if (tagGlow) {
        ctx.shadowColor = tagGlow;
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      ctx.roundRect(-tagWidth / 2, tagY, tagWidth, tagHeight, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Name Text
      ctx.fillStyle = tagTextCol;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold 20px "Rajdhani", sans-serif';
      ctx.fillText(fullText, 0, tagY + 25);
      ctx.restore();

      ctx.restore();
    }
  }

  // Particle Generators
  function triggerFlame() {
    sfx.playBassDrop();
    for (let k = 0; k < 2; k++) {
      const originX = k === 0 ? 240 : 840;
      const originY = 820;
      for (let i = 0; i < 40; i++) {
        flames.push({
          x: originX + (Math.random() - 0.5) * 50,
          y: originY,
          vx: (Math.random() - 0.5) * 6,
          vy: -15 - Math.random() * 25,
          size: 35 + Math.random() * 45,
          color: Math.random() > 0.3 ? '#ff3b00' : '#ffd000',
          alpha: 1,
          decay: 0.02 + Math.random() * 0.02
        });
      }
    }
  }

  function triggerSmoke() {
    for (let k = 0; k < 2; k++) {
      const originX = k === 0 ? 180 : 900;
      const originY = 750;
      for (let i = 0; i < 35; i++) {
        fogs.push({
          x: originX + (Math.random() - 0.5) * 60,
          y: originY,
          vx: (k === 0 ? 1 : -1) * (4 + Math.random() * 8),
          vy: 6 + Math.random() * 12,
          radius: 40 + Math.random() * 50,
          growth: 1.5,
          alpha: 0.75,
          decay: 0.008 + Math.random() * 0.006,
          color: Math.random() > 0.5 ? 'rgba(0, 240, 255, ' : 'rgba(255, 0, 128, '
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

  // Active Speech Bubble
  function addSpeechBubble(username, nickname, text) {
    const targetDancer = dancers.find(d => d.username === username || d.nickname === nickname);
    speechBubbles.push({
      username,
      nickname,
      text,
      x: targetDancer ? targetDancer.x : 0.5,
      y: targetDancer ? targetDancer.y : 0.7,
      targetDancer,
      createdAt: performance.now(),
      duration: 4000
    });
  }

  // Show Gift Notification Banner
  function showGiftBanner(gift) {
    const bannerContainer = document.getElementById('gift-alert-slot');
    if (!bannerContainer) return;

    bannerContainer.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'gift-alert-card';

    const avatarHtml = gift.avatar
      ? `<div class="gift-avatar" style="background-image: url('${gift.avatar}')"></div>`
      : `<div class="gift-avatar" style="background: #ff007f; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:24px;">🎁</div>`;

    card.innerHTML = `
      ${avatarHtml}
      <div class="gift-details">
        <div class="gift-sender">${gift.nickname || gift.username}</div>
        <div class="gift-action">Tặng ${gift.giftName} x${gift.repeatCount} (${gift.diamondCount} 💎)</div>
      </div>
    `;

    bannerContainer.appendChild(card);
    setTimeout(() => {
      if (card.parentNode === bannerContainer) {
        bannerContainer.removeChild(card);
      }
    }, 4200);
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

  // Draw Stage Backdrop & Industrial Truss & Kaleidoscope Screen (Elevated)
  function drawStageBackdrop(now) {
    const sx = W * 0.15;
    const sy = 160;
    const sw = W * 0.7;
    const sh = 230;

    ctx.save();

    // Ceiling & Stage Truss Framework (Industrial Aluminum Truss)
    ctx.strokeStyle = 'rgba(120, 140, 180, 0.45)';
    ctx.lineWidth = 3;
    // Top Horizontal Truss Beam
    ctx.strokeRect(W * 0.05, 120, W * 0.9, 26);
    // Cross-bracing in truss
    for (let x = W * 0.05; x < W * 0.95; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 120);
      ctx.lineTo(x + 40, 146);
      ctx.stroke();
    }
    // Vertical Support Columns (Left & Right)
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
      if (isChaserActive) {
        ctx.shadowColor = parColor;
        ctx.shadowBlur = 15;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // LED Screen boundaries (Center Upper Stage)
    ctx.fillStyle = '#050714';
    ctx.fillRect(sx, sy, sw, sh);
    const borderColor = stageLighting.getCurrentColor();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 12 + beatEngine.bassLevel * 15;
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.shadowBlur = 0;

    // Kaleidoscope effect inside screen
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx + 4, sy + 4, sw - 8, sh - 8);
    ctx.clip();

    const cx = sx + sw / 2;
    const cy = sy + sh / 2;
    const petals = 8;
    const baseRadius = 40 + midIntensity * 75;
    const rotSpeed = now * 0.0015 * (beatEngine.bpm / 120);

    for (let i = 0; i < petals; i++) {
      const angle = rotSpeed + (i * (Math.PI * 2 / petals));
      const px = cx + Math.cos(angle) * (baseRadius * 0.6);
      const py = cy + Math.sin(angle) * (baseRadius * 0.6);

      ctx.beginPath();
      ctx.arc(px, py, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 === 0 ? stageLighting.getCurrentColor(i) : stageLighting.getCurrentColor(i + 3);
      ctx.lineWidth = 2 + beatEngine.bassLevel * 3;
      ctx.stroke();
    }

    // Audio Equalizer Spectrum Bars at bottom of screen
    if (freqData) {
      const barCount = 36;
      const barWidth = (sw - 16) / barCount;
      for (let i = 0; i < barCount; i++) {
        const val = freqData[i * 2] / 255;
        const barHeight = val * (sh * 0.78);
        const bx = sx + 8 + i * barWidth;
        const by = sy + sh - 8 - barHeight;

        const grad = ctx.createLinearGradient(0, by, 0, by + barHeight);
        grad.addColorStop(0, stageLighting.getCurrentColor(0));
        grad.addColorStop(0.5, stageLighting.getCurrentColor(2));
        grad.addColorStop(1, stageLighting.getCurrentColor(4));

        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, barWidth - 3, barHeight);
      }
    }

    ctx.restore();
    ctx.restore();
  }

  // Draw DJ Booth Platform, Disco Mirror Ball, Superstar Resident DJ, Pioneer Mixer & Vibrating Speakers (Elevated)
  function drawDJStage(now) {
    const stageY = 360;

    ctx.save();

    // ========================================================
    // 1. SOFT THEATRICAL KEY-LIGHT WASH ON DJ (Smooth Volumetric Bloom)
    // ========================================================
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const djWashAlpha = 0.16 + beatEngine.bassLevel * 0.20;
    const djGlow = ctx.createRadialGradient(W / 2, stageY + 45, 15, W / 2, stageY + 45, 220);
    djGlow.addColorStop(0, `rgba(255, 245, 190, ${djWashAlpha})`);
    djGlow.addColorStop(0.5, `rgba(255, 200, 50, ${djWashAlpha * 0.45})`);
    djGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = djGlow;
    ctx.beginPath();
    ctx.ellipse(W / 2, stageY + 45, 240, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ========================================================
    // 2. QUẢ CẦU GƯƠNG DISCO MIRROR BALL
    // ========================================================
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

    // Metallic spherical gradient
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

    // Disco Ball Sparkles (Starfield orbiting around ball)
    discoSparkles.forEach(s => {
      s.angle += s.speed * (beatEngine.bpm / 120);
      const sx = ballX + Math.cos(s.angle) * s.orbitRadius;
      const sy = ballY + Math.sin(s.angle) * (s.orbitRadius * 0.4);

      ctx.beginPath();
      ctx.arc(sx, sy, s.size * (0.8 + beatEngine.bassLevel * 0.5), 0, Math.PI * 2);
      const sparkleColor = stageLighting.getCurrentColor(s.colorOffset);
      ctx.fillStyle = sparkleColor;
      ctx.shadowColor = sparkleColor;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // ========================================================
    // 3. BỤC NỀN SÂN KHẤU (Stage Platform Base)
    // ========================================================
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
    const tableW = 360;
    const tableH = 105;
    const tableX = (W - tableW) / 2;
    const tableY = stageY + 20;

    // ========================================================
    // 4. SUPERSTAR RESIDENT DJ CHARACTER (Centerpiece of the Stage!)
    // ========================================================
    const djHype = Math.max(0, Math.min(1.0, (beatEngine.bassLevel - 0.18) / 0.65));
    const djBob = djHype > 0.08
      ? Math.sin(beatEngine.beatPhase * Math.PI) * (8 + djHype * 28)
      : Math.sin(now * 0.003) * 4;
    const djSway = Math.sin(beatEngine.danceCycle * Math.PI * 2) * (3 + djHype * 12);
    const djHeadX = W / 2 + djSway;
    const djHeadY = tableY - 58 + djBob;

    // A. DJ Hoodie Body & Neon Seams
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

    // Chest Logo (Golden Lightning)
    ctx.font = '900 22px "Orbitron", sans-serif';
    ctx.fillStyle = '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 12;
    ctx.textAlign = 'center';
    ctx.fillText('⚡ DJ ⚡', djHeadX, djHeadY + 70);
    ctx.shadowBlur = 0;

    // Heavy Gold Cuban Bling Chain & Spinning Vinyl Medallion
    ctx.beginPath();
    ctx.ellipse(djHeadX, djHeadY + 46, 28, 12, 0, 0, Math.PI);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffd700';
    ctx.stroke();

    // Spinning Gold Vinyl Disc Medallion
    const medRot = now * 0.006;
    ctx.save();
    ctx.translate(djHeadX, djHeadY + 60);
    ctx.rotate(medRot);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#b48300';
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // B. Left Arm: Turntablist Scratching on Deck
    const scratchOffset = Math.sin(now * 0.015 * (beatEngine.bpm / 120)) * 14;
    const deckLeftX = W / 2 - 105;
    const deckLeftY = tableY + 22;

    ctx.save();
    ctx.strokeStyle = '#1e2238';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(djHeadX - 42, djHeadY + 36);
    ctx.quadraticCurveTo(djHeadX - 75, djHeadY + 75, deckLeftX + scratchOffset, deckLeftY - 5);
    ctx.stroke();

    // Cyber DJ Glove on turntable
    ctx.beginPath();
    ctx.arc(deckLeftX + scratchOffset, deckLeftY - 5, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // C. Right Arm: Crowd Hype Pumping High in the Air!
    const pumpOffset = Math.sin(beatEngine.beatPhase * Math.PI) * (14 + djHype * 22);
    const handX = djHeadX + 68 + Math.cos(now * 0.005) * 8;
    const handY = djHeadY - 45 - pumpOffset;

    ctx.save();
    ctx.strokeStyle = '#1e2238';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(djHeadX + 42, djHeadY + 36);
    ctx.quadraticCurveTo(djHeadX + 70, djHeadY - 5, handX, handY);
    ctx.stroke();

    // Glowing Neon Rave Wristband
    ctx.beginPath();
    ctx.arc(handX - 5, handY + 10, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Hand showing Peace Sign ✌ hyping the audience
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✌', handX, handY + 6);
    ctx.restore();

    // D. Head, Backward Snapback Cap & RGB Studio Headphones
    // Face
    ctx.beginPath();
    ctx.arc(djHeadX, djHeadY, 36, 0, Math.PI * 2);
    ctx.fillStyle = '#ffcc99';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Backward Snapback DJ Cap
    ctx.save();
    ctx.beginPath();
    ctx.arc(djHeadX, djHeadY - 8, 38, Math.PI * 0.85, Math.PI * 2.15);
    ctx.closePath();
    ctx.fillStyle = '#0f111e';
    ctx.fill();
    // Cap strap & gold plate
    ctx.beginPath();
    ctx.rect(djHeadX - 16, djHeadY - 44, 32, 10);
    ctx.fillStyle = '#ffe600';
    ctx.fill();
    ctx.font = 'bold 12px "Orbitron", sans-serif';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText('DJ', djHeadX, djHeadY - 36);
    ctx.restore();

    // RGB Studio Monitor Headphones
    ctx.save();
    // Headband
    ctx.beginPath();
    ctx.arc(djHeadX, djHeadY - 10, 44, Math.PI * 0.88, Math.PI * 2.12);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Rainbow RGB cycling halo rings on earcups
    const rgbHue = (now * 0.15) % 360;
    const rgbColor = `hsl(${rgbHue}, 100%, 55%)`;

    [-1, 1].forEach(side => {
      const ecupX = djHeadX + side * 44;
      const ecupY = djHeadY - 4;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ecupX - 8, ecupY - 18, 16, 36);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(ecupX - 8, ecupY - 18, 16, 36);

      ctx.beginPath();
      ctx.ellipse(ecupX, ecupY, 7, 16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgbColor;
      ctx.shadowColor = rgbColor;
      ctx.shadowBlur = 15;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Coiled headphone cable
    ctx.beginPath();
    ctx.moveTo(djHeadX - 44, djHeadY + 14);
    ctx.bezierCurveTo(djHeadX - 60, djHeadY + 50, djHeadX - 30, tableY + 10, djHeadX - 15, tableY + 25);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // DJ Smile
    ctx.beginPath();
    ctx.arc(djHeadX, djHeadY + 16, 12, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.stroke();

    // E. Superstar Resident DJ Dual-Lens Equalizer Sunglasses! (Không dùng thanh chữ nhật gạch ngang!)
    ctx.save();
    const visY = djHeadY - 4;
    const djLensW = 21;
    const djLensH = 17;
    const djLensSpacing = 7;
    const djLeftX = djHeadX - djLensSpacing - djLensW / 2;
    const djRightX = djHeadX + djLensSpacing + djLensW / 2;

    [djLeftX, djRightX].forEach((lx, idx) => {
      // Sleek Aviator Hex Lens Path
      ctx.beginPath();
      ctx.roundRect(lx - djLensW / 2, visY - djLensH / 2, djLensW, djLensH, 5);
      ctx.fillStyle = '#050711';
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 4 mini EQ bars inside each lens
      const numBars = 4;
      const bW = 3.2;
      const bGap = 1.4;
      const startX = lx - djLensW / 2 + 2.5;
      for (let b = 0; b < numBars; b++) {
        const bx = startX + b * (bW + bGap);
        const globalB = idx * 4 + b;
        const freqPhase = globalB * 0.9;
        const barHeightRatio = Math.min(1.0, Math.max(0.18,
          (beatEngine.bassLevel * (1.1 - (b % 4) * 0.12)) + Math.sin(now * 0.015 + freqPhase) * 0.25
        ));
        const bH = (djLensH - 5) * barHeightRatio;
        const by = visY + djLensH / 2 - 2 - bH;
        const barCol = bH > 9 ? '#ff007f' : (bH > 5 ? '#ffea00' : '#00ff66');
        ctx.fillStyle = barCol;
        ctx.fillRect(bx, by, bW, bH);
      }
    });

    // Metallic Arched Bridge between the two lenses
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(djLeftX + djLensW / 2, visY - 3);
    ctx.quadraticCurveTo(djHeadX, visY - 6, djRightX - djLensW / 2, visY - 3);
    ctx.stroke();
    ctx.restore();

    // ========================================================
    // 5. BÀN MIXER DJ CHUYÊN NGHIỆP & BẢNG ĐÈN LED (Pioneer DJ Console)
    // ========================================================
    // Table Base Front
    ctx.fillStyle = '#14172b';
    ctx.fillRect(tableX, tableY, tableW, tableH);
    ctx.strokeStyle = stageLighting.getCurrentColor(1);
    ctx.lineWidth = 3;
    ctx.strokeRect(tableX, tableY, tableW, tableH);

    // Neon DJ Club Sign on table front
    ctx.save();
    ctx.font = '900 24px "Orbitron", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = stageLighting.getCurrentColor(0);
    ctx.shadowBlur = 18 + beatEngine.bassLevel * 18;
    ctx.textAlign = 'center';
    ctx.fillText('⚡ RESIDENT SUPERSTAR DJ ⚡', W / 2, tableY + 68);
    ctx.shadowBlur = 0;

    // Bottom Soundwave line across table
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let wx = 0; wx < tableW - 40; wx += 8) {
      const wy = tableY + 100 + Math.sin(wx * 0.1 + now * 0.01) * (4 + beatEngine.bassLevel * 12);
      if (wx === 0) ctx.moveTo(tableX + 20 + wx, wy);
      else ctx.lineTo(tableX + 20 + wx, wy);
    }
    ctx.stroke();
    ctx.restore();

    // Pioneer DJM Center Mixer Console
    const mixerW = 100;
    const mixerH = 75;
    const mixerX = W / 2 - mixerW / 2;
    const mixerY = tableY + 5;

    ctx.fillStyle = '#181b30';
    ctx.fillRect(mixerX, mixerY, mixerW, mixerH);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(mixerX, mixerY, mixerW, mixerH);

    // Dual Vertical 8-Segment LED VU Meters
    [-1, 1].forEach(side => {
      const vuX = W / 2 + side * 14;
      const vuY = mixerY + 12;
      const numSegments = 8;
      const segH = 4;
      const segW = 6;
      const activeSegments = Math.round(beatEngine.bassLevel * numSegments);

      for (let s = 0; s < numSegments; s++) {
        const sy = vuY + (numSegments - 1 - s) * (segH + 2);
        const isActive = s < activeSegments;
        let segColor;
        if (s < 4) segColor = isActive ? '#00ff66' : '#003314'; // Green
        else if (s < 6) segColor = isActive ? '#ffee00' : '#333000'; // Yellow
        else segColor = isActive ? '#ff0055' : '#330011'; // Red Peak

        ctx.fillStyle = segColor;
        ctx.fillRect(vuX - segW / 2, sy, segW, segH);
      }
    });

    // Crossfader Slider
    const cfX = mixerX + 18;
    const cfY = mixerY + mixerH - 14;
    const cfW = mixerW - 36;
    ctx.fillStyle = '#0b0d17';
    ctx.fillRect(cfX, cfY, cfW, 4);
    const faderPos = (Math.sin(now * 0.003) * 0.4 + 0.5) * cfW;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cfX + faderPos - 3, cfY - 3, 6, 10);

    // Turntables on table (2 spinning discs)
    const discRadius = 32;
    for (let side = -1; side <= 1; side += 2) {
      const dx = W / 2 + side * 110;
      const dy = tableY + 25;

      ctx.beginPath();
      ctx.arc(dx, dy, discRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0f';
      ctx.fill();
      ctx.strokeStyle = stageLighting.getCurrentColor(side > 0 ? 2 : 4);
      ctx.lineWidth = 3;
      ctx.stroke();

      // Spinning indicator
      const spinAngle = (now * 0.005 * (beatEngine.bpm / 120)) * side;
      ctx.beginPath();
      ctx.arc(dx, dy, discRadius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe600';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx + Math.cos(spinAngle) * discRadius, dy + Math.sin(spinAngle) * discRadius);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // ========================================================
    // 6. CO2 CRYO JETS (Cold White-Cyan Gas on Bass Drops!)
    // ========================================================
    if (beatEngine.isBeatHit && beatEngine.bassLevel > 0.55) {
      [-1, 1].forEach(side => {
        const cannonX = W / 2 + side * (tableW / 2 + 15);
        const cannonY = tableY + 15;
        for (let p = 0; p < 4; p++) {
          fogs.push({
            x: cannonX + (Math.random() - 0.5) * 16,
            y: cannonY,
            vx: (Math.random() - 0.5) * 4 + side * 2,
            vy: -18 - Math.random() * 16,
            radius: 25 + Math.random() * 30,
            growth: 1.8,
            alpha: 0.85,
            decay: 0.025 + Math.random() * 0.015,
            color: 'rgba(210, 245, 255, '
          });
        }
      });
    }

    // ========================================================
    // 7. LOA SUBWOOFER KHỔNG LỒ RUNG CHUYỂN
    // ========================================================
    const speakerPunch = djHype > 0.05 ? (djHype * 0.28 + (beatEngine.isBeatHit ? 0.15 : 0)) : 0;
    const spkScale = 1.0 + speakerPunch;
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

  // 2.5D Perspective Dance Floor Grid with Floor Lights, Glossy Reflections & Bass Ripples
  function drawDanceFloor(now) {
    const horizonY = 560;
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

        const cellX1 = x1Start + span1 * u1;
        const cellX2 = x1Start + span1 * u2;
        const cellX3 = x2Start + span2 * u2;
        const cellX4 = x2Start + span2 * u1;

        ctx.beginPath();
        ctx.moveTo(cellX1, y1);
        ctx.lineTo(cellX2, y1);
        ctx.lineTo(cellX3, y2);
        ctx.lineTo(cellX4, y2);
        ctx.closePath();

        const isOdd = (r + c) % 2 === 0;
        const tileWave = Math.sin(now * 0.003 * (beatEngine.bpm / 120) + r * 0.6 + c * 0.5);

        // Glossy dark neon tiles
        if (isOdd) {
          ctx.fillStyle = `rgba(16, 12, 38, ${0.5 + tileWave * 0.25 * beatEngine.bassLevel})`;
        } else {
          ctx.fillStyle = `rgba(8, 20, 44, ${0.45 + (1 - tileWave) * 0.25 * beatEngine.bassLevel})`;
        }
        ctx.fill();

        // Neon border glow
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
    const dt = 0.016; // approximate delta for shockwave expansion
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
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = r.alpha * 0.9;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // ========================================================
  // BỤC VINH DANH TOP 1, TOP 2, TOP 3 VIP (Elevated 2.5D Multi-Tier Podiums)
  // ========================================================
  // Helper to draw a single 3D cylinder tier
  function drawCylinderTier(ctx, cx, cy, rx, ry, height, wallGrad, topGrad, rimColor, rimGlow) {
    // 1. Curved front cylinder wall
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + height, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fillStyle = wallGrad;
    ctx.fill();

    // Bottom rim line
    ctx.beginPath();
    ctx.ellipse(cx, cy + height, rx, ry, 0, 0, Math.PI);
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.restore();

    // 2. Top flat ellipse face
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = topGrad;
    ctx.fill();

    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 3;
    if (rimGlow > 0) {
      ctx.shadowColor = rimColor;
      ctx.shadowBlur = rimGlow;
    }
    ctx.stroke();
    ctx.restore();
  }

  // Helper to draw an entire multi-tier VIP podium
  function drawSinglePodium(ctx, cx, cy, tiers, colors, badgeText, rank, now) {
    ctx.save();

    // A. Soft Volumetric Highlight Glow on Podium (Additive Theatrical Key-Light)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spotAlpha = 0.14 + (rank === 1 ? 0.08 : 0) + beatEngine.bassLevel * 0.12;
    const podiumGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, tiers[0].rx * 1.5);
    podiumGlow.addColorStop(0, colors.spotLight.replace('ALPHA', spotAlpha.toFixed(2)));
    podiumGlow.addColorStop(0.55, colors.spotLight.replace('ALPHA', (spotAlpha * 0.35).toFixed(2)));
    podiumGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = podiumGlow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, tiers[0].rx * 1.5, tiers[0].ry * 2.0, 0, 0, Math.PI * 2);
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
      fGrad.addColorStop(0.65, colors.topRim);
      fGrad.addColorStop(1, colors.topEdge);

      const glow = (t === tiers.length - 1) ? (15 + beatEngine.bassLevel * 18) : 6;
      drawCylinderTier(ctx, cx, tierY, tier.rx, tier.ry, tier.height, wGrad, fGrad, colors.rimColor, glow);
    }

    // C. Top Platform Floor Effects: Bass-Pulsing Inner Concentric Ring
    const topTier = tiers[tiers.length - 1];
    const topPlatformY = cy + topTier.offsetY;
    const ringScale = 0.55 + Math.sin(beatEngine.beatPhase * Math.PI) * 0.08 * (1 + beatEngine.bassLevel);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, topPlatformY, topTier.rx * ringScale, topTier.ry * ringScale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = colors.rimColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = colors.rimColor;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center Hologram Badge
    ctx.font = rank === 1 ? '24px Arial' : '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const holoIcon = rank === 1 ? '👑' : (rank === 2 ? '🥈' : '🥉');
    ctx.fillText(holoIcon, cx, topPlatformY);
    ctx.restore();

    // D. Front Metallic Engraved Plaque on base wall
    const badgeW = rank === 1 ? 220 : 155;
    const badgeH = rank === 1 ? 30 : 28;
    const badgeY = cy + tiers[0].offsetY + tiers[0].height - (rank === 1 ? 20 : 18);

    ctx.save();
    const bGrad = ctx.createLinearGradient(cx - badgeW / 2, badgeY, cx + badgeW / 2, badgeY + badgeH);
    bGrad.addColorStop(0, colors.badgeBg0);
    bGrad.addColorStop(1, colors.badgeBg1);
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, badgeY, badgeW, badgeH, 6);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = colors.rimColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 15px "Rajdhani", "Orbitron", sans-serif';
    ctx.fillStyle = colors.badgeTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, cx, badgeY + badgeH / 2 + 1);
    ctx.restore();

    // E. Rising Sparkle Motes
    for (let s = 0; s < 3; s++) {
      const spkTime = now * 0.0018 + s * 2.1 + rank * 1.5;
      const spkProgress = (spkTime % 1.0);
      const spkX = cx + Math.sin(spkTime * 4) * (topTier.rx * 0.55);
      const spkY = topPlatformY - spkProgress * 65;
      const spkAlpha = Math.sin(spkProgress * Math.PI) * 0.85;

      ctx.save();
      ctx.globalAlpha = spkAlpha;
      drawSparkleStar(ctx, spkX, spkY, 5 + (1 - spkProgress) * 3, '#ffffff', colors.rimColor);
      ctx.restore();
    }

    ctx.restore();
  }

  // 3 VIP Podiums on Dance Floor (Top 1 Center Gold, Top 2 Left Silver, Top 3 Right Bronze)
  function drawVIPPodiums(now) {
    // 1. TOP 1 PODIUM (Center - Elevated 3-Tier Massive Gold Stage)
    const top1Cx = W * 0.50;
    const top1Cy = 850; // Shifted UP into upper-mid VIP focal zone
    const top1Tiers = [
      { offsetY: 48, height: 30, rx: 220, ry: 60 }, // Tier 0 (bottom base)
      { offsetY: 24, height: 26, rx: 190, ry: 52 }, // Tier 1 (mid)
      { offsetY: 0,  height: 24, rx: 160, ry: 44 }  // Tier 2 (top platform)
    ];
    const top1Colors = {
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
    };
    drawSinglePodium(ctx, top1Cx, top1Cy, top1Tiers, top1Colors, '👑 TOP 1 ĐẠI GIA', 1, now);

    // 2. TOP 2 PODIUM (Left - 2-Tier Silver / Electric Cyan Stage)
    const top2Cx = W * 0.24;
    const top2Cy = 940; // Shifted UP
    const top2Tiers = [
      { offsetY: 26, height: 24, rx: 135, ry: 38 }, // Tier 0 (bottom)
      { offsetY: 0,  height: 22, rx: 115, ry: 32 }  // Tier 1 (top platform)
    ];
    const top2Colors = {
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
    };
    drawSinglePodium(ctx, top2Cx, top2Cy, top2Tiers, top2Colors, '🥈 TOP 2 VIP', 2, now);

    // 3. TOP 3 PODIUM (Right - 2-Tier Bronze / Amber Stage)
    const top3Cx = W * 0.76;
    const top3Cy = 940; // Shifted UP
    const top3Tiers = [
      { offsetY: 26, height: 24, rx: 130, ry: 36 }, // Tier 0 (bottom)
      { offsetY: 0,  height: 22, rx: 110, ry: 30 }  // Tier 1 (top platform)
    ];
    const top3Colors = {
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
    };
    drawSinglePodium(ctx, top3Cx, top3Cy, top3Tiers, top3Colors, '🥉 TOP 3 VIP', 3, now);
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

    // 2. Ensure Top 1, 2, 3 podiums are always occupied by dancers!
    for (let rank = 1; rank <= 3; rank++) {
      const hasRank = dancers.some(d => d.vipRank === rank);
      if (!hasRank) {
        const available = dancers.filter(d => !assigned.has(d));
        if (available.length > 0) {
          available.sort((a, b) => (b.score || 0) - (a.score || 0));
          const chosen = available[0];
          chosen.vipRank = rank;
          chosen.isVip = true;
          assigned.add(chosen);
        }
      }
    }

    // 3. Anchor VIPs to elevated podium coordinates and keep regular crowd clear of podiums
    dancers.forEach(d => {
      if (d.vipRank === 1) {
        d.targetX = 0.50;
        d.targetY = 0.373; // Feet land precisely on Top 1 massive gold platform (cy = 850px)
        if (!d.vipPositioned) { d.x = d.targetX; d.y = d.targetY; d.vipPositioned = true; }
      } else if (d.vipRank === 2) {
        d.targetX = 0.24;
        d.targetY = 0.436; // Feet land on Top 2 platform (cy = 940px)
        if (!d.vipPositioned) { d.x = d.targetX; d.y = d.targetY; d.vipPositioned = true; }
      } else if (d.vipRank === 3) {
        d.targetX = 0.76;
        d.targetY = 0.436; // Feet land on Top 3 platform (cy = 940px)
        if (!d.vipPositioned) { d.x = d.targetX; d.y = d.targetY; d.vipPositioned = true; }
      } else {
        // Regular crowd: keep clear of elevated VIP podiums, dancing on floor (y >= 0.58)
        if (d.targetY < 0.58) {
          const charCode = (d.id || d.username || 'user').charCodeAt(0);
          d.targetY = 0.60 + (charCode % 15) * 0.024;
          if (!d.crowdPositioned) { d.y = d.targetY; d.crowdPositioned = true; }
        }
      }
    });
  }

  // ===========================================================================
  // PROFESSIONAL NIGHTCLUB LIGHTING RIG (Cinematic Volumetric Haze & Liquid Sky)
  // Replaces harsh polygons with true atmospheric feathered light shafts:
  //   1. 6 Pro Volumetric Moving Heads (Perpendicular cross-gradient soft haze)
  //   2. Overhead Liquid Sky Laser Sheet (Tomorrowland/Ultra Festival canopy)
  //   3. Optical Fixture Lens Flare Blooms
  //   4. Gaussian Floor Wash Pools (Perspective Radial Falloff)
  // ===========================================================================
  function drawLasers(now) {
    const sweepTime = now * 0.0012 * (beatEngine.bpm / 120);
    const horizonY = 560;

    ctx.save();
    // Use ADDITIVE BLENDING for all volumetric light beams:
    ctx.globalCompositeOperation = 'lighter';

    // -------------------------------------------------------------------------
    // 1. 6 VOLUMETRIC MOVING HEADS (Soft Perpendicular-Feathered Haze Shafts)
    // -------------------------------------------------------------------------
    movingHeads.forEach((head, idx) => {
      // Symmetrical sweep choreography: left side mirrors right side
      const isLeft = idx < 3;
      const pairIdx = isLeft ? idx : (5 - idx);
      const wavePhase = sweepTime * head.speed + pairIdx * 0.50;
      const sweepAngle = (isLeft ? -1 : 1) * (head.baseAngle + Math.sin(wavePhase) * head.sweepRange);

      const colorRgb = stageLighting.getRgb(head.colorOffset);
      const beamColorStr = stageLighting.getCurrentColor(head.colorOffset);

      // Emitter origin at fixture lens tip
      const originX = head.x;
      const originY = head.y + 14;

      // Calculate trajectory length and target floor point
      const beamLength = 1200;
      const targetX = originX + Math.sin(sweepAngle) * beamLength;
      const targetY = originY + Math.cos(sweepAngle) * beamLength;

      // Base atmospheric luminance
      const alphaBase = beatEngine.isBassActive
        ? (0.18 + beatEngine.bassLevel * 0.22 + stageLighting.flashIntensity * 0.16)
        : 0.10;

      // TRANSFORM TO LOCAL BEAM COORDINATE SYSTEM:
      // In local coordinates: (0, 0) is emitter, X-axis extends down the beam length!
      // This allows 100% mathematically soft perpendicular feathering across the beam width!
      const angleRad = Math.atan2(targetY - originY, targetX - originX);
      const dist = Math.hypot(targetX - originX, targetY - originY);
      const endWidth = 140 + beatEngine.bassLevel * 50 + (stageLighting.flashIntensity * 35);
      const startWidth = 10;

      ctx.save();
      ctx.translate(originX, originY);
      ctx.rotate(angleRad); // Local +X is now the direction of the beam!

      // Layer A: Wide Soft Volumetric Haze Shaft (Trapezoid with soft lateral gradient)
      // Along local Y: -endWidth/2 to +endWidth/2 is the width of the beam.
      // We clip to the trapezoid cone and fill with a 2-directional soft gradient.
      ctx.beginPath();
      ctx.moveTo(0, -startWidth / 2);
      ctx.lineTo(dist, -endWidth / 2);
      ctx.lineTo(dist, endWidth / 2);
      ctx.lineTo(0, startWidth / 2);
      ctx.closePath();

      // Lateral cross-gradient (hot center, completely soft transparent edges - NO HARD LINES!)
      const lateralGrad = ctx.createLinearGradient(0, -endWidth / 2, 0, endWidth / 2);
      lateralGrad.addColorStop(0.00, 'transparent');
      lateralGrad.addColorStop(0.20, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.15})`);
      lateralGrad.addColorStop(0.50, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.85})`);
      lateralGrad.addColorStop(0.80, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.15})`);
      lateralGrad.addColorStop(1.00, 'transparent');
      ctx.fillStyle = lateralGrad;
      ctx.fill();

      // Longitudinal distance fade overlay (brighter near fixture, fading toward floor)
      const distGrad = ctx.createLinearGradient(0, 0, dist, 0);
      distGrad.addColorStop(0.00, `rgba(255, 255, 255, ${alphaBase * 0.50})`);
      distGrad.addColorStop(0.15, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.40})`);
      distGrad.addColorStop(0.70, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.10})`);
      distGrad.addColorStop(1.00, 'transparent');
      ctx.fillStyle = distGrad;
      ctx.fill();

      // Layer B: Hot Core Centerline (Subtle luminous ray down the spine)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dist * 0.9, 0);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alphaBase * 0.65})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore(); // Restore world coordinates

      // 2. Realistic Floor Light Pool (Soft Elliptical Radial Hotspot)
      const floorY = Math.min(targetY, H - 40);
      if (floorY > horizonY) {
        const spotRx = 65 + beatEngine.bassLevel * 30;
        const spotRy = 22 + beatEngine.bassLevel * 10;

        ctx.save();
        ctx.translate(targetX, floorY);
        ctx.scale(1, spotRy / spotRx);

        const spotGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, spotRx);
        spotGrad.addColorStop(0, `rgba(255, 255, 255, ${alphaBase * 1.1})`);
        spotGrad.addColorStop(0.25, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.70})`);
        spotGrad.addColorStop(0.65, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.20})`);
        spotGrad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(0, 0, spotRx, 0, Math.PI * 2);
        ctx.fillStyle = spotGrad;
        ctx.fill();
        ctx.restore();
      }
    });

    // -------------------------------------------------------------------------
    // 2. THEATRICAL OVERHEAD LIQUID SKY LASER SHEET (Festival Atmosphere Canopy)
    // Slices horizontally above the stage (y=190-250), skimming cleanly OVER dancers!
    // -------------------------------------------------------------------------
    const laserPulse = beatEngine.isBassActive ? (0.45 + beatEngine.bassLevel * 0.45) : 0.22;
    const laserY = 210 + Math.sin(now * 0.0018) * 18;
    const laserColor1 = stageLighting.getCurrentColor(0);
    const laserColor2 = stageLighting.getCurrentColor(2);

    // Glowing Horizontal Liquid Sky Sheet
    const sheetGrad = ctx.createLinearGradient(0, laserY - 15, 0, laserY + 45);
    sheetGrad.addColorStop(0, 'transparent');
    sheetGrad.addColorStop(0.3, `rgba(0, 245, 212, ${laserPulse * 0.25})`);
    sheetGrad.addColorStop(0.5, `rgba(255, 0, 127, ${laserPulse * 0.35})`);
    sheetGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = sheetGrad;
    ctx.fillRect(W * 0.10, laserY - 15, W * 0.80, 60);

    // Razor-thin scanning beam lines skimming through the liquid sky
    for (let l = 0; l < 4; l++) {
      const phase = (now * 0.002 + l * 0.25) % 1;
      const lx = W * (0.12 + phase * 0.76);
      const ly = laserY + Math.sin(phase * Math.PI * 4 + now * 0.003) * 12;

      ctx.beginPath();
      ctx.moveTo(W * 0.5, 125); // Origin at center truss
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(W * 0.5, 125);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = l % 2 === 0 ? laserColor1 : laserColor2;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    ctx.restore(); // Restore normal composite operation

    // -------------------------------------------------------------------------
    // 3. PHYSICAL FIXTURE BODIES & OPTICAL LENS FLARES (On Ceiling Rig)
    // -------------------------------------------------------------------------
    movingHeads.forEach(head => {
      ctx.save();
      ctx.translate(head.x, head.y);

      // Truss clamp bracket
      ctx.fillStyle = '#161928';
      ctx.strokeStyle = '#3a4460';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-5, -12, 10, 12);
      ctx.strokeRect(-5, -12, 10, 12);

      // Yoke assembly
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#111322';
      ctx.fill();
      ctx.stroke();

      // Optical Lens Flare Bloom (Additive glowing lens point)
      const lensColor = stageLighting.getCurrentColor(head.colorOffset);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lensGrad = ctx.createRadialGradient(0, 4, 1, 0, 4, 14);
      lensGrad.addColorStop(0, '#ffffff');
      lensGrad.addColorStop(0.35, lensColor);
      lensGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = lensGrad;
      ctx.beginPath();
      ctx.arc(0, 4, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    });
  }

  // Draw Speech Bubbles
  function drawSpeechBubbles(now) {
    const curTime = now || performance.now();
    for (let i = speechBubbles.length - 1; i >= 0; i--) {
      const sb = speechBubbles[i];
      const age = curTime - sb.createdAt;
      if (age < 0 || age > sb.duration) {
        speechBubbles.splice(i, 1);
        continue;
      }

      // Track dancer location if bound
      if (sb.targetDancer) {
        sb.x = sb.targetDancer.x;
        sb.y = sb.targetDancer.y;
      }

      const bx = sb.x * W;
      const by = sb.y * H - 120;
      // Smooth fade out in the last 800ms
      const alpha = age > (sb.duration - 800) ? Math.max(0, (sb.duration - age) / 800) : 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 22px "Be Vietnam Pro", sans-serif';
      const textMetrics = ctx.measureText(sb.text);
      const bw = Math.min(Math.max(textMetrics.width + 30, 140), 360);
      const bh = 45;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(bx - bw / 2, by - bh, bw, bh, 14);
      ctx.fill();
      ctx.stroke();

      // Speech bubble pointer
      ctx.beginPath();
      ctx.moveTo(bx - 10, by);
      ctx.lineTo(bx, by + 12);
      ctx.lineTo(bx + 10, by);
      ctx.fillStyle = '#ff007f';
      ctx.fill();

      // Text inside bubble
      ctx.fillStyle = '#0a0d1e';
      ctx.textAlign = 'center';
      ctx.fillText(sb.text, bx, by - 14);

      ctx.restore();
    }
  }

  // Particle updates & renders (Flames, Fog, Fireworks, Confetti, Hearts)
  function renderParticles(dt) {
    // 1. Flames (喷火)
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

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.restore();
    }

    // 2. Smoke / CO2 Fog (烟雾)
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

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${p.alpha})`;
      ctx.fill();
      ctx.restore();
    }

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
          <span class="vip-coins">${g.coins}💎</span>
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
        showGiftBanner(data);
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
        break;

      case 'chat':
        appendChatFeed(data);
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

      case 'dancers_cleared':
        dancers = [];
        const cc = document.getElementById('crowd-count');
        if (cc) cc.textContent = 0;
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
      const nextIdx = (playlist.indexOf(currentTrack) + 1) % playlist.length;
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

  // Initialization: Start graphics & network immediately without blocking
  initLasers();
  setupWebSocket();
  requestAnimationFrame(renderLoop);

  preloadAssets(() => {
    console.log('All character sprites and stage assets loaded!');
  });

})();
