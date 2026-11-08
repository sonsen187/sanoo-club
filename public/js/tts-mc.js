// ============================================================================
// SANOO CLUB - TRUE CLUB MC & DANCEFLOOR HYPENESS AUDIO ENGINE
// ============================================================================
// Built specifically for authentic Vietnamese Club / Bar / Vinahouse atmospheres:
// 1. Sôi Động & Gãy Gọn (Fast 1.22x - 1.28x club tempo, no sluggish reading)
// 2. Câu từ dân quẩy sàn bay chính hiệu (Tay đâu tay đâu, 1 2 3 zô, khét lẹt, sếp lớn)
// 3. Tempo-synced Triplet Club Delay (234ms @ 128 BPM Vinahouse with thick repeats)
// 4. Large Venue Hall Reverb (Độ vang vũ trường hàng nghìn mét vuông)
// 5. Preserved Bass Kick (Nhạc chỉ hạ 45-50%, giữ nguyên lực Bass uỳnh uỳnh, không tụt mood)
// 6. DJ Stinger: Quẹt đĩa (Scratch) / Laser zap nhẹ đệm nhịp khi MC lên tiếng
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
      this.volume = 1.0;
      this.style = 'female_hype'; // 'female_hype' (Quẩy sung) | 'male_deep' (Nam trầm gằn)
      this.playbackRate = 1.24; // 1.24x fast club cadence
      this.stingerEnabled = true; // Đệm scratch nhẹ khi MC nói

      this.isDucking = false;
      this.baseMusicVolume = 0.8;
      this.duckingRatio = 0.52; // Keep 52% of music volume - keep the bass kick alive!

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
      this.reverbConvolver = null;
      this.reverbGain = null;
      this.masterVocalGain = null;

      // Periodic MC Hype timer (Every 2 - 3.5 minutes)
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
        // 1. Stage Vocal Equalizer (Microphone Modeling for Loud Club Mix)
        // Highpass at 220Hz cuts all muddiness, letting the club sub-bass breathe
        this.micHighpass = this.ctx.createBiquadFilter();
        this.micHighpass.type = 'highpass';
        this.micHighpass.frequency.value = 220;
        this.micHighpass.Q.value = 0.85;

        // Strong presence boost at 2800Hz (+5.5dB) cuts through the dense Vinahouse drop
        this.micPresence = this.ctx.createBiquadFilter();
        this.micPresence.type = 'peaking';
        this.micPresence.frequency.value = 2800;
        this.micPresence.gain.value = 5.5;
        this.micPresence.Q.value = 1.3;

        // Lowpass at 8200Hz cuts harsh hiss
        this.micLowpass = this.ctx.createBiquadFilter();
        this.micLowpass.type = 'lowpass';
        this.micLowpass.frequency.value = 8200;
        this.micLowpass.Q.value = 0.9;

        // 2. Tempo-synced Club Triplet Delay (234ms @ 128 BPM Vinahouse)
        this.delayNode = this.ctx.createDelay(1.0);
        this.delayNode.delayTime.value = 0.234; // 1/8 note rhythmic bounce

        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.38; // Thick rhythmic tail ("nàooo... nàooo... nàooo...")

        this.wetGain = this.ctx.createGain();
        this.wetGain.gain.value = 0.32; // 32% wet echo for unmistakable club vibe

        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 0.85;

        // 3. Large Club Hall Reverb (Convolver)
        this.reverbConvolver = this.ctx.createConvolver();
        this.reverbConvolver.buffer = this._createClubHallImpulse(this.ctx, 1.8, 3.2);

        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.24; // 24% wet hall acoustics

        this.masterVocalGain = this.ctx.createGain();
        this.masterVocalGain.gain.value = this.volume;

        // Connect Equalizer Chain:
        // Input -> micHighpass -> micPresence -> micLowpass
        this.micHighpass.connect(this.micPresence);
        this.micPresence.connect(this.micLowpass);

        // Dry Route
        this.micLowpass.connect(this.dryGain);
        this.dryGain.connect(this.masterVocalGain);

        // Delay Route (with feedback loop)
        this.micLowpass.connect(this.delayNode);
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);
        this.delayNode.connect(this.wetGain);
        this.wetGain.connect(this.masterVocalGain);

        // Reverb Route
        this.micLowpass.connect(this.reverbConvolver);
        this.reverbConvolver.connect(this.reverbGain);
        this.reverbGain.connect(this.masterVocalGain);

        this.masterVocalGain.connect(this.ctx.destination);
      } catch (err) {
        console.warn('Club TTS DSP Setup warning:', err);
      }
    }

    // Synthesize realistic Club Stadium / Hall Acoustic Impulse
    _createClubHallImpulse(audioContext, duration = 1.8, decay = 3.2) {
      const sampleRate = audioContext.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const impulse = audioContext.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * decay);
        // Early concrete / glass reflections
        let earlyL = 0, earlyR = 0;
        if (i === Math.floor(sampleRate * 0.022)) { earlyL = 0.55; earlyR = 0.28; }
        if (i === Math.floor(sampleRate * 0.045)) { earlyL = -0.38; earlyR = 0.46; }
        if (i === Math.floor(sampleRate * 0.075)) { earlyL = 0.32; earlyR = -0.28; }
        if (i === Math.floor(sampleRate * 0.118)) { earlyL = -0.22; earlyR = 0.22; }

        left[i] = ((Math.random() * 2 - 1) * env * 0.75 + earlyL) * 0.5;
        right[i] = ((Math.random() * 2 - 1) * env * 0.75 + earlyR) * 0.5;
      }
      return impulse;
    }

    // ==========================================================================
    // PROCEDURAL CLUB MIC SFX & DJ STINGER
    // ==========================================================================
    playMicClick(isOn = true) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      try {
        const now = this.ctx.currentTime;

        // Mechanical switch contact click (12ms bandpass noise pulse)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isOn ? 1350 : 850, now);
        osc.frequency.exponentialRampToValueAtTime(isOn ? 480 : 260, now + 0.015);

        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 3.5;

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.02);

        // Sub capsule thump
        if (isOn) {
          const thump = this.ctx.createOscillator();
          const thumpGain = this.ctx.createGain();
          thump.type = 'sine';
          thump.frequency.setValueAtTime(120, now);
          thump.frequency.exponentialRampToValueAtTime(45, now + 0.026);

          thumpGain.gain.setValueAtTime(0.1, now);
          thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

          thump.connect(thumpGain);
          thumpGain.connect(this.ctx.destination);

          thump.start(now);
          thump.stop(now + 0.032);
        }
      } catch (e) {}
    }

    // DJ Stinger (Quick scratch or zap before big hype)
    playDJStinger() {
      if (!this.stingerEnabled || !window.sfx) return;
      try {
        const rand = Math.random();
        if (rand < 0.6) {
          if (typeof window.sfx.playScratch === 'function') window.sfx.playScratch();
        }
      } catch (e) {}
    }

    // ==========================================================================
    // AUDIO DUCKING (Smooth dip to 52% - keeps the bass kick pumping!)
    // ==========================================================================
    startDucking() {
      if (!this.audioElement || this.isDucking) return;
      this.isDucking = true;
      this.baseMusicVolume = this.audioElement.volume > 0.1 ? this.audioElement.volume : 0.8;
      // Drop to 52% instead of 22% so the club beat stays punchy!
      const targetVol = Math.max(0.35, this.baseMusicVolume * this.duckingRatio);

      const startTime = performance.now();
      const startVol = this.audioElement.volume;
      const duration = 160; // 160ms fast dip

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
      const duration = 400; // 400ms quick punchy restore

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
    speak(text, priority = false, withStinger = false) {
      if (!this.enabled || !text) return;
      text = text.trim();
      if (!text) return;

      const item = { text, withStinger };

      if (priority) {
        this.queue.unshift(item);
      } else {
        this.queue.push(item);
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
      const item = this.queue.shift();
      const text = item.text;
      this.lastSpeechTime = Date.now();

      // 1. Play DJ Scratch Stinger if triggered
      if (item.withStinger) {
        this.playDJStinger();
        await new Promise(r => setTimeout(r, 180));
      }

      // 2. Play mic-on click & begin audio ducking
      this.playMicClick(true);
      this.startDucking();

      // Short pause (100ms) for realistic mic keying
      await new Promise(r => setTimeout(r, 100));

      // 3. Play speech using Web Audio DSP (/api/tts)
      let success = await this._playServerAudioDSP(text);

      if (!success) {
        await this._playWebSpeech(text);
      }

      // 4. Play mic-off click & restore music volume
      this.playMicClick(false);
      this.lastSpeechTime = Date.now();

      // 100ms pause after speaking before restoring music
      await new Promise(r => setTimeout(r, 100));
      this.stopDucking();

      // Inter-speech buffer (250ms) before next speech in queue
      await new Promise(r => setTimeout(r, 250));
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

          // FAST ENERGETIC CLUB CADENCE: 1.22x - 1.28x
          // Style adjustments:
          if (this.style === 'male_deep') {
            source.playbackRate.value = 1.15; // Slightly slower, deeper presence
          } else {
            source.playbackRate.value = this.playbackRate || 1.24; // Fast & punchy
          }

          // Connect into our stage microphone DSP equalizer, delay & reverb
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

        // Fast & punchy MC delivery
        utterance.rate = 1.22;
        utterance.pitch = this.style === 'male_deep' ? 0.88 : 1.12;

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
    // 1. SMART GIFT CELEBRATION (AUTHENTIC CLUB VINAHOUSE SLANG)
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

      // High-tier VIP gift announcement (Báo động cấp 1, chấn động vũ trường)
      if (diamondCount >= 70 || fxType === 'mega_rave' || fxType === 'flame') {
        const vipPhrases = [
          `Báo động cấp 1! Đại gia ${nickname} vừa nổ quả ${giftName} chấn động cả vũ trường! Nâng ly hú hét chúc mừng đại gia nào anh em ơi!`,
          `Ui là trời! Khét mù sàn bay rồi anh em ơiii! Cảm ơn đại gia ${nickname} nổ ${giftName} siêu đẳng cấp!`,
          `Đẳng cấp là mãi mãi! Cảm ơn anh đại ${nickname} đã hạ cánh món quà khủng ${giftName}! Nâng ly quẩy hết mình cùng đại ca nào!`,
          `Nổ tung nóc nhà! Món quà ${giftName} cực khủng từ vị trí của đại gia ${nickname}! Cả vũ trường nâng ly chúc mừng nào!`
        ];
        sentence = vipPhrases[Math.floor(Math.random() * vipPhrases.length)];
        this.speak(sentence, true, true); // VIP gifts get priority & scratch stinger
        return;
      }

      // Combo gifts (count > 1)
      if (count > 1) {
        const comboPhrases = [
          `1 2 3... ối dồi ôi! Cảm ơn ${nickname} nã combo ${count} ${giftName}! Rung chuyển sàn bay luôn anh em ơiii!`,
          `Gáy lên nào anh em ơi! Cảm ơn sếp ${nickname} giã liền ${count} ${giftName}! Quá đỉnh quá đẳng cấp!`,
          `Khét mù mắt luôn anh em ơi! Combo ${count} ${giftName} từ vị trí của đại ca ${nickname}! Quẩy bung nóc nào!`,
          `Nuốt luôn cái beat này nào! Cảm ơn sếp ${nickname} đã bắn phá ${count} ${giftName} lên sàn diễn!`
        ];
        sentence = comboPhrases[Math.floor(Math.random() * comboPhrases.length)];
      } else {
        // Single gift
        const singlePhrases = [
          `Lên luônnn! Cảm ơn sếp ${nickname} đã nổ ${giftName}! Rót chén rượu mời sếp nào anh em ơi!`,
          `Khét lẹt luôn! Cảm ơn anh ${nickname} với quả ${giftName} cực cháy! Quẩy bung nóc nào!`,
          `Nhận chén rượu từ DJ gửi tới ${nickname}! Cảm ơn món quà ${giftName} nhé sếp ơi!`,
          `Đẳng cấp sếp ơi! Cảm ơn ${nickname} đã tiếp lửa ${giftName} cho sàn bay!`,
          `Tay đâu tay đâu anh em ơi! Hú hét cảm ơn sếp ${nickname} vừa nổ ${giftName} nào!`,
          `Quá đỉnh sếp ${nickname} ơi! Một món quà ${giftName} làm rực sáng cả sàn diễn đêm nay!`
        ];
        sentence = singlePhrases[Math.floor(Math.random() * singlePhrases.length)];
      }

      this.speak(sentence, false, false);
    }

    // ==========================================================================
    // 2. TOP 3 VIP PODIUM ANNOUNCEMENTS (VŨ TRƯỜNG SOÁN NGÔI TOP 1)
    // ==========================================================================
    onTopGiftersUpdate(topGifters) {
      if (!this.enabled || !Array.isArray(topGifters) || topGifters.length === 0) return;

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

      // Check for Rank 1 change (SOÁN NGÔI TOP 1)
      if (u1 && u1 !== this.lastTop3Usernames[0]) {
        const name = curTop1.nickname || curTop1.username;
        const rank1Phrases = [
          `Trật tự nào anh em ơiii! Bảng vàng đại gia chính thức đổi chủ! Chào đón sếp lớn ${name} bước lên ngai vàng Top 1! Quá đẳng cấp!`,
          `Nổ tung sàn diễn! Đại ca ${name} chính thức soán ngôi độc chiếm Top 1 bục vàng đại gia đêm nay! Anh em hú hét lên nào!`,
          `Tiếng nổ vang trời từ vị trí của ${name}! Ngai vàng Top 1 đại gia Sanoo Club đêm nay đã có chủ! Cả vũ trường nâng ly nào!`
        ];
        const text = rank1Phrases[Math.floor(Math.random() * rank1Phrases.length)];
        this.speak(text, true, true);
      }
      // Check for Rank 2 change
      else if (u2 && u2 !== this.lastTop3Usernames[1] && u2 !== this.lastTop3Usernames[0]) {
        const name = curTop2.nickname || curTop2.username;
        const text = `Đẳng cấp không cần bàn cãi! Chúc mừng ${name} đã xuất sắc vươn lên Top 2 đại gia!`;
        this.speak(text, true, false);
      }
      // Check for Rank 3 change
      else if (u3 && u3 !== this.lastTop3Usernames[2] && u3 !== this.lastTop3Usernames[0] && u3 !== this.lastTop3Usernames[1]) {
        const name = curTop3.nickname || curTop3.username;
        const text = `Hú hét lên nào anh em ơi! Chào mừng ${name} chính thức ghi danh bước lên Top 3 bục vinh quang!`;
        this.speak(text, true, false);
      }

      this.lastTop3Usernames = [u1, u2, u3];
    }

    // ==========================================================================
    // 3. PERIODIC RANDOM MC HYPE SHOUTS (KHUẤY ĐỘNG VŨ TRƯỜNG CỰC CHÁY)
    // ==========================================================================
    startPeriodicHypeTimer() {
      if (this.hypeIntervalTimer) clearInterval(this.hypeIntervalTimer);

      this.hypeIntervalTimer = setInterval(() => {
        if (!this.enabled) return;

        const idleTime = Date.now() - this.lastSpeechTime;
        // If idle for over 130 seconds (over 2 mins) and queue is empty, fire a random hype shout
        if (idleTime >= 130000 && this.queue.length === 0 && !this.isPlaying) {
          this.triggerRandomHype();
        }
      }, 25000);
    }

    triggerRandomHype() {
      const hypePhrases = [
        "1 2 3... ối dồi ôi, tay đâu tay đâu hết rồi anh em ơi! Cho DJ xin một tràng pháo tim nổ tung màn hình nào!",
        "Ai chưa có mặt trên sàn gõ phím 1 để nhập hội quẩy xuyên màn đêm cùng team mèo nào!",
        "Nhạc đang lên cực căng, anh em nâng ly zô một cái thật to nào! Một hai ba... zô!",
        "Quẩy sung lên anh em ơiii! Đêm nay không say không về, tới bến luôn nào!",
        "Cảm ơn năm trăm anh em đang có mặt tại phòng kính Sanoo Club! Nhún nhảy hết mình theo điệu nhạc nào!",
        "Ai muốn đổi style mèo quẩy chất hơn gõ chấm than 1, chấm than 2 hoặc chấm than 3 nhé anh em!",
        "Bass đang đập rung sàn, anh em sẵn sàng xé toạc màn đêm cùng DJ Sanoo chưa nàooo!",
        "Tay trái đâu là tay trái đâu? Tay phải đâu là tay phải đâu? Giơ cao hai tay nhún nhảy theo nhạc nào anh em!",
        "Đoạn drop này chuẩn bị nổ tung vũ trường! Anh em sẵn sàng bung nóc chưa nào!",
        "Nhạc hay âm thanh ấm, anh em thả tim nhiệt tình tiếp lửa cho các vũ công quẩy đêm nay nhé!"
      ];

      const randomPhrase = hypePhrases[Math.floor(Math.random() * hypePhrases.length)];
      this.speak(randomPhrase, false, true);
    }

    // Set voice style: 'female_hype' | 'male_deep'
    setStyle(style) {
      if (style === 'female_hype' || style === 'male_deep') {
        this.style = style;
      }
    }

    // Set playback rate (speed: 1.1x - 1.35x)
    setSpeed(speed) {
      const val = parseFloat(speed);
      if (!isNaN(val) && val >= 1.0 && val <= 1.45) {
        this.playbackRate = val;
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
