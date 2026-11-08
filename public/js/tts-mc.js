// ============================================================================
// SANOO CLUB - TRUE CLUB MC & DANCEFLOOR HYPENESS AUDIO ENGINE (REFINED)
// ============================================================================
// Optimized to protect music enjoyment (Nhạc là nhân vật chính, MC chỉ điểm xuyết):
// 1. Âm lượng vừa phải (Default volume 50%, không lấn át bài hát)
// 2. Không làm tụt nhạc (Ducking giữ 88% âm lượng nhạc, Bass kick đập liền mạch)
// 3. Câu từ siêu ngắn gọn (1.2s - 2.2s, gãy gọn, dứt khoát, không nói dài dòng)
// 4. Giãn cách định kỳ 4 - 5 phút (Lâu lâu mới thả 1 câu drop ngắn 1.5s)
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
      this.volume = 1.0; // Default 100% (Full master level, prominent and clearly audible above loud club music)
      this.style = 'female_hype'; // 'female_hype' (Quẩy sung) | 'male_deep' (Nam trầm gằn)
      this.playbackRate = 1.26; // 1.26x fast, snappy club tempo
      this.stingerEnabled = false; // Disable extra scratch by default to keep music clean

      this.isDucking = false;
      this.baseMusicVolume = 0.8;
      this.duckingRatio = 0.35; // Distinct ducking to 35% during speech so MC voice cuts right through loud EDM/Vinahouse!

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
      this.vocalCompressor = null;
      this.makeupGain = null;
      this.delayNode = null;
      this.delayFeedback = null;
      this.wetGain = null;
      this.dryGain = null;
      this.reverbConvolver = null;
      this.reverbGain = null;
      this.masterVocalGain = null;

      // Periodic MC Hype timer (Every 4 - 5 minutes, only when idle)
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
        // 1. Stage Vocal Equalizer (Microphone Modeling for Powerful Club Mix)
        // Highpass at 160Hz cleans sub-rumble while retaining full vocal chest and body
        this.micHighpass = this.ctx.createBiquadFilter();
        this.micHighpass.type = 'highpass';
        this.micHighpass.frequency.value = 160;
        this.micHighpass.Q.value = 0.7;

        // Presence boost at 3000Hz (+6.0dB) delivers sharp, crisp intelligibility through thick EDM bass
        this.micPresence = this.ctx.createBiquadFilter();
        this.micPresence.type = 'peaking';
        this.micPresence.frequency.value = 3000;
        this.micPresence.gain.value = 6.0;
        this.micPresence.Q.value = 1.2;

        // Lowpass at 9500Hz removes harsh sibilance while letting airy mic sheen breathe
        this.micLowpass = this.ctx.createBiquadFilter();
        this.micLowpass.type = 'lowpass';
        this.micLowpass.frequency.value = 9500;
        this.micLowpass.Q.value = 0.8;

        // 2. Broadcast-Grade Studio Vocal Compressor (Evens out speech dynamics and fattens the voice)
        this.vocalCompressor = this.ctx.createDynamicsCompressor();
        this.vocalCompressor.threshold.value = -22;
        this.vocalCompressor.knee.value = 10;
        this.vocalCompressor.ratio.value = 5.0;
        this.vocalCompressor.attack.value = 0.003;
        this.vocalCompressor.release.value = 0.12;

        // Makeup Gain: +4.1dB boost bringing voice up to standard master EDM commercial loudness
        this.makeupGain = this.ctx.createGain();
        this.makeupGain.gain.value = 1.6;

        // 3. Tempo-synced Club Triplet Delay (234ms @ 128 BPM Vinahouse)
        this.delayNode = this.ctx.createDelay(1.0);
        this.delayNode.delayTime.value = 0.234;

        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.28;

        this.wetGain = this.ctx.createGain();
        this.wetGain.gain.value = 0.24; // Lush concert echo

        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 1.0; // 100% direct voice

        // 4. Large Club Hall Reverb
        this.reverbConvolver = this.ctx.createConvolver();
        this.reverbConvolver.buffer = this._createClubHallImpulse(this.ctx, 1.2, 3.5);

        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.16;

        this.masterVocalGain = this.ctx.createGain();
        this.masterVocalGain.gain.value = this.volume;

        // Routing Chain:
        // Input -> micHighpass -> micPresence -> micLowpass -> vocalCompressor -> makeupGain
        this.micHighpass.connect(this.micPresence);
        this.micPresence.connect(this.micLowpass);
        this.micLowpass.connect(this.vocalCompressor);
        this.vocalCompressor.connect(this.makeupGain);

        // Dry Voice Path: makeupGain -> dryGain -> masterVocalGain
        this.makeupGain.connect(this.dryGain);
        this.dryGain.connect(this.masterVocalGain);

        // Delay Send: makeupGain -> delayNode -> wetGain -> masterVocalGain
        this.makeupGain.connect(this.delayNode);
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);
        this.delayNode.connect(this.wetGain);
        this.wetGain.connect(this.masterVocalGain);

        // Reverb Send: makeupGain -> reverbConvolver -> reverbGain -> masterVocalGain
        this.makeupGain.connect(this.reverbConvolver);
        this.reverbConvolver.connect(this.reverbGain);
        this.reverbGain.connect(this.masterVocalGain);

        this.masterVocalGain.connect(this.ctx.destination);
      } catch (err) {
        console.warn('Club TTS DSP Setup warning:', err);
      }
    }

    _createClubHallImpulse(audioContext, duration = 1.5, decay = 3.5) {
      const sampleRate = audioContext.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const impulse = audioContext.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * decay);
        left[i] = (Math.random() * 2 - 1) * env * 0.45;
        right[i] = (Math.random() * 2 - 1) * env * 0.45;
      }
      return impulse;
    }

    playMicClick(isOn = true) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isOn ? 1350 : 850, now);
        osc.frequency.exponentialRampToValueAtTime(isOn ? 480 : 260, now + 0.012);

        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 3.5;

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.014);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.016);
      } catch (e) {}
    }

    // ==========================================================================
    // AUDIO DUCKING (Gentle dip to 88% - keeps 100% music groove intact)
    // ==========================================================================
    startDucking() {
      if (!this.audioElement || this.isDucking) return;
      this.isDucking = true;
      this.baseMusicVolume = this.audioElement.volume > 0.1 ? this.audioElement.volume : 0.8;
      const targetVol = Math.max(0.15, this.baseMusicVolume * this.duckingRatio);

      const startTime = performance.now();
      const startVol = this.audioElement.volume;
      const duration = 90;

      const duckTimer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        if (this.audioElement) {
          this.audioElement.volume = startVol + (targetVol - startVol) * progress;
        }
        if (progress >= 1) clearInterval(duckTimer);
      }, 16);
    }

    stopDucking() {
      if (!this.audioElement || !this.isDucking) return;
      this.isDucking = false;
      const targetVol = this.baseMusicVolume;
      const startVol = this.audioElement.volume;
      const startTime = performance.now();
      const duration = 300;

      const restoreTimer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        if (this.audioElement) {
          this.audioElement.volume = startVol + (targetVol - startVol) * progress;
        }
        if (progress >= 1) clearInterval(restoreTimer);
      }, 20);
    }

    // ==========================================================================
    // CORE SPEECH QUEUE & PLAYBACK
    // ==========================================================================
    // Direct async speak that resolves strictly when audio playback finishes
    async speakDirectAsync(text) {
      if (!this.enabled || !text) return;
      text = text.trim();
      if (!text) return;

      this.isPlaying = true;
      this.lastSpeechTime = Date.now();

      this.playMicClick(true);
      this.startDucking();

      await new Promise(r => setTimeout(r, 60));

      let success = await this._playServerAudioDSP(text);
      if (!success) {
        await this._playWebSpeech(text);
      }

      this.playMicClick(false);
      this.lastSpeechTime = Date.now();

      await new Promise(r => setTimeout(r, 60));
      this.stopDucking();
      this.isPlaying = false;
    }

    // Tra ve cau cam on ngan gon theo gia tri qua (KHONG doc ten qua, dung chat MC club)
    getGiftThankYouSentence(nickname, diamondCount = 0, count = 1, fxType = 'sparkles') {
      const cleanNick = (nickname || 'bạn').trim();
      const totalCoins = Math.max(diamondCount * (count > 1 ? count : 1), diamondCount);

      // TANG 4: Sieu qua khung (>= 5,000 xu, vi du Du Thuyen 9,999 xu, Su Tu 29,999 xu...)
      if (totalCoins >= 5000) {
        const phrases = [
          `Bái phục đại gia ${cleanNick}! Đẳng cấp vũ trụ!`,
          `Chao đảo sàn nhảy! Cảm ơn trùm đại gia ${cleanNick}!`,
          `Đại địa chấn! Cảm ơn đại gia ${cleanNick} quá khủng!`,
          `Cả sàn nâng ly chúc mừng đại gia ${cleanNick}!`,
          `Quá khét đại gia ${cleanNick} ơi! Đỉnh của chóp!`
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
      }

      // TANG 3: Qua to / Dai gia (500 - 4,999 xu, vi du Sung Tien 500 xu, Vuong Mien, Thien Nga...)
      if (totalCoins >= 500 || fxType === 'mega_rave') {
        const phrases = [
          `Úi xời đại gia ${cleanNick}! Đẳng cấp quá sếp ơi!`,
          `Cháy sàn luôn! Cảm ơn đại gia ${cleanNick}!`,
          `Đẳng cấp đại gia! Cảm ơn sếp ${cleanNick}!`,
          `Khét mù sàn nhảy! Cảm ơn đại gia ${cleanNick}!`,
          `Cảm ơn đại gia ${cleanNick}, quẩy tung nóc nhà!`,
          `Quá đỉnh đại gia ${cleanNick} ơi! Lên là lên!`
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
      }

      // TANG 2: Qua vua / Qua xin (50 - 499 xu)
      if (totalCoins >= 50 || fxType === 'flame' || fxType === 'fireworks') {
        const phrases = [
          `Cảm ơn sếp ${cleanNick} quá đã!`,
          `Khét lẹt! Cảm ơn sếp ${cleanNick}!`,
          `Lên luôn! Cảm ơn ${cleanNick} nha!`,
          `Quá bốc! Cảm ơn ${cleanNick}!`,
          `Cảm ơn ${cleanNick}, quẩy hết nấc luôn!`,
          `Đỉnh chóp! Cảm ơn sếp ${cleanNick}!`,
          `Cảm ơn ${cleanNick}, quẩy cháy sàn nào!`
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
      }

      // COMBO Qua nho (Ban lien tiep nhieu lan):
      if (count > 2) {
        const phrases = [
          `Cảm ơn ${cleanNick} bắn tay quá đã!`,
          `1 2 3! Cảm ơn ${cleanNick} tiếp lửa đều tay!`,
          `Quá nhiệt tình! Cảm ơn ${cleanNick} nha!`
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
      }

      // TANG 1: Qua nho (< 50 xu, vi du Hoa hong 1 xu, Trai tim 5 xu...)
      // Sieu ngan gon (~1.0s), khong doc ten qua, khong lan at nhac san
      const smallPhrases = [
        `Cảm ơn ${cleanNick} nhé!`,
        `Cảm ơn ${cleanNick} nhiều nha!`,
        `Cảm ơn ${cleanNick} lên đồ!`,
        `Cảm ơn sếp ${cleanNick} nha!`,
        `Yeah! Cảm ơn ${cleanNick}!`,
        `Cảm ơn ${cleanNick}, quẩy lên nào!`,
        `Cảm ơn ${cleanNick} ủng hộ nha!`
      ];
      return smallPhrases[Math.floor(Math.random() * smallPhrases.length)];
    }

    // Formulates concise thank you sentence without gift name and speaks it in sequence
    async speakGiftAsync(gift) {
      if (!this.enabled || !gift) return;

      const nickname = gift.nickname || gift.username || 'Bạn';
      const count = gift.repeatCount || 1;
      const diamondCount = gift.diamondCount || 0;
      const fxType = gift.fxType || 'sparkles';

      const sentence = this.getGiftThankYouSentence(nickname, diamondCount, count, fxType);
      return this.speakDirectAsync(sentence);
    }

    speak(text, priority = false) {
      if (!this.enabled || !text) return;
      text = text.trim();
      if (!text) return;

      const item = { text };

      if (priority) {
        this.queue.unshift(item);
      } else {
        this.queue.push(item);
      }

      // Max 2 pending messages to prevent voice piling up
      if (this.queue.length > 2) {
        this.queue.splice(1, this.queue.length - 2);
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
      const item = this.queue.shift();
      const text = item.text;
      this.lastSpeechTime = Date.now();

      // Mic-on click & gentle ducking
      this.playMicClick(true);
      this.startDucking();

      await new Promise(r => setTimeout(r, 60));

      let success = await this._playServerAudioDSP(text);

      if (!success) {
        await this._playWebSpeech(text);
      }

      this.playMicClick(false);
      this.lastSpeechTime = Date.now();

      await new Promise(r => setTimeout(r, 60));
      this.stopDucking();

      await new Promise(r => setTimeout(r, 200));
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

          // FAST & CRISP CADENCE: 1.25x - 1.28x
          if (this.style === 'male_deep') {
            source.playbackRate.value = 1.16;
          } else {
            source.playbackRate.value = this.playbackRate || 1.26;
          }

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
        utterance.rate = 1.25;
        utterance.pitch = this.style === 'male_deep' ? 0.9 : 1.1;

        const voices = window.speechSynthesis.getVoices();
        const viVoices = voices.filter(v => v.lang.includes('vi') || v.lang.includes('VI'));
        if (viVoices.length > 0) {
          if (this.style === 'male_deep') {
            const maleVoice = viVoices.find(v => v.name.includes('NamMinh') || v.name.includes('An') || v.name.includes('Male'));
            utterance.voice = maleVoice || viVoices[0];
          } else {
            const femaleVoice = viVoices.find(v => v.name.includes('HoaiMy') || v.name.includes('Female') || v.name.includes('Google'));
            utterance.voice = femaleVoice || viVoices[0];
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
    // 1. SMART GIFT CELEBRATION (SUPER CONCISE & PUNCHY: 1.2s - 2.0s MAX)
    // ==========================================================================
    onGift(data) {
      if (!this.enabled || !data) return;

      const userKey = data.username || data.nickname || 'guest';
      const nickname = data.nickname || data.username || 'Bạn';
      const giftName = data.giftName || 'quà';
      const repeatCount = data.repeatCount || 1;
      const diamondCount = data.diamondCount || 0;
      const fxType = data.fxType || 'sparkles';

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

      const { nickname, count, diamondCount, fxType } = entry;
      const sentence = this.getGiftThankYouSentence(nickname, diamondCount, count, fxType);
      const totalCoins = Math.max(diamondCount * (count > 1 ? count : 1), diamondCount);
      const isPriority = totalCoins >= 500 || fxType === 'mega_rave';
      this.speak(sentence, isPriority);
    }

    // ==========================================================================
    // 2. TOP 3 VIP PODIUM ANNOUNCEMENTS (CONCISE: ~2.0s)
    // ==========================================================================
    onTopGiftersUpdate(topGifters) {
      if (!this.enabled) return;
      if (!Array.isArray(topGifters) || topGifters.length === 0) {
        this.lastTop3Usernames = [null, null, null];
        this.isInitialTopLoad = true;
        return;
      }

      const curTop1 = topGifters[0];
      const curTop2 = topGifters[1];
      const curTop3 = topGifters[2];

      const u1 = curTop1 && curTop1.coins > 0 ? (curTop1.username || curTop1.nickname) : null;
      const u2 = curTop2 && curTop2.coins > 0 ? (curTop2.username || curTop2.nickname) : null;
      const u3 = curTop3 && curTop3.coins > 0 ? (curTop3.username || curTop3.nickname) : null;

      if (this.isInitialTopLoad) {
        this.isInitialTopLoad = false;
        this.lastTop3Usernames = [u1, u2, u3];
        return;
      }

      // Rank 1 change
      if (u1 && u1 !== this.lastTop3Usernames[0]) {
        const name = curTop1.nickname || curTop1.username;
        const rank1Phrases = [
          `Chúc mừng sếp ${name} lên đỉnh Top 1 bục vàng!`,
          `Đại ca ${name} soán ngôi Top 1 đại gia! Quá đỉnh!`
        ];
        const text = rank1Phrases[Math.floor(Math.random() * rank1Phrases.length)];
        this.speak(text, true);
      }
      // Rank 2 change
      else if (u2 && u2 !== this.lastTop3Usernames[1] && u2 !== this.lastTop3Usernames[0]) {
        const name = curTop2.nickname || curTop2.username;
        const text = `Chúc mừng ${name} lên Top 2 đại gia!`;
        this.speak(text, true);
      }
      // Rank 3 change
      else if (u3 && u3 !== this.lastTop3Usernames[2] && u3 !== this.lastTop3Usernames[0] && u3 !== this.lastTop3Usernames[1]) {
        const name = curTop3.nickname || curTop3.username;
        const text = `Chúc mừng ${name} bước vào Top 3!`;
        this.speak(text, true);
      }

      this.lastTop3Usernames = [u1, u2, u3];
    }

    // ==========================================================================
    // 3. PERIODIC RANDOM MC HYPE SHOUTS (SPARSE: Every 4 - 5 mins, ~1.5s drop)
    // ==========================================================================
    startPeriodicHypeTimer() {
      if (this.hypeIntervalTimer) clearInterval(this.hypeIntervalTimer);

      this.hypeIntervalTimer = setInterval(() => {
        if (!this.enabled) return;

        const idleTime = Date.now() - this.lastSpeechTime;
        // Only trigger every 240 seconds (4 minutes) when room is completely idle
        if (idleTime >= 240000 && this.queue.length === 0 && !this.isPlaying) {
          this.triggerRandomHype();
        }
      }, 35000);
    }

    triggerRandomHype() {
      const hypePhrases = [
        "Tay đâu tay đâu anh em ơiii!",
        "Một hai ba... zô!",
        "Nhạc đang lên cực căng, quẩy bung nóc nào!",
        "Thả tim nhiệt tình cho DJ nhé anh em!",
        "Gõ 1 lên sàn quẩy cùng mèo nào anh em!",
        "Đêm nay không say không về nào anh em ơi!"
      ];

      const randomPhrase = hypePhrases[Math.floor(Math.random() * hypePhrases.length)];
      this.speak(randomPhrase, false);
    }

    setStyle(style) {
      if (style === 'female_hype' || style === 'male_deep') {
        this.style = style;
      }
    }

    setSpeed(speed) {
      const val = parseFloat(speed);
      if (!isNaN(val) && val >= 1.0 && val <= 1.45) {
        this.playbackRate = val;
      }
    }

    setEnabled(val) {
      this.enabled = !!val;
      if (!this.enabled) {
        this.queue = [];
        this.stopDucking();
      }
    }

    setVolume(vol) {
      const v = parseFloat(vol);
      if (!isNaN(v) && v >= 0) {
        this.volume = Math.max(0, Math.min(2.0, v));
        if (this.masterVocalGain && this.ctx) {
          try {
            this.masterVocalGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
          } catch (_) {
            this.masterVocalGain.gain.value = this.volume;
          }
        }
      }
    }

    setDucking(ratio) {
      const r = parseFloat(ratio);
      if (!isNaN(r) && r >= 0.1 && r <= 1.0) {
        this.duckingRatio = r;
      }
    }
  }

  return new TTSMCManager();
});
