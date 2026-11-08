// ============================================================================
// SANOO CLUB - AI MC & TTS REALISTIC STAGE MICROPHONE ENGINE
// ============================================================================
// Features:
// 1. Realistic Wireless / Stage Mic SFX:
//    - Mic-on key click & sub capsule thump (procedural Web Audio impulse)
//    - Audio Ducking: Smoothly dips background music by ~75% during speech
//    - Stage Vocal DSP: 180Hz Highpass, 3.2kHz Peaking (+4.5dB presence), 7.6kHz Lowpass
//    - Club Stage Echo / Delay (170ms delay with gentle feedback for authentic venue space)
//    - Mic-off release click, smooth background music restoration
// 2. Intelligent Gift Celebration:
//    - Instant speech on gifts with smart debounce / repeat count aggregation
//    - Natural diverse Vietnamese thank-you phrases
//    - Special hype announcements for high-tier / VIP gifts
// 3. Top 3 VIP Podium Announcements:
//    - Automatic detection when a user climbs onto Top 1, Top 2, or Top 3
//    - Formal MC recognition ("Chiếm lĩnh Top 1 bục vàng đại gia...")
// 4. Periodic Random MC Hype Shouts:
//    - Every 2.5 to 4 minutes during idle periods
//    - Crowd engagement: call to type 1, send hearts, cheer up the dancers
// 5. Dialect & Voice Engine Flexibility:
//    - Supports Google TTS / Server Audio with Web Audio DSP
//    - Fallback / Alternative: Browser SpeechSynthesis (supports Northern / Southern voices)
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TTSMCManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class TTSMCManager {
    constructor() {
      this.ctx = null;
      this.audioElement = null;
      this.enabled = true;
      this.volume = 0.95;
      this.voiceAccent = 'north'; // 'north' (miền Bắc) | 'south' (miền Nam)
      this.engine = 'auto'; // 'auto' (server endpoint + Web Audio DSP) | 'speech_synthesis'

      this.isDucking = false;
      this.baseMusicVolume = 0.8;
      this.duckingRatio = 0.22; // Duck music down to 22% of its base level

      this.queue = [];
      this.isPlaying = false;
      this.lastSpeechTime = Date.now();

      // Top 3 Tracking
      this.lastTop3Usernames = [null, null, null];
      this.isInitialTopLoad = true;

      // Smart Gift Aggregation: username -> { nickname, giftName, count, diamondCount, fxType, timer }
      this.giftBuffer = new Map();

      // Audio DSP Nodes
      this.micHighpass = null;
      this.micPresence = null;
      this.micLowpass = null;
      this.delayNode = null;
      this.delayFeedback = null;
      this.wetGain = null;
      this.dryGain = null;
      this.masterVocalGain = null;

      // Periodic MC Hype timer
      this.hypeIntervalTimer = null;
      this.startPeriodicHypeTimer();
    }

    init(audioCtx, audioElement) {
      if (audioCtx) this.ctx = audioCtx;
      if (audioElement) this.audioElement = audioElement;

      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          try { this.ctx = new AudioContext(); } catch (e) {}
        }
      }

      this._setupAudioDSP();
    }

    _setupAudioDSP() {
      if (!this.ctx) return;
      try {
        // 1. Stage Vocal Equalizer (Microphone Modeling)
        // Highpass at 180Hz cuts boominess / mechanical thumps
        this.micHighpass = this.ctx.createBiquadFilter();
        this.micHighpass.type = 'highpass';
        this.micHighpass.frequency.value = 180;
        this.micHighpass.Q.value = 0.8;

        // Peaking at 3200Hz (+4.5dB) gives the Shure SM58 / wireless mic vocal clarity & punch
        this.micPresence = this.ctx.createBiquadFilter();
        this.micPresence.type = 'peaking';
        this.micPresence.frequency.value = 3200;
        this.micPresence.gain.value = 4.5;
        this.micPresence.Q.value = 1.4;

        // Lowpass at 7600Hz smooths out digital harshness
        this.micLowpass = this.ctx.createBiquadFilter();
        this.micLowpass.type = 'lowpass';
        this.micLowpass.frequency.value = 7600;
        this.micLowpass.Q.value = 0.9;

        // 2. Club Delay / Stage Echo
        this.delayNode = this.ctx.createDelay(1.0);
        this.delayNode.delayTime.value = 0.17; // 170ms venue reflection

        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.22; // subtle echo decay

        this.wetGain = this.ctx.createGain();
        this.wetGain.gain.value = 0.18; // 18% wet echo

        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 0.88;

        this.masterVocalGain = this.ctx.createGain();
        this.masterVocalGain.gain.value = this.volume;

        // Routing:
        // Input -> micHighpass -> micPresence -> micLowpass
        this.micHighpass.connect(this.micPresence);
        this.micPresence.connect(this.micLowpass);

        // micLowpass -> dryGain -> masterVocalGain
        this.micLowpass.connect(this.dryGain);
        this.dryGain.connect(this.masterVocalGain);

        // micLowpass -> delayNode -> wetGain -> masterVocalGain
        // delayNode -> delayFeedback -> delayNode (feedback loop)
        this.micLowpass.connect(this.delayNode);
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);
        this.delayNode.connect(this.wetGain);
        this.wetGain.connect(this.masterVocalGain);

        this.masterVocalGain.connect(this.ctx.destination);
      } catch (err) {
        console.warn('TTS DSP Setup warning:', err);
      }
    }

    // ==========================================================================
    // PROCEDURAL REALISTIC MICROPHONE SFX
    // ==========================================================================
    playMicClick(isOn = true) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      try {
        const now = this.ctx.currentTime;

        // 1. Mechanical switch contact click (12ms bandpass noise pulse)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isOn ? 1250 : 850, now);
        osc.frequency.exponentialRampToValueAtTime(isOn ? 420 : 280, now + 0.016);

        filter.type = 'bandpass';
        filter.frequency.value = 1700;
        filter.Q.value = 3.5;

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.07, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.022);

        // 2. Sub capsule thump (wireless mic un-mute impact)
        if (isOn) {
          const thump = this.ctx.createOscillator();
          const thumpGain = this.ctx.createGain();
          thump.type = 'sine';
          thump.frequency.setValueAtTime(115, now);
          thump.frequency.exponentialRampToValueAtTime(42, now + 0.028);

          thumpGain.gain.setValueAtTime(0.09, now);
          thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

          thump.connect(thumpGain);
          thumpGain.connect(this.ctx.destination);

          thump.start(now);
          thump.stop(now + 0.035);
        }
      } catch (e) {}
    }

    // ==========================================================================
    // AUDIO DUCKING (Smoothly drops background music when MC speaks)
    // ==========================================================================
    startDucking() {
      if (!this.audioElement || this.isDucking) return;
      this.isDucking = true;
      this.baseMusicVolume = this.audioElement.volume > 0.1 ? this.audioElement.volume : 0.8;
      const targetVol = Math.max(0.12, this.baseMusicVolume * this.duckingRatio);

      const startTime = performance.now();
      const startVol = this.audioElement.volume;
      const duration = 220; // 220ms smooth dip

      const duckTimer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        if (this.audioElement) {
          this.audioElement.volume = startVol + (targetVol - startVol) * progress;
        }
        if (progress >= 1) clearInterval(duckTimer);
      }, 20);
    }

    stopDucking() {
      if (!this.audioElement || !this.isDucking) return;
      this.isDucking = false;
      const targetVol = this.baseMusicVolume;
      const startVol = this.audioElement.volume;
      const startTime = performance.now();
      const duration = 550; // 550ms gentle restore

      const restoreTimer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        if (this.audioElement) {
          this.audioElement.volume = startVol + (targetVol - startVol) * progress;
        }
        if (progress >= 1) clearInterval(restoreTimer);
      }, 25);
    }

    // ==========================================================================
    // CORE SPEECH QUEUE & PLAYBACK
    // ==========================================================================
    speak(text, priority = false) {
      if (!this.enabled || !text) return;
      text = text.trim();
      if (!text) return;

      if (priority) {
        this.queue.unshift(text);
      } else {
        this.queue.push(text);
      }

      // Keep queue manageable (max 3 pending messages)
      if (this.queue.length > 3) {
        this.queue.splice(1, this.queue.length - 3);
      }

      if (!this.isPlaying) {
        this._processNextInQueue();
      }
    }

    async _processNextInQueue() {
      if (this.queue.length === 0) {
        this.isPlaying = false;
        return;
      }

      this.isPlaying = true;
      const text = this.queue.shift();
      this.lastSpeechTime = Date.now();

      // 1. Play mic-on click & begin audio ducking
      this.playMicClick(true);
      this.startDucking();

      // Small pause (150ms) for realistic mic keying before vocal starts
      await new Promise(r => setTimeout(r, 150));

      // 2. Play speech using Web Audio DSP (/api/tts) or Web Speech API fallback
      let success = false;
      if (this.engine !== 'speech_synthesis') {
        success = await this._playServerAudioDSP(text);
      }

      if (!success) {
        await this._playWebSpeech(text);
      }

      // 3. Play mic-off click & restore music volume
      this.playMicClick(false);
      this.lastSpeechTime = Date.now();

      // 120ms pause after speaking before restoring music
      await new Promise(r => setTimeout(r, 120));
      this.stopDucking();

      // Inter-speech buffer (300ms) before next speech in queue
      await new Promise(r => setTimeout(r, 300));
      this._processNextInQueue();
    }

    // Play TTS via /api/tts decoded directly into Web Audio DSP Graph
    async _playServerAudioDSP(text) {
      if (!this.ctx) return false;
      try {
        if (this.ctx.state === 'suspended') {
          await this.ctx.resume();
        }

        const encoded = encodeURIComponent(text);
        const res = await fetch(`/api/tts?text=${encoded}`);
        if (!res.ok) throw new Error('TTS server status ' + res.status);

        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

        return new Promise((resolve) => {
          const source = this.ctx.createBufferSource();
          source.buffer = audioBuffer;

          // Connect into our stage microphone DSP equalizer & club delay
          if (this.micHighpass) {
            source.connect(this.micHighpass);
          } else {
            source.connect(this.ctx.destination);
          }

          source.onended = () => resolve(true);
          source.start();
        });
      } catch (err) {
        console.warn('Server TTS DSP failed, falling back to Web Speech API:', err.message);
        return false;
      }
    }

    // Fallback: Browser Web Speech API
    _playWebSpeech(text) {
      return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
          resolve(false);
          return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.volume = this.volume;

        // Adjust rate and pitch for lively MC delivery
        utterance.rate = 1.08;
        utterance.pitch = this.voiceAccent === 'south' ? 1.05 : 1.0;

        // Try to find the best Vietnamese voice (HoaiMy, NamMinh, An, or Google)
        const voices = window.speechSynthesis.getVoices();
        const viVoices = voices.filter(v => v.lang.includes('vi') || v.lang.includes('VI'));
        if (viVoices.length > 0) {
          if (this.voiceAccent === 'north') {
            const northVoice = viVoices.find(v => v.name.includes('HoaiMy') || v.name.includes('NamMinh') || v.name.includes('An'));
            utterance.voice = northVoice || viVoices[0];
          } else {
            const southVoice = viVoices.find(v => !v.name.includes('HoaiMy') && !v.name.includes('NamMinh'));
            utterance.voice = southVoice || viVoices[0];
          }
        }

        utterance.onend = () => resolve(true);
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis error:', e);
          resolve(false);
        };

        window.speechSynthesis.speak(utterance);
      });
    }

    // ==========================================================================
    // 1. SMART GIFT CELEBRATION (Aggregates multiple gifts within 1.2s)
    // ==========================================================================
    onGift(data) {
      if (!this.enabled || !data) return;

      const userKey = data.username || data.nickname || 'guest';
      const nickname = data.nickname || data.username || 'Bạn';
      const giftName = data.giftName || 'quà';
      const repeatCount = data.repeatCount || 1;
      const diamondCount = data.diamondCount || 0;
      const fxType = data.fxType || 'sparkles';

      // Check if this user recently sent a gift (within 1.2s)
      if (this.giftBuffer.has(userKey)) {
        const buffered = this.giftBuffer.get(userKey);
        clearTimeout(buffered.timer);
        buffered.count += repeatCount;
        buffered.diamondCount += diamondCount;
        buffered.timer = setTimeout(() => this._flushBufferedGift(userKey), 1200);
      } else {
        const entry = {
          nickname,
          giftName,
          count: repeatCount,
          diamondCount,
          fxType,
          timer: setTimeout(() => this._flushBufferedGift(userKey), 1200)
        };
        this.giftBuffer.set(userKey, entry);
      }
    }

    _flushBufferedGift(userKey) {
      const entry = this.giftBuffer.get(userKey);
      if (!entry) return;
      this.giftBuffer.delete(userKey);

      const { nickname, giftName, count, diamondCount, fxType } = entry;
      let sentence = '';

      // High-tier VIP gift announcement
      if (diamondCount >= 80 || fxType === 'mega_rave' || fxType === 'flame') {
        const vipPhrases = [
          `Úi xời cảm ơn đại gia ${nickname} đã nổ món quà ${giftName} cực khủng! Quẩy lên nào anh em ơi!`,
          `Đẳng cấp đại gia! Cảm ơn ${nickname} đã gửi tặng ${giftName} bùng nổ sàn diễn!`,
          `Cháy quá anh em ơi! Cảm ơn đại gia ${nickname} với món quà ${giftName} siêu hoành tráng!`
        ];
        sentence = vipPhrases[Math.floor(Math.random() * vipPhrases.length)];
        this.speak(sentence, true); // VIP gifts get priority
        return;
      }

      // Combo gifts (count > 1)
      if (count > 1) {
        const comboPhrases = [
          `Cảm ơn ${nickname} đã tặng liền ${count} ${giftName}! Đỉnh quá anh em ơi!`,
          `Cảm ơn ${nickname} đã gửi tặng combo ${count} ${giftName}! Quẩy hết mình nhé!`,
          `Tuyệt vời! Cảm ơn ${nickname} đã ủng hộ ${count} ${giftName} cho sàn nhảy!`
        ];
        sentence = comboPhrases[Math.floor(Math.random() * comboPhrases.length)];
      } else {
        // Single gift
        const singlePhrases = [
          `Cảm ơn ${nickname} đã gửi tặng ${giftName}, quẩy lên nào anh em ơi!`,
          `Cảm ơn ${nickname} với món quà ${giftName} cực xinh!`,
          `Cảm ơn bạn ${nickname} đã ủng hộ ${giftName}, chúc bạn một đêm quẩy thật vui!`,
          `Cảm ơn ${nickname} đã tiếp lửa cho sàn nhảy bằng ${giftName} nhé!`
        ];
        sentence = singlePhrases[Math.floor(Math.random() * singlePhrases.length)];
      }

      this.speak(sentence, false);
    }

    // ==========================================================================
    // 2. TOP 3 VIP PODIUM ANNOUNCEMENTS (Triggered when ranking changes)
    // ==========================================================================
    onTopGiftersUpdate(topGifters) {
      if (!this.enabled || !Array.isArray(topGifters) || topGifters.length === 0) return;

      // Extract current Top 3 usernames
      const curTop1 = topGifters[0];
      const curTop2 = topGifters[1];
      const curTop3 = topGifters[2];

      const u1 = curTop1 && curTop1.coins > 0 ? (curTop1.username || curTop1.nickname) : null;
      const u2 = curTop2 && curTop2.coins > 0 ? (curTop2.username || curTop2.nickname) : null;
      const u3 = curTop3 && curTop3.coins > 0 ? (curTop3.username || curTop3.nickname) : null;

      // If initial state load, just record usernames without speaking
      if (this.isInitialTopLoad) {
        this.isInitialTopLoad = false;
        this.lastTop3Usernames = [u1, u2, u3];
        return;
      }

      // Check for Rank 1 change
      if (u1 && u1 !== this.lastTop3Usernames[0]) {
        const name = curTop1.nickname || curTop1.username;
        const rank1Phrases = [
          `Chúc mừng đại gia ${name} đã chính thức chiếm lĩnh Top 1 bục vàng đại gia!`,
          `Đẳng cấp đại gia! ${name} đã vươn lên vị trí dẫn đầu bảng vàng Sanoo Club!`
        ];
        const text = rank1Phrases[Math.floor(Math.random() * rank1Phrases.length)];
        this.speak(text, true);
      }
      // Check for Rank 2 change
      else if (u2 && u2 !== this.lastTop3Usernames[1] && u2 !== this.lastTop3Usernames[0]) {
        const name = curTop2.nickname || curTop2.username;
        const text = `Chúc mừng ${name} đã xuất sắc vươn lên vị trí Top 2 đại gia!`;
        this.speak(text, true);
      }
      // Check for Rank 3 change
      else if (u3 && u3 !== this.lastTop3Usernames[2] && u3 !== this.lastTop3Usernames[0] && u3 !== this.lastTop3Usernames[1]) {
        const name = curTop3.nickname || curTop3.username;
        const text = `Chúc mừng ${name} đã bước lên Top 3 bục vinh quang!`;
        this.speak(text, true);
      }

      this.lastTop3Usernames = [u1, u2, u3];
    }

    // ==========================================================================
    // 3. PERIODIC RANDOM MC HYPE SHOUTS (Every 2.5 - 4 minutes during idle)
    // ==========================================================================
    startPeriodicHypeTimer() {
      if (this.hypeIntervalTimer) clearInterval(this.hypeIntervalTimer);

      // Check every 30 seconds if it's time for an MC hype shout
      this.hypeIntervalTimer = setInterval(() => {
        if (!this.enabled) return;

        const idleTime = Date.now() - this.lastSpeechTime;
        // If idle for over 150 seconds (2.5 mins) and queue is empty, trigger a random hype phrase
        if (idleTime >= 150000 && this.queue.length === 0 && !this.isPlaying) {
          this.triggerRandomHype();
        }
      }, 30000);
    }

    triggerRandomHype() {
      const hypePhrases = [
        "Chào mừng tất cả anh em đang có mặt tại phòng kính Sanoo Club! Cho DJ xin một lượt thả tim để tăng nhiệt độ nào!",
        "Ai chưa có mặt trên sàn nhảy gõ 1 tham gia quẩy cùng hội mèo ngay nhé anh em ơi!",
        "Nhạc đang lên cực căng, anh em nâng ly quẩy hết mình đêm nay nào!",
        "Cảm ơn tất cả anh em đã ghé thăm Sanoo Club! Chúc cả nhà một buổi tối tràn đầy năng lượng và niềm vui!",
        "Tay đâu tay đâu anh em ơi! Thả tim nhiệt tình cho các vũ công và chú mèo quẩy đêm nay nào!",
        "Anh em nào muốn đổi style mèo gõ chấm than 1, chấm than 2 hoặc chấm than 3 nhé!",
        "Bass đang đập rung sàn, anh em sẵn sàng quẩy bung nóc cùng DJ Sanoo chưa nào!",
        "Anh em đi qua cho xin một lượt follow kênh để không bỏ lỡ những đêm nhạc bùng nổ tiếp theo nhé!",
        "Quẩy nhiệt tình lên anh em ơi, đêm nay không say không về!",
        "Âm thanh phòng kính nghe quá là ấm và phê luôn cả nhà ơi! Cùng nhún nhảy nào!"
      ];

      const randomPhrase = hypePhrases[Math.floor(Math.random() * hypePhrases.length)];
      this.speak(randomPhrase, false);
    }

    // Set voice accent: 'north' | 'south'
    setVoiceAccent(accent) {
      if (accent === 'north' || accent === 'south') {
        this.voiceAccent = accent;
      }
    }

    // Toggle enabled
    setEnabled(val) {
      this.enabled = !!val;
      if (!this.enabled) {
        this.queue = [];
        this.stopDucking();
      }
    }
  }

  return new TTSMCManager();
});
