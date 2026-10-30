/**
 * IDEA9103 Group E — Audio Mechanic V3: The Garden Listens
 * Contributor module; revised after team feedback (October 2026).
 *
 * Design: AUDIO ADDS LIGHT, never scales flowers or recolours their dots.
 *  - Bass transients briefly brighten each bloom, strongest at the centre.
 *  - Lower frequencies light up inner dots; higher ones light up outer dots.
 *  - Midrange energy drives a circular travelling light.
 *  - Treble produces sparse, reproducible glints.
 *  - Tonal balance changes ring-light hue between blue and gold.
 *  - Quiet music dims the background only, not the plants.
 *  - The Perlin net brightens during beats without changing geometry.
 *
 * Uses browser Web Audio API, not p5.sound. All drawing uses p5.js.
 * Read-only integration with the current team's clock and flower data.
 * AI acknowledgement: Developed with assistance from ChatGPT (OpenAI).
 * Review, test and adapt this code before final group submission.
 */

const AUDIO_LIGHT_BANDS = [
  {low: 35, high: 160, release: 5},
  {low: 160, high: 500, release: 5},
  {low: 500, high: 1800, release: 5},
  {low: 1800, high: 5500, release: 7},
  {low: 5500, high: 12000, release: 8}
];
const AUDIO_LIGHT_COOL = [115, 175, 255];
const AUDIO_LIGHT_WARM = [255, 208, 120];
const AUDIO_LIGHT_MAX_DOTS = 520;

function audioClamp(value, lo=0, hi=1) {
  return Math.min(hi, Math.max(lo, value));
}
function audioBlend(a, b, k) {
  return a.map((v, i) => v + (b[i] - v) * audioClamp(k));
}
function audioEase(x) {
  x = audioClamp(x); return x * x * (3 - 2 * x);
}
function audioHash(n) {
  const x = Math.sin(n * 127.7 + 9.3) * 43758.54;
  return x - Math.floor(x);
}
function audioColourOf(dot) {
  if (Array.isArray(dot.rgb)) return dot.rgb;
  if (dot.colour) return [red(dot.colour), green(dot.colour), blue(dot.colour)];
  return [255, 255, 255];
}

class AudioEnergyBand {
  constructor(settings) {
    this.settings = settings;
    this.noiseFloor = 0;
    this.ceiling = 0.2;
    this.raw = 0;
    this.energy = 0;
  }
  sample(value, dt) {
    this.raw = audioClamp(value);
    const floorRate = value < this.noiseFloor ? 0.20 : Math.min(1, dt * 0.6);
    this.noiseFloor += (value - this.noiseFloor) * floorRate;
    this.ceiling = Math.max(value, this.ceiling - dt * 0.04, this.noiseFloor + 0.10);
    const contrast = audioClamp((value - this.noiseFloor) / (this.ceiling - this.noiseFloor));
    const target = Math.pow(contrast, 1.45);
    const rate = target > this.energy ? 19 : this.settings.release;
    this.energy += (target - this.energy) * Math.min(1, dt * rate);
  }
}

class GroupAudioMechanic {
  constructor(audioElement) {
    if (!audioElement) throw new Error('An <audio> element is required.');
    this.element = audioElement;
    this.context = null;
    this.analyser = null;
    this.fft = null;
    this.bands = AUDIO_LIGHT_BANDS.map(x => new AudioEnergyBand(x));
    this.loudness = 0;
    this.warmth = 0.35;
    this.beatPulse = 0;
    this.lastBass = 0;
    this.typicalRise = 0.015;
    this.beatCooldown = 0;
    this.rotation = 0;
    this.lastUpdate = null;
    this.started = false;
    this.playError = '';
  }

