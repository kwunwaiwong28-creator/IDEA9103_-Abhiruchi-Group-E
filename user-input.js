/*
 * USER INPUT — HANGJING YE
 *
 * Touch the garden. The flowers and leaves answer a click the way real
 * plants answer a light touch, without hiding what the other mechanics draw:
 * the team's blooming, wilting and drifting dots always stay fully visible.
 *
 * Clicking a FLOWER:
 *   - the flower head gives a small springy bounce (it is never faded or covered)
 *   - and, outside the flower, one of three things happens:
 *       01 BREEZE  — a few dots are blown off the petal edge, away from the
 *                    click, and a gust goes through the garden: the leaves and
 *                    the falling wilted dots sway with it.
 *       02 POLLEN  — a few dots pop off the petal edge and drift down slowly,
 *                    like pollen shaken from a flower.
 *       03 RIPPLE  — rings of small dots spread outwards from the flower's
 *                    edge, like a drop on a pond.
 *
 * Clicking a LEAF flicks it: it swings on a damped spring (like a real leaf
 * flicked with a finger) and settles back into the shared wind.
 *
 * Clicking a STEM pushes the whole plant: the stem leans from its base and
 * sways back and forth on a slower spring, carrying its flower head and its
 * leaves with it, and the leaves give a small flutter of their own.
 *
 * How it stays non-destructive:
 *   - The team's flower objects (animatedFlowers, noisyFlowers, leaves) are
 *     only READ. Loose dots are new particles in the flower's own colours.
 *   - The bounce scales the flower head around its own centre by wrapping the
 *     existing draw methods, the same way time-mechanic.js wraps
 *     perlin-layer.js. Their code is not edited.
 *   - The leaf swing and the gust are added through the wind value that
 *     perlin-layer.js already uses (windStrength() and WindLeaf.draw()).
 *   - The stem sway moves the stem top only while Stem.draw() runs and puts
 *     it straight back, so time-mechanic.js still controls the real stem.
 *   - setup() and draw() from sketch.js are wrapped, not replaced.
 *
 * Controls (panel, bottom left): choose a flower effect or "Random", and set
 * the click strength. Keyboard: Tab to the canvas, arrow keys choose a
 * flower, Enter / Space triggers it.
 *
 * Techniques from outside the course (also listed in README.md):
 *   - pointer events (one handler for mouse, pen and touch)
 *     https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
 *   - prefers-reduced-motion: smaller motion for people who ask the OS for it
 *     https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
 *   - easeInOutSine curve for soft starts and stops: https://easings.net/#easeInOutSine
 *   - damped spring (harmonic oscillator) for the leaf swing, the stem sway and
 *     the flower bounce, stepped each frame: https://www.ryanjuckett.com/damped-springs/
 *
 * AI acknowledgement: the first version (click detection, control panel,
 * copying the dots) was written with help from ChatGPT (OpenAI). The later
 * versions (the flower bounce, the three edge effects, the wind gust, the
 * leaf spring, the stem sway, the dotted hover ring and the keyboard controls) were written
 * with help from Claude (Anthropic), then tested and edited by me.
 */

