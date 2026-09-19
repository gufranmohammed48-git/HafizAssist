// Continuous 16 kHz mono resampling; state persists across 128-frame worklet blocks.
class RecitationCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.phase = 0; this.sum = 0; this.weight = 0;
    this.buffer = new Float32Array(5120); this.length = 0; this.active = true;
    this.port.onmessage = ({ data }) => {
      if (data === 'flush') {
        this.active = false;
        if (this.length) { const tail = this.buffer.slice(0, this.length); this.port.postMessage({ samples: tail }, [tail.buffer]); }
        this.port.postMessage({ flushed: true });
      }
    };
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || !this.active) return true;
    for (const sample of input) {
      let remaining = 1;
      while (remaining > 1e-9) {
        const take = Math.min(remaining, this.ratio - this.phase);
        this.sum += sample * take; this.weight += take; this.phase += take; remaining -= take;
        if (this.phase >= this.ratio - 1e-9) {
          this.buffer[this.length++] = this.sum / this.weight;
          this.phase = 0; this.sum = 0; this.weight = 0;
          if (this.length === this.buffer.length) {
            this.port.postMessage({ samples: this.buffer }, [this.buffer.buffer]);
            this.buffer = new Float32Array(5120); this.length = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor('recitation-capture', RecitationCapture);