  async play() {
    try {
      if (!this.context) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('Web Audio API is unavailable in this browser.');
        this.context = new AC();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.52;
        this.fft = new Uint8Array(this.analyser.frequencyBinCount);
        const source = this.context.createMediaElementSource(this.element);
        source.connect(this.analyser);
        this.analyser.connect(this.context.destination);
      }
      // Begin both operations inside the SAME user gesture; important for Safari.
      const playback = this.element.play();
      const resumed = this.context.resume();
      await Promise.all([playback, resumed]);
      this.started = true;
      this.playError = '';
      return true;
    } catch (error) {
      this.playError = String(error.message || error);
      throw error;
    }
  }
  pause() { this.element.pause(); }
  stop() { this.element.pause(); try { this.element.currentTime = 0; } catch (_) {} }
  // Change source while keeping the SAME audio element and its analyser connection.
  loadFile(file) {
    if (!file) return;
    if (this.objectURL) URL.revokeObjectURL(this.objectURL);
    this.objectURL = URL.createObjectURL(file);
    this.pause();
    this.element.src = this.objectURL;
    this.element.load();
    this.playError = '';
  }
  band(i) { return this.bands[i].energy; }
  isPlaying() { return this.started && !this.element.paused && !this.element.ended; }
  lightTint() { return audioBlend(AUDIO_LIGHT_COOL, AUDIO_LIGHT_WARM, this.warmth); }

  update() {
    const now = performance.now() / 1000;
    const dt = this.lastUpdate === null ? (1 / 60) : audioClamp(now - this.lastUpdate, 0, 0.1);
    this.lastUpdate = now;
    const playing = this.isPlaying() && this.analyser;
    let total = 0, centroid = 0;
    if (playing) {
      this.analyser.getByteFrequencyData(this.fft);
    }
    const hzPerBin = playing ? this.context.sampleRate / this.analyser.fftSize : 1;
    this.bands.forEach((band, i) => {
      let raw = 0;
      if (playing) {
        const first = Math.max(0, Math.ceil(band.settings.low / hzPerBin));
        const last = Math.min(this.fft.length, Math.max(first + 1, Math.ceil(band.settings.high / hzPerBin)));
        let sum = 0;
        for (let k = first; k < last; k++) sum += this.fft[k];
        raw = sum / ((last - first) * 255);
      }
      band.sample(raw, dt);
      total += raw;
      centroid += raw * i;
    });
    const volumeTarget = audioClamp(total / this.bands.length / 0.28);
    this.loudness += (volumeTarget - this.loudness) * Math.min(1, dt * (volumeTarget > this.loudness ? 6 : 2.5));
    if (playing && total > 0.025) {
      const targetWarmth = audioClamp((centroid / total / 4 - 0.24) * 1.7);
      this.warmth += (targetWarmth - this.warmth) * Math.min(1, dt * 2.0);
    }
    const bass = this.bands[0].raw;
    const rise = Math.max(0, bass - this.lastBass);
    this.lastBass = bass;
    this.beatCooldown = Math.max(0, this.beatCooldown - dt);
    if (playing && this.beatCooldown <= 0 && bass > 0.22 && rise > this.typicalRise * 2.7 + 0.025) {
      this.beatPulse = 1;
      this.beatCooldown = 0.22;
    }
    this.typicalRise += (rise - this.typicalRise) * Math.min(1, dt * 2.8);
    this.beatPulse *= Math.exp(-5.2 * dt);
    // The melodic light travels faster when the middle bands become active.
    if (playing) this.rotation += dt * (0.55 + 4.5 * this.band(2));
  }
}

/** Read only the lifecycle information currently exposed by Team E's Time Mechanic.
 * Current implementation: completed self-drawing flowers BEGIN WILTING immediately;
 * noisy flowers stay open after blooming. We do not invent MATURE_SECONDS/flower.life.
 */
function groupFlowerAudioPhase(flower, wilts) {
  const name = (typeof clockOf === 'function') ? clockOf(flower) : null;
  const clock = name && typeof CLOCKS !== 'undefined' ? CLOCKS[name] : null;
  const now = (typeof clockNow === 'function') ? clockNow() : millis() / 1000;
  if (flower instanceof FlowerDotAnimator) {
    if (!flower.finished) {
      if (clock && now < clock.start) return {name:'bud', strength:0, dots:[]};
      return {name:'bloom', strength:0.55, dots:flower.dots || []};
    }
    const wilt = (wilts || []).find(w => w.flower === flower && !w.gone);
    if (!wilt) return {name:'rest', strength:0, dots:[]};
    const age = wilt.timer && wilt.timer.seconds ? wilt.timer.seconds() : 0;
    const duration = typeof WILT_SECONDS === 'number' ? WILT_SECONDS : 15;
    const remaining = audioClamp(1 - age / duration);
    const strength = (0.30 + 0.30 * Math.exp(-age / 1.3)) * remaining;
    const dots = wilt.dots.filter(d => d.state === 'attached').map(d => ({
      x:d.x, y:d.y + d.droop(age), size:d.size, rgb:d.colourAt(age)
    }));
    return {name:'wilt', strength, dots};
  }
  // In the current NoisyFlowerBloom, the visible dot subset depends on its clock.
  if (!clock) return {name:'mature', strength:1, dots:flower.dots || []};
  const tau = now - clock.start;
  if (tau < 0) return {name:'bud', strength:0, dots:[]};
  if (tau < clock.bloom) {
    const progress = audioClamp(tau / clock.bloom);
    const look = flower.bloomClock && typeof flower.bloomClock.bloomLook === 'function'
      ? flower.bloomClock.bloomLook(progress) : null;
    return {name:'bloom', strength:0.55, dots:look ? look.dots : []};
  }
  return {name:'mature', strength:1, dots:flower.dots || []};
}

