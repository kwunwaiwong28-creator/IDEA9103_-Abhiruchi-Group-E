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
 * Every click also sends a COLOUR WAVE through the background net: the
 * wavy lines light up in the colour of what was clicked (the flower's petal
 * colour, green for a leaf or stem) as the wave passes, then fade back.
 *
 * The mouse itself is a DOT: the system arrow is hidden and replaced by a
 * small Kusama-style dot with a short trail of smaller dots. It grows over
 * anything that can be touched and squeezes then springs back on a click.
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
 *   - The colour wave changes each background line's colour only while
 *     PerlinBackground.draw() runs, then restores it, so the net's own
 *     colours and noise movement are untouched.
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
 * leaf spring, the stem sway, the colour wave, the dot cursor, the dotted hover ring and the keyboard controls) were written
 * with help from Claude (Anthropic), then tested and edited by me.
 */

(() => {
  'use strict';

  // ---------------------------------------------------------------- settings
  // The three flower effects. "Random" in the panel picks one per click.
  const EFFECTS = ['breeze', 'pollen', 'ripple'];
  const LABELS = { breeze: 'Breeze', pollen: 'Pollen', ripple: 'Ripple' };

  // Timing and size of the flower effects. LIFETIME is long enough for the
  // dots to travel and fade, short enough that repeated clicks feel responsive.
  const LIFETIME = 3400;        // ms for one flower effect
  const LOOSE_DOTS = 46;        // dots released from the petal edge per click
  const DOT_SCALE = 0.55;       // loose dots are drawn smaller than the originals
  const GUST = 1.1;             // extra wind added to windStrength() by BREEZE

  // Colour wave through the background net (sizes as fractions of the canvas).
  // The lit band is a Gaussian bump around the moving wave front.
  const WAVE = {
    life: 2200,                 // ms until the wave has passed and faded
    reach: 1.25,                // how far it travels (1 = canvas width)
    band: 0.11,                 // how wide the lit band is
    tint: 0.95,                 // how strongly a line takes the colour (0–1)
    thicken: 1.3                // a lit line also gets up to 1 + 1.3 = 2.3× thicker
  };
  const LEAF_TINT = [96, 176, 88];        // green from the team's LEAF_SETS

  // Dot cursor (sizes as fractions of the canvas width).
  const CURSOR = {
    size: 0.016,                // the dot when over empty space
    hoverSize: 0.026,           // the dot over a flower, leaf or stem
    trail: 6,                   // number of trailing dots
    follow: 0.45,               // how quickly each trail dot catches up (0–1)
    press: { freq: 3.2, damping: 0.25, kick: -9 }   // squeeze-and-spring on a click
  };

  // Springs: a damped oscillator  a'' = -w²·a - 2·z·w·a'
  //   freq    — swings per second when it is let go (natural frequency)
  //   damping — damping ratio z: 0 swings forever, 1 returns with no swing.
  //             Small values (about 0.1) give several swings that die away,
  //             which is how a real leaf or stem settles.
  //   kick    — speed given by one click (units of the value being sprung)
  // A leaf is light, so it swings fastest; a stem carries a flower, so it is
  // the slowest and heaviest; the flower bounce is a quick, short "nod".
  const LEAF = { freq: 1.3, damping: 0.11, kick: 3.6 };     // leaf swing (radians)
  const BOUNCE = { freq: 2.4, damping: 0.16, kick: 1.1 };   // flower head (scale)
  const STEM = { freq: 0.9, damping: 0.08, kick: 0.3 };     // stem top (fraction of canvas width)

  // Spring state is kept in Maps keyed by the team's own objects, so my
  // mechanic never has to add or change properties on their classes.
  // "angle" is the sprung value, "speed" its velocity, "last" the time of the
  // last step (for real frame time).
  const leafSwing = new Map();   // leaf   → { angle, speed, last }
  const flowerBounce = new Map(); // flower → { angle, speed, last }  (angle = extra scale)
  const stemSway = new Map();     // stem   → { angle, speed, last }  (angle = sideways offset)
  const stemOfFlower = new Map(); // flower → its stem, found once at the start

  // Dotted hover ring: its size changes on every click. The new size is
  // picked at random (1.05–1.35 × the radius, never close to the last one),
  // and a spring carries the ring there with a little overshoot, so it
  // jumps bigger or smaller and wobbles before it settles. Between clicks it
  // breathes slowly in and out.
  const RING = {
    min: 1.05, max: 1.35,       // ring radius range (× flower radius)
    spring: { freq: 1.6, damping: 0.22 },
    breathe: 0.05               // ± slow breathing on top
  };
  const ring = { goal: 1.18, angle: 1.18, speed: 0, last: 0 };

  // Interaction state shared by the functions below.
  let active = [];              // running flower effects
  let colourWaves = [];         // running colour waves: { x, y, rgb, start }
  // The cursor: its trail positions, its current size (eased towards a
  // target), the colour it takes over a flower, and its press spring.
  const cursor = { trail: [], size: 0, rgb: [245, 242, 235], inside: false, press: { angle: 0, speed: 0, last: 0 } };
  let lastEffect = -1;
  let lastClickAt = -Infinity;
  let intensity = 1.0;
  let selection = 'random';
  let status = null;
  let keyboardIndex = -1;       // flower chosen with the arrow keys

  // If the visitor's system asks for reduced motion, every effect is scaled
  // down to about a third (see strength()).
  const reduceMotion = !!(
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // ------------------------------------------------------------ small helpers
  // clamp01: keeps a value between 0 and 1.
  // easeInOutSine: 0 → 1 with a soft start and a soft stop (a half cosine).
  // strength: the click strength from the slider, reduced for reduced motion.
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeInOutSine = (v) => 0.5 - 0.5 * Math.cos(Math.PI * v);
  const strength = () => intensity * (reduceMotion ? 0.35 : 1);

  // The team stores dot colours in two ways: FlowerDotAnimator dots have an
  // [r, g, b] array, NoisyFlower dots have a p5 colour. This returns [r, g, b]
  // for either, so loose dots can use the flower's real colours.
  function rgbOfDot(d) {
    if (Array.isArray(d.rgb)) return d.rgb;
    if (d.colour && typeof red === 'function') {
      return [red(d.colour), green(d.colour), blue(d.colour)];
    }
    return [232, 190, 160];
  }

  // One step of a damped spring, using the real frame time.
  //   acceleration = -w² · angle - 2 · z · w · speed     (w = 2π · freq)
  // The first term pulls back to rest (stiffness), the second slows it down
  // (damping). Speed is updated first, then the angle (semi-implicit Euler),
  // which stays stable at frame-rate steps. dt is capped at 50 ms so that a
  // pause (e.g. switching browser tabs) does not make the spring jump.
  // Returns true once it has settled, so the caller can forget the state.
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
  // All clickable flowers: the self-drawing ones and the noisy ones.
  // typeof checks keep this file working even if a teammate renames a list.
  function flowers() {
    const list = [];
    if (typeof animatedFlowers !== 'undefined') list.push(...animatedFlowers);
    if (typeof noisyFlowers !== 'undefined') list.push(...noisyFlowers);
    return list;
  }

  // nx, ny are 0–1 canvas coordinates; returns the flower under that point.
  // The vertical distance is multiplied by height / width because flower
  // radii (nr) are measured as a fraction of the canvas WIDTH. The 1.15
  // tolerance makes the petal tips count as part of the flower.
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
  // Both flower classes have outline(angle), which gives the petal edge as a
  // multiple of the radius in that direction (spiky or rounded petals).
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
      // Scale around the flower's own centre: move the centre to the origin,
      // scale, move back. "shift" moves the head with a swaying stem.
      // push()/pop() keep this transform away from everything drawn later.
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

  // Replace each drawing method with a wrapped version that still calls the
  // team's original method. getFlower tells the wrapper which flower an
  // object belongs to (a FlowerWilt draws on behalf of its flower).
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

  // A click adds speed to the flower's spring (it does not set the size
  // directly), so quick repeated clicks add up naturally.
  function bounceFlower(flower) {
    const state = flowerBounce.get(flower) || { angle: 0, speed: 0, last: performance.now() };
    state.speed += BOUNCE.kick * strength();
    flowerBounce.set(flower, state);
  }

  // ------------------------------------------------ gust in the team's wind
  // windStrength(t) from perlin-layer.js drives the leaves and the falling
  // wilted dots. BREEZE adds a gust on top, in the direction it blows.
  // p is the progress of the effect (0–1). The gust rises over the first
  // 25 % and dies away over the remaining 75 %, like a real gust of wind.
  function gustEnvelope(p) {
    if (p <= 0 || p >= 1) return 0;
    return p < 0.25 ? easeInOutSine(p / 0.25) : easeInOutSine(1 - (p - 0.25) / 0.75);
  }

  // Sum of all running breezes. Math.sign(windX) makes the gust blow left or
  // right, the same way as the loose dots.
  function currentGust(now) {
    let gust = 0;
    for (const pulse of active) {
      if (pulse.type !== 'breeze') continue;
      gust += gustEnvelope((now - pulse.start) / LIFETIME) * GUST * strength() * Math.sign(pulse.windX || 1);
    }
    return gust;
  }

  // window.windStrength is the global function from perlin-layer.js, so
  // replacing it here changes the wind for every leaf and falling dot.
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
  // Same as map(lengthN, 0.1, 0.4, 1, 0.55, true) in WindLeaf.draw():
  // longer leaves swing less for the same wind.
  function leafLengthFactor(leaf) {
    const f = (leaf.lengthN - 0.1) / 0.3;
    return 1 + (0.55 - 1) * clamp01(f);
  }

  // The leaf's main axis angle on screen, the same rotation draw() uses.
  function leafAxis(leaf, swing) {
    return leaf.direction === 1 ? -leaf.tilt + swing : Math.PI + leaf.tilt - swing;
  }

  // Each frame: step the leaf's spring, then draw the leaf with
  //   wind + springAngle / (0.28 · lengthFactor)
  // which makes WindLeaf.draw() rotate it by exactly springAngle more.
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
  // The click is turned into the leaf's own coordinates with two dot
  // products: "along" runs from the stalk (0) to the tip (L), "across" is the
  // distance from the middle vein. The leaf is widest in the middle, so the
  // allowed width follows sin(π · along / L), plus 4 px for easier clicking.
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

  // Leaves drawn later are on top, so they are tested first.
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
  // A rigid lean is a good match for a short sway and keeps Stem.draw()
  // unchanged: only the top point moves, the base stays planted.
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
  // Projection of a point onto the stem line: f is found with a dot product
  // and clamped to the stem, then distance is measured to that closest point.
  function alongStem(stem, x, y) {
    const x1 = stem.topX * width, y1 = stem.topY * height;
    const x2 = stem.bottomX * width, y2 = stem.bottomY * height;
    const vx = x2 - x1, vy = y2 - y1;
    const f = clamp01(((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy));
    const distance = Math.hypot(x - (x1 + vx * f), y - (y1 + vy * f));
    return { f, distance };
  }

  // A leaf whose stalk lies on a swaying stem (within 1.2 % of the canvas
  // width) moves sideways by the sway at its height: full sway at the top
  // (f = 0), none at the base (f = 1).
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
  // A click within 60 % of the stem's thickness (plus 4 px) counts as on it.
  // The very top (f < 0.02) belongs to the flower head instead.
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

    // Secondary motion: as the stem jerks one way, its leaves lag behind and
    // flick the other way, which makes the plant look flexible, not rigid.
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

  // ------------------------------------------------------ colour wave (net)
  // A click starts a wave at the click point. Each background line is lit
  // when the wave front passes its position: a vertical line is reached when
  // the front has travelled its horizontal distance from the click, and a
  // horizontal line its vertical distance. So the colour runs out along the
  // net's rows and columns, like dye spreading through a woven net.
  function startColourWave(x, y, rgb) {
    colourWaves.push({ x, y, rgb, start: performance.now() });
    if (colourWaves.length > 4) colourWaves.shift();
  }

  // How much one line takes a wave's colour right now (0–1).
  function waveOnLine(wave, line, now) {
    const p = (now - wave.start) / WAVE.life;
    if (p <= 0 || p >= 1) return 0;
    const front = easeInOutSine(p) * WAVE.reach * width;          // px from the click
    const distance = line.horizontal
      ? Math.abs(line.position * height - wave.y)
      : Math.abs(line.position * width - wave.x);
    const band = WAVE.band * width;
    const lit = Math.exp(-((distance - front) ** 2) / (2 * band * band));   // bright at the front
    return lit * (1 - p) * WAVE.tint;                              // and fading with time
  }

  function wrapBackground() {
    if (typeof PerlinBackground === 'undefined') return;
    const teamDraw = PerlinBackground.prototype.draw;
    PerlinBackground.prototype.draw = function (...args) {
      const now = performance.now();
      colourWaves = colourWaves.filter((w) => now - w.start < WAVE.life);
      if (!colourWaves.length || !Array.isArray(this.lines)) return teamDraw.apply(this, args);

      // tint (and thicken) each line for this drawing only
      const homes = this.lines.map((line) => ({ colour: line.colour, weight: line.weight }));
      for (const line of this.lines) {
        let colour = line.colour;
        let glow = 0;
        for (const wave of colourWaves) {
          const k = waveOnLine(wave, line, now);
          if (k > 0.002) colour = colour.map((c, i) => c + (wave.rgb[i] - c) * k);
          glow = Math.max(glow, k);
        }
        line.colour = colour;
        line.weight = line.weight * (1 + WAVE.thicken * glow);
      }
      try {
        return teamDraw.apply(this, args);
      } finally {
        this.lines.forEach((line, i) => {                               // the net is unchanged
          line.colour = homes[i].colour;
          line.weight = homes[i].weight;
        });
      }
    };
  }

  // The main petal colour of a flower: its most common outer-dot colour.
  function petalColour(flower) {
    const counts = new Map();
    let best = null;
    for (const rgb of edgeColours(flower)) {
      const key = rgb.join(',');
      const n = (counts.get(key) || 0) + 1;
      counts.set(key, n);
      if (!best || n > counts.get(best.join(','))) best = rgb;
    }
    return best || [235, 230, 220];
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

  // Each loose dot starts at a point on the petal edge (0.96–1.04 × the edge,
  // so they do not sit in a perfect line) with its own size, colour, random
  // seed and start delay. The seed makes every dot move a little differently.
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

  // The panel's choice, or a random effect that is not the same as the last
  // one (so "Random" always feels varied).
  function pickEffect() {
    let index = EFFECTS.indexOf(selection);
    if (index < 0) {
      index = Math.floor(Math.random() * EFFECTS.length);
      if (index === lastEffect) index = (index + 1 + Math.floor(Math.random() * 2)) % EFFECTS.length;
    }
    lastEffect = index;
    return EFFECTS[index];
  }

  // Starts an effect on a flower. Clicks closer than 150 ms are ignored, so a
  // double click does not start two effects on top of each other.
  // clickX / clickY are the click position in flower units (1 = radius);
  // a click near the centre counts as coming from the left (angle π).
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
    // each ripple spreads a little differently (0.5–0.7 × the radius beyond
    // the petals), so repeated ripples are not all the same
    const reach = 0.5 + Math.random() * 0.2;
    active.push({ flower, type, start: now, dots, windX, windY, reach });
    if (active.length > 4) active.shift();

    if (status) status.textContent = LABELS[type];
    return true;
  }

  // ------------------------------------------------------- the edge effects
  // Position of a loose dot after t seconds (flower units, 1 = flower radius).
  //   Breeze: travel along the wind direction with a smooth start
  //           (easeInOutSine over 2.2 s), plus a sideways sway from noise()
  //           that grows in over the first 0.6 s.
  //   Pollen: a short hop outwards that slows down (1 − e^(−4t)), then a fall
  //           that speeds up like gravity (∝ t²), with a sine flutter.
  // k is the click strength; s (the dot's seed) makes each path different.
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

  // Draws every running effect. Dots are placed relative to the flower's
  // centre (cx, cy) and radius R, so they stay right after a window resize.
  function drawEffects(now) {
    const k = strength();

    for (const pulse of active) {
      const p = (now - pulse.start) / LIFETIME;
      const flower = pulse.flower;
      const cx = flower.nx * width;
      const cy = flower.ny * height;
      const R = flower.nr * width;

      if (pulse.type === 'ripple') {
        drawRipple(flower, p, cx, cy, R, pulse.reach);
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
  // Three rings start one after another (0.16 apart in progress), each grows
  // from 1.06 × the petal outline by "reach" (random per click) and fades.
  function drawRipple(flower, p, cx, cy, R, reach = 0.6) {
    const dot = Math.max(1.5, R * 0.024);
    for (let i = 0; i < 3; i++) {
      const q = clamp01((p - i * 0.16) / 0.75);
      if (q <= 0 || q >= 1) continue;
      const grow = 1.06 + reach * easeInOutSine(q);     // starts just outside the petals
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
  // (mouse hover or keyboard).
  // (The dot cursor shows leaves and stems; see drawCursor.)
  // The keyboard choice wins over the mouse. The ring's size comes from
  // ringScale(); it turns slowly and a brightness wave runs round it.
  // Current ring size: the spring moves "angle" towards "goal".
  function ringScale(now) {
    const offset = { angle: ring.angle - ring.goal, speed: ring.speed, last: ring.last || now };
    stepSpring(offset, RING.spring, now);
    ring.angle = ring.goal + offset.angle;
    ring.speed = offset.speed;
    ring.last = offset.last;
    return ring.angle * (1 + RING.breathe * Math.sin(now / 900));
  }

  // A new random ring size, at least 0.1 away from the current one, so every
  // click visibly makes it bigger or smaller.
  function jumpRing() {
    let next;
    do {
      next = RING.min + Math.random() * (RING.max - RING.min);
    } while (Math.abs(next - ring.goal) < 0.1);
    ring.goal = next;
  }

  function drawHover(now) {
    let flower = null;
    const mouseIn = typeof mouseX === 'number' && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
    if (keyboardIndex >= 0) {
      flower = flowers()[keyboardIndex] || null;
    } else if (mouseIn) {
      flower = flowerAt(mouseX / width, mouseY / height);
    }

    if (!flower) return;

    const R = flower.nr * width;
    const cx = flower.nx * width + flowerShift(flower);
    const cy = flower.ny * height;
    const ringR = R * ringScale(now);
    const count = Math.round(30 * ring.angle);        // more dots on a bigger ring
    const turn = now / 6000;                          // one turn every ~38 s
    const dot = Math.max(2, R * 0.034);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + turn;
      const glint = 0.7 + 0.3 * Math.sin(a * 3 - now / 500);     // a slow shimmer runs round the ring
      fill(255, 255, 255, 230 * glint);
      circle(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, dot);
    }
  }

  // The dot cursor. Each trail dot moves a fixed fraction of the way towards
  // the dot in front of it every frame, so the trail lags behind and curls
  // when the mouse turns. Over something clickable the dot grows and takes
  // that thing's colour; a click squeezes it on a quick spring.
  function drawCursor(now, target) {
    // hidden when the pointer has left the canvas (p5 keeps the last mouseX)
    // or while the keyboard is being used
    if (!cursor.inside || keyboardIndex >= 0) {
      cursor.trail = [];
      return;
    }

    // trail: the first point is the mouse, the rest chase the one in front
    if (!cursor.trail.length) {
      for (let i = 0; i <= CURSOR.trail; i++) cursor.trail.push({ x: mouseX, y: mouseY });
    }
    cursor.trail[0].x = mouseX;
    cursor.trail[0].y = mouseY;
    for (let i = 1; i < cursor.trail.length; i++) {
      const a = cursor.trail[i];
      const b = cursor.trail[i - 1];
      a.x += (b.x - a.x) * CURSOR.follow;
      a.y += (b.y - a.y) * CURSOR.follow;
    }

    // size and colour ease towards what is under the mouse
    const goal = (target ? CURSOR.hoverSize : CURSOR.size) * width;
    cursor.size += (goal - cursor.size) * 0.2;
    const goalRgb = target ? target.rgb : [245, 242, 235];
    cursor.rgb = cursor.rgb.map((c, i) => c + (goalRgb[i] - c) * 0.15);

    stepSpring(cursor.press, CURSOR.press, now);
    const squeeze = Math.max(0.4, 1 + cursor.press.angle);

    // trail dots: smaller and fainter towards the end
    for (let i = cursor.trail.length - 1; i >= 1; i--) {
      const k = 1 - i / (cursor.trail.length + 1);
      fill(cursor.rgb[0], cursor.rgb[1], cursor.rgb[2], 200 * k);
      circle(cursor.trail[i].x, cursor.trail[i].y, cursor.size * 0.55 * k);
    }

    // the dot itself: a plain solid dot, no outline
    fill(cursor.rgb[0], cursor.rgb[1], cursor.rgb[2]);
    circle(mouseX, mouseY, cursor.size * squeeze);
  }

  // What is under the mouse and its colour (for the cursor).
  function cursorTarget() {
    if (typeof mouseX !== 'number') return null;
    const flower = flowerAt(mouseX / width, mouseY / height);
    if (flower) return { rgb: petalColour(flower) };
    const onLeaf = leafAt(mouseX, mouseY);
    if (onLeaf) return { rgb: (onLeaf.leaf.colours && onLeaf.leaf.colours.light) || LEAF_TINT };
    const onStem = stemAt(mouseX, mouseY);
    if (onStem) return { rgb: (onStem.stem.colours && onStem.stem.colours.mid) || LEAF_TINT };
    return null;
  }

  // Called after the team's draw() every frame, so everything here is drawn
  // on top of the garden.
  function display() {
    if (typeof push !== 'function' || typeof width !== 'number') return;
    const now = performance.now();
    active = active.filter((p) => now - p.start < LIFETIME);

    push();
    noStroke();
    drawHover(now);
    drawEffects(now);
    drawCursor(now, cursorTarget());
    pop();
  }

  // --------------------------------------------------------- control panel
  // The panel is plain HTML placed over the canvas (not drawn with p5), so it
  // stays sharp, works with the keyboard and screen readers, and does not
  // have to be redrawn every frame.
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
  // index.html loads this file AFTER sketch.js, so the team's setup() and
  // draw() already exist and can be wrapped: theirs runs first, then mine.
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
  wrapBackground();

  window.setup = function (...args) {
    const result = originalSetup.apply(this, args);
    const canvas = document.querySelector('canvas');

    if (canvas) {
      canvas.setAttribute('tabindex', '0');
      canvas.style.cursor = 'none';             // the dot cursor replaces the arrow
      canvas.setAttribute('aria-label',
        'Interactive flower garden. Click a flower to make it bounce and shed a few dots, a leaf to make it swing, or a stem to make the plant sway. Arrow keys and Enter choose and trigger flowers.');

      // One pointer handler covers mouse, pen and touch. Only the left button
      // / first finger counts. Flowers are checked first, then leaves, then
      // stems, because a flower head sits on top of its stem and leaves.
      canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        keyboardIndex = -1;
        cursor.press.last = performance.now();
        cursor.press.speed += CURSOR.press.kick;       // squeeze the dot cursor
        const rect = canvas.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = (event.clientY - rect.top) / rect.height;
        const px = nx * width;
        const py = ny * height;
        const flower = flowerAt(nx, ny);
        if (flower) {
          if (trigger(flower, nx, ny)) {
            startColourWave(px, py, petalColour(flower));
            jumpRing();
          }
          return;
        }
        const onLeaf = leafAt(px, py);
        if (onLeaf) {
          kickLeaf(onLeaf.leaf, onLeaf.hit);
          startColourWave(px, py, (onLeaf.leaf.colours && onLeaf.leaf.colours.light) || LEAF_TINT);
          return;
        }
        const onStem = stemAt(px, py);
        if (onStem) {
          pushStem(onStem.stem, onStem.f, px);
          startColourWave(px, py, (onStem.stem.colours && onStem.stem.colours.mid) || LEAF_TINT);
        }
        else if (status) status.textContent = 'Click a flower, a leaf or a stem';
      });

      // Keyboard access: arrow keys move between flowers (shown by the dot
      // ring), Enter or Space triggers the chosen flower.
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
          if (trigger(f, f.nx, f.ny)) {
            startColourWave(f.nx * width, f.ny * height, petalColour(f));
            jumpRing();
          }
        }
      });
      canvas.addEventListener('blur', () => { keyboardIndex = -1; });

      // show the dot cursor only while the pointer is over the canvas; moving
      // the mouse hands control back from the keyboard
      canvas.addEventListener('pointerenter', () => { cursor.inside = true; });
      canvas.addEventListener('pointerleave', () => { cursor.inside = false; });
      canvas.addEventListener('pointermove', () => {
        cursor.inside = true;
        keyboardIndex = -1;
      });
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
