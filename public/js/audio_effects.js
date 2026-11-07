// ============================================================================
// BAR & CLUB GLASS ROOM ACOUSTIC AUDIO ENGINE (Web Audio DSP)
// Simulates the authentic, immersive club acoustic atmosphere:
//   - 'glass_room': Phòng Kính Bar / VIP Glass Lounge
//                   (Bass trầm uỳnh uỳnh qua lớp kính, tiêu âm treble mềm mại,
//                    độ vang đanh nhẹ đặc trưng của phòng kính cách âm)
//   - 'main_floor': Sàn Nhảy Chính (Âm thanh trực diện, full dynamic studio EDM)
//   - 'outside_door': Ngoài Cửa Bar / Hành Lang (Âm bass uỳnh uỳnh cách âm sâu)
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BarAudioEffects = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let ctx = null;
  let source = null;
  let destination = null;
  let isInitialized = false;

  // DSP Nodes
  let inputGain = null;
  let dryGain = null;
  let muffGain = null;
  let wetGain = null;
  let masterGain = null;

  let lpf1 = null;      // Primary Glass Low-Pass Filter
  let lpf2 = null;      // Secondary High-Cut (4-pole 24dB/oct steep glass absorption)
  let bassBoost = null; // Sub-Bass Kick Punch (85Hz Resonance)
  let roomBody = null;  // Low-Mid Room Mode (240Hz Box Enclosure)
  let convolver = null; // Glass Room Acoustic Impulse Response

  let currentMode = 'glass_room'; // 'glass_room' | 'main_floor' | 'outside_door'

  // Synthesize realistic Glass Room Impulse Response (Fast early reflections + diffuse decay)
  function createGlassRoomImpulse(audioContext, duration = 1.5, decay = 2.6) {
    const sampleRate = audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * decay);
      const noiseL = (Math.random() * 2 - 1);
      const noiseR = (Math.random() * 2 - 1);

      // Discrete early glass reflections at 12ms, 25ms, 42ms, 65ms
      let earlyL = 0;
      let earlyR = 0;
      if (i === Math.floor(sampleRate * 0.012)) { earlyL = 0.55; earlyR = 0.22; }
      if (i === Math.floor(sampleRate * 0.025)) { earlyL = -0.42; earlyR = 0.48; }
      if (i === Math.floor(sampleRate * 0.042)) { earlyL = 0.32; earlyR = -0.36; }
      if (i === Math.floor(sampleRate * 0.065)) { earlyL = -0.25; earlyR = 0.25; }

      // Polished glass reflects higher frequencies with a slight shimmer
      left[i] = (noiseL * env * 0.8 + earlyL) * 0.5;
      right[i] = (noiseR * env * 0.8 + earlyR) * 0.5;
    }
    return impulse;
  }

  function init(audioCtx, sourceNode, destNode) {
    if (isInitialized && ctx === audioCtx) return;
    ctx = audioCtx;
    source = sourceNode;
    destination = destNode || ctx.destination;

    try {
      // 1. Gain stages
      inputGain = ctx.createGain();
      dryGain = ctx.createGain();
      muffGain = ctx.createGain();
      wetGain = ctx.createGain();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1.0;

      // 2. Dual Low-Pass Filter (Steep 24dB/oct cutoff)
      lpf1 = ctx.createBiquadFilter();
      lpf1.type = 'lowpass';
      lpf1.frequency.value = 750;
      lpf1.Q.value = 2.2;

      lpf2 = ctx.createBiquadFilter();
      lpf2.type = 'lowpass';
      lpf2.frequency.value = 1200;
      lpf2.Q.value = 1.0;

      // 3. Sub-Bass & Room Mode Resonators
      bassBoost = ctx.createBiquadFilter();
      bassBoost.type = 'peaking';
      bassBoost.frequency.value = 85;
      bassBoost.Q.value = 1.2;
      bassBoost.gain.value = 4.8; // Punchy sub-bass through glass

      roomBody = ctx.createBiquadFilter();
      roomBody.type = 'peaking';
      roomBody.frequency.value = 240;
      roomBody.Q.value = 2.5;
      roomBody.gain.value = 2.2;

      // 4. Glass Convolver Reverb
      convolver = ctx.createConvolver();
      convolver.buffer = createGlassRoomImpulse(ctx, 1.4, 2.5);

      // Connect DSP Graph
      // Split input:
      source.connect(inputGain);

      // Path A: Dry Direct Sound
      inputGain.connect(dryGain);
      dryGain.connect(masterGain);

      // Path B: Filtered Glass Sound Chain
      inputGain.connect(lpf1);
      lpf1.connect(lpf2);
      lpf2.connect(bassBoost);
      bassBoost.connect(roomBody);

      // Muffled direct output
      roomBody.connect(muffGain);
      muffGain.connect(masterGain);

      // Glass Reverb output
      roomBody.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(masterGain);

      // Output to destination
      masterGain.connect(destination);

      isInitialized = true;
      console.log('[BarAudioEffects] Glass Room Bar Acoustic Processor initialized successfully!');

      // Apply initial mode
      applyMode(currentMode, 0.05);
    } catch (err) {
      console.error('[BarAudioEffects] Error initializing audio DSP graph:', err);
    }
  }

  function applyMode(mode, rampDuration = 0.35) {
    currentMode = mode;
    if (!isInitialized || !ctx) return;

    const now = ctx.currentTime;
    const rampEnd = now + rampDuration;

    if (mode === 'glass_room') {
      // 🍸 PHÒNG KÍNH BAR / VIP GLASS LOUNGE:
      // Tiếng bass sub uỳnh uỳnh qua kính, tiêu âm treble mềm mại, độ vang phòng kính
      lpf1.frequency.linearRampToValueAtTime(750, rampEnd);
      lpf1.Q.linearRampToValueAtTime(2.2, rampEnd);
      lpf2.frequency.linearRampToValueAtTime(1200, rampEnd);
      bassBoost.gain.linearRampToValueAtTime(4.8, rampEnd);

      dryGain.gain.linearRampToValueAtTime(0.06, rampEnd);  // 6% rò rỉ nhẹ qua kính
      muffGain.gain.linearRampToValueAtTime(0.90, rampEnd); // 90% âm thanh qua kính
      wetGain.gain.linearRampToValueAtTime(0.32, rampEnd);  // 32% độ vang phòng kính

    } else if (mode === 'outside_door') {
      // 🚪 NGOÀI CỬA BAR / HÀNH LANG CÁCH ÂM:
      // Âm bass trầm đập uỳnh uỳnh từ xa, tiêu âm sâu
      lpf1.frequency.linearRampToValueAtTime(420, rampEnd);
      lpf1.Q.linearRampToValueAtTime(2.5, rampEnd);
      lpf2.frequency.linearRampToValueAtTime(650, rampEnd);
      bassBoost.gain.linearRampToValueAtTime(6.0, rampEnd);

      dryGain.gain.linearRampToValueAtTime(0.00, rampEnd);
      muffGain.gain.linearRampToValueAtTime(0.95, rampEnd);
      wetGain.gain.linearRampToValueAtTime(0.20, rampEnd);

    } else {
      // 🔊 SÀN NHẢY CHÍNH (MAIN DANCE FLOOR - DIRECT STUDIO SOUND):
      // Âm thanh studio trực diện căng đét, full dynamic
      dryGain.gain.linearRampToValueAtTime(1.00, rampEnd);
      muffGain.gain.linearRampToValueAtTime(0.00, rampEnd);
      wetGain.gain.linearRampToValueAtTime(0.00, rampEnd);
    }
  }

  function setMode(mode, rampDuration = 0.35) {
    applyMode(mode, rampDuration);
  }

  function toggleMode() {
    if (currentMode === 'glass_room') {
      setMode('main_floor');
    } else if (currentMode === 'main_floor') {
      setMode('outside_door');
    } else {
      setMode('glass_room');
    }
    return currentMode;
  }

  function getModeInfo(modeKey = currentMode) {
    const modes = {
      glass_room: {
        id: 'glass_room',
        name: 'Phòng Kính Bar (VIP Glass Room)',
        shortName: 'PHÒNG KÍNH BAR',
        icon: '🍸',
        desc: 'Âm bass uỳnh uỳnh qua lớp kính, tiêu âm treble mềm mại, độ vang phòng kín'
      },
      main_floor: {
        id: 'main_floor',
        name: 'Sàn Nhảy Sôi Động (Main Floor)',
        shortName: 'SÀN NHẢY CHÍNH',
        icon: '🔊',
        desc: 'Âm thanh trực diện căng đét, full dải tần studio EDM'
      },
      outside_door: {
        id: 'outside_door',
        name: 'Ngoài Cửa Bar (Outside Door)',
        shortName: 'NGOÀI CỬA BAR',
        icon: '🚪',
        desc: 'Âm bass trầm rung chuyển từ xa, tiêu âm cách âm sâu'
      }
    };
    return modes[modeKey] || modes.glass_room;
  }

  return {
    init,
    setMode,
    toggleMode,
    getCurrentMode: () => currentMode,
    getModeInfo
  };
});
