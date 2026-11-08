const { MPEGDecoder } = require('mpg123-decoder');
const fs = require('fs');

/**
 * Precision Sub-Bass & Kick Drum Audio Analyzer
 * Identical to the algorithm used for built-in 53 club tracks:
 * - 2-Pole IIR 110Hz Low-Pass Filter (isolates pure sub-bass & kick drum)
 * - Autocorrelation tempo detection (BPM)
 * - Kick drop onset detection (beatOffset in seconds)
 * - Second-by-second punch profile (peak * rms) normalized 0.00 to 1.00
 */
async function analyzeAudioFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buf = fs.readFileSync(filePath);
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const { channelData, sampleRate } = decoder.decode(buf);

  const left = channelData[0];
  const right = channelData[1] || left;
  const totalSamples = left.length;
  const duration = totalSamples / sampleRate;

  // 1. 2-Pole IIR Low-Pass Filter at 110 Hz
  const cutoff = 110;
  const rc = 1.0 / (cutoff * 2 * Math.PI);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);

  const hopSize = Math.floor(sampleRate / 100); // 100 fps for BPM autocorrelation
  const numFrames = Math.floor(totalSamples / hopSize);
  const totalSec = Math.floor(duration);

  const bassEnergies = new Float32Array(numFrames);
  const secScores = new Float32Array(totalSec);

  let y1 = 0, y2 = 0;
  let sampleIdx = 0;
  let maxSecScore = 0.0001;
  let maxEnergy = 0.0001;

  // Single-pass processing for maximum speed and minimal memory footprint
  for (let s = 0; s < totalSec; s++) {
    const secEndSample = Math.min(totalSamples, (s + 1) * sampleRate);
    let secSumSq = 0;
    let secPeak = 0;
    let secCount = 0;

    while (sampleIdx < secEndSample) {
      const frameIdx = Math.floor(sampleIdx / hopSize);
      const frameEndSample = Math.min(secEndSample, (frameIdx + 1) * hopSize);
      let frameSumSq = 0;
      let frameCount = 0;

      for (; sampleIdx < frameEndSample; sampleIdx += 2) {
        const raw = (left[sampleIdx] + right[sampleIdx]) * 0.5;
        // 2-pole lowpass
        y1 += alpha * (raw - y1);
        y2 += alpha * (y1 - y2);

        const absVal = Math.abs(y2);
        if (absVal > secPeak) secPeak = absVal;
        const sq = y2 * y2;
        frameSumSq += sq;
        secSumSq += sq;
        frameCount++;
        secCount++;
      }

      if (frameIdx < numFrames && frameCount > 0) {
        const frameRms = Math.sqrt(frameSumSq / frameCount);
        bassEnergies[frameIdx] = frameRms;
        if (frameRms > maxEnergy) maxEnergy = frameRms;
      }
    }

    if (secCount > 0) {
      const secRms = Math.sqrt(secSumSq / secCount);
      const punch = secPeak * secRms;
      secScores[s] = punch;
      if (punch > maxSecScore) maxSecScore = punch;
    }
  }

  // 2. Detect BPM using loudest 50s window of filtered kick bass
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

  const minLag = Math.floor(100 * 60 / 185); // Up to 185 BPM
  const maxLag = Math.floor(100 * 60 / 75);  // Down to 75 BPM
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

  // 3. Find first genuine kick drop offset (where kick energy > 0.40)
  let beatOffset = 0;
  const searchEndFrame = Math.min(numFrames, Math.floor(30 * 100)); // First 30s
  for (let f = 10; f < searchEndFrame; f++) {
    if (bassEnergies[f] / maxEnergy > 0.40) {
      beatOffset = Math.round((f / 100) * 1000) / 1000;
      break;
    }
  }

  // 4. Normalized second-by-second punch profile
  const secBass = [];
  for (let s = 0; s < totalSec; s++) {
    const norm = Math.round((secScores[s] / maxSecScore) * 100) / 100;
    secBass.push(norm);
  }

  return {
    bpm: detectedBpm,
    duration: Math.round(duration),
    beatOffset,
    bassProfile: secBass
  };
}

module.exports = {
  analyzeAudioFile
};
