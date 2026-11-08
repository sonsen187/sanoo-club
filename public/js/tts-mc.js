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
    root.ClubTTSMC = root.TTSMCManager;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class TTSMCManager {
    constructor() {
      this.ctx = null;
      this.audioElement = null;
      this.enabled = true;
      this.volume = 1.0; // Default 100% (Full master level, prominent and clearly audible above loud club music)
      this.style = 'female_hype'; // 'female_hype' (Quẩy sung) | 'male_deep' (Nam trầm gằn) | 'google'
      this.playbackRate = 1.20; // 1.20x energetic club tempo
      this.pitch = 0; // -50Hz to +50Hz pitch adjust
      this.echo = 35; // 0% to 100% echo/reverb wet mix
      this.stingerEnabled = false;
      this.introSFX = 'click'; // 'none' | 'click' | 'airhorn' | 'scratch' | 'siren'
      this.enableGiftHype = true;
      this.enableTopRankHype = true;
      this.enablePeriodicHype = true;

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
        const AudioContext = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
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
        this.setEcho(this.echo);
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

    playIntroSFX(isOn = true) {
      if (!isOn) {
        if (this.introSFX === 'click') this.playMicClick(false);
        return;
      }

      if (this.introSFX === 'click') {
        this.playMicClick(true);
      } else if (this.introSFX === 'airhorn') {
        if (typeof window !== 'undefined' && window.sfx && typeof window.sfx.playAirhorn === 'function') {
          window.sfx.playAirhorn();
        }
      } else if (this.introSFX === 'scratch') {
        if (typeof window !== 'undefined' && window.sfx && typeof window.sfx.playScratch === 'function') {
          window.sfx.playScratch();
        }
      } else if (this.introSFX === 'siren') {
        if (typeof window !== 'undefined' && window.sfx && typeof window.sfx.playSiren === 'function') {
          window.sfx.playSiren();
        }
      }
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

      this.playIntroSFX(true);
      this.startDucking();

      await new Promise(r => setTimeout(r, 60));

      let success = await this._playServerAudioDSP(text);
      if (!success) {
        await this._playWebSpeech(text);
      }

      this.playIntroSFX(false);
      this.lastSpeechTime = Date.now();

      await new Promise(r => setTimeout(r, 60));
      this.stopDucking();
      this.isPlaying = false;
    }

    // Tra ve cau ho qua chuan Club / DJ MC (TUYET DOI KHONG dung tu "cam on", chuan phong cach vu truong)
    getGiftThankYouSentence(nickname, diamondCount = 0, count = 1, fxType = 'sparkles') {
      const cleanNick = (nickname || 'bạn').trim();
      const totalCoins = Math.max(diamondCount * (count > 1 ? count : 1), diamondCount);

      // TẦNG 4: Siêu quà khủng (>= 5,000 xu, ví dụ Du Thuyền, Sư Tử, Lâu Đài...)
      if (totalCoins >= 5000) {
        const phrases = [
          `Bái phục đại gia ${cleanNick}! Đẳng cấp vũ trụ!`,
          `Chao đảo sàn bay! Gọi tên trùm đại gia ${cleanNick}!`,
          `Đại địa chấn! Đại gia ${cleanNick} gánh cả sàn nhảy!`,
          `Cả sàn nâng ly! Đại gia ${cleanNick} quá khét!`,
          `Đỉnh của chóp! Đại gia ${cleanNick} bao trọn sàn bay!`,
          `Quá đẳng cấp! Một tràng pháo tay cho sếp ${cleanNick}!`,
          `Sếp ${cleanNick} xuất hiện, chao đảo cả vũ trường!`
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
      }

      // TẦNG 3: Quà to / Đại gia (500 - 4,999 xu, ví dụ Súng Tiền, Vương Miện, Thiên Nga, Siêu Xe...)
      if (totalCoins >= 500 || fxType === 'mega_rave') {
        const phrases = [
          `Úi xời đại gia ${cleanNick}! Đẳng cấp quá sếp ơi!`,
          `Cháy sàn luôn! Gọi tên đại gia ${cleanNick}!`,
          `Đẳng cấp dân chơi! Sếp ${cleanNick} lên đồ khét lẹt!`,
          `Khét mù sàn nhảy! Đại gia ${cleanNick} vào việc rồi!`,
          `Quá bốc sếp ${cleanNick} ơi! Lên là lên luôn!`,
          `Một hai ba zô! Vinh danh đại gia ${cleanNick}!`,
          `Hết nước chấm! Đại gia ${cleanNick} quẩy tung nóc!`,
          `Bén quá sếp ${cleanNick} ơi! Cả sàn quỳ gối!`
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
      }

      // TẦNG 2: Quà vừa / Quà xịn (50 - 499 xu, ví dụ Bắn Pháo, Lửa, Kính Mát, Tim Bay...)
      if (totalCoins >= 50 || fxType === 'flame' || fxType === 'fireworks') {
        const phrases = [
          `Quá bén sếp ${cleanNick} ơi! Lên luôn!`,
          `Khét lẹt! Sếp ${cleanNick} vào nhịp rồi!`,
          `Lên là lên! ${cleanNick} quẩy hết nấc luôn!`,
          `Quá bốc! Gọi tên ${cleanNick} trên sàn bay!`,
          `Bốc luôn sếp ${cleanNick} ơi! Quẩy cháy sàn!`,
          `Đỉnh chóp! ${cleanNick} tiếp lửa quá đã!`,
          `Tay đâu tay đâu! Vỗ tay cho sếp ${cleanNick}!`,
          `Chất chơi người dơi! ${cleanNick} bốc lửa luôn!`
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
      }

      // COMBO Quà nhỏ (Bắn liên tiếp nhiều lần / Combo streak):
      if (count > 2) {
        const phrases = [
          `Bắn tay khét lẹt! ${cleanNick} dồn dập quá đã!`,
          `Một hai ba zô! ${cleanNick} tiếp lửa đều tay!`,
          `Tay đâu cho ${cleanNick}! Bắn nhịp quá bén!`,
          `Lên nhịp liên hoàn! ${cleanNick} quẩy tới bến!`,
          `Khét mù luôn! ${cleanNick} bấm tay không trượt phát nào!`
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
      }

      // TẦNG 1: Quà nhỏ (< 50 xu, ví dụ Hoa hồng, Trái tim, Kẹo, Kem...)
      // Siêu ngắn gọn (~1.0s), dứt khoát, đúng chất Club MC
      const smallPhrases = [
        `Lên đồ nào ${cleanNick}!`,
        `Quá bén ${cleanNick} ơi!`,
        `Tiếp lửa cực căng ${cleanNick}!`,
        `Đã cái nư ${cleanNick} ơi!`,
        `Bốc luôn ${cleanNick} ơi!`,
        `Zô zô ${cleanNick} nào!`,
        `Khét lẹt ${cleanNick} ơi!`,
        `Lên nhịp luôn ${cleanNick}!`,
        `Quẩy nhiệt nào ${cleanNick}!`,
        `Bung lụa sếp ${cleanNick} ơi!`
      ];
      return smallPhrases[Math.floor(Math.random() * smallPhrases.length)];
    }

    async speakGiftAsync(gift) {
      if (!this.enabled || !this.enableGiftHype || !gift) return;

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
      this.playIntroSFX(true);
      this.startDucking();

      await new Promise(r => setTimeout(r, 60));

      let success = await this._playServerAudioDSP(text);

      if (!success) {
        await this._playWebSpeech(text);
      }

      this.playIntroSFX(false);
      this.lastSpeechTime = Date.now();

      await new Promise(r => setTimeout(r, 60));
      this.stopDucking();

      await new Promise(r => setTimeout(r, 200));
      this._processNextInQueue();
    }

    // Play TTS via /api/tts decoded directly into Web Audio DSP Graph with HTML5 Audio & Web Speech fallbacks
    async _playServerAudioDSP(text) {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          try {
            this.ctx = new AudioContext();
            this._setupAudioDSP();
          } catch (_) {}
        }
      }

      const encoded = encodeURIComponent(text);
      const url = `/api/tts?text=${encoded}&voice=${encodeURIComponent(this.style || 'female_hype')}&speed=${this.playbackRate || 1.20}&pitch=${this.pitch || 0}`;

      // Tier 1: Web Audio DSP Graph (Mic Compressor + Reverb + Triplet Delay)
      if (this.ctx) {
        try {
          if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
          }
          const res = await fetch(url);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

            return await new Promise((resolve) => {
              const source = this.ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.playbackRate.value = (this.style === 'google') ? (this.playbackRate || 1.20) : 1.0;

              if (this.micHighpass) {
                source.connect(this.micHighpass);
              } else {
                source.connect(this.ctx.destination);
              }

              source.onended = () => resolve(true);
              source.onerror = () => resolve(false);
              source.start();
            });
          }
        } catch (dspErr) {
          console.warn('[TTS] Web Audio DSP decode failed, falling back to HTML5 Audio:', dspErr.message);
        }
      }

      // Tier 2 Fallback: Native HTML5 Audio Element (Direct hardware audio decoding, zero decode issues)
      try {
        const audioSuccess = await new Promise((resolve) => {
          const audio = new Audio(url);
          audio.volume = Math.min(1.0, this.volume);
          audio.onended = () => resolve(true);
          audio.onerror = () => resolve(false);
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => resolve(false));
          }
        });
        if (audioSuccess) return true;
      } catch (_) {}

      // Tier 3 Fallback: Browser Web Speech API
      return this._playWebSpeech(text);
    }

    // Fallback: Browser Web Speech API
    _playWebSpeech(text) {
      return new Promise((resolve) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          resolve(false);
          return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.volume = this.volume;
        utterance.rate = this.playbackRate || 1.20;
        const basePitch = this.style === 'male_deep' ? 0.9 : 1.1;
        utterance.pitch = Math.max(0.5, Math.min(2.0, basePitch + (this.pitch || 0) / 80));

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
      if (!this.enabled || !this.enableGiftHype || !data) return;

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
      if (!this.enabled || !this.enableTopRankHype) return;
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
          `Bái phục sếp ${name} soán ngôi bục vàng Top 1!`,
          `Gọi tên đại ca ${name} chễm chệ ngôi vương Top 1! Quá đỉnh!`,
          `Đại địa chấn! Sếp ${name} độc chiếm bục vàng Top 1!`
        ];
        const text = rank1Phrases[Math.floor(Math.random() * rank1Phrases.length)];
        this.speak(text, true);
      }
      // Rank 2 change
      else if (u2 && u2 !== this.lastTop3Usernames[1] && u2 !== this.lastTop3Usernames[0]) {
        const name = curTop2.nickname || curTop2.username;
        const text = `Hò reo cho sếp ${name} chiếm lĩnh bục bạc Top 2!`;
        this.speak(text, true);
      }
      // Rank 3 change
      else if (u3 && u3 !== this.lastTop3Usernames[2] && u3 !== this.lastTop3Usernames[0] && u3 !== this.lastTop3Usernames[1]) {
        const name = curTop3.nickname || curTop3.username;
        const text = `Nâng ly cho ${name} vững vàng bục đồng Top 3!`;
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
        if (this.enablePeriodicHype && idleTime >= 240000 && this.queue.length === 0 && !this.isPlaying) {
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
      if (style === 'female_hype' || style === 'male_deep' || style === 'google') {
        this.style = style;
      }
    }

    setConfig(config) {
      if (!config) return;
      if (typeof config.enabled !== 'undefined') this.setEnabled(config.enabled);
      if (typeof config.volume !== 'undefined') this.setVolume(config.volume);
      if (typeof config.speed !== 'undefined') this.setSpeed(config.speed);
      if (typeof config.pitch !== 'undefined') this.setPitch(config.pitch);
      if (typeof config.echo !== 'undefined') this.setEcho(config.echo);
      if (typeof config.style !== 'undefined') this.setStyle(config.style);
      if (typeof config.introSFX !== 'undefined') this.introSFX = config.introSFX;
      if (typeof config.duckingRatio !== 'undefined') this.setDucking(config.duckingRatio);
      if (typeof config.enableGiftHype !== 'undefined') this.enableGiftHype = !!config.enableGiftHype;
      if (typeof config.enableTopRankHype !== 'undefined') this.enableTopRankHype = !!config.enableTopRankHype;
      if (typeof config.enablePeriodicHype !== 'undefined') this.enablePeriodicHype = !!config.enablePeriodicHype;
    }

    setSpeed(speed) {
      const val = parseFloat(speed);
      if (!isNaN(val) && val >= 0.70 && val <= 1.60) {
        this.playbackRate = val;
      }
    }

    setPitch(val) {
      const p = parseInt(val, 10);
      if (!isNaN(p) && p >= -60 && p <= 60) {
        this.pitch = p;
        if (this.micPresence && this.micHighpass && this.ctx) {
          try {
            const now = this.ctx.currentTime;
            this.micPresence.frequency.setValueAtTime(3000 + p * 15, now);
            this.micHighpass.frequency.setValueAtTime(Math.max(80, 160 + p * 2), now);
          } catch (_) {}
        }
      }
    }

    setEcho(val) {
      const echoPct = Math.max(0, Math.min(100, parseFloat(val) || 0));
      this.echo = echoPct;
      const factor = echoPct / 100;
      if (this.wetGain && this.ctx) {
        const targetWet = factor * 0.45;
        const targetFeedback = Math.min(0.55, 0.15 + factor * 0.35);
        const targetReverb = factor * 0.35;
        try {
          const now = this.ctx.currentTime;
          this.wetGain.gain.setValueAtTime(targetWet, now);
          this.delayFeedback.gain.setValueAtTime(targetFeedback, now);
          this.reverbGain.gain.setValueAtTime(targetReverb, now);
        } catch (_) {
          this.wetGain.gain.value = targetWet;
          this.delayFeedback.gain.value = targetFeedback;
          this.reverbGain.gain.value = targetReverb;
        }
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
