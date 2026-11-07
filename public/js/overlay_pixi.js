// ==============================================================================
// SANOO CLUB - PIXIJS V8 HARDWARE-ACCELERATED STREAM OVERLAY ENGINE
// 100% GPU-Powered WebGL2/WebGPU Rendering for 60 FPS Locked TikTok Live 9:16
// ==============================================================================

(async function () {
  'use strict';

  console.log('⚡ Initializing Sanoo Club PixiJS v8 Engine...');

  const W = 1080;
  const H = 1920;

  // 1. Initialize PixiJS v8 Application
  const canvasElement = document.getElementById('stage-canvas');
  const app = new PIXI.Application();

  await app.init({
    canvas: canvasElement,
    width: W,
    height: H,
    backgroundAlpha: 0,
    antialias: true,
    resolution: 1,
    autoDensity: true,
    powerPreference: 'high-performance'
  });

  console.log('✅ PixiJS v8 WebGL Renderer Ready!');

  // ===========================================================================
  // GAME & STREAM STATE
  // ===========================================================================
  let playlist = [];
  let currentTrack = null;
  let isPlaying = false;
  let dancers = []; window.__DJ_DANCERS__ = dancers;
  let topGifters = [];
  let particles = [];
  let flames = [];
  let fogs = [];
  let floatingHearts = [];
  let speechBubbles = [];
  let ws = null;
  let checkAudioFrame = 0;
  let currentAudioMode = 'glass_room';

  // Audio Context & Analyser
  let audioCtx = null;
  let analyser = null;
  let freqData = null;
  let audioSource = null;
  let bassIntensity = 0;
  let midIntensity = 0;
  let beatCounter = 0;
  let assetsLoaded = false;

  const audioElement = new Audio();
  audioElement.preload = 'auto';
  audioElement.crossOrigin = 'anonymous';

  // Connect Web Audio Graph
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      freqData = new Uint8Array(analyser.frequencyBinCount);

      try {
        audioSource = audioCtx.createMediaElementSource(audioElement);
        if (window.BarAudioEffects) {
          window.BarAudioEffects.init(audioCtx, audioSource, analyser);
          window.BarAudioEffects.setMode(currentAudioMode, 0.05);
        } else {
          audioSource.connect(analyser);
          analyser.connect(audioCtx.destination);
        }
      } catch (err) {
        console.warn('Audio graph connection:', err);
      }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function checkAudioUnlocked() {
    const banner = document.getElementById('audio-unlock-overlay');
    if (!banner) return;
    const isUnlocked = audioCtx && audioCtx.state === 'running' && audioElement && !audioElement.paused;
    banner.style.display = isUnlocked ? 'none' : 'flex';
  }

  const unlockOverlay = document.getElementById('audio-unlock-overlay');
  if (unlockOverlay) {
    unlockOverlay.addEventListener('click', () => {
      initAudioContext();
      if (audioElement && audioElement.src) {
        audioElement.play().then(() => checkAudioUnlocked()).catch(e => console.warn(e));
      }
    });
  }

  // Audio Mode UI sync
  function updateAudioModeUI(mode) {
    currentAudioMode = mode;
    const btn = document.getElementById('btn-audio-mode');
    if (!btn) return;
    const textEl = document.getElementById('audio-mode-text');
    const iconEl = btn.querySelector('.audio-mode-icon');
    btn.className = 'audio-mode-pill mode-' + mode;
    if (mode === 'glass_room') {
      if (textEl) textEl.textContent = 'PHÒNG KÍNH BAR';
      if (iconEl) iconEl.textContent = '🍸';
    } else if (mode === 'main_floor') {
      if (textEl) textEl.textContent = 'SÀN NHẢY CHÍNH';
      if (iconEl) iconEl.textContent = '🔊';
    } else if (mode === 'outside_door') {
      if (textEl) textEl.textContent = 'NGOÀI CỬA BAR';
      if (iconEl) iconEl.textContent = '🚪';
    }
  }

  function toggleAudioMode() {
    const modes = ['glass_room', 'main_floor', 'outside_door'];
    const nextIdx = (modes.indexOf(currentAudioMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    currentAudioMode = nextMode;
    if (window.BarAudioEffects) {
      window.BarAudioEffects.setMode(nextMode, 0.35);
    }
    updateAudioModeUI(nextMode);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'audio_mode', mode: nextMode }));
    }
  }

  const btnAudioMode = document.getElementById('btn-audio-mode');
  if (btnAudioMode) {
    btnAudioMode.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAudioMode();
    });
  }

  // Track playback
  function playTrack(track, offsetSec = 0) {
    if (!track) return;
    currentTrack = track;
    audioElement.src = track.url;
    audioElement.currentTime = offsetSec;
    smoothPlayTime = offsetSec;
    lastAudioTime = -1;
    audioClockRunning = false;

    updateTrackUI(track);
    initAudioContext();
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isPlaying = true;
        checkAudioUnlocked();
      }).catch(() => {
        isPlaying = false;
        checkAudioUnlocked();
      });
    }
  }

  function updateTrackUI(track) {
    const titleEl = document.getElementById('now-playing-title');
    const labelEl = document.getElementById('now-playing-label');
    if (titleEl && track) titleEl.textContent = `${track.id}. ${track.title}`;
    if (labelEl && track) labelEl.textContent = `DJ VŨ TRƯỜNG • BÀI #${track.id}`;
  }

  // ===========================================================================
  // STAGE LIGHTING ENGINE
  // ===========================================================================
  const stageLighting = {
    colorIndex: 0,
    flashIntensity: 0,
    chillPalette: [
      { hex: 0x00f5d4, str: '#00f5d4', r: 0,   g: 245, b: 212 },
      { hex: 0x7209b7, str: '#7209b7', r: 114, g: 9,   b: 183 },
      { hex: 0x00b4d8, str: '#00b4d8', r: 0,   g: 180, b: 216 },
      { hex: 0xf72585, str: '#f72585', r: 247, g: 37,  b: 133 },
      { hex: 0x4361ee, str: '#4361ee', r: 67,  g: 97,  b: 238 }
    ],
    dropPalette: [
      { hex: 0xff007f, str: '#ff007f', r: 255, g: 0,   b: 127 },
      { hex: 0x00f0ff, str: '#00f0ff', r: 0,   g: 240, b: 255 },
      { hex: 0xffe600, str: '#ffe600', r: 255, g: 230, b: 0 },
      { hex: 0x00ff88, str: '#00ff88', r: 0,   g: 255, b: 136 },
      { hex: 0xb5179e, str: '#b5179e', r: 181, g: 23,  b: 158 },
      { hex: 0xff3300, str: '#ff3300', r: 255, g: 51,  b: 0 }
    ],

    getCurrentColor(offset = 0) {
      const palette = beatEngine.isBassActive ? this.dropPalette : this.chillPalette;
      const idx = (Math.floor(this.colorIndex) + offset) % palette.length;
      return (palette[idx >= 0 ? idx : 0] || palette[0]).hex;
    },

    getCurrentColorStr(offset = 0) {
      const palette = beatEngine.isBassActive ? this.dropPalette : this.chillPalette;
      const idx = (Math.floor(this.colorIndex) + offset) % palette.length;
      return (palette[idx >= 0 ? idx : 0] || palette[0]).str;
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

  // 6 Pro Moving Heads on Ceiling Truss Rigging (y=135)
  const movingHeads = [
    { x: 130, y: 135, baseAngle: 0.38, sweepRange: 0.38, speed: 0.95, colorOffset: 0 },
    { x: 290, y: 135, baseAngle: 0.22, sweepRange: 0.30, speed: -1.15, colorOffset: 2 },
    { x: 450, y: 135, baseAngle: 0.08, sweepRange: 0.25, speed: 1.05, colorOffset: 4 },
    { x: 630, y: 135, baseAngle: 0.08, sweepRange: 0.25, speed: -1.05, colorOffset: 1 },
    { x: 790, y: 135, baseAngle: 0.22, sweepRange: 0.30, speed: 1.15, colorOffset: 3 },
    { x: 950, y: 135, baseAngle: 0.38, sweepRange: 0.38, speed: -0.95, colorOffset: 5 }
  ];

  let clubAtmosphereMotes = [];
  for (let i = 0; i < 35; i++) {
    clubAtmosphereMotes.push({
      x: Math.random() * W,
      y: H * 0.15 + Math.random() * (H * 0.75),
      vx: (Math.random() - 0.5) * 8,
      vy: -10 - Math.random() * 16,
      size: 2 + Math.random() * 3.5,
      alpha: 0.25 + Math.random() * 0.5,
      color: 0x00f0ff
    });
  }

  let discoSparkles = [];
  for (let i = 0; i < 40; i++) {
    discoSparkles.push({
      angle: Math.random() * Math.PI * 2,
      speed: (0.0006 + Math.random() * 0.0014) * (Math.random() < 0.5 ? 1 : -1),
      orbitRadius: 30 + Math.random() * 240,
      size: 3 + Math.random() * 4,
      colorOffset: Math.floor(Math.random() * 5)
    });
  }

  let bassRipples = [];

  // ===========================================================================
  // REAL-TIME AUDIO CLOCK & BEAT ENGINE
  // ===========================================================================
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
        smoothPlayTime = cur;
      } else {
        smoothPlayTime += drift * 0.25;
      }
    }
    smoothPlayTime += dt;
    return smoothPlayTime;
  }

  function getSmoothSmoothTime(dt, beatOffset, beatDuration) {
    const rawTime = getSmoothPlayTime(dt);
    if (!audioElement || audioElement.paused) return 0;
    const alignedTime = rawTime - beatOffset;
    return alignedTime >= 0 ? alignedTime : (rawTime % beatDuration);
  }

  const beatEngine = {
    bpm: 128,
    beatDuration: 60 / 128,
    beatProgress: 0,
    beatPhase: 0,
    danceCycle: 0,
    bassIntensity: 0,
    bassLevel: 0,
    bassFloor: 0.1,
    danceEnergy: 0,
    isBassActive: false,
    isBeatHit: false,
    kickPower: 0,
    lastBeatTime: 0,

    update(now, dt) {
      const trackBpm = (currentTrack && currentTrack.bpm) ? currentTrack.bpm : 128;
      const beatOffset = (currentTrack && currentTrack.beatOffset) ? currentTrack.beatOffset : 0;
      this.bpm = trackBpm;
      this.beatDuration = 60 / this.bpm;

      const isAudioActive = audioElement && !audioElement.paused && audioElement.currentTime > 0;

      if (isAudioActive) {
        const playTime = getSmoothSmoothTime(dt, beatOffset, this.beatDuration);
        this.beatProgress = playTime / this.beatDuration;
        this.beatPhase = ((this.beatProgress % 1.0) + 1.0) % 1.0;
        this.danceCycle = ((this.beatProgress / 2) % 1.0 + 1.0) % 1.0;

        let kickBand = 0;
        let midEnergy = 0;
        if (analyser && freqData && audioCtx && audioCtx.state === 'running') {
          analyser.getByteFrequencyData(freqData);
          const kickRaw = (freqData[2] * 1.6 + freqData[3] * 1.5 + freqData[4] * 1.0) / (4.1 * 255);
          kickBand = kickRaw;

          let midSum = 0;
          for (let i = 8; i <= 36; i++) midSum += freqData[i];
          midEnergy = midSum / (29 * 255);
          this.midIntensity = midEnergy;
        }

        this.bassFloor += (kickBand - this.bassFloor) * 0.05;
        const kickSpike = Math.max(0, kickBand - this.bassFloor * 1.15);

        const curSec = Math.floor(smoothPlayTime);
        const profileBass = (currentTrack && currentTrack.bassProfile && currentTrack.bassProfile[curSec] !== undefined)
          ? currentTrack.bassProfile[curSec]
          : 0.0;

        if (currentTrack && currentTrack.bassProfile && currentTrack.bassProfile.length > 0) {
          this.isBassActive = (profileBass >= 0.28);
        } else {
          this.isBassActive = (kickBand >= 0.35 && kickSpike > 0.08);
        }

        const beatPulse = Math.pow(Math.max(0, 1.0 - this.beatPhase * 2.2), 2.2);
        const targetMeter = this.isBassActive
          ? Math.min(1.0, 0.22 + profileBass * 0.32 + (kickSpike * 1.8 + beatPulse * 0.35) * 0.5)
          : Math.max(0.04, Math.min(0.16, profileBass * 0.35 + kickBand * 0.15));

        if (targetMeter > this.bassLevel) {
          this.bassLevel += (targetMeter - this.bassLevel) * 0.70;
        } else {
          this.bassLevel += (targetMeter - this.bassLevel) * 0.22;
        }
        this.bassLevel = Math.max(0, Math.min(1.0, this.bassLevel));

        if (this.isBassActive) {
          this.danceEnergy = Math.min(1.0, this.danceEnergy + dt * 4.5);
        } else {
          this.danceEnergy = Math.max(0.0, this.danceEnergy - dt * 3.5);
        }

        const timeSinceLast = (now - this.lastBeatTime) / 1000;
        if (this.isBassActive && (this.beatPhase < 0.16 || this.beatPhase > 0.84) && timeSinceLast > (this.beatDuration * 0.72)) {
          this.isBeatHit = true;
          this.kickPower = Math.min(1.0, this.bassLevel * 1.5);
          this.lastBeatTime = now;
          stageLighting.onBeatHit(this.bpm, this.bassLevel);

          if (bassRipples.length < 8) {
            bassRipples.push({
              x: W / 2,
              y: H * 0.48,
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

        stageLighting.update(dt);

      } else {
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

      // Forced Hype Drop (from button or test)
      if (this.forcedDropUntil && now < this.forcedDropUntil) {
        this.isBassActive = true;
        this.bassLevel = Math.max(this.bassLevel, 0.78 + Math.sin(this.beatPhase * Math.PI) * 0.22);
        this.danceEnergy = 1.0;
      }

      // Automatic Drop Impact Explosion
      if (this.isBassActive && !this._lastBassActiveState) {
        triggerSmoke();
        triggerFlame();
        triggerConfetti();
        dancers.forEach(d => { d.isJumping = true; });
        setTimeout(() => { dancers.forEach(d => { d.isJumping = false; }); }, 4200);
        stageLighting.flashIntensity = 1.0;
        const strobe = document.getElementById('strobe-fx');
        if (strobe) {
          strobe.classList.remove('active');
          void strobe.offsetWidth;
          strobe.classList.add('active');
        }
      }
      this._lastBassActiveState = this.isBassActive;

      // Periodic Auto Pyro on continuous drop
      if (this.isBassActive && this.bassLevel > 0.65) {
        if (!this._lastAutoFxTime || (now - this._lastAutoFxTime > 6200)) {
          this._lastAutoFxTime = now;
          if (Math.random() > 0.45) triggerFlame();
          else triggerSmoke();
        }
      }

      // Update HUD
      const fillEl = document.getElementById('bass-bar-fill');
      const textEl = document.getElementById('bass-mode-text');
      if (fillEl) fillEl.style.width = Math.min(100, Math.round(this.bassLevel * 100)) + '%';
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
      setTimeout(() => { dancers.forEach(d => { d.isJumping = false; }); }, 4500);
    }
  };

  // Button Listeners
  const btnHypeDrop = document.getElementById('btn-hype-drop');
  if (btnHypeDrop) {
    btnHypeDrop.addEventListener('click', (e) => {
      e.stopPropagation();
      beatEngine.forceHypeDrop(14);
    });
  }

  // ===========================================================================
  // PIXIJS TEXTURE CACHE & SPRITE LOADING
  // ===========================================================================
  const textureCache = {
    char1: [],
    char2: [],
    char3: [],
    human_male: [],
    human_female: [],
    speaker: null
  };

  async function loadAllTextures() {
    console.log('Loading character sprite textures into WebGL GPU VRAM...');
    const loadPromises = [];

    // Char 1: 14 frames
    for (let i = 1; i <= 14; i++) {
      const url = `/assets/characters/char1/${i}.png?v=clean2`;
      loadPromises.push(PIXI.Assets.load(url).then(t => { textureCache.char1[i - 1] = t; }));
    }
    // Char 2: 13 frames
    for (let i = 1; i <= 13; i++) {
      const url = `/assets/characters/char2/${i}.png?v=clean2`;
      loadPromises.push(PIXI.Assets.load(url).then(t => { textureCache.char2[i - 1] = t; }));
    }
    // Char 3: 14 frames
    for (let i = 1; i <= 14; i++) {
      const url = `/assets/characters/char3/${i}.png?v=clean2`;
      loadPromises.push(PIXI.Assets.load(url).then(t => { textureCache.char3[i - 1] = t; }));
    }
    // Human Male: 14 frames
    for (let i = 1; i <= 14; i++) {
      const url = `/assets/characters/human_male/${i}.png?v=chibi1`;
      loadPromises.push(PIXI.Assets.load(url).then(t => { textureCache.human_male[i - 1] = t; }));
    }
    // Human Female: 14 frames
    for (let i = 1; i <= 14; i++) {
      const url = `/assets/characters/human_female/${i}.png?v=chibi1`;
      loadPromises.push(PIXI.Assets.load(url).then(t => { textureCache.human_female[i - 1] = t; }));
    }
    // Speaker
    loadPromises.push(PIXI.Assets.load('/assets/characters/char3/loa.png').then(t => { textureCache.speaker = t; }).catch(() => {}));

    await Promise.all(loadPromises);
    assetsLoaded = true;
    console.log('✅ All WebGL Textures Loaded into GPU!');
  }

  // ===========================================================================
  // DANCER CLASS (PIXIJS POWERED)
  // ===========================================================================
  class PixiDancer {
    constructor(data) {
      this.id = data.id || ('d_' + Math.random().toString(36).substr(2, 9));
      this.userId = data.userId || this.id;
      this.username = data.username || 'RaVIP';
      this.nickname = data.nickname || this.username;
      this.avatar = data.avatar || '';
      this.charCategory = data.charCategory || 'cat';
      this.gender = data.gender || 'male';
      this.charType = data.charType || (Math.floor(Math.random() * 3) + 1);
      this.danceStyle = data.danceStyle || (Math.floor(Math.random() * 3) + 1);

      this.x = data.x !== undefined ? data.x : (0.15 + Math.random() * 0.7);
      this.y = data.y !== undefined ? data.y : (0.54 + Math.random() * 0.38);
      this.targetX = this.x;
      this.targetY = this.y;
      this.score = data.score || 0;
      this.frameIndex = 0;
      this.scale = 0.62 + (this.y - 0.62) * 0.32;
      this.isJumping = false;
      this.jumpOffset = 0;
      this.bounceY = 0;
      this.swayAngle = 0;
      this.squash = 1;
      this.kickImpulse = 0;
      this.isVip = false;
      this.vipRank = data.vipRank || 0;

      // Pixi Container Hierarchy
      this.container = new PIXI.Container();
      this.container.anchor = { x: 0.5, y: 0.5 };

      // VIP Aura Graphics
      this.auraGfx = new PIXI.Graphics();
      this.container.addChild(this.auraGfx);

      // Character Sprite
      this.sprite = new PIXI.Sprite();
      this.sprite.anchor.set(0.5, 0.5);
      this.container.addChild(this.sprite);

      // Floating Name Tag Container
      this.tagContainer = new PIXI.Container();
      this.tagBg = new PIXI.Graphics();
      this.tagText = new PIXI.Text({
        text: this.getBadgeText(),
        style: {
          fontFamily: 'Rajdhani, sans-serif',
          fontWeight: 'bold',
          fontSize: 20,
          fill: 0x000000,
          align: 'center'
        }
      });
      this.tagText.anchor.set(0.5, 0.5);
      this.tagContainer.addChild(this.tagBg);
      this.tagContainer.addChild(this.tagText);
      this.container.addChild(this.tagContainer);

      dancersLayer.addChild(this.container);
    }

    getBadgeText() {
      let prefix = '';
      if (this.vipRank === 1) prefix = '👑 TOP 1 • ';
      else if (this.vipRank === 2) prefix = '🥈 TOP 2 • ';
      else if (this.vipRank === 3) prefix = '🥉 TOP 3 • ';
      return prefix + this.nickname;
    }

    getTextures() {
      if (this.charCategory === 'human') {
        const list = (this.gender === 'female' ? textureCache.human_female : textureCache.human_male);
        if (list && list.length > 0) return list;
      }
      const catList = textureCache[`char${this.charType}`] || textureCache.char1;
      if (catList && catList.length > 0) return catList;
      return textureCache.char1 || [];
    }

    getAdaptiveFrame(totalFrames, bEngine) {
      if (bEngine.danceEnergy < 0.12) return 0;
      const danceCycle = bEngine.danceCycle;
      if (bEngine.danceEnergy > 0.45 && bEngine.isBassActive) {
        const half = (danceCycle * 2) % 1.0;
        const side = danceCycle < 0.5 ? 0 : 1;
        const snap = Math.pow(half, 0.65);

        if (this.charCategory === 'human') {
          return Math.floor(danceCycle * totalFrames) % totalFrames;
        } else if (this.charType === 2) {
          const arr = side === 0 ? [0, 2, 4, 6] : [6, 8, 10, 12];
          return arr[Math.min(arr.length - 1, Math.floor(snap * arr.length))];
        } else if (this.charType === 1) {
          const arr = side === 0 ? [1, 4, 7] : [7, 10, 13];
          return arr[Math.min(arr.length - 1, Math.floor(snap * arr.length))];
        } else {
          const arr = side === 0 ? [0, 2, 5] : [7, 10, 13];
          return arr[Math.min(arr.length - 1, Math.floor(snap * arr.length))];
        }
      } else {
        const swing = (Math.sin((danceCycle - 0.25) * Math.PI * 2) + 1) * 0.5;
        return Math.floor(swing * totalFrames) % totalFrames;
      }
    }

    update(dt, bEngine, now) {
      this.x += (this.targetX - this.x) * 0.05;
      this.y += (this.targetY - this.y) * 0.05;

      if (this.vipRank === 1) {
        this.scale = 1.48;
      } else if (this.vipRank === 2) {
        this.scale = 1.15;
      } else if (this.vipRank === 3) {
        this.scale = 1.08;
      } else {
        this.scale = 0.62 + (this.y - 0.62) * 0.32;
      }

      const textures = this.getTextures();
      const totalFrames = textures && textures.length > 0 ? textures.length : 14;

      if (bEngine.danceEnergy < 0.18 || !bEngine.isBassActive) {
        this.frameIndex = 0;
        const dip = Math.sin(bEngine.beatPhase * Math.PI);
        this.bounceY = -dip * 24;
        this.squash = 1.0 - (dip * 0.12);
        this.swayAngle = Math.sin(bEngine.beatProgress * Math.PI) * 0.035;
        this.kickImpulse = 0;
      } else {
        this.frameIndex = this.getAdaptiveFrame(totalFrames, bEngine);
        const dynamicHeight = (8 + Math.pow(bEngine.bassLevel, 1.3) * 36) * bEngine.danceEnergy;
        const bounceCurve = Math.sin(bEngine.beatPhase * Math.PI);
        this.bounceY = bounceCurve * dynamicHeight + (this.kickImpulse * 14);
        const dynamicSquash = 0.05 + bEngine.bassLevel * 0.12;
        this.squash = 1.0 - (bounceCurve * dynamicSquash * bEngine.danceEnergy) + (this.kickImpulse * 0.08);
        this.swayAngle = Math.sin(bEngine.danceCycle * Math.PI * 2) * (0.04 + bEngine.bassLevel * 0.07) * bEngine.danceEnergy;

        if (bEngine.isBeatHit) this.kickImpulse = 1.2;
        this.kickImpulse *= 0.85;
      }

      if (this.isJumping) {
        this.jumpOffset = Math.abs(Math.sin((now || performance.now()) * 0.015)) * 48;
      } else {
        this.jumpOffset = 0;
      }

      // Apply to Pixi Container
      const screenX = this.x * W;
      const totalYOffset = this.jumpOffset + this.bounceY;
      const screenY = this.y * H - totalYOffset;

      this.container.x = screenX;
      this.container.y = screenY;

      // Update Texture
      if (textures && textures.length > 0) {
        const tIdx = this.frameIndex % textures.length;
        if (textures[tIdx]) {
          this.sprite.texture = textures[tIdx];
        }
      }

      const isHuman = (this.charCategory === 'human');
      const baseScale = (isHuman ? 1.05 : 1.1) * this.scale;
      this.sprite.scale.set(baseScale / this.squash, baseScale * this.squash);
      this.sprite.rotation = this.swayAngle;

      // Update VIP Aura
      this.auraGfx.clear();
      const drawWidth = 300 * this.scale;
      if (this.vipRank === 1) {
        const auraR = drawWidth * 0.58 * (1.0 + bEngine.bassLevel * 0.18);
        this.auraGfx.circle(0, 0, auraR).fill({ color: 0xffd700, alpha: 0.35 });
      } else if (this.vipRank === 2) {
        const auraR = drawWidth * 0.50 * (1.0 + bEngine.bassLevel * 0.14);
        this.auraGfx.circle(0, 0, auraR).fill({ color: 0x00f0ff, alpha: 0.30 });
      } else if (this.vipRank === 3) {
        const auraR = drawWidth * 0.45 * (1.0 + bEngine.bassLevel * 0.12);
        this.auraGfx.circle(0, 0, auraR).fill({ color: 0xff8c00, alpha: 0.30 });
      }

      // Update Floating Name Tag
      const fullText = this.getBadgeText();
      if (this.tagText.text !== fullText) {
        this.tagText.text = fullText;
      }
      const tagW = Math.max(this.tagText.width + 30, 110);
      const tagH = 36;
      const tagY = isHuman ? (-140 * this.scale) : (-115 * this.scale);

      this.tagContainer.y = tagY;
      this.tagBg.clear();
      let bgColor = 0x0f1428;
      let borderColor = 0x00f0ff;
      let textColor = 0xffffff;

      if (this.vipRank === 1) {
        bgColor = 0xffe600;
        borderColor = 0xffffff;
        textColor = 0x000000;
      } else if (this.vipRank === 2) {
        bgColor = 0x00b4d8;
        borderColor = 0xffffff;
        textColor = 0x000000;
      } else if (this.vipRank === 3) {
        bgColor = 0xd97706;
        borderColor = 0xffffff;
        textColor = 0x000000;
      }

      this.tagBg.roundRect(-tagW / 2, -tagH / 2, tagW, tagH, 8)
        .fill({ color: bgColor, alpha: this.vipRank > 0 ? 0.95 : 0.85 })
        .stroke({ color: borderColor, width: 2.5 });
      this.tagText.style.fill = textColor;
    }

    destroy() {
      if (this.container && this.container.parent) {
        this.container.parent.removeChild(this.container);
      }
    }
  }

  // ===========================================================================
  // PIXI SCENE LAYERS HIERARCHY
  // ===========================================================================
  const stageRoot = app.stage;
  const bgLayer = new PIXI.Container();
  const floorLayer = new PIXI.Container();
  const podiumsLayer = new PIXI.Container();
  const lightsLayer = new PIXI.Container();
  const dancersLayer = new PIXI.Container();
  const particlesLayer = new PIXI.Container();
  const hudLayer = new PIXI.Container();

  stageRoot.addChild(bgLayer);
  stageRoot.addChild(floorLayer);
  stageRoot.addChild(podiumsLayer);
  stageRoot.addChild(lightsLayer);
  stageRoot.addChild(dancersLayer);
  stageRoot.addChild(particlesLayer);
  stageRoot.addChild(hudLayer);

  // Graphics Singletons for 60 FPS Batch Updates
  const trussGfx = new PIXI.Graphics();
  const ledScreenGfx = new PIXI.Graphics();
  const djStageGfx = new PIXI.Graphics();
  const floorGfx = new PIXI.Graphics();
  const podiumsGfx = new PIXI.Graphics();
  const lightsGfx = new PIXI.Graphics();
  const particlesGfx = new PIXI.Graphics();

  bgLayer.addChild(trussGfx);
  bgLayer.addChild(ledScreenGfx);
  bgLayer.addChild(djStageGfx);
  floorLayer.addChild(floorGfx);
  podiumsLayer.addChild(podiumsGfx);
  lightsGfx.blendMode = 'add';
  lightsLayer.addChild(lightsGfx);
  particlesGfx.blendMode = 'add';
  particlesLayer.addChild(particlesGfx);

  // LED Banner Text (Pixi.Text)
  const ledText = new PIXI.Text({
    text: '🎧 SANOO CLUB RESIDENT DJ • GROOVE SESSION 🎧',
    style: {
      fontFamily: 'Rajdhani, sans-serif',
      fontWeight: '900',
      fontSize: 26,
      fill: 0x00f0ff,
      align: 'center'
    }
  });
  ledText.anchor.set(0.5, 0.5);
  ledText.x = W * 0.5;
  ledText.y = H * 0.15 + (H * 0.22) * 0.28;
  bgLayer.addChild(ledText);

  // DJ Table Marquee Text
  const djMarqueeText = new PIXI.Text({
    text: '★ SANOO CLUB • RESIDENT DJ ★',
    style: {
      fontFamily: 'Rajdhani, sans-serif',
      fontWeight: '900',
      fontSize: 17,
      fill: 0xffffff,
      align: 'center'
    }
  });
  djMarqueeText.anchor.set(0.5, 0.5);
  djMarqueeText.x = W * 0.5;
  djMarqueeText.y = H * 0.36 + 25 + 95;
  bgLayer.addChild(djMarqueeText);

  // VIP Podiums Text Labels
  const podiumLabels = [
    { text: '👑 TOP 1 ĐẠI GIA', x: W * 0.50, y: H * 0.54 + 68, fill: 0xffffff, bg: 0xb45309 },
    { text: '🥈 TOP 2 VIP',     x: W * 0.24, y: H * 0.59 + 52, fill: 0xffffff, bg: 0x0e7490 },
    { text: '🥉 TOP 3 VIP',     x: W * 0.76, y: H * 0.59 + 52, fill: 0xffffff, bg: 0x9a3412 }
  ];
  const podiumTextObjects = podiumLabels.map(l => {
    const t = new PIXI.Text({
      text: l.text,
      style: {
        fontFamily: 'Rajdhani, sans-serif',
        fontWeight: '900',
        fontSize: 13,
        fill: l.fill,
        align: 'center'
      }
    });
    t.anchor.set(0.5, 0.5);
    t.x = l.x;
    t.y = l.y;
    podiumsLayer.addChild(t);
    return t;
  });

  // ===========================================================================
  // STAGE & GRAPHICS DRAWING ROUTINES (PIXI GRAPHICS)
  // ===========================================================================

  // 1. Truss & LED Screen
  function drawStageBackdropPixi(now) {
    const sx = W * 0.15;
    const sy = H * 0.15;
    const sw = W * 0.7;
    const sh = H * 0.22;

    trussGfx.clear();
    // Horizontal truss
    trussGfx.rect(W * 0.05, 120, W * 0.9, 26).stroke({ color: 0x788cb4, width: 3, alpha: 0.45 });
    for (let x = W * 0.05; x < W * 0.95; x += 40) {
      trussGfx.poly([x, 120, x + 40, 146]).stroke({ color: 0x788cb4, width: 2, alpha: 0.45 });
    }
    // Support Columns
    trussGfx.rect(W * 0.05, 146, 26, H * 0.28).stroke({ color: 0x788cb4, width: 2.5, alpha: 0.45 });
    trussGfx.rect(W * 0.95 - 26, 146, 26, H * 0.28).stroke({ color: 0x788cb4, width: 2.5, alpha: 0.45 });

    // Par LED Chaser
    const parCount = 10;
    const parSpacing = (W * 0.9) / parCount;
    const chaserStep = Math.floor((now * 0.006 * (beatEngine.bpm / 120))) % parCount;
    for (let p = 0; p < parCount; p++) {
      const px = W * 0.05 + p * parSpacing + 20;
      const isChaser = (p === chaserStep || (p + 1) % parCount === chaserStep);
      const col = isChaser ? stageLighting.getCurrentColor(p) : 0x00f0ff;
      trussGfx.circle(px, 133, isChaser ? 8 : 5).fill({ color: col, alpha: isChaser ? 1 : 0.35 });
    }

    // LED Screen Visualizer
    ledScreenGfx.clear();
    ledScreenGfx.rect(sx, sy, sw, sh).fill({ color: 0x040612 }).stroke({ color: stageLighting.getCurrentColor(), width: 4 });

    const cx = sx + sw / 2;
    const cy = sy + sh / 2;

    // Concentric Octagons
    const tunnelRings = 5;
    for (let r = 0; r < tunnelRings; r++) {
      const ringProg = ((now * 0.0009 * (beatEngine.bpm / 120) + r / tunnelRings) % 1.0);
      const ringR = 25 + ringProg * (sw * 0.46);
      const ringAlpha = Math.sin(ringProg * Math.PI) * (0.28 + beatEngine.bassLevel * 0.42);
      const ringColor = stageLighting.getCurrentColor(r * 2);

      const pts = [];
      for (let a = 0; a < 8; a++) {
        const ang = a * (Math.PI / 4) + (now * 0.0006);
        pts.push(cx + Math.cos(ang) * ringR, cy - 25 + Math.sin(ang) * (ringR * 0.65));
      }
      ledScreenGfx.poly(pts, true).stroke({ color: ringColor, width: 2 + beatEngine.bassLevel * 3, alpha: ringAlpha });
    }

    // 36-Band EQ Spectrum Analyzer
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

      const barColor = mag > 0.85 ? 0xffffff : (mag > 0.65 ? 0xffe600 : (mag > 0.35 ? 0xff007f : 0x00f0ff));
      ledScreenGfx.rect(bx, by, barW, barH).fill({ color: barColor });
      ledScreenGfx.rect(bx, by - 3, barW, 2).fill({ color: 0xffffff });
    }

    // Dynamic LED Banner Text
    if (beatEngine.isBassActive) {
      const slogans = ['⚡ BASS DROP! ⚡', '🔥 SANOO RAVE CLUB 🔥', '💥 QUẨY LÊN NÀO! 💥', '⚡ DROP THE BASS ⚡'];
      const sloganIdx = Math.floor(now * 0.001 * (beatEngine.bpm / 120) * 0.5) % slogans.length;
      ledText.text = slogans[sloganIdx];
      ledText.style.fontSize = 38;
      ledText.style.fill = 0xffe600;
      const pulseScale = 1.0 + beatEngine.bassLevel * 0.22;
      ledText.scale.set(pulseScale);
    } else {
      ledText.text = '🎧 SANOO CLUB RESIDENT DJ • GROOVE SESSION 🎧';
      ledText.style.fontSize = 24;
      ledText.style.fill = 0x00f0ff;
      ledText.scale.set(1.0);
    }

    // Strobe Flash
    if (stageLighting.flashIntensity > 0.08) {
      ledScreenGfx.rect(sx, sy, sw, sh).fill({ color: 0xffffff, alpha: stageLighting.flashIntensity * 0.5 });
    }
  }

  // 2. DJ Stage, Mixer, Resident DJ Character & Speakers
  function drawDJStagePixi(now) {
    const stageY = H * 0.36;
    djStageGfx.clear();

    // Disco Mirror Ball
    const ballX = W / 2;
    const ballY = 155;
    const ballRadius = 38;
    djStageGfx.poly([ballX, 120, ballX, ballY - ballRadius]).stroke({ color: 0xcbd5e1, width: 3 });
    djStageGfx.circle(ballX, ballY, ballRadius).fill({ color: 0x94a3b8 }).stroke({ color: 0xffffff, width: 2 });

    // Stage Platform Base
    djStageGfx.poly([
      W * 0.18, stageY + 70,
      W * 0.82, stageY + 70,
      W * 0.88, stageY + 140,
      W * 0.12, stageY + 140
    ], true).fill({ color: 0x0c0f20 }).stroke({ color: stageLighting.getCurrentColor(0), width: 3 });

    // DJ Table Front Panel
    const tableW = 380;
    const tableH = 125;
    const tableX = (W - tableW) / 2;
    const tableY = stageY + 25;

    djStageGfx.rect(tableX, tableY, tableW, tableH)
      .fill({ color: 0x121426 })
      .stroke({ color: stageLighting.getCurrentColor(1), width: 3 });

    // Resident DJ Character Physics
    const djHype = Math.max(0, Math.min(1.0, (beatEngine.bassLevel - 0.18) / 0.65));
    const djBob = djHype > 0.08 ? Math.sin(beatEngine.beatPhase * Math.PI) * (8 + djHype * 28) : Math.sin(now * 0.003) * 4;
    const djSway = Math.sin(beatEngine.danceCycle * Math.PI * 2) * (3 + djHype * 12);
    const djHeadX = W / 2 + djSway;
    const djHeadY = tableY - 58 + djBob;

    // DJ Body & Hoodie
    djStageGfx.poly([
      djHeadX - 48, djHeadY + 28,
      djHeadX + 48, djHeadY + 28,
      djHeadX + 62, djHeadY + 105,
      djHeadX - 62, djHeadY + 105
    ], true).fill({ color: 0x111322 }).stroke({ color: 0xffe600, width: 3 });

    // DJ Head & Visor
    djStageGfx.circle(djHeadX, djHeadY, 38).fill({ color: 0xffdd99 }).stroke({ color: 0x1e293b, width: 3 });
    djStageGfx.roundRect(djHeadX - 28, djHeadY - 4, 56, 22, 6).fill({ color: 0x0f172a }).stroke({ color: 0x00ff88, width: 3 });
    // Visor Equalizer
    for (let b = 0; b < 4; b++) {
      const bx = djHeadX - 22 + b * 11;
      const bh = 4 + Math.sin(now * 0.02 + b) * 5 + beatEngine.bassLevel * 6;
      djStageGfx.rect(bx, djHeadY + 14 - bh, 7, bh).fill({ color: 0x00ff88 });
    }
    // Snapback Cap
    djStageGfx.ellipse(djHeadX, djHeadY - 16, 44, 9).fill({ color: 0x1e2233 }).stroke({ color: 0xffe600, width: 2 });

    // DJ Arms (Dual-Arm Rave in drops, Turntable Scratching in chill)
    const isDJDrop = beatEngine.isBassActive || djHype > 0.35;
    const deckLeftX = tableX + 85;
    const deckRightX = tableX + tableW - 85;
    const deckLeftY = tableY + 22;

    if (isDJDrop) {
      const pumpOffset = Math.sin(beatEngine.beatPhase * Math.PI) * 42;
      const rHandX = djHeadX + 68;
      const rHandY = djHeadY - 45 - pumpOffset;
      const lHandX = djHeadX - 68;
      const lHandY = djHeadY - 45 - pumpOffset;

      // Arms
      djStageGfx.poly([djHeadX + 44, djHeadY + 36, rHandX, rHandY]).stroke({ color: 0xffe600, width: 14 });
      djStageGfx.poly([djHeadX - 44, djHeadY + 36, lHandX, lHandY]).stroke({ color: 0xffe600, width: 14 });

      // Fists & Neon Wristbands
      djStageGfx.circle(rHandX, rHandY, 13).fill({ color: 0xffdd99 }).stroke({ color: 0xffe600, width: 2.5 });
      djStageGfx.circle(rHandX, rHandY + 6, 8).fill({ color: 0xff007f });
      djStageGfx.circle(lHandX, lHandY, 13).fill({ color: 0xffdd99 }).stroke({ color: 0xffe600, width: 2.5 });
      djStageGfx.circle(lHandX, lHandY + 6, 8).fill({ color: 0x00f0ff });
    } else {
      const scratchWobble = Math.sin(now * 0.015) * 8;
      djStageGfx.poly([djHeadX + 48, djHeadY + 38, deckRightX, deckLeftY]).stroke({ color: 0xffe600, width: 12 });
      djStageGfx.circle(deckRightX, deckLeftY, 11).fill({ color: 0xffdd99 });
      djStageGfx.poly([djHeadX - 48, djHeadY + 38, deckLeftX + scratchWobble, deckLeftY]).stroke({ color: 0xffe600, width: 12 });
      djStageGfx.circle(deckLeftX + scratchWobble, deckLeftY, 11).fill({ color: 0xffdd99 });
    }

    // Pioneer Mixer & Turntable Jog Wheels
    const mixerW = 76;
    const mixerH = 70;
    const mixerX = (W - mixerW) / 2;
    const mixerY = tableY + 5;
    djStageGfx.rect(mixerX, mixerY, mixerW, mixerH).fill({ color: 0x0a0d18 }).stroke({ color: 0x334155, width: 2 });
    // VU Meters
    for (let ch = 0; ch < 2; ch++) {
      const vuX = mixerX + 18 + ch * 24;
      const vuY = mixerY + 12;
      const vuH = 40;
      djStageGfx.rect(vuX, vuY, 8, vuH).fill({ color: 0x05070e });
      const activeH = Math.min(vuH, beatEngine.bassLevel * vuH * 1.25);
      djStageGfx.rect(vuX, vuY + vuH - activeH, 8, activeH).fill({ color: beatEngine.isBassActive ? 0xff0055 : 0x00ff88 });
    }
    // Jog Wheels
    [-1, 1].forEach(side => {
      const dx = tableX + (side < 0 ? 85 : tableW - 85);
      const dy = tableY + 25;
      djStageGfx.circle(dx, dy, 38).fill({ color: 0x080a14 }).stroke({ color: stageLighting.getCurrentColor(side > 0 ? 2 : 4), width: 3 });
      const spinAngle = now * 0.005 * side;
      djStageGfx.poly([dx, dy, dx + Math.cos(spinAngle) * 32, dy + Math.sin(spinAngle) * 32]).stroke({ color: 0xffffff, width: 3 });
      djStageGfx.circle(dx, dy, 12).fill({ color: 0x1e293b }).stroke({ color: 0xffe600, width: 2 });
    });

    // Concert Speakers Left & Right
    const spkScale = 1.0 + (beatEngine.isBeatHit ? 0.06 * beatEngine.danceEnergy : 0);
    const sw = 100 * spkScale;
    const sh = 170 * spkScale;
    djStageGfx.rect(120 - sw / 2, stageY + 20 - sh / 2, sw, sh).fill({ color: 0x10121f }).stroke({ color: 0x334155, width: 3 });
    djStageGfx.circle(120, stageY + 20 - 25, 28 * spkScale).fill({ color: 0x1e2235 }).stroke({ color: 0x00f0ff, width: 2 });
    djStageGfx.circle(120, stageY + 20 + 35, 36 * spkScale).fill({ color: 0x1e2235 }).stroke({ color: 0x00f0ff, width: 2 });

    djStageGfx.rect(W - 120 - sw / 2, stageY + 20 - sh / 2, sw, sh).fill({ color: 0x10121f }).stroke({ color: 0x334155, width: 3 });
    djStageGfx.circle(W - 120, stageY + 20 - 25, 28 * spkScale).fill({ color: 0x1e2235 }).stroke({ color: 0x00f0ff, width: 2 });
    djStageGfx.circle(W - 120, stageY + 20 + 35, 36 * spkScale).fill({ color: 0x1e2235 }).stroke({ color: 0x00f0ff, width: 2 });
  }

  // 3. 2.5D Dance Floor & Podiums
  function drawDanceFloorPixi(now) {
    const horizonY = H * 0.48;
    floorGfx.clear();

    // Floor Base gradient
    floorGfx.rect(0, horizonY, W, H - horizonY).fill({ color: 0x030611, alpha: 0.95 });

    // Grid Perspective Lines
    const numLines = 14;
    for (let i = 0; i <= numLines; i++) {
      const bottomX = (W / numLines) * i;
      const topX = W * 0.5 + (bottomX - W * 0.5) * 0.16;
      floorGfx.poly([topX, horizonY, bottomX, H]).stroke({ color: 0x00f0ff, width: 1.5, alpha: 0.22 });
    }
    // Horizontal Depth Grid Rings
    for (let j = 1; j <= 8; j++) {
      const t = j / 8;
      const gy = horizonY + Math.pow(t, 2.2) * (H - horizonY);
      floorGfx.poly([0, gy, W, gy]).stroke({ color: 0x00f0ff, width: 1.5, alpha: 0.15 + t * 0.25 });
    }

    // Bass Ripples
    for (let i = bassRipples.length - 1; i >= 0; i--) {
      const r = bassRipples[i];
      r.radius += r.speed * 0.016;
      r.alpha -= 0.018;
      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        bassRipples.splice(i, 1);
        continue;
      }
      floorGfx.ellipse(r.x, r.y + (r.radius * 0.45), r.radius, r.radius * 0.32)
        .stroke({ color: r.color, width: 3, alpha: r.alpha });
    }

    // VIP Podiums
    podiumsGfx.clear();
    // Top 1 Gold Podium (Center, Elevated y=H*0.54=1036px)
    drawTieredPodiumPixi(podiumsGfx, W * 0.50, H * 0.54, [
      { rx: 210, ry: 72, h: 28, col: 0x92400e, rim: 0xffe600 },
      { rx: 180, ry: 60, h: 26, col: 0xb45309, rim: 0xfff066 },
      { rx: 155, ry: 50, h: 24, col: 0xd97706, rim: 0xfffbeb }
    ]);
    podiumsGfx.roundRect(W * 0.50 - 85, H * 0.54 + 52, 170, 32, 6)
      .fill({ color: 0xb45309 }).stroke({ color: 0xffe600, width: 2 });

    // Top 2 Silver Podium (Left, Elevated y=H*0.59=1132px)
    drawTieredPodiumPixi(podiumsGfx, W * 0.24, H * 0.59, [
      { rx: 135, ry: 48, h: 22, col: 0x0e7490, rim: 0x38bdf8 },
      { rx: 115, ry: 40, h: 20, col: 0x0284c7, rim: 0xe0f2fe }
    ]);
    podiumsGfx.roundRect(W * 0.24 - 65, H * 0.59 + 38, 130, 28, 6)
      .fill({ color: 0x0e7490 }).stroke({ color: 0x38bdf8, width: 2 });

    // Top 3 Bronze Podium (Right, Elevated y=H*0.59=1132px)
    drawTieredPodiumPixi(podiumsGfx, W * 0.76, H * 0.59, [
      { rx: 130, ry: 46, h: 22, col: 0x9a3412, rim: 0xfb923c },
      { rx: 110, ry: 38, h: 20, col: 0xc2410c, rim: 0xffedd5 }
    ]);
    podiumsGfx.roundRect(W * 0.76 - 65, H * 0.59 + 38, 130, 28, 6)
      .fill({ color: 0x9a3412 }).stroke({ color: 0xfb923c, width: 2 });
  }

  function drawTieredPodiumPixi(gfx, cx, cy, tiers) {
    let currentY = cy;
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      // Cylinder Base Side
      gfx.poly([
        cx - t.rx, currentY,
        cx + t.rx, currentY,
        cx + t.rx, currentY + t.h,
        cx - t.rx, currentY + t.h
      ], true).fill({ color: t.col }).stroke({ color: t.rim, width: 2 });
      // Bottom ellipse curve
      gfx.ellipse(cx, currentY + t.h, t.rx, t.ry).fill({ color: t.col });
      // Top platform cap
      gfx.ellipse(cx, currentY, t.rx, t.ry).fill({ color: t.col }).stroke({ color: t.rim, width: 2.5 });
      currentY -= (t.h * 0.7);
    }
  }

  // 4. Moving Head Volumetric Beams, Liquid Sky & Atmospheric Haze (Additive GPU Blend)
  function drawLightsPixi(now) {
    const sweepSpeed = beatEngine.isBassActive ? (now * 0.0022 * (beatEngine.bpm / 120)) : (now * 0.0013 * (beatEngine.bpm / 120));
    lightsGfx.clear();

    // 6 Moving Heads Volumetric Cones
    movingHeads.forEach((head, idx) => {
      const isLeft = idx < 3;
      const pairIdx = isLeft ? idx : (5 - idx);
      const wavePhase = sweepSpeed * head.speed + pairIdx * 0.55;
      const sweepAngle = (isLeft ? -1 : 1) * (head.baseAngle + Math.sin(wavePhase) * head.sweepRange);

      const colorHex = stageLighting.getCurrentColor(head.colorOffset);
      const originX = head.x;
      const originY = head.y + 14;
      const beamLength = 1400;
      const targetX = originX + Math.sin(sweepAngle) * beamLength;
      const targetY = originY + Math.cos(sweepAngle) * beamLength;
      const endWidth = 145 + beatEngine.bassLevel * 55;
      const perpAngle = sweepAngle + Math.PI / 2;

      const p1X = originX - Math.cos(perpAngle) * 7;
      const p1Y = originY - Math.sin(perpAngle) * 7;
      const p2X = originX + Math.cos(perpAngle) * 7;
      const p2Y = originY + Math.sin(perpAngle) * 7;
      const p3X = targetX + Math.cos(perpAngle) * (endWidth / 2);
      const p3Y = targetY + Math.sin(perpAngle) * (endWidth / 2);
      const p4X = targetX - Math.cos(perpAngle) * (endWidth / 2);
      const p4Y = targetY - Math.sin(perpAngle) * (endWidth / 2);

      const alphaBase = beatEngine.isBassActive ? (0.24 + beatEngine.bassLevel * 0.28) : 0.14;

      lightsGfx.poly([p1X, p1Y, p2X, p2Y, p3X, p3Y, p4X, p4Y], true)
        .fill({ color: colorHex, alpha: alphaBase });

      // Floor Spotlight Pool
      const floorY = Math.min(targetY, H - 40);
      if (floorY > H * 0.48) {
        const spotRx = 70 + beatEngine.bassLevel * 35;
        const spotRy = 24 + beatEngine.bassLevel * 12;
        lightsGfx.ellipse(targetX, floorY, spotRx, spotRy)
          .fill({ color: colorHex, alpha: alphaBase * 0.85 });
      }

      // Fixture housing on truss
      lightsGfx.circle(head.x, head.y + 10, 8).fill({ color: 0x111322 }).stroke({ color: 0x3a4460, width: 2 });
      lightsGfx.circle(head.x, head.y + 10, 5).fill({ color: colorHex });
    });

    // Liquid Sky Laser Fan Plane (Horizontal laser sheet above crowd)
    const fanColor = stageLighting.getCurrentColor(1);
    const fanAlpha = 0.10 + beatEngine.bassLevel * 0.22;
    lightsGfx.ellipse(W / 2, H * 0.47, W * 0.48, 16 + beatEngine.bassLevel * 12)
      .fill({ color: fanColor, alpha: fanAlpha });

    // Floating Atmospheric Haze Motes
    clubAtmosphereMotes.forEach(m => {
      m.y += m.vy * 0.016;
      m.x += Math.sin(now * 0.002) * 0.4;
      if (m.y < H * 0.12) {
        m.y = H * 0.88;
        m.x = Math.random() * W;
      }
      lightsGfx.circle(m.x, m.y, m.size).fill({ color: m.color, alpha: m.alpha * (0.35 + beatEngine.bassLevel * 0.55) });
    });
  }

  // 5. Stage Pyrotechnics: Flames, CO2 Cryo Geysers, Fireworks & Confetti
  function drawParticlesPixi(dt) {
    particlesGfx.clear();

    // Flames
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
      particlesGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha });
    }

    // CO2 Cryo Geysers
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
      particlesGfx.circle(p.x, p.y, p.radius).fill({ color: p.color, alpha: p.alpha * 0.75 });
    }

    // Fireworks & Confetti
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
      if (p.isConfetti) {
        particlesGfx.rect(p.x, p.y, p.size, p.size / 2).fill({ color: p.color, alpha: p.alpha });
      } else {
        particlesGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha });
      }
    }
  }

  // Particle Emitters
  function triggerFlame() {
    if (window.sfx) window.sfx.playBassDrop();
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
          color: Math.random() > 0.35 ? 0xff3b00 : 0xffe600,
          alpha: 1,
          decay: 0.022 + Math.random() * 0.018
        });
      }
    }
  }

  function triggerSmoke() {
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
          vy: -Math.cos(spreadAngle) * speed,
          radius: 28 + Math.random() * 32,
          growth: 2.2,
          alpha: 0.85,
          decay: 0.011 + Math.random() * 0.007,
          color: Math.random() > 0.35 ? 0xe6f8ff : 0x00f0ff
        });
      }
    }
  }

  function triggerFireworks() {
    if (window.sfx) window.sfx.playFireworks();
    for (let b = 0; b < 3; b++) {
      const cx = 200 + Math.random() * 680;
      const cy = 250 + Math.random() * 400;
      const colors = [0xff007f, 0x00f0ff, 0xffe600, 0x00ff66, 0xb000ff];
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
    const colors = [0xff007f, 0x00f0ff, 0xffe600, 0x00ff66, 0xffffff];
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
        gravity: 0.1,
        isConfetti: true
      });
    }
  }

  function triggerRave() {
    triggerFlame();
    triggerSmoke();
    triggerFireworks();
    if (window.sfx) {
      try { window.sfx.playAirhorn(); } catch (e) {}
    }
    const strobe = document.getElementById('strobe-fx');
    if (strobe) {
      strobe.classList.remove('active');
      void strobe.offsetWidth;
      strobe.classList.add('active');
    }
  }

  // VIP Podiums & Dancers Synchronizer
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

    // 2. Ensure Top 1, 2, 3 podiums are always occupied by the top dancers!
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

    // 3. Anchor VIPs to podium coordinates and keep regular crowd clear of podiums
    dancers.forEach(d => {
      if (d.vipRank === 1) {
        d.targetX = 0.50;
        // Platform is at H * 0.54. Standing cleanly on top surface, plaque fully visible!
        d.targetY = 0.465;
        if (!d.vipPositioned) { d.x = d.targetX; d.y = d.targetY; d.vipPositioned = true; }
      } else if (d.vipRank === 2) {
        d.targetX = 0.24;
        d.targetY = 0.525; // Platform is at H * 0.59
        if (!d.vipPositioned) { d.x = d.targetX; d.y = d.targetY; d.vipPositioned = true; }
      } else if (d.vipRank === 3) {
        d.targetX = 0.76;
        d.targetY = 0.525; // Platform is at H * 0.59
        if (!d.vipPositioned) { d.x = d.targetX; d.y = d.targetY; d.vipPositioned = true; }
      } else {
        // Regular crowd: dance on lower floor (y >= 0.67), completely clear of VIP podiums!
        if (d.targetY < 0.66) {
          const charCode = (d.id || d.username || 'user').charCodeAt(0);
          d.targetY = 0.68 + (charCode % 15) * 0.018;
          if (!d.crowdPositioned) { d.x = d.targetX; d.y = d.targetY; d.crowdPositioned = true; }
        }
      }
    });
  }

  // ===========================================================================
  // PIXIJS MAIN RENDER LOOP (TICKER)
  // ===========================================================================
  let lastTime = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (++checkAudioFrame % 45 === 0) {
      checkAudioUnlocked();
    }

    // 1. Audio Beat Engine Update
    beatEngine.update(now, dt);

    // 2. Render Stage Background & LED Wall
    drawStageBackdropPixi(now);

    // 3. Render DJ Stage, Mixer & DJ Character
    drawDJStagePixi(now);

    // 4. Render 2.5D Dance Floor & VIP Podiums
    drawDanceFloorPixi(now);

    // 5. Render 6 Moving Heads & Laser Atmosphere
    drawLightsPixi(now);

    // 6. Synchronize VIP Podiums & Dancers Ranks
    syncVIPRanksAndPodiums();

    // 7. Update & Depth-sort Dancers (Sorted by screen Y for true 2.5D depth!)
    dancers.forEach(d => {
      d.update(dt, beatEngine, now);
    });
    dancersLayer.children.sort((a, b) => a.y - b.y);

    // 8. Render Particles (Flames, CO2 Smoke, Fireworks, Confetti)
    drawParticlesPixi(dt);
  });

  // ===========================================================================
  // WEBSOCKET CLIENT FOR LIVE STREAM SYNC
  // ===========================================================================
  function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log('✅ WebSocket connected to DJ Club server!');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch (err) {
        console.error('WS Parse error:', err);
      }
    };

    ws.onclose = () => setTimeout(setupWebSocket, 2000);
  }

  function handleWsMessage(msg) {
    const data = msg.data || {};
    switch (msg.type) {
      case 'init':
      case 'init_state':
        playlist = data.playlist || [];
        if (data.topGiftersList) updateTopGiftersUI(data.topGiftersList);
        if (data.dancers) {
          dancers.forEach(d => d.destroy());
          dancers = Object.values(data.dancers).map(d => new PixiDancer(d));
          window.__DJ_DANCERS__ = dancers;
          const crowdCountEl = document.getElementById('crowd-count');
          if (crowdCountEl) crowdCountEl.textContent = dancers.length;
        }
        if (data.currentTrack) playTrack(data.currentTrack);
        if (data.settings && data.settings.audioMode) {
          currentAudioMode = data.settings.audioMode;
          if (window.BarAudioEffects) window.BarAudioEffects.setMode(currentAudioMode, 0.05);
          updateAudioModeUI(currentAudioMode);
        }
        break;

      case 'add_dancer':
      case 'dancer_update':
        const existing = dancers.find(d => d.id === data.id || d.username === data.username);
        if (!existing) {
          dancers.push(new PixiDancer(data));
        } else {
          existing.nickname = data.nickname || existing.nickname;
          if (data.score !== undefined) existing.score = data.score;
          if (data.charCategory) existing.charCategory = data.charCategory;
          if (data.gender) existing.gender = data.gender;
          if (data.charType) existing.charType = data.charType;
          if (data.danceStyle) existing.danceStyle = data.danceStyle;
          existing.isJumping = true;
          setTimeout(() => { if (existing) existing.isJumping = false; }, 1500);
        }
        const crowdEl = document.getElementById('crowd-count');
        if (crowEl) crowdEl.textContent = dancers.length;
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
              dancers.push(new PixiDancer(dData));
            }
          });
          const crowdSyncEl = document.getElementById('crowd-count');
          if (crowdSyncEl) crowdSyncEl.textContent = dancers.length;
        }
        break;

      case 'dancers_cleared':
        dancers.forEach(d => d.destroy());
        dancers = [];
        window.__DJ_DANCERS__ = dancers;
        const crowdClearEl = document.getElementById('crowd-count');
        if (crowdClearEl) crowdClearEl.textContent = 0;
        break;

      case 'remove_dancer':
        const rIdx = dancers.findIndex(d => d.id === data.id || d.username === data.username);
        if (rIdx !== -1) {
          dancers[rIdx].destroy();
          dancers.splice(rIdx, 1);
          const crowdRemEl = document.getElementById('crowd-count');
          if (crowdRemEl) crowdRemEl.textContent = dancers.length;
        }
        break;

      case 'track_change':
        if (data.track) playTrack(data.track);
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
        if (window.sfx) window.sfx.playGiftChime();
        if (data.fxType === 'mega_rave') triggerRave();
        else if (data.fxType === 'fireworks') triggerFireworks();
        else if (data.fxType === 'flame') triggerFlame();
        else if (data.fxType === 'smoke') triggerSmoke();
        else if (data.fxType === 'confetti') triggerConfetti();
        else triggerFireworks();

        const gifter = dancers.find(d => d.username === data.username || d.nickname === data.nickname);
        if (gifter) {
          gifter.isJumping = true;
          setTimeout(() => { if (gifter) gifter.isJumping = false; }, 3500);
        }
        break;

      case 'top_gifters':
        updateTopGiftersUI(data);
        break;

      case 'effect':
      case 'trigger_effect':
        if (data.effect === 'flame') triggerFlame();
        else if (data.effect === 'smoke') triggerSmoke();
        else if (data.effect === 'fireworks') triggerFireworks();
        else if (data.effect === 'rave') triggerRave();
        else if (data.effect === 'confetti') triggerConfetti();
        else if (data.effect === 'airhorn' && window.sfx) window.sfx.playAirhorn();
        else if (data.effect === 'scratch' && window.sfx) window.sfx.playScratch();
        else if (data.effect === 'siren' && window.sfx) window.sfx.playSiren();
        break;

      case 'like':
        const likesCountEl = document.getElementById('likes-count');
        if (likesCountEl) likesCountEl.textContent = data.totalLikes || (parseInt(likesCountEl.textContent) + 1);
        break;

      case 'audio_mode':
      case 'audio_mode_changed':
        if (data && data.mode) {
          currentAudioMode = data.mode;
          if (window.BarAudioEffects) window.BarAudioEffects.setMode(currentAudioMode, 0.35);
          updateAudioModeUI(currentAudioMode);
        }
        break;
    }
  }

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
        item.innerHTML = `<span class="vip-rank">${medals[i]}</span><span class="vip-name">${g.nickname || g.username}</span><span class="vip-coins">${g.coins}💎</span>`;
      } else {
        item.innerHTML = `<span class="vip-rank">${medals[i]}</span><span class="vip-name" style="color: #666;">Chờ đại gia...</span><span class="vip-coins">-</span>`;
      }
      listEl.appendChild(item);
    }
  }

  // Load Textures and Initial Status
  await loadAllTextures();

  try {
    const statusData = await fetch('/api/status').then(r => r.json());
    if (statusData) {
      playlist = statusData.playlist || [];
      if (statusData.currentTrack && !currentTrack) {
        updateTrackUI(statusData.currentTrack);
        playTrack(statusData.currentTrack);
      }
      if (statusData.topGiftersList) {
        updateTopGiftersUI(statusData.topGiftersList);
      }
      if (statusData.dancers && dancers.length === 0) {
        dancers = Object.values(statusData.dancers).map(d => new PixiDancer(d));
        window.__DJ_DANCERS__ = dancers;
        const crowdCountEl = document.getElementById('crowd-count');
        if (crowdCountEl) crowdCountEl.textContent = dancers.length;
      }
    }
  } catch (err) {
    console.warn('REST status load error:', err);
  }

  setupWebSocket();

  console.log('🎉 Sanoo Club PixiJS Engine Fully Active and Running at 60 FPS!');
})();
