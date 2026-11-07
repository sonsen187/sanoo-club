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
      labelEl.textContent = `DJ SANOO • BÀI #${track.id}`;
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
        ctx.fill();
      }

      // 2. Draw character sprite (centered at origin)
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

      // Glowstick rave trail / pulse on beat impact for char 2!
      if (this.charType === 2 && this.kickImpulse > 0.15) {
        ctx.save();
        ctx.globalAlpha = this.kickImpulse * 0.7;
        ctx.fillStyle = '#00ff88';
        
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
      let nameText = this.nickname;
      let badgePrefix = '';
      let fontSize = 15;
      let tagHeight = 26;
      let textPadY = 18;

      if (this.vipRank === 1) {
        badgePrefix = '👑 TOP 1 • ';
        fontSize = 21;
        tagHeight = 36;
        textPadY = 25;
      } else if (this.vipRank === 2) {
        badgePrefix = '🥈 TOP 2 • ';
        fontSize = 17;
        tagHeight = 30;
        textPadY = 21;
      } else if (this.vipRank === 3) {
        badgePrefix = '🥉 TOP 3 • ';
        fontSize = 17;
        tagHeight = 30;
        textPadY = 21;
      }

      ctx.font = `bold ${fontSize}px "Rajdhani", sans-serif`;
      const fullText = badgePrefix + nameText;
      const textWidth = ctx.measureText(fullText).width;
      const tagWidth = Math.max(textWidth + 24, 88);
      const tagY = isHuman ? (-drawHeight * 0.40 - tagHeight * 0.6) : (-drawHeight * 0.42 - tagHeight * 0.5);

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
    const maxBarH = sh * 0.58;
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

    // 4. Dynamic High-Energy LED Stage Banner Text
    ctx.save();
    if (beatEngine.isBassActive) {
      const slogans = [
        '⚡ BASS DROP! ⚡',
        '🔥 SANOO RAVE CLUB 🔥',
        '💥 QUẨY LÊN NÀO! 💥',
        '⚡ DROP THE BASS ⚡'
      ];
      const sloganIdx = Math.floor(now * 0.001 * (beatEngine.bpm / 120) * 0.5) % slogans.length;
      const slogan = slogans[sloganIdx];
      const pulseScale = 1.0 + beatEngine.bassLevel * 0.22;

      ctx.translate(cx, sy + 75);
      ctx.scale(pulseScale, pulseScale);
      ctx.font = '900 38px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe600';
      ctx.fillText(slogan, 0, 0);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(slogan, 0, 0);
    } else {
      ctx.font = '900 24px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00f0ff';
      
      ctx.fillText('🎧 DJ SANOO • GROOVE SESSION 🎧', cx, sy + 65);

      // Rolling sine soundwave in chill mode
      ctx.beginPath();
      for (let x = sx + 40; x < sx + sw - 40; x += 6) {
        const y = sy + 95 + Math.sin(x * 0.03 + now * 0.005) * 8;
        if (x === sx + 40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();

    // 5. Strobe Flash on Bass Hits
    if (stageLighting.flashIntensity > 0.08) {
      ctx.fillStyle = `rgba(255, 255, 255, ${stageLighting.flashIntensity * 0.55})`;
      ctx.fillRect(sx, sy, sw, sh);
    }

    ctx.restore();
    ctx.restore();
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
    const pumpProgress = Math.sin(beatEngine.beatPhase * Math.PI);
    const pumpOffset = pumpProgress * (isDJDropRave ? 40 : 16);

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

    // 3. Anchor VIPs precisely to stand in the DEAD CENTER of each podium platform
    dancers.forEach(d => {
      if (d.vipRank === 1) {
        const p = PODIUM_CONFIG.top1;
        d.targetX = p.cx / W;
        const isHuman = (d.charCategory === 'human');
        const baseH = isHuman ? 320 : 194;
        const scaleMult = isHuman ? 1.05 : 1.1;
        const drawH = baseH * 1.38 * scaleMult;
        // Top 1 contact point squarely on Tier 2 top platform (cy = 970px):
        const contactOffset = isHuman ? (drawH * 0.48) : (drawH * 0.47);
        d.targetY = (p.cy - 16 - contactOffset) / H;
        d.x = d.targetX;
        d.y = d.targetY;
        d.vipPositioned = true;
        d.lastVipRank = 1;
      } else if (d.vipRank === 2) {
        const p = PODIUM_CONFIG.top2;
        d.targetX = p.cx / W;
        const isHuman = (d.charCategory === 'human');
        const baseH = isHuman ? 320 : 194;
        const scaleMult = isHuman ? 1.05 : 1.1;
        const drawH = baseH * 0.88 * scaleMult;
        const contactOffset = isHuman ? (drawH * 0.48) : (drawH * 0.47);
        d.targetY = (p.cy - 14 - contactOffset) / H;
        d.x = d.targetX;
        d.y = d.targetY;
        d.vipPositioned = true;
        d.lastVipRank = 2;
      } else if (d.vipRank === 3) {
        const p = PODIUM_CONFIG.top3;
        d.targetX = p.cx / W;
        const isHuman = (d.charCategory === 'human');
        const baseH = isHuman ? 320 : 194;
        const scaleMult = isHuman ? 1.05 : 1.1;
        const drawH = baseH * 0.78 * scaleMult;
        const contactOffset = isHuman ? (drawH * 0.48) : (drawH * 0.47);
        d.targetY = (p.cy - 14 - contactOffset) / H;
        d.x = d.targetX;
        d.y = d.targetY;
        d.vipPositioned = true;
        d.lastVipRank = 3;
      } else {
        d.lastVipRank = 0;
        // Regular crowd (không có top): close the gap! Dance floor starts right below podiums (y = 0.59 ~ 0.88)
        if (!d.crowdPositioned || d.targetY >= 0.67 || d.targetY < 0.585) {
          const str = d.id || d.username || 'user';
          let hash = 0;
          for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
          hash = Math.abs(hash);
          const row = hash % 18;
          d.targetY = 0.595 + row * 0.016; // 18 natural staggered depth rows (0.595 ~ 0.87)

          // Avoid standing directly on Top 2 or Top 3 podium bases in front rows (y < 0.62)
          if (d.targetY < 0.62) {
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
    movingHeads.forEach((head, idx) => {
      const isLeft = idx < 3;
      const pairIdx = isLeft ? idx : (5 - idx);
      const wavePhase = sweepSpeed * head.speed + pairIdx * 0.55;
      const sweepAngle = (isLeft ? -1 : 1) * (head.baseAngle + Math.sin(wavePhase) * head.sweepRange);

      const colorRgb = stageLighting.getRgb(head.colorOffset);

      const originX = head.x;
      const originY = head.y + 14;

      const beamLength = 1400;
      const targetX = originX + Math.sin(sweepAngle) * beamLength;
      const targetY = originY + Math.cos(sweepAngle) * beamLength;

      const endWidth = 145 + beatEngine.bassLevel * 55 + (stageLighting.flashIntensity * 40);
      const perpAngle = sweepAngle + Math.PI / 2;
      const p1X = originX - Math.cos(perpAngle) * 7;
      const p1Y = originY - Math.sin(perpAngle) * 7;
      const p2X = originX + Math.cos(perpAngle) * 7;
      const p2Y = originY + Math.sin(perpAngle) * 7;
      const p3X = targetX + Math.cos(perpAngle) * (endWidth / 2);
      const p3Y = targetY + Math.sin(perpAngle) * (endWidth / 2);
      const p4X = targetX - Math.cos(perpAngle) * (endWidth / 2);
      const p4Y = targetY - Math.sin(perpAngle) * (endWidth / 2);

      const alphaBase = beatEngine.isBassActive
        ? (0.24 + beatEngine.bassLevel * 0.32 + stageLighting.flashIntensity * 0.28)
        : 0.14;

      const beamGrad = ctx.createLinearGradient(originX, originY, targetX, targetY);
      beamGrad.addColorStop(0, `rgba(255, 255, 255, ${alphaBase * 0.95})`);
      beamGrad.addColorStop(0.10, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.85})`);
      beamGrad.addColorStop(0.55, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.30})`);
      beamGrad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.moveTo(p1X, p1Y);
      ctx.lineTo(p2X, p2Y);
      ctx.lineTo(p3X, p3Y);
      ctx.lineTo(p4X, p4Y);
      ctx.closePath();
      ctx.fillStyle = beamGrad;
      ctx.fill();

      // Floor Spotlight Reflection Pool
      const floorY = Math.min(targetY, H - 40);
      if (floorY > H * 0.48) {
        const spotRx = 70 + beatEngine.bassLevel * 35;
        const spotRy = 24 + beatEngine.bassLevel * 12;

        ctx.save();
        ctx.translate(targetX, floorY);
        ctx.scale(1, spotRy / spotRx);

        const spotGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, spotRx);
        spotGrad.addColorStop(0, `rgba(255, 255, 255, ${alphaBase * 0.95})`);
        spotGrad.addColorStop(0.3, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.65})`);
        spotGrad.addColorStop(0.7, `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${alphaBase * 0.15})`);
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
    ctx.ellipse(W / 2, fanY, W * 0.48, 16 + beatEngine.bassLevel * 12, 0, 0, Math.PI * 2);
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

  // Automated Test Drop Support (for testing or direct query)
  if (window.location.search.includes('testDrop')) {
    beatEngine.forceHypeDrop(60);
  }

})();
