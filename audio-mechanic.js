/*
 * GROUP E / AUDIO MECHANIC — independent contributor module
 * Audio: browser Web Audio API (RMS amplitude from a real soundtrack).
 * No generated GIF is used as a substitute for sound analysis.
 * Original Group E flower drawing and time mechanics remain in their own files.
 * AI assistance: this module was drafted with OpenAI ChatGPT. Please review,
 * test, revise, and disclose retained assistance in the final README.
 */
class GroupAudioMechanic {
  constructor(audioElement) {
    this.element = audioElement;
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.samples = null;
    this.level = 0;
    this.smoothedLevel = 0;
    this.flowerScale = 1;
    this.sensitivity = 0.12; // RMS value expected to count as a loud moment
  }

  async play() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio API is not supported by this browser.');
      this.context = new AudioContextClass();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.6;
      this.samples = new Uint8Array(this.analyser.fftSize);
      this.source = this.context.createMediaElementSource(this.element);
      this.source.connect(this.analyser);
      this.analyser.connect(this.context.destination);
    }
    await this.context.resume();
    await this.element.play(); // User gesture is required by browsers.
  }

  pause() { this.element.pause(); }

  stop() {
    this.element.pause();
    try { this.element.currentTime = 0; } catch (_) {}
    // The team's Time Mechanic is intentionally NOT reset here.
  }

  setSensitivity(value) {
    const v = Number(value);
    if (Number.isFinite(v)) this.sensitivity = Math.max(0.03, Math.min(0.30, v));
  }

  update() {
    const active = !this.element.paused && !this.element.ended && !!this.analyser;
    let rms = 0;
    if (active) {
      this.analyser.getByteTimeDomainData(this.samples);
      let sum = 0;
      for (const sample of this.samples) {
        const x = (sample - 128) / 128;
        sum += x * x;
      }
      rms = Math.sqrt(sum / this.samples.length);
    }
    this.level = rms;
    this.smoothedLevel += (rms - this.smoothedLevel) * 0.18;
    // Only playing music changes size. Silence/no playback settles to normal.
    const energy = Math.min(1, this.smoothedLevel / this.sensitivity);
    const target = active ? 0.78 + energy * 0.52 : 1;
    this.flowerScale += (target - this.flowerScale) * 0.10;
  }

  // B flowers already start mature in the actual team's current code.
  scaleForMatureBloom() { return this.flowerScale; }

  // A flowers create FlowerWilt the instant drawing finishes; let the
  // initial mature/wilt transition respond, then relinquish control to Time.
  scaleForWitheringBloom(wilt) {
    const elapsed = wilt && wilt.timer ? wilt.timer.seconds() : 0;
    const weight = Math.max(0, 1 - elapsed / 5.0);
    return 1 + (this.flowerScale - 1) * weight;
  }
}

// Apply scale around the flower HEAD's own centre. Stems, leaves, perlin
// background and timer state stay untouched. Used only from sketch.js.
function drawWithGroupAudioScale(flower, scaleValue, render) {
  const cx = flower.nx * width;
  const cy = flower.ny * height;
  push();
  translate(cx, cy);
  scale(scaleValue);
  translate(-cx, -cy);
  try { render(); } finally { pop(); }
}