(() => {
  'use strict';

  // ---------------------------------------------------------------- settings
  const EFFECTS = ['breeze', 'pollen', 'ripple'];
  const LABELS = { breeze: 'Breeze', pollen: 'Pollen', ripple: 'Ripple' };

  const LIFETIME = 3400;        // ms for one flower effect
  const LOOSE_DOTS = 46;        // dots released from the petal edge per click
  const DOT_SCALE = 0.55;       // loose dots are drawn smaller than the originals
  const GUST = 1.1;             // extra wind added to windStrength() by BREEZE

  // Springs: a damped oscillator  a'' = -w²·a - 2·z·w·a'
  const LEAF = { freq: 1.3, damping: 0.11, kick: 3.6 };     // leaf swing (radians)
  const BOUNCE = { freq: 2.4, damping: 0.16, kick: 1.1 };   // flower head (scale)
  const STEM = { freq: 0.9, damping: 0.08, kick: 0.3 };     // stem top (fraction of canvas width)

  const leafSwing = new Map();   // leaf   → { angle, speed, last }
  const flowerBounce = new Map(); // flower → { angle, speed, last }  (angle = extra scale)
  const stemSway = new Map();     // stem   → { angle, speed, last }  (angle = sideways offset)
  const stemOfFlower = new Map(); // flower → its stem, found once at the start

  let active = [];              // running flower effects
  let lastEffect = -1;
  let lastClickAt = -Infinity;
  let intensity = 1.0;
  let selection = 'random';
  let status = null;
  let keyboardIndex = -1;       // flower chosen with the arrow keys

  const reduceMotion = !!(
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // ------------------------------------------------------------ small helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeInOutSine = (v) => 0.5 - 0.5 * Math.cos(Math.PI * v);
  const strength = () => intensity * (reduceMotion ? 0.35 : 1);

  function rgbOfDot(d) {
    if (Array.isArray(d.rgb)) return d.rgb;
    if (d.colour && typeof red === 'function') {
      return [red(d.colour), green(d.colour), blue(d.colour)];
    }
    return [232, 190, 160];
  }

  // One step of a damped spring, using the real frame time.
  function stepSpring(state, spring, now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    const w = Math.PI * 2 * spring.freq;
    const accel = -w * w * state.angle - 2 * spring.damping * w * state.speed;
    state.speed += accel * dt;
    state.angle += state.speed * dt;
    return Math.abs(state.angle) < 0.0005 && Math.abs(state.speed) < 0.005;   // settled?
  }

  // ------------------------------------------------------- the team's flowers
  function flowers() {
    const list = [];
    if (typeof animatedFlowers !== 'undefined') list.push(...animatedFlowers);
    if (typeof noisyFlowers !== 'undefined') list.push(...noisyFlowers);
    return list;
  }

  // nx, ny are 0–1 canvas coordinates; returns the flower under that point.
  function flowerAt(nx, ny) {
    let best = null;
    let bestDistance = Infinity;
    for (const flower of flowers()) {
      const d = Math.hypot(nx - flower.nx, (ny - flower.ny) * height / width);
      if (d < flower.nr * 1.15 && d < bestDistance) {
        best = flower;
        bestDistance = d;
      }
    }
    return best;
  }

  // Edge of the flower (in flower units) in the direction of angle a.
  function edgeOf(flower, a) {
    return typeof flower.outline === 'function' ? flower.outline(a) : 1;
  }

  // ------------------------------------------- flower bounce (wrapping)
  // The flower head is drawn scaled around its own centre by the spring.
  // Nothing is faded or hidden, so the other mechanics stay readable.
  function withBounce(getFlower, original) {
    return function (...args) {
      const flower = getFlower(this);
      const state = flower && flowerBounce.get(flower);
      const shift = flower ? flowerShift(flower) : 0;      // carried by a swaying stem
      if (!state && !shift) return original.apply(this, args);

      let grow = 1;
      if (state) {
        if (stepSpring(state, BOUNCE, performance.now())) flowerBounce.delete(flower);
        grow = 1 + state.angle;
      }
      const cx = flower.nx * width;
      const cy = flower.ny * height;
      push();
      translate(cx + shift, cy);
      scale(grow);
      translate(-cx, -cy);
      try {
        return original.apply(this, args);
      } finally {
        pop();
      }
    };
  }

  function wrapFlowerDrawing() {
    if (typeof FlowerDotAnimator !== 'undefined') {
      const p = FlowerDotAnimator.prototype;
      p.update = withBounce((self) => self, p.update);
    }
    if (typeof NoisyFlower !== 'undefined') {
      const p = NoisyFlower.prototype;
      p.draw = withBounce((self) => self, p.draw);
    }
    // After a self-drawing flower is finished, time-mechanic.js draws it
    // through FlowerWilt, so that bounces too.
    if (typeof FlowerWilt !== 'undefined') {
      const p = FlowerWilt.prototype;
      p.update = withBounce((self) => self.flower, p.update);
    }
  }

  function bounceFlower(flower) {
    const state = flowerBounce.get(flower) || { angle: 0, speed: 0, last: performance.now() };
    state.speed += BOUNCE.kick * strength();
    flowerBounce.set(flower, state);
  }

  // ------------------------------------------------ gust in the team's wind
  // windStrength(t) from perlin-layer.js drives the leaves and the falling
  // wilted dots. BREEZE adds a gust on top, in the direction it blows.
  function gustEnvelope(p) {
    if (p <= 0 || p >= 1) return 0;
    return p < 0.25 ? easeInOutSine(p / 0.25) : easeInOutSine(1 - (p - 0.25) / 0.75);
  }

  function currentGust(now) {
    let gust = 0;
    for (const pulse of active) {
      if (pulse.type !== 'breeze') continue;
      gust += gustEnvelope((now - pulse.start) / LIFETIME) * GUST * strength() * Math.sign(pulse.windX || 1);
    }
    return gust;
  }

  function wrapWind() {
    if (typeof window.windStrength !== 'function') return;
    const teamWind = window.windStrength;
    window.windStrength = function (t) {
      return teamWind(t) + currentGust(performance.now());
    };
  }

  // ---------------------------------------------------------- leaves (spring)
  // The swing a WindLeaf draws is (wind · 0.28 + flutter) · lengthFactor
  // (perlin-layer.js). To add the spring angle without editing that file,
  // the wind passed to draw() is raised by the matching amount.
  function leafLengthFactor(leaf) {
    const f = (leaf.lengthN - 0.1) / 0.3;
    return 1 + (0.55 - 1) * clamp01(f);
  }

  // The leaf's main axis angle on screen, the same rotation draw() uses.
  function leafAxis(leaf, swing) {
    return leaf.direction === 1 ? -leaf.tilt + swing : Math.PI + leaf.tilt - swing;
  }

  function wrapLeaves() {
    if (typeof WindLeaf === 'undefined') return;
    const teamDraw = WindLeaf.prototype.draw;
    WindLeaf.prototype.draw = function (t, wind) {
      const state = leafSwing.get(this);
      let extra = 0;
      if (state) {
        if (stepSpring(state, LEAF, performance.now())) leafSwing.delete(this);
        extra = state.angle;
      }
      // a leaf on a swaying stem is carried sideways with it
      const follow = leafOnSwayingStem(this);
      const homeX = this.px;
      if (follow) this.px += follow.offset;

      // remember what was drawn, so a click can be tested against it
      const lf = leafLengthFactor(this);
      this.uiSwing = (wind * 0.28) * lf + extra;
      try {
        return teamDraw.call(this, t, wind + extra / (0.28 * lf));
      } finally {
        this.uiX = this.px;
        this.px = homeX;
      }
    };
  }

  // Is the canvas point (x, y) in pixels on this leaf? If so, return where.
  function leafHit(leaf, x, y) {
    const L = leaf.lengthN * width;
    const W = L * leaf.widthRatio;
    const a = leafAxis(leaf, leaf.uiSwing || 0);
    const dx = x - (leaf.uiX !== undefined ? leaf.uiX : leaf.px) * width;
    const dy = y - leaf.py * height;
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    const across = -dx * Math.sin(a) + dy * Math.cos(a);
    if (along < 0 || along > L) return null;
    const halfWidth = W * 0.72 * Math.sin(Math.PI * along / L) + 4;
    if (Math.abs(across) > halfWidth) return null;
    return { along: along / L, across };
  }

  function leafAt(x, y) {
    if (typeof leaves === 'undefined') return null;
    for (let i = leaves.length - 1; i >= 0; i--) {   // top-most first
      const hit = leafHit(leaves[i], x, y);
      if (hit) return { leaf: leaves[i], hit };
    }
    return null;
  }

  // Flick the leaf away from the finger: the tip moves to the other side
  // of the click, harder when the click is near the tip.
  function kickLeaf(leaf, hit) {
    const state = leafSwing.get(leaf) || { angle: 0, speed: 0, last: performance.now() };
    const away = hit.across > 0 ? -1 : 1;                 // screen rotation direction
    const toSwing = leaf.direction === 1 ? 1 : -1;        // swing turns the other way on mirrored leaves
    state.speed += away * toSwing * LEAF.kick * strength() * (0.45 + 0.55 * hit.along);
    leafSwing.set(leaf, state);
    if (status) status.textContent = 'Leaf';
  }

  // ----------------------------------------------------------- stems (sway)
  // A pushed stem leans from its base: the top moves sideways by the spring
  // offset, and anything further down moves less (nothing at the base).
  function stemsList() {
    return typeof stems !== 'undefined' ? stems : [];
  }

  // Which stem holds this flower: the stem whose top is nearest the flower
  // centre. Found once, because time-mechanic.js moves stem tops later.
  function stemFor(flower) {
    if (stemOfFlower.has(flower)) return stemOfFlower.get(flower);
    let best = null;
    let bestDistance = 0.05;
    for (const stem of stemsList()) {
      const d = Math.hypot(stem.topX - flower.nx, stem.topY - flower.ny);
      if (d < bestDistance) { best = stem; bestDistance = d; }
    }
    stemOfFlower.set(flower, best);
    return best;
  }

  // Sideways offset of the flower head in pixels (0 if its stem is still).
  function flowerShift(flower) {
    const stem = stemFor(flower);
    const state = stem && stemSway.get(stem);
    return state ? state.angle * width : 0;
  }

  // How far along the stem a point is (0 = top, 1 = base) and how far from it.
  function alongStem(stem, x, y) {
    const x1 = stem.topX * width, y1 = stem.topY * height;
    const x2 = stem.bottomX * width, y2 = stem.bottomY * height;
    const vx = x2 - x1, vy = y2 - y1;
    const f = clamp01(((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy));
    const distance = Math.hypot(x - (x1 + vx * f), y - (y1 + vy * f));
    return { f, distance };
  }

  function leafOnSwayingStem(leaf) {
    for (const [stem, state] of stemSway) {
      const where = alongStem(stem, leaf.px * width, leaf.py * height);
      if (where.distance < width * 0.012) return { offset: state.angle * (1 - where.f) };
    }
    return null;
  }

  function wrapStems() {
    if (typeof Stem === 'undefined') return;
    const teamDraw = Stem.prototype.draw;
    Stem.prototype.draw = function (...args) {
      const state = stemSway.get(this);
      if (!state) return teamDraw.apply(this, args);
      if (stepSpring(state, STEM, performance.now())) stemSway.delete(this);
      const homeX = this.topX;
      this.topX = homeX + state.angle;          // lean for this drawing only
      try {
        return teamDraw.apply(this, args);
      } finally {
        this.topX = homeX;                      // the team's stem is unchanged
      }
    };
  }

  // Is the canvas point (x, y) in pixels on a stem? Returns the stem and where.
  function stemAt(x, y) {
    for (const stem of stemsList()) {
      const where = alongStem(stem, x, y);
      const thick = stem.thicknessN * width;
      if (where.distance < thick * 0.6 + 4 && where.f > 0.02) return { stem, f: where.f, side: x };
    }
    return null;
  }

  // Push the stem away from the finger; a push high up moves it more.
  // Its leaves give a small flutter of their own as the stem starts to move.
  function pushStem(stem, f, clickX) {
    const state = stemSway.get(stem) || { angle: 0, speed: 0, last: performance.now() };
    const stemX = (stem.topX + (stem.bottomX - stem.topX) * f) * width;
    const away = clickX < stemX ? 1 : -1;
    state.speed += away * STEM.kick * strength() * (0.4 + 0.6 * (1 - f));
    stemSway.set(stem, state);

    if (typeof leaves !== 'undefined') {
      for (const leaf of leaves) {
        if (alongStem(stem, leaf.px * width, leaf.py * height).distance < width * 0.012) {
          const ls = leafSwing.get(leaf) || { angle: 0, speed: 0, last: performance.now() };
          ls.speed += -away * (leaf.direction === 1 ? 1 : -1) * 1.4 * strength();
          leafSwing.set(leaf, ls);
        }
      }
    }
    if (status) status.textContent = 'Stem';
  }

  // ------------------------------------------------------------- click → effect
  // Loose dots start ON the petal edge and only move outwards, so they never
  // cover the flower. Their colours come from the flower's own outer dots.
  function edgeColours(flower) {
    const colours = [];
    if (Array.isArray(flower.dots)) {
      for (const d of flower.dots) {
        const x = Number.isFinite(d.x) ? d.x : d.hx;
        const y = Number.isFinite(d.y) ? d.y : d.hy;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const r = Math.hypot(x, y) / edgeOf(flower, Math.atan2(y, x));
        if (r > 0.6) colours.push(rgbOfDot(d));                // petal dots, not the centre
      }
    }
    if (!colours.length && typeof PALETTE !== 'undefined') {
      colours.push(...[PALETTE.crimson, PALETTE.gold, PALETTE.white].filter(Boolean));
    }
    return colours.length ? colours : [[235, 230, 220]];
  }

  function makeLooseDots(flower, type, clickAngle, windX, windY) {
    const colours = edgeColours(flower);
    const dots = [];
    for (let i = 0; i < LOOSE_DOTS; i++) {
      let a;
      if (type === 'breeze') {
        // the far edge (opposite the click) lets go, so the dots blow away
        // from the flower instead of across it
        a = clickAngle + Math.PI + (Math.random() - 0.5) * 2.0;
      } else {
        a = Math.random() * Math.PI * 2;
      }
      const r = edgeOf(flower, a) * (0.96 + Math.random() * 0.08);
      dots.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        angle: a,
        size: 0.03 + Math.random() * 0.03,
        rgb: colours[Math.floor(Math.random() * colours.length)],
        seed: Math.random(),
        delay: Math.random() * 0.18          // they let go one after another
      });
    }
    return dots;
  }

  function pickEffect() {
    let index = EFFECTS.indexOf(selection);
    if (index < 0) {
      index = Math.floor(Math.random() * EFFECTS.length);
      if (index === lastEffect) index = (index + 1 + Math.floor(Math.random() * 2)) % EFFECTS.length;
    }
    lastEffect = index;
    return EFFECTS[index];
  }

  function trigger(flower, nx, ny) {
    const now = performance.now();
    if (now - lastClickAt < 150) return false;
    lastClickAt = now;

    const type = pickEffect();
    const clickX = (nx - flower.nx) / flower.nr;
    const clickY = (ny - flower.ny) * height / (flower.nr * width);
    const clickAngle = Math.hypot(clickX, clickY) > 0.2 ? Math.atan2(clickY, clickX) : Math.PI;

    // The breeze blows away from the click point (a click in the middle
    // blows to the right, like the team's default wind), a little upwards.
    let windX = -Math.cos(clickAngle);
    let windY = -Math.sin(clickAngle) * 0.4 - 0.2;
    const wl = Math.hypot(windX, windY);
    windX /= wl;
    windY /= wl;

    bounceFlower(flower);

    const dots = type === 'ripple' ? [] : makeLooseDots(flower, type, clickAngle, windX, windY);
    active = active.filter((p) => now - p.start < LIFETIME);
    active.push({ flower, type, start: now, dots, windX, windY });
    if (active.length > 4) active.shift();

    if (status) status.textContent = LABELS[type];
    return true;
  }

  // ------------------------------------------------------- the edge effects
  // Position of a loose dot after t seconds (flower units, 1 = flower radius).
  function looseDotAt(pulse, d, t, k) {
    const s = d.seed;
    let x = d.x;
    let y = d.y;

    if (pulse.type === 'breeze') {
      // carried along the wind; Perlin noise makes each path wander
      const travel = k * (0.5 + 0.9 * s) * easeInOutSine(clamp01(t / 2.2));
      const sway = (noise(s * 40, t * 0.7) - 0.5) * 0.5 * k * clamp01(t / 0.6);
      x += pulse.windX * travel - pulse.windY * sway;
      y += pulse.windY * travel + pulse.windX * sway;
    }

    else if (pulse.type === 'pollen') {
      // a small hop outwards, then a slow fall with a sideways flutter
      const hop = k * (0.12 + 0.18 * s) * (1 - Math.exp(-t * 4));
      const fall = 0.12 * t * t * (0.6 + 0.6 * s);
      const flutter = Math.sin(t * (2 + 2 * s) + s * 6.3) * 0.06 * clamp01(t);
      x += Math.cos(d.angle) * hop + flutter;
      y += Math.sin(d.angle) * hop + fall;
    }

    return [x, y];
  }

  function drawEffects(now) {
    const k = strength();

    for (const pulse of active) {
      const p = (now - pulse.start) / LIFETIME;
      const flower = pulse.flower;
      const cx = flower.nx * width;
      const cy = flower.ny * height;
      const R = flower.nr * width;

      if (pulse.type === 'ripple') {
        drawRipple(flower, p, cx, cy, R);
        continue;
      }

      for (const d of pulse.dots) {
        const t = Math.max(0, (p - d.delay) * LIFETIME / 1000);
        if (t <= 0) continue;
        const [x, y] = looseDotAt(pulse, d, t, k);
        // fade in quickly, fade out over the last 40 % (crisp dots, no blur)
        const life = clamp01((p - d.delay) / (1 - d.delay));
        const alpha = 255 * clamp01(life / 0.08) * clamp01((1 - life) / 0.4);
        fill(d.rgb[0], d.rgb[1], d.rgb[2], alpha);
        circle(cx + x * R, cy + y * R, Math.max(1.5, d.size * R * DOT_SCALE * 1.6));
      }
    }
  }

  // Rings of small dots spread out from the flower's edge (never over it).
  function drawRipple(flower, p, cx, cy, R) {
    const dot = Math.max(1.5, R * 0.024);
    for (let i = 0; i < 3; i++) {
      const q = clamp01((p - i * 0.16) / 0.75);
      if (q <= 0 || q >= 1) continue;
      const grow = 1.06 + 0.6 * easeInOutSine(q);       // starts just outside the petals
      fill(240, 244, 255, 235 * (1 - q) * (1 - i * 0.25));
      // enough dots that they read as a ring (about 2.6 dot-widths apart)
      const count = Math.max(24, Math.floor((Math.PI * 2 * grow * R) / (dot * 2.6)));
      for (let j = 0; j < count; j++) {
        const a = (j / count) * Math.PI * 2 + i * 0.25;
        const r = edgeOf(flower, a) * grow * R;            // the ring follows the petal shape
        circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dot);
      }
    }
  }

  // A ring of small dots slowly circles the flower that can be clicked
  // (mouse hover or keyboard). Leaves and stems only change the cursor.
  function drawHover(now) {
    let flower = null;
    let overLeaf = false;
    const mouseIn = typeof mouseX === 'number' && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
    if (keyboardIndex >= 0) {
      flower = flowers()[keyboardIndex] || null;
    } else if (mouseIn) {
      flower = flowerAt(mouseX / width, mouseY / height);
      if (!flower) overLeaf = !!leafAt(mouseX, mouseY) || !!stemAt(mouseX, mouseY);
    }

    const canvas = document.querySelector('canvas');
    if (canvas) canvas.style.cursor = flower || overLeaf ? 'pointer' : 'default';
    if (!flower) return;

    const R = flower.nr * width;
    const cx = flower.nx * width + flowerShift(flower);
    const cy = flower.ny * height;
    const ringR = R * 1.18;
    const count = 36;
    const turn = now / 6000;                          // one turn every ~38 s
    const dot = Math.max(2, R * 0.034);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + turn;
      const glint = 0.7 + 0.3 * Math.sin(a * 3 - now / 500);     // a slow shimmer runs round the ring
      fill(255, 255, 255, 230 * glint);
      circle(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, dot);
    }
  }

  function display() {
    if (typeof push !== 'function' || typeof width !== 'number') return;
    const now = performance.now();
    active = active.filter((p) => now - p.start < LIFETIME);

    push();
    noStroke();
    drawHover(now);
    drawEffects(now);
    pop();
  }

  // --------------------------------------------------------- control panel
  function makeControls() {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed; z-index:30; left:14px; bottom:14px;
      background:rgba(8,12,27,.92); color:#e8eaf2;
      padding:12px 14px; border:1px solid #3b4f72; border-radius:12px;
      font:12px/1.5 system-ui,sans-serif; width:220px;
      box-shadow:0 8px 30px #0008;
    `;

    const title = document.createElement('div');
    title.textContent = 'USER INPUT · TOUCH THE GARDEN';
    title.style.cssText = 'letter-spacing:.11em;font-weight:700;margin-bottom:8px;color:#d8e0f5';
    panel.append(title);

    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Choose flower click effect');
    select.style.cssText = `width:100%;padding:7px;border:1px solid #526180;border-radius:6px;background:#121b30;color:white;`;
    const options = [['random', 'Random · three effects'], ...EFFECTS.map((e, i) => [e, '0' + (i + 1) + ' ' + LABELS[e]])];
    for (const [value, label] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    select.addEventListener('change', () => { selection = select.value; });
    panel.append(select);

    const row = document.createElement('div');
    row.style.cssText = 'margin-top:10px;display:flex;justify-content:space-between';
    const amountLabel = document.createElement('span');
    amountLabel.textContent = 'Click strength';
    const amount = document.createElement('span');
    amount.textContent = intensity.toFixed(1) + '×';
    row.append(amountLabel, amount);
    panel.append(row);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.4';
    slider.max = '1.8';
    slider.step = '0.1';
    slider.value = String(intensity);
    slider.setAttribute('aria-label', 'Click strength');
    slider.style.cssText = 'width:100%;accent-color:#95b9df';
    slider.addEventListener('input', () => {
      intensity = Number(slider.value);
      amount.textContent = intensity.toFixed(1) + '×';
    });
    panel.append(slider);

    status = document.createElement('div');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Click a flower, a leaf or a stem';
    status.style.cssText = 'margin-top:8px;color:#aebdd5';
    panel.append(status);

    document.body.append(panel);
  }

  // ------------------------------------------- hook into the p5 lifecycle
  const originalSetup = window.setup;
  const originalDraw = window.draw;
  if (typeof originalSetup !== 'function' || typeof originalDraw !== 'function') {
    console.error('user-input.js must load AFTER sketch.js');
    return;
  }

  wrapFlowerDrawing();
  wrapWind();
  wrapLeaves();
  wrapStems();

  window.setup = function (...args) {
    const result = originalSetup.apply(this, args);
    const canvas = document.querySelector('canvas');

    if (canvas) {
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('aria-label',
        'Interactive flower garden. Click a flower to make it bounce and shed a few dots, a leaf to make it swing, or a stem to make the plant sway. Arrow keys and Enter choose and trigger flowers.');

      canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        keyboardIndex = -1;
        const rect = canvas.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = (event.clientY - rect.top) / rect.height;
        const flower = flowerAt(nx, ny);
        if (flower) {
          trigger(flower, nx, ny);
          return;
        }
        const onLeaf = leafAt(nx * width, ny * height);
        if (onLeaf) {
          kickLeaf(onLeaf.leaf, onLeaf.hit);
          return;
        }
        const onStem = stemAt(nx * width, ny * height);
        if (onStem) pushStem(onStem.stem, onStem.f, nx * width);
        else if (status) status.textContent = 'Click a flower, a leaf or a stem';
      });

      canvas.addEventListener('keydown', (event) => {
        const list = flowers();
        if (!list.length) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          keyboardIndex = (keyboardIndex + 1) % list.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          keyboardIndex = (keyboardIndex - 1 + list.length) % list.length;
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (keyboardIndex < 0) keyboardIndex = 0;
          const f = list[keyboardIndex];
          trigger(f, f.nx, f.ny);
        }
      });
      canvas.addEventListener('blur', () => { keyboardIndex = -1; });
    }

    makeControls();
    return result;
  };

  window.draw = function (...args) {
    const result = originalDraw.apply(this, args);
    display();
    return result;
  };
})();
