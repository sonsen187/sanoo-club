const { MPEGDecoder } = require('mpg123-decoder');
const fs = require('fs');
const path = require('path');

async function analyzeAll() {
  console.log('Starting precision sub-bass kick analysis for 68 tracks...');
  const playlistPath = path.join(__dirname, '../public/assets/playlist.json');
  const playlist = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));

  const decoder = new MPEGDecoder();
  await decoder.ready;

  for (let i = 0; i < playlist.length; i++) {
    const item = playlist[i];
    const filePath = path.join(__dirname, '../public/assets/music', item.filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    try {
      const buf = fs.readFileSync(filePath);
      const { channelData, sampleRate } = decoder.decode(buf);
      const left = channelData[0];
      const right = channelData[1] || left;
      const duration = left.length / sampleRate;

      // 1. Apply 2-Pole IIR Low-Pass Filter at 110 Hz (isolates true kick drum & sub-bass)
      const cutoff = 110;
      const rc = 1.0 / (cutoff * 2 * Math.PI);
      const dt = 1.0 / sampleRate;
      const alpha = dt / (rc + dt);

      let y1 = 0, y2 = 0;
      const filtered = new Float32Array(left.length);
      for (let j = 0; j < left.length; j++) {
        const s = (left[j] + right[j]) * 0.5;
        y1 += alpha * (s - y1);
        y2 += alpha * (y1 - y2);
        filtered[j] = y2;
      }

      // 2. High-temporal resolution (100 fps) sub-bass energy for BPM & Beat Offset
      const hopSize = Math.floor(sampleRate / 100); // 100 fps
      const numFrames = Math.floor(left.length / hopSize);

      const bassEnergies = new Float32Array(numFrames);
      for (let f = 0; f < numFrames; f++) {
        const start = f * hopSize;
        let sum = 0;
        const step = 4;
        for (let j = 0; j < hopSize; j += step) {
          const s = filtered[start + j];
          sum += s * s;
        }
        bassEnergies[f] = Math.sqrt(sum / (hopSize / step));
      }

      // Max energy in filtered signal
      let maxEnergy = 0.0001;
      for (let f = 0; f < numFrames; f++) {
        if (bassEnergies[f] > maxEnergy) maxEnergy = bassEnergies[f];
      }

      // 3. Detect BPM using loudest 50s window of filtered kick bass
      const windowFrames = Math.min(numFrames - 100, 50 * 100);
      let maxWindowEnergy = -1;
      let bestWindowStart = 0;
      for (let f = 0; f < numFrames - windowFrames; f += 200) {
        let wEnergy = 0;
        for (let k = 0; k < windowFrames; k += 10) wEnergy += bassEnergies[f + k];
        if (wEnergy > maxWindowEnergy) {
          maxWindowEnergy = wEnergy;
          bestWindowStart = f;
        }
      }

      const novelty = new Float32Array(windowFrames);
      for (let k = 1; k < windowFrames; k++) {
        const diff = bassEnergies[bestWindowStart + k] - bassEnergies[bestWindowStart + k - 1];
        novelty[k] = diff > 0 ? diff : 0;
      }

      const minLag = Math.floor(100 * 60 / 185); // 185 BPM
      const maxLag = Math.floor(100 * 60 / 75);  // 75 BPM
      let bestLag = minLag;
      let maxCorr = -1;

      for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0, count = 0;
        for (let k = 0; k < windowFrames - lag; k += 2) {
          corr += novelty[k] * novelty[k + lag];
          count++;
        }
        corr /= count;
        if (corr > maxCorr) {
          maxCorr = corr;
          bestLag = lag;
        }
      }

      let detectedBpm = Math.round(60 * 100 / bestLag);
      if (detectedBpm < 92) detectedBpm *= 2;
      if (detectedBpm > 195) detectedBpm = Math.round(detectedBpm / 2);

      // 4. Find first genuine kick drop offset (where kick energy > 0.40)
      let beatOffset = 0;
      const searchEndFrame = Math.min(numFrames, Math.floor(30 * 100)); // First 30s
      for (let f = 10; f < searchEndFrame; f++) {
        if (bassEnergies[f] / maxEnergy > 0.40) {
          beatOffset = Math.round((f / 100) * 1000) / 1000;
          break;
        }
      }

      // 5. Precision Second-by-Second Kick Punch Profile (0.0 to 1.0)
      // Uses Peak * RMS of 110Hz sub-bass to completely suppress intro melodies & synth drones
      const totalSec = Math.floor(duration);
      const secScores = new Float32Array(totalSec);
      let maxSecScore = 0.0001;

      for (let s = 0; s < totalSec; s++) {
        const start = s * sampleRate;
        const end = Math.min(filtered.length, (s + 1) * sampleRate);
        let sumSq = 0, peak = 0;
        const step = 4;
        for (let j = start; j < end; j += step) {
          const val = Math.abs(filtered[j]);
          if (val > peak) peak = val;
          sumSq += val * val;
        }
        const rms = Math.sqrt(sumSq / ((end - start) / step));
        const punch = peak * rms;
        secScores[s] = punch;
        if (punch > maxSecScore) maxSecScore = punch;
      }

      const secBass = [];
      for (let s = 0; s < totalSec; s++) {
        const norm = Math.round((secScores[s] / maxSecScore) * 100) / 100;
        secBass.push(norm);
      }

      item.bpm = detectedBpm;
      item.duration = Math.round(duration);
      item.beatOffset = beatOffset;
      item.bassProfile = secBass;

      console.log(`[${i + 1}/${playlist.length}] ${item.filename} | BPM: ${detectedBpm} | Dur: ${item.duration}s | Offset: ${beatOffset}s | Intro: [${secBass.slice(0, 5).join(', ')}]`);
    } catch (err) {
      console.error(`Error processing ${item.filename}:`, err.message);
      item.bpm = item.bpm || 128;
      item.duration = item.duration || 180;
      item.beatOffset = 0;
      item.bassProfile = [];
    }
  }

  decoder.free();
  fs.writeFileSync(playlistPath, JSON.stringify(playlist, null, 2), 'utf8');
  console.log('Successfully saved updated playlist.json with strict sub-bass kick profiles!');
}

analyzeAll();