/** Called AFTER the team draws a flower, in the same breeze transform. */
function drawGroupAudioFlowerLights(flower, mechanic, wiltList) {
  if (!mechanic || !mechanic.isPlaying()) return;
  const state = groupFlowerAudioPhase(flower, wiltList);
  if (!state.strength || !state.dots.length) return;
  const cx = flower.nx * width;
  const cy = flower.ny * height;
  const radius = flower.nr * width;
  const tint = mechanic.lightTint();
  const dots = state.dots;
  const stride = Math.max(1, Math.ceil(dots.length / AUDIO_LIGHT_MAX_DOTS));
  const blinkFrame = Math.floor(millis() / 90);
  const sweep = mechanic.rotation + flower.nx * 6;
  noFill();
  for (let i = 0; i < dots.length; i += stride) {
    const d = dots[i];
    if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) continue;
    const distance = Math.hypot(d.x, d.y);
    const angle = Math.atan2(d.y, d.x);
    const maxDistance = Math.max(0.05, flower.outline(angle));
    const f = audioClamp(distance / maxDistance);
    const band = Math.min(4, Math.floor(f * 5));
    let energy = mechanic.band(band) * 0.36;
    energy += mechanic.beatPulse * 0.85 * (1 - 0.67 * f);
    const delta = Math.atan2(Math.sin(angle - sweep), Math.cos(angle - sweep));
    energy += mechanic.band(2) * 0.77 * Math.exp(-Math.pow(delta / 0.36, 2));
    if (audioHash(i * 13.1 + blinkFrame * 3.7 + flower.nx * 11) < mechanic.band(4) * 0.11) energy += 0.95;
    energy = audioClamp(energy) * state.strength;
    if (energy < 0.09) continue;
    const original = audioColourOf(d);
    const ringColour = audioBlend(audioBlend(original, tint, 0.70), [255,255,248], 0.25);
    const diameter = Math.max(1, d.size * radius);
    stroke(ringColour[0], ringColour[1], ringColour[2], 240 * energy);
    strokeWeight(Math.max(0.8, diameter * 0.14));
    circle(cx + d.x * radius, cy + d.y * radius, diameter * 1.48);
  }
  noStroke();
}

/** Background overlay is called BEFORE stems, leaves and flowers are drawn. */
function drawGroupAudioBackgroundDim(mechanic) {
  if (!mechanic || !mechanic.started) return;
  const dim = 150 * (1 - audioEase(mechanic.loudness * 1.7));
  if (dim < 2) return;
  noStroke(); fill(3, 5, 15, dim); rect(0, 0, width, height);
}

/** Draw the SAME Perlin net in place, with a light stroke on drum hits. */
function drawGroupAudioNetGlow(mechanic, backgroundLayer, t) {
  const flash = mechanic && mechanic.isPlaying() ? mechanic.beatPulse : 0;
  if (flash < 0.035 || !backgroundLayer || !backgroundLayer.lines) return;
  const light = mechanic.lightTint();
  noFill();
  for (const line of backgroundLayer.lines) {
    const rgb = audioBlend(line.colour, light, 0.6);
    stroke(rgb[0], rgb[1], rgb[2], 180 * flash);
    strokeWeight(Math.max(0.8, line.weight * width / 900 * 1.9));
    beginShape();
    if (line.horizontal) {
      for (let x = -20; x <= width + 20; x += 10) {
        const n = noise(line.seed + (x / width) * 3, t * 0.12);
        vertex(x, line.position * height + map(n, 0, 1, -1, 1) * line.amplitude * height);
      }
    } else {
      for (let y = -20; y <= height + 20; y += 10) {
        const n = noise(line.seed + (y / height) * 3, t * 0.12);
        vertex(line.position * width + map(n, 0, 1, -1, 1) * line.amplitude * width, y);
      }
    }
    endShape();
  }
  noStroke();
}
