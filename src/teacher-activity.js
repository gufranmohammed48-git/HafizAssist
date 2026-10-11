// A local PCM activity heuristic for scheduling teacher feedback. This is not
// a speech model: steady room noise, soft speech, and unusual microphones can
// overlap. Recognition changes supply independent evidence of spoken sounds.
import { createTeacherVoicing } from './teacher-voicing.js';

const FRAME_SAMPLES = 320; // 20 ms at the capture worklet's 16 kHz sample rate.
const HISTORY_FRAMES = 100;
const MIN_NOISE = .00035;
const CALIBRATION_MS = 800;
const ACTIVITY_WINDOW_MS = 320;
const REQUIRED_ACTIVITY_MS = 160;

export function createTeacherActivity() {
  const voicing = createTeacherVoicing();
  let speechAt = 0, recognitionAt = -Infinity, acousticAt = -Infinity;
  let noiseFloor = .0015, history = [];
  let ambientUpper = .0015, vowelNoiseFloor = .0015, activityWindow = [], recent = [];
  let candidateMs = 0, quietMs = 0, voiced = false, confirmedRun = false;
  let lastVariationAt = -Infinity, voiceLevel = 0, previousAt = 0, captureAt = 0;
  let dropAt = null, steadyDropMs = 0, latestRms = 0, releaseLevel = 0;
  let calibrated = false, calibrationMs = 0, calibrationFrames = [];
  let calibrationVowels = [], periodicVoice = false, activeWindowMs = 0, activityReason = 'quiet';
  let vowelEnergyThreshold = 0;
  let calibrationSquares = 0, calibrationSamples = 0;

  function reset(now = Date.now(), { preserveNoise = false } = {}) {
    speechAt = now; recognitionAt = -Infinity; acousticAt = -Infinity;
    if (!preserveNoise) { noiseFloor = .0015; ambientUpper = .0015; vowelNoiseFloor = .0015; calibrated = false; }
    if (!preserveNoise || !calibrated) calibrationMs = 0;
    calibrationFrames = []; calibrationVowels = []; calibrationSquares = 0; calibrationSamples = 0;
    history = []; activityWindow = []; recent = []; voicing.reset();
    candidateMs = 0; quietMs = 0; voiced = false; confirmedRun = false;
    lastVariationAt = -Infinity; voiceLevel = 0; previousAt = now; captureAt = 0;
    dropAt = null; steadyDropMs = 0; latestRms = 0; releaseLevel = 0;
    periodicVoice = false; activeWindowMs = 0; activityReason = 'quiet'; vowelEnergyThreshold = 0;
    return speechAt;
  }

  function calibrate(samples) {
    if (calibrated) return true;
    if (!samples?.length) return false;
    captureAt = Date.now();
    // Both energy and vowel-pattern checks see the same quiet microphone.
    // An upper envelope includes ordinary room fluctuations, not just minima.
    for (let offset = 0; offset < samples.length; offset += FRAME_SAMPLES) {
      const metric = voicing.observe(samples.subarray(offset, Math.min(samples.length, offset + FRAME_SAMPLES)));
      if (metric.ready) calibrationVowels.push(metric.windowRms);
    }
    // Startup collects room sound before recitation begins. Accumulate full
    // 20 ms frames across chunks so a short final fragment has no extra weight.
    for (const value of samples) {
      const sample = Number.isFinite(value) ? value : 0;
      calibrationSquares += sample * sample;
      if (++calibrationSamples < FRAME_SAMPLES) continue;
      latestRms = Math.sqrt(calibrationSquares / FRAME_SAMPLES);
      calibrationFrames.push(latestRms);
      calibrationMs += FRAME_SAMPLES / 16;
      calibrationSquares = 0; calibrationSamples = 0;
      if (calibrationMs < CALIBRATION_MS) continue;
      // The lower envelope avoids letting isolated clicks/breaths define the
      // ambient floor used to distinguish a softer held vowel from quiet.
      const sorted = calibrationFrames.slice().sort((a, b) => a - b);
      noiseFloor = Math.max(MIN_NOISE, sorted[Math.floor((sorted.length - 1) * .2)]);
      ambientUpper = Math.max(noiseFloor, sorted[Math.floor((sorted.length - 1) * .8)]);
      const vowelLevels = calibrationVowels.slice().sort((a, b) => a - b);
      vowelNoiseFloor = Math.max(MIN_NOISE, vowelLevels.length
        ? vowelLevels[Math.floor((vowelLevels.length - 1) * .8)] : ambientUpper);
      calibrated = true; calibrationFrames = []; calibrationVowels = [];
      return true;
    }
    return false;
  }

  function noteRecognition(now = Date.now()) {
    // Recognition can revise old sounds long after the learner went quiet.
    // Confirm recent microphone activity; never date speech by delivery time
    // or erase a quiet plateau because an older hypothesis changed.
    if (now - acousticAt > 640 || (!voiced && candidateMs < 80)) return speechAt;
    recognitionAt = acousticAt;
    speechAt = Math.max(speechAt, acousticAt);
    confirmedRun = true;
    return speechAt;
  }

  function observe(samples, now = Date.now()) {
    if (!samples?.length) return speechAt;
    captureAt = now;
    const duration = samples.length / 16;
    // A discontinuity must not combine two short sounds into sustained speech.
    if (previousAt && now - previousAt > Math.max(1000, duration * 2)) {
      candidateMs = 0; quietMs = 0; voiced = false; confirmedRun = false;
      voiceLevel = 0; history = []; activityWindow = []; activeWindowMs = 0;
      dropAt = null; steadyDropMs = 0; voicing.reset();
    }
    previousAt = now;
    let chunkActiveMs = 0, chunkSupportedMs = 0, chunkPeakRms = 0;
    for (let offset = 0; offset < samples.length; offset += FRAME_SAMPLES) {
      const end = Math.min(samples.length, offset + FRAME_SAMPLES);
      const frameMs = (end - offset) / 16;
      const frameAt = now - duration + end / 16;
      let squares = 0;
      for (let index = offset; index < end; index++) {
        const sample = Number.isFinite(samples[index]) ? samples[index] : 0;
        squares += sample * sample;
      }
      const rms = Math.sqrt(squares / (end - offset));
      chunkPeakRms = Math.max(chunkPeakRms, rms);
      const metric = voicing.observe(samples.subarray(offset, end));
      latestRms = rms;
      history.push(rms);
      if (history.length > HISTORY_FRAMES) history.shift();
      const envelope = history.slice(-24).sort((a, b) => a - b);
      const low = envelope[Math.floor((envelope.length - 1) * .2)];
      const high = envelope[Math.floor((envelope.length - 1) * .8)];
      const varies = envelope.length >= 4 && high > Math.max(.0025, low * 1.5);
      if (varies) lastVariationAt = frameAt;
      const recognizedRecently = frameAt - recognitionAt <= 1200;
      const ambientRelease = Math.max(MIN_NOISE * 1.5, noiseFloor * 1.35);
      // Strong ordinary speech and softer periodic vowels have separate gates.
      // The latter protects madd without relying on ASR tokens or old loudness.
      releaseLevel = Math.max(.0025, noiseFloor * 2.2, ambientUpper * 1.4);
      vowelEnergyThreshold = Math.max(MIN_NOISE * 1.5, vowelNoiseFloor * 1.35);
      periodicVoice = metric.ready && metric.periodicity >= .65 && metric.windowRms >= vowelEnergyThreshold;
      const strongSound = rms >= releaseLevel && (varies || recognizedRecently ||
        (voiced && frameAt - lastVariationAt <= 600));
      const recognitionSupport = recognizedRecently && rms >= ambientRelease;
      const evidence = periodicVoice || strongSound || recognitionSupport;
      activityWindow.push({ ms: frameMs, evidence });
      let windowMs = activityWindow.reduce((sum, frame) => sum + frame.ms, 0);
      // Use audio duration, so delayed/batched callbacks cannot enlarge support.
      while (windowMs > ACTIVITY_WINDOW_MS && activityWindow.length > 1) windowMs -= activityWindow.shift().ms;
      activeWindowMs = activityWindow.reduce((sum, frame) => sum + (frame.evidence ? frame.ms : 0), 0);
      candidateMs = evidence ? activeWindowMs : 0;
      // A fresh ASR extension may confirm a shorter audible candidate. Merely
      // dating it does not let an 80 ms noise burst refresh the pause clock.
      if (evidence && activeWindowMs >= 80) acousticAt = frameAt;
      const supported = evidence && activeWindowMs >= REQUIRED_ACTIVITY_MS;
      if (evidence) chunkActiveMs += frameMs;
      if (supported) chunkSupportedMs += frameMs;
      activityReason = supported ? periodicVoice ? 'periodic-vowel' : strongSound ? 'sustained-energy' : 'recent-recognition'
        : evidence ? 'candidate' : 'quiet';

      if (supported) {
        voiced = true; quietMs = 0; dropAt = null; steadyDropMs = 0;
        voiceLevel = Math.max(high, voiceLevel);
        confirmedRun = confirmedRun || recognizedRecently;
        acousticAt = frameAt;
        speechAt = Math.max(speechAt, frameAt);
      } else if (voiced) {
        // Brief noise crossings no longer reset quiet or refresh speechAt.
        // A continuing vowel still supplies supported frames indefinitely.
        if (dropAt === null) dropAt = frameAt;
        quietMs += frameMs; steadyDropMs = quietMs;
        if (quietMs >= 240) {
          voiced = false; confirmedRun = false; voiceLevel = 0;
        }
      }
      if (!voiced && !evidence && rms < releaseLevel) {
        const sorted = [...history].sort((a, b) => a - b);
        const ambient = Math.max(MIN_NOISE, sorted[Math.floor((sorted.length - 1) * .2)]);
        // Learn background only outside a supported voice/candidate window.
        // Startup's upper envelopes remain available to reject fluctuating noise.
        const rate = ambient < noiseFloor ? .12 : varies ? .015 : .08;
        noiseFloor += (ambient - noiseFloor) * rate;
      }
    }
    const metric = voicing.metric;
    recent.push({ at: now, rms: latestRms, noiseFloor, releaseLevel, windowRms: metric.windowRms,
      periodicity: metric.periodicity, pitchHz: metric.pitchHz, periodicVoice, activeWindowMs,
      chunkActiveMs, chunkSupportedMs, chunkPeakRms, quietMs, voiced, reason: activityReason, speechAt });
    if (recent.length > 20) recent.shift();
    return speechAt;
  }

  reset();
  return { reset, calibrate, observe, noteRecognition, get speechAt() { return speechAt; }, get captureAt() { return captureAt; },
    get diagnostic() { return { voiced, confirmedRun, noiseFloor, voiceLevel, latestRms, releaseLevel,
      candidateMs, quietMs, steadyDropMs, dropAt, acousticAt, recognitionAt, lastVariationAt,
      calibrated, calibrationMs, ambientUpper, vowelNoiseFloor, vowelEnergyThreshold,
      ...voicing.metric, periodicVoice, activeWindowMs, activityWindowMs: ACTIVITY_WINDOW_MS,
      requiredActivityMs: REQUIRED_ACTIVITY_MS, activityReason,
      recent: recent.map(({ at, speechAt: lastSpeech, ...frame }) => ({ ageMs: Math.max(0, Date.now() - at),
        speechAgeMs: Math.max(0, at - lastSpeech), ...frame })) }; } };
}
