// Local pitch-pattern evidence, not a speech classifier or Tajweed grader.
const WINDOW = 240; // 60 ms after averaging 16 kHz PCM down to 4 kHz.
const COMPARE = 160;
const FIRST_LAG = 6, LAST_LAG = 67;

export function createTeacherVoicing() {
  const ring = new Float32Array(WINDOW), centered = new Float64Array(WINDOW);
  const correlations = new Float64Array(LAST_LAG + 2);
  let write = 0, count = 0, groupSum = 0, groupCount = 0;
  let current = { ready: false, periodicity: 0, pitchHz: 0, windowRms: 0 };

  function reset() {
    ring.fill(0); centered.fill(0); correlations.fill(0);
    write = 0; count = 0; groupSum = 0; groupCount = 0;
    current = { ready: false, periodicity: 0, pitchHz: 0, windowRms: 0 };
  }

  function observe(samples) {
    for (const value of samples || []) {
      groupSum += Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
      if (++groupCount < 4) continue;
      ring[write] = groupSum / 4;
      write = (write + 1) % WINDOW;
      count = Math.min(WINDOW, count + 1);
      groupSum = 0; groupCount = 0;
    }
    if (count < WINDOW) return { ...current };

    let mean = 0;
    for (let i = 0; i < WINDOW; i++) mean += ring[i];
    mean /= WINDOW;
    for (let i = 0; i < WINDOW; i++) centered[i] = ring[(write + i) % WINDOW] - mean;
    const start = WINDOW - COMPARE;
    let energy = 0;
    for (let i = start; i < WINDOW; i++) energy += centered[i] * centered[i];
    const windowRms = Math.sqrt(Math.max(0, energy / COMPARE));
    correlations.fill(0);
    if (energy > 1e-18) {
      // Equal-length comparisons keep large lags from winning through a
      // shrinking overlap. Neighboring lags distinguish a periodic peak
      // from the ordinary similarity of adjacent waveform samples.
      for (let lag = FIRST_LAG - 1; lag <= LAST_LAG + 1; lag++) {
        let dot = 0, shiftedEnergy = 0;
        for (let i = start; i < WINDOW; i++) {
          const shifted = centered[i - lag];
          dot += centered[i] * shifted;
          shiftedEnergy += shifted * shifted;
        }
        const denominator = Math.sqrt(energy * shiftedEnergy);
        correlations[lag] = denominator > 1e-18 ? Math.max(-1, Math.min(1, dot / denominator)) : 0;
      }
    }
    let periodicity = 0, pitchHz = 0;
    for (let lag = FIRST_LAG; lag <= LAST_LAG; lag++) {
      const strength = correlations[lag];
      if (strength > periodicity && strength > correlations[lag - 1] && strength >= correlations[lag + 1]) {
        periodicity = strength; pitchHz = 4000 / lag;
      }
    }
    current = { ready: true, periodicity, pitchHz, windowRms };
    return { ...current };
  }

  return { reset, observe, get metric() { return { ...current }; } };
}
