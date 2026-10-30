/*
 * IDEA9103 GROUP E — AUDIO MECHANIC V4: THE GARDEN LISTENS
 * Contributor: Audio Mechanic
 *
 * Drop-in module for the group's EXISTING index.html, which already loads
 * audio-mechanic.js. Do not upload music files: this file composes and plays
 * an ORIGINAL, gentle electronic loop with the browser Web Audio API.
 * Click Play Music once: browsers deliberately block unrequested sound.
 *
 * The music's real frequency data and beat events drive additive lighting:
 * bass -> central halo; mids -> revolving ring; treble -> dot glints.
 * None of the team's flowers, colours, petals, stems or clocks are changed.
 * Works independently of sketch.js, perlin-layer.js, time-mechanic.js and
 * user-input.js: the light is drawn on a transparent, pointer-free overlay.
 *
 * AI acknowledgement: developed with ChatGPT (OpenAI) assistance;
 * review and disclose this in the team's README before final submission.
 */
(() => {
  'use strict';
  if (window.__GROUP_E_AUDIO_V4__) return;
  window.__GROUP_E_AUDIO_V4__ = true;

  const BPM = 96;
  const STEP = 60 / BPM / 4; // 16th-note step
  const CHORDS = [[50, 53, 57], [48, 52, 55], [46, 50, 53], [43, 46, 50]];
  const LEAD = [
    74, 0, 77, 0, 81, 0, 79, 0, 77, 0, 74, 0, 72, 0, 74, 0,
    72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 69, 0, 72, 0,
    70, 0, 74, 0, 77, 0, 79, 0, 77, 0, 74, 0, 72, 0, 70, 0,
    69, 0, 74, 0, 77, 0, 74, 0, 72, 0, 69, 0, 67, 0, 69, 0
  ];
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
  const tnow = () => performance.now() / 1000;
  const fade = x => { const v = clamp(x); return v * v * (3 - 2 * v); };
  const bandRanges = [[40, 190], [190, 600], [600, 2000], [2000, 5000], [5000, 12000]];
  const randomHash = n => {
    const v = Math.sin(n * 127.1 + 63.71) * 43758.5453;
    return v - Math.floor(v);
  };

  class GardenGeneratedMusic {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.analyser = null;
      this.data = null;
      this.timer = null;
      this.nextAt = 0;
      this.step = 0;
      this.playing = false;
      this.volume = 0.55;
      this.bands = [0, 0, 0, 0, 0];
      this.level = 0;
      this.beat = 0;
      this.noteEvents = [];
      this.phase = 0;
      this.lastTick = tnow();
      this.noiseBuffer = null;
    }

    create() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Your browser does not support Web Audio.');
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.volume;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -19;
      limiter.knee.value = 18;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.008;
      limiter.release.value = 0.18;
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.55;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.master.connect(limiter);
      limiter.connect(this.analyser);
      this.analyser.connect(c.destination);

      // White-noise buffer is synthesised in memory, NOT downloaded or uploaded.
      this.noiseBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.28), c.sampleRate);
      const arr = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < arr.length; i++) arr[i] = Math.random() * 2 - 1;
    }

    oscillator(midi, at, length, type, gain, cutoff = 0) {
      const c = this.ctx;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(midiHz(midi), at);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + length);
      if (cutoff) {
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        o.connect(filter);
        filter.connect(g);
      } else {
        o.connect(g);
      }
      g.connect(this.master);
      o.start(at);
      o.stop(at + length + 0.03);
    }

    drum(at, kind) {
      const c = this.ctx;
      if (kind === 'kick') {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(148, at);
        o.frequency.exponentialRampToValueAtTime(47, at + 0.17);
        g.gain.setValueAtTime(0.001, at);
        g.gain.linearRampToValueAtTime(0.65, at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.24);
        o.connect(g); g.connect(this.master); o.start(at); o.stop(at + 0.25);
        this.noteEvents.push({ time: at, kind: 'kick' });
      } else {
        const n = c.createBufferSource();
        n.buffer = this.noiseBuffer;
        const f = c.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = kind === 'snare' ? 1100 : 6500;
        const g = c.createGain();
        const amp = kind === 'snare' ? 0.12 : 0.052;
        const dur = kind === 'snare' ? 0.14 : 0.055;
        g.gain.setValueAtTime(amp, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        n.connect(f); f.connect(g); g.connect(this.master);
        n.start(at); n.stop(at + dur);
      }
    }

    scheduleStep(n, at) {
      const beatIndex = n % 16;
      const bar = Math.floor(n / 16) % CHORDS.length;
      const root = CHORDS[bar][0] - 12;
      if (beatIndex === 0) {
        for (const note of CHORDS[bar]) this.oscillator(note + 12, at, STEP * 13.8, 'sine', 0.036, 1000);
      }
      if ([0, 8].includes(beatIndex)) this.drum(at, 'kick');
      if ([4, 12].includes(beatIndex)) this.drum(at, 'snare');
      if (beatIndex % 2 === 0) this.drum(at, 'hat');
      if ([0, 6, 8, 12].includes(beatIndex)) {
        this.oscillator(root + (beatIndex === 6 ? 7 : 0), at, STEP * 3.7, 'triangle', 0.13, 540);
      }
      const note = LEAD[n % LEAD.length];
      if (note) {
        this.oscillator(note, at, STEP * 2.3, 'sine', 0.08, 2900);
        this.oscillator(note + 12, at, STEP * 1.8, 'triangle', 0.016, 3200);
      }
    }

    schedule() {
      if (!this.playing || !this.ctx) return;
      while (this.nextAt < this.ctx.currentTime + 0.17) {
        this.scheduleStep(this.step, this.nextAt);
        this.step = (this.step + 1) % 64;
        this.nextAt += STEP;
      }
    }

    async play() {
      if (!this.ctx) this.create();
      // Called directly from a user click, not in page-load code.
      await this.ctx.resume();
      if (this.playing) return;
      this.playing = true;
      this.nextAt = Math.max(this.nextAt, this.ctx.currentTime + 0.035);
      this.timer = setInterval(() => this.schedule(), 30);
      this.schedule();
    }

    async pause() {
      this.playing = false;
      clearInterval(this.timer); this.timer = null;
      if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
    }

    setVolume(v) {
      this.volume = clamp(v, 0, 1);
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.025);
      }
    }

    update() {
      const now = tnow();
      const dt = clamp(now - this.lastTick, 0, 0.09);
      this.lastTick = now;
      if (!this.ctx || !this.playing) {
        for (let i = 0; i < 5; i++) this.bands[i] *= Math.exp(-7 * dt);
        this.beat *= Math.exp(-7 * dt);
        this.level *= Math.exp(-7 * dt);
        return;
      }
      this.analyser.getByteFrequencyData(this.data);
      const hz = this.ctx.sampleRate / this.analyser.fftSize;
      let energy = 0;
      bandRanges.forEach(([lo, hi], i) => {
        let left = Math.max(0, Math.floor(lo / hz));
        let right = Math.min(this.data.length, Math.max(left + 1, Math.ceil(hi / hz)));
        let avg = 0;
        for (let k = left; k < right; k++) avg += this.data[k];
        avg /= (right - left) * 255;
        const target = clamp(avg * (i < 2 ? 3.8 : 5.8));
        this.bands[i] += (target - this.bands[i]) * Math.min(1, dt * (target > this.bands[i] ? 14 : 5));
        energy += this.bands[i];
      });
      this.level += (clamp(energy / 3) - this.level) * Math.min(1, dt * 5);
      const current = this.ctx.currentTime;
      while (this.noteEvents.length && this.noteEvents[0].time <= current) {
        this.noteEvents.shift();
        this.beat = 1;
      }
      this.beat *= Math.exp(-5.7 * dt);
      this.phase += dt * (0.45 + this.bands[2] * 2.8);
    }
  }

  const music = new GardenGeneratedMusic();
  window.GroupEGeneratedAudio = music;
  let overlay = null;
  let octx = null;
  let targetCanvas = null;

  function flowerInfo() {
    // Shared classic <script> globals are accessible even when declared via let.
    try {
      const a = (typeof animatedFlowers !== 'undefined' && Array.isArray(animatedFlowers)) ? animatedFlowers : [];
      const b = (typeof noisyFlowers !== 'undefined' && Array.isArray(noisyFlowers)) ? noisyFlowers : [];
      const w = (typeof wilts !== 'undefined' && Array.isArray(wilts)) ? wilts : [];
      return { flowers: a.concat(b), wilts: w };
    } catch (_) {
      return { flowers: [], wilts: [] };
    }
  }

  function visualData(f, wilts) {
    const wilt = wilts.find(w => w.flower === f && !w.gone);
    if (wilt && wilt.dots) {
      const secs = typeof wilt.timer?.seconds === 'function' ? wilt.timer.seconds() : 0;
      const strength = clamp(0.65 * (1 - secs / 15));
      const dots = wilt.dots.filter(d => d.state === 'attached').map(d => ({
        x: d.x, y: d.y + (typeof d.droop === 'function' ? d.droop(secs) : 0), size: d.size
      }));
      return { strength, dots };
    }
    if (f.finished && f.onCreated && !wilt) return { strength: 0, dots: [] };
    // The team's bloom clocks and regrowth are responsible for showing dots.
    let strength = f.finished ? 0.2 : 1;
    let dots = f.dots || [];
    if (f.life || f.bloomClock) {
      const b = f.life || f.bloomClock;
      if (typeof clockNow === 'function' && b.clock) {
        const sec = clockNow() - b.clock.start;
        if (sec < 0) return { strength: 0, dots: [] };
        if (typeof b.period === 'number' && b.period > 0) {
          const cycle = ((sec % b.period) + b.period) % b.period;
          const bs = b.clock.bloom;
          const mature = typeof MATURE_SECONDS === 'number' ? MATURE_SECONDS : 6;
          const wiltLen = typeof WILT_SECONDS === 'number' ? WILT_SECONDS : 15;
          if (cycle >= bs + mature + wiltLen) return { strength: 0, dots: [] };
          if (cycle >= bs + mature) {
            strength = 0.35 * (1 - (cycle - bs - mature) / wiltLen);
            if (b.flower?.dots) dots = b.flower.dots.filter(d => !d.dropped);
          } else if (cycle < bs) {
            strength = 0.35 + 0.65 * fade(cycle / bs);
            if (typeof b.bloomLook === 'function') {
              try { dots = b.bloomLook(cycle / bs).dots || []; } catch (_) { /* nonessential lights */ }
            }
          } else {
            strength = 1;
          }
        }
      }
    }
    return { strength, dots };
  }

  function ensureOverlay() {
    if (!targetCanvas || !targetCanvas.isConnected) {
      targetCanvas = document.querySelector('canvas.p5Canvas') ||
        Array.from(document.querySelectorAll('canvas')).find(c => c.id !== 'group-e-audio-light');
    }
    if (!targetCanvas) return false;
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'group-e-audio-light';
      Object.assign(overlay.style, {
        position: 'fixed', pointerEvents: 'none', zIndex: '10',
        display: 'block', background: 'transparent'
      });
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
      octx = overlay.getContext('2d');
    }
    const r = targetCanvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(r.width * ratio), ch = Math.round(r.height * ratio);
    if (overlay.width !== cw || overlay.height !== ch) {
      overlay.width = cw; overlay.height = ch;
    }
    overlay.style.left = `${r.left}px`;
    overlay.style.top = `${r.top}px`;
    overlay.style.width = `${r.width}px`;
    overlay.style.height = `${r.height}px`;
    octx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return true;
  }

  function render() {
    requestAnimationFrame(render);
    music.update();
    if (!ensureOverlay()) return;
    const width = targetCanvas.getBoundingClientRect().width;
    const height = targetCanvas.getBoundingClientRect().height;
    octx.clearRect(0, 0, width, height);
    if (!music.playing) return;
    const scene = flowerInfo();
    if (!scene.flowers.length) return;
    const bass = music.bands[0], mids = music.bands[2];
    const treble = music.bands[4], beat = music.beat;
    const strength = clamp(0.25 + bass * 0.6 + mids * 0.5 + beat * 0.35);

    // Soft additive halos: overlay only, no edits to source dots or flower geometry.
    octx.globalCompositeOperation = 'lighter';
    for (const f of scene.flowers) {
      const cx = f.nx * width, cy = f.ny * height, radius = f.nr * width;
      if (![cx, cy, radius].every(Number.isFinite)) continue;
      const state = visualData(f, scene.wilts);
      if (state.strength <= 0 || !state.dots.length) continue;
      const rad = radius * (0.35 + 0.25 * bass);
      const glow = octx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const a = clamp(state.strength * (bass * 0.15 + beat * 0.17));
      glow.addColorStop(0, `rgba(250,215,155,${a})`);
      glow.addColorStop(1, 'rgba(80,150,255,0)');
      octx.fillStyle = glow;
      octx.beginPath(); octx.arc(cx, cy, rad, 0, Math.PI * 2); octx.fill();
      const stride = Math.max(1, Math.ceil(state.dots.length / 270));
      const tint = mids > bass ? [250, 206, 125] : [120, 187, 255];
      for (let i = 0; i < state.dots.length; i += stride) {
        const d = state.dots[i];
        const dx = Number.isFinite(d.x) ? d.x : d.hx;
        const dy = Number.isFinite(d.y) ? d.y : d.hy;
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const sweep = Math.atan2(Math.sin(angle - music.phase - f.nx * 8), Math.cos(angle - music.phase - f.nx * 8));
        let e = bass * (1 - clamp(distance)) * 0.50;
        e += mids * Math.exp(-Math.pow(sweep / 0.45, 2)) * 0.58;
        if (randomHash(i * 17.2 + Math.floor(tnow() * 9) * 13 + f.nx) < treble * 0.12) e += 0.8;
        e += beat * 0.5;
        e = clamp(e * strength * state.strength);
        if (e < 0.14) continue;
        const x = cx + dx * radius, y = cy + dy * radius;
        const dotSize = clamp((d.size || 0.035) * radius, 1.5, 18);
        octx.beginPath(); octx.arc(x, y, dotSize * 0.84, 0, Math.PI * 2);
        octx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.80 * e})`;
        octx.lineWidth = Math.max(0.8, dotSize * 0.19);
        octx.stroke();
      }
    }
    octx.globalCompositeOperation = 'source-over';
  }

  function createControls() {
    if (document.getElementById('group-e-audio-ui')) return;
    const panel = document.createElement('div');
    panel.id = 'group-e-audio-ui';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Garden music controls');
    Object.assign(panel.style, {
      position: 'fixed', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '100', display: 'flex', gap: '9px', alignItems: 'center',
      maxWidth: 'calc(100vw - 20px)', padding: '10px 14px',
      borderRadius: '16px', border: '1px solid rgba(172,190,255,0.38)',
      background: 'rgba(10,14,32,0.91)', color: '#f6f7ff',
      boxShadow: '0 8px 28px rgba(0,0,0,.4)', font: '13px system-ui, sans-serif'
    });
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = '▶ Play Music';
    Object.assign(button.style, {
      border: '1px solid #a8b9f4', borderRadius: '11px', padding: '10px 14px',
      background: '#293d87', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
      font: '600 13px system-ui, sans-serif'
    });
    const volume = document.createElement('input');
    volume.type = 'range'; volume.min = '0'; volume.max = '100';
    volume.value = '55'; volume.setAttribute('aria-label', 'Music volume');
    volume.title = 'Volume'; volume.style.width = '65px';
    volume.addEventListener('input', () => music.setVolume(Number(volume.value) / 100));
    const status = document.createElement('span');
    status.textContent = 'Built-in music · no MP3 needed';
    status.style.fontSize = '11px'; status.style.opacity = '0.9';
    status.style.whiteSpace = 'nowrap';
    const mq = window.matchMedia?.('(max-width: 480px)');
    if (mq?.matches) status.textContent = 'Original soundtrack';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        if (music.playing) {
          await music.pause();
          button.textContent = '▶ Play Music'; status.textContent = 'Paused';
        } else {
          await music.play();
          button.textContent = '❚❚ Pause'; status.textContent = 'Original soundtrack playing';
        }
      } catch (err) {
        status.textContent = 'Audio error: ' + (err?.message || err);
        console.error('Group E Audio:', err);
      } finally { button.disabled = false; }
    });
    panel.append(button, volume, status);
    document.body.appendChild(panel);
  }

  function init() { createControls(); requestAnimationFrame(render); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
