/*
 * USER INPUT — HANGJING YE
 *
 * Touch the garden. The flowers and leaves answer a click the way real
 * plants answer a light touch, without hiding what the other mechanics draw:
 * the team's blooming, wilting and drifting dots always stay fully visible.
 *
 * Clicking a FLOWER changes its colours: each click gives it a new colour
 * scheme from the team's palette, which spreads across the flower from the
 * point you clicked (with a bounce and a small ring of dots in the new
 * colour). Click the same flower a fourth time in a row and
 * its whole head lets go of the stem and falls to the ground; a few seconds
 * later it draws itself again on the stem (keeping its new colours).
 *
 * Clicking EMPTY SPACE presses into the background net (its lines bend away
 * from the click and spring back), gives the background its next colour
 * scheme (spreading out from the click as a circle while the net lines
 * fade to their new colours) and plants a new flower: a seed drops
 * from the click to the ground, a stem shoots up to where you clicked, a
 * leaf unfolds, and a new self-drawing flower blooms at the top. The whole
 * new plant (stem, leaf and flower) is drawn together, just in front of the
 * net and behind the original plants. It is one of the team's own
 * FlowerDotAnimator flowers with its own FlowerWilt, so it lives the same
 * life as the others: it blooms, wilts (its stem and leaf dry too) and
 * regrows. Only one seed
 * grows at a time (with a short pause after it), and up to two planted
 * flowers are kept; planting a third fades the oldest away.
 *
 * Clicking a LEAF makes it fall: it lets go of the stem and drifts down,
 * rocking from side to side and carried by the shared wind, lies on the
 * ground for a moment and fades. A few seconds later a new leaf grows back
 * on the stem.
 *
 * The mouse itself is a DOT: the system arrow is hidden and replaced by a
 * small Kusama-style dot with a short trail of smaller dots. It grows over
 * anything that can be touched and squeezes then springs back on a click.
 *
 * SOUND: each colour change plays a soft two-note chime that gets higher
 * with each click in a row (so the fall can be heard coming); a falling
 * flower head plays a soft falling run of "dot" notes over a breath of air,
 * then a low thump when it lands; a falling leaf plays a papery, fluttering
 * rustle and a soft tap on the ground. The notes are in D minor, the key
 * of the team's music. While the music (audio-mechanic.js) is playing, these sounds are mixed into it, so its
 * volume slider controls them and its frequency analysis — and therefore
 * its audio light — reacts to every fall. "Sounds" in the panel
 * switches them off.
 *
 * Clicking a STEM pushes the whole plant: the stem leans from its base and
 * sways back and forth on a slower spring, carrying its flower head and its
 * leaves with it, and the leaves give a small flutter of their own.
 *
 * How it stays non-destructive:
 *   - The team's files are not edited. A new colour only swaps which palette
 *     colour a dot or pen points to; a falling head is a copy of the dots.
 *   - The bounce scales the flower head around its own centre by wrapping the
 *     existing draw methods, the same way time-mechanic.js wraps
 *     perlin-layer.js. Their code is not edited.
 *   - The leaf flutter is added through the wind value that WindLeaf.draw()
 *     already uses.
 *   - The stem sway moves the stem top only while Stem.draw() runs and puts
 *     it straight back, so time-mechanic.js still controls the real stem.
 *   - A falling or regrowing leaf is drawn by the team's own WindLeaf.draw()
 *     with its position, angle or size changed only for that drawing.
 *   - A planted flower is a new FlowerDotAnimator with its own Stem and
 *     WindLeaf. They are kept in my own list and drawn together with the
 *     team's own draw methods, so the plant never splits into layers.
 *   - The net is pressed, and the background recoloured, by changing what
 *     is passed to p5's vertex(), background() and stroke() only while
 *     PerlinBackground.draw() runs; then the real functions are restored.
 *   - setup() and draw() from sketch.js are wrapped, not replaced.
 *
 * Controls (panel, top left): set the click strength; the panel also says
 * what the last click did. Keyboard: Tab to the canvas, arrow keys choose a
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
 *   - Web Audio API (oscillators, filtered noise, gain envelopes, an LFO) for
 *     the click sounds: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
 *   - MIDI note number → frequency: f = 440 · 2^((n − 69) / 12)
 *     https://en.wikipedia.org/wiki/MIDI_tuning_standard
 *
 * AI acknowledgement: the first version (click detection, control panel,
 * copying the dots) was written with help from ChatGPT (OpenAI). The later
 * versions (the flower bounce, the colour change, the falling flower head,
 * the stem sway, the planted flowers, the pressed net, the background
 * colours, the falling leaves,
 * the dot cursor, the dotted hover ring, the keyboard controls, the falling
 * sounds and the reorganisation into classes) were written with help from
 * Claude (Anthropic), then tested and edited by me.
 */

(() => {
  'use strict';

  // ---------------------------------------------------------------- settings
  // Touching a flower (times in ms; ring sizes in flower radii).
  const TOUCH = {
    toDrop: 4,                  // clicks 1–3 change colour, the 4th makes the flower head fall
    sweep: 500,                 // ms for a new colour to spread across the flower from the click
    window: 2500,               // clicks further apart than this start counting again
    ripple: 1200,               // the small ring of dots after a colour change
    rippleReach: [0.16, 0.26],  // how far the ring spreads beyond the petals
    fallSpeed: 0.55,            // fastest a falling head moves (canvas heights / s)
    rest: 1200,                 // ms the head lies on the ground
    fadeOut: 1000,              // ms to fade away
    regrow: 800                 // ms after that before the flower draws itself again
  };

  const LEAF_TINT = [96, 176, 88];        // green from the team's LEAF_SETS

  // Planting a flower (times in ms, sizes as fractions of the canvas).
  const PLANT = {
    seedFall: 600,              // the seed drops from the click to the ground
    grow: 1400,                 // the stem shoots up to the click point
    radius: [0.09, 0.13],       // size of a planted flower (× canvas width)
    max: 2,                     // planted flowers kept at once
    cooldown: 2500,             // ms before another seed can be planted
    fade: 1200                  // the oldest one fades away over this time
  };

  // Pressing the background net (sizes as fractions of the canvas width).
  // A dent pushes the net's lines away from the click and springs back:
  //   offset = depth · e^(−(d/radius)²) · e^(−t/decay) · sin(2π · freq · t)
  const NET = { life: 1800, depth: 0.03, radius: 0.13, decay: 0.45, freq: 1.6 };

  // Background colours. Each empty-space click moves on to the next colour
  // scheme: the new background colour spreads out from the click as a
  // growing circle, and the net lines fade to their new colours at the same
  // time. The first scheme is the team's own (MIDNIGHT and NET_BLUES in
  // perlin-layer.js); the others are dark, so the flowers still stand out,
  // like the different grounds of Kusama's flower paintings.
  const BACKDROP = { spread: 1100 };   // ms for the new colour to cover the canvas
  const BACKDROPS = [
    null,                                                                   // the team's own
    { bg: [26, 6, 12], net: [[176, 42, 64], [204, 66, 80], [132, 30, 52]] },    // crimson
    { bg: [17, 8, 28], net: [[122, 72, 192], [152, 96, 214], [96, 56, 162]] },  // violet
    { bg: [6, 18, 13], net: [[42, 142, 92], [64, 172, 112], [30, 112, 72]] },   // forest
    { bg: [24, 16, 6], net: [[192, 140, 42], [214, 166, 62], [160, 110, 30]] }  // amber
  ];

  // A falling leaf (settings).
  const FALL = {
    ground: 0.96,               // where it comes to rest (× canvas height)
    speed: 0.16,                // falling speed it settles at (canvas heights / s)
    rest: 1500,                 // ms lying on the ground before fading
    fadeOut: 1200,              // ms to fade away
    regrowDelay: 1500,          // ms before a new leaf starts to grow
    regrow: 1800                // ms for the new leaf to reach full size
  };

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
  const LEAF = { freq: 1.3, damping: 0.11 };                // leaf flutter (radians)
  const BOUNCE = { freq: 2.4, damping: 0.16, kick: 1.6 };   // flower head (scale)
  const STEM = { freq: 0.9, damping: 0.08, kick: 0.3 };     // stem top (fraction of canvas width)

  // Dotted hover ring: it sits just outside the petal tips. Its size changes
  // on every click: the new size is picked at random (1.04–1.14 × the
  // distance to the furthest petal tip, never close to the last one),
  // and a spring carries the ring there with a little overshoot, so it
  // jumps bigger or smaller and wobbles before it settles. Between clicks it
  // breathes slowly in and out.
  const RING = {
    min: 1.04, max: 1.14,       // ring radius range (× the furthest petal tip)
    minJump: 0.04,              // each new size differs at least this much
    spring: { freq: 1.6, damping: 0.22 },
    breathe: 0.015              // ± slow breathing on top
  };

  // Sounds (Web Audio, made in code — no sound files). Notes are from
  // D minor, the key of the team's music (audio-mechanic.js), so they fit
  // in when the music is playing.
  const SOUND = {
    volume: 1.5,                // overall level of my sounds (balanced against the music)
    flowerNotes: [86, 81, 77, 74, 69],   // D6 A5 F5 D5 A4: a falling run of "dot" notes
    landNote: 50,               // D3: the soft thump when a head lands
    // a colour change: a soft two-note chime that rises with each click in
    // a row (1/4, 2/4, 3/4), so the viewer hears the fall coming
    colourChimes: [[74, 81], [77, 84], [81, 86]],   // D5+A5, F5+C6, A5+D6
    leafGlide: [81, 74]         // A5 → D5: the leaf's airy glide down
  };

  // Spring state is kept in Maps keyed by the team's own objects, so my
  // mechanic never has to add or change properties on their classes.
  const leafSwing = new Map();    // leaf   → Spring (value = extra angle, radians)
  const flowerBounce = new Map(); // flower → Spring (value = extra scale)
  const stemSway = new Map();     // stem   → Spring (value = sideways offset of the top)
  const stemOfFlower = new Map(); // flower → its stem, found once at the start
  const fallingLeaves = new Map(); // leaf  → its FallingLeaf
  const growingLeaves = new Map(); // leaf  → when it (re)starts growing
  let plants = [];                 // PlantedFlowers, oldest first
  let drawingPlants = false;       // true while drawPlantsBehind() is drawing them
  let dents = [];                  // presses in the background net: { x, y, start }
  const plantOf = new Map();       // flower / stem / leaf → the PlantedFlower it belongs to

  // Interaction state shared by the functions below.
  let ripples = [];             // Ripples after colour changes
  let recolours = [];           // dots waiting for their new colour: { flower, dot, rgb, wiltRgb, at }
  const touches = new Map();    // flower → { count, at } clicks in a row
  let heads = [];               // FallingHeads
  const headless = new Set();   // flowers whose head has fallen (hidden until they regrow)
  let lastClickAt = -Infinity;
  let lastPlantAt = -Infinity;
  let intensity = 1.0;
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
  const easeOutCubic = (v) => 1 - Math.pow(1 - v, 3);   // fast start, soft landing
  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note number → frequency (A4 = 69 = 440 Hz)

  // Efficiency: some answers are needed several times in one frame (the
  // list of flowers, the flower under the mouse). perFrame() works each one
  // out once per frame and reuses it until the next frame starts.
  let frame = 0;                          // counted up at the start of every draw()
  const frameCache = new Map();           // key → { frame, value }
  function perFrame(key, compute) {
    const hit = frameCache.get(key);
    if (hit && hit.frame === frame) return hit.value;
    const value = compute();
    frameCache.set(key, { frame, value });
    return value;
  }

  // Draw something with a lower canvas opacity, then put it back.
  function withAlpha(alpha, draw) {
    if (alpha >= 0.999 || typeof drawingContext === 'undefined') return draw();
    const ctx = drawingContext;
    const before = ctx.globalAlpha;
    ctx.globalAlpha = before * Math.max(0, alpha);
    try {
      return draw();
    } finally {
      ctx.globalAlpha = before;
    }
  }

  // Opacity of a part of a planted flower that is fading away (1 otherwise).
  function plantAlpha(part, now) {
    const plant = plantOf.get(part);
    return plant ? plant.alpha(now) : 1;
  }

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

  // ================================================================ classes
  // Each moving thing in my mechanic is one small class that keeps its own
  // state and knows how to update and draw itself:
  //   Spring        — a damped spring (leaf flutter, stem sway, flower bounce,
  //                   cursor squeeze, hover ring size)
  //   FallingLeaf   — a leaf that has been let go and drifts to the ground
  //   FallingHead   — a flower head that has fallen off its stem
  //   PlantedFlower — a seed → stem → leaf → flower planted by a click
  //   Ripple        — the small ring of dots after a colour change
  //   HoverRing     — the dotted ring around the flower under the mouse
  //   DotCursor     — the Kusama-style dot that replaces the mouse arrow
  //   Backdrop      — the background colour scheme, changed by empty-space clicks
  //   GardenSounds  — the colour chime and the falling-flower and falling-leaf sounds
  // The functions after the classes find what was clicked and hook these
  // classes into the team's drawing.

  // A damped spring, stepped with the real frame time.
  //   acceleration = -w² · value - 2 · z · w · speed     (w = 2π · freq)
  // The first term pulls back to rest (stiffness), the second slows it down
  // (damping). Speed is updated first, then the value (semi-implicit Euler),
  // which stays stable at frame-rate steps. dt is capped at 50 ms so that a
  // pause (e.g. switching browser tabs) does not make the spring jump.
  // "settings" is one of LEAF, BOUNCE, STEM, CURSOR.press or RING.spring.
  class Spring {
    constructor(settings, value = 0) {
      this.settings = settings;
      this.value = value;         // how far it is from rest
      this.speed = 0;
      this.last = performance.now();
    }

    // A click adds speed (it does not set the value directly), so quick
    // repeated clicks add up naturally.
    kick(speed) {
      if (this.settled()) this.last = performance.now();   // start timing from now
      this.speed += speed;
    }

    // Moves the spring on to time "now"; returns true once it has settled,
    // so the caller can forget it.
    step(now) {
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      const w = Math.PI * 2 * this.settings.freq;
      const accel = -w * w * this.value - 2 * this.settings.damping * w * this.speed;
      this.speed += accel * dt;
      this.value += this.speed * dt;
      return this.settled();
    }

    settled() {
      return Math.abs(this.value) < 0.0005 && Math.abs(this.speed) < 0.005;
    }
  }

  // Map.get(key), or a new Spring stored under that key.
  function springFor(map, key, settings) {
    let spring = map.get(key);
    if (!spring) {
      spring = new Spring(settings);
      map.set(key, spring);
    }
    return spring;
  }

  // A leaf that has been let go. Its stalk point falls at a speed that
  // builds up to FALL.speed (1 − e^(−2.2t) — like air resistance), drifts
  // with the shared wind, and rocks from side to side on a sine while it
  // slowly turns — the "falling leaf" motion. On the ground it lies still,
  // then fades. The team's WindLeaf draws it; only its position and angle
  // are changed for that one drawing.
  class FallingLeaf {
    constructor(leaf) {
      this.leaf = leaf;
      this.x0 = leaf.uiX !== undefined ? leaf.uiX : leaf.px;   // where it was drawn last
      this.x = this.x0;
      this.y = leaf.py;
      this.tilt0 = leaf.tilt;
      this.rot = 0;
      this.dir = leaf.direction === 1 ? 1 : -1;   // drifts to the side its tip points to
      this.seed = Math.random() * 6.28;
      this.drift = 0;
      this.time = 0;
      this.last = performance.now();
      this.landedAt = null;
      this.fade = 1;
    }

    // Moves it on to time "now". Returns false once it has faded away.
    update(wind, now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;

      if (this.landedAt === null) {
        this.time += dt;
        const T = this.time;
        this.y += FALL.speed * (1 - Math.exp(-2.2 * T)) * dt;
        this.drift += (wind * 0.05 + this.dir * 0.02) * dt;
        const rock = Math.sin(2.4 * T + this.seed);
        this.x = this.x0 + this.drift + 0.04 * rock;
        this.rot = this.dir * 0.25 * T + 0.45 * rock;       // mostly rocking, a slow turn
        if (this.y >= FALL.ground) {
          this.y = FALL.ground;
          this.landedAt = now;
          sounds.leafLand();                                // a soft tap on the ground
        }
        return true;
      }
      this.fade = 1 - clamp01((now - this.landedAt - FALL.rest) / FALL.fadeOut);
      return this.fade > 0;
    }

    draw(t, alpha, teamDraw) {
      const leaf = this.leaf;
      const home = { px: leaf.px, py: leaf.py, tilt: leaf.tilt };
      leaf.px = this.x;
      leaf.py = this.y;
      leaf.tilt = this.tilt0 + this.rot;
      try {
        withAlpha(alpha * this.fade, () => teamDraw.call(leaf, t, 0));
      } finally {
        leaf.px = home.px;                                  // the team's leaf is unchanged
        leaf.py = home.py;
        leaf.tilt = home.tilt;
      }
    }
  }

  // A flower head that has let go of its stem: a copy of its dots that
  // speeds up under gravity until air resistance stops it speeding up
  // (TOUCH.fallSpeed), sways a little and turns slowly. On the ground it
  // rests, fades, and then the real flower regrows on its stem.
  class FallingHead {
    constructor(flower, dots) {
      this.flower = flower;
      this.dots = dots;
      this.x0 = flower.nx + flowerShift(flower) / width;   // where its swaying stem holds it
      this.x = this.x0;
      this.y = flower.ny;
      this.vy = 0;
      this.rot = 0;
      this.spin = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
      this.seed = Math.random() * 6.28;
      this.time = 0;
      this.last = performance.now();
      this.landedAt = null;
      this.behind = plantOf.has(flower);   // planted flowers fall on their own layer
      this.done = false;
    }

    update(now) {
      if (this.behind && !plantOf.has(this.flower)) { this.done = true; return; }   // its plant has gone
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.landedAt === null) {
        this.time += dt;
        this.vy = Math.min(TOUCH.fallSpeed, this.vy + 1.2 * dt);
        this.y += this.vy * dt;
        this.x = this.x0 + 0.012 * Math.sin(3 * this.time + this.seed);
        this.rot += this.spin * dt;
        const ground = 1 - (this.flower.nr * width * 0.55) / height;   // it rests on its edge
        if (this.y >= ground) {
          this.y = ground;
          this.landedAt = now;
          sounds.flowerLand(this.flower.nr);                // a soft thump
        }
      } else if (now - this.landedAt > TOUCH.rest + TOUCH.fadeOut + TOUCH.regrow) {
        regrowFlower(this.flower);
        this.done = true;
      }
    }

    draw(now) {
      let alpha = plantAlpha(this.flower, now);
      if (this.landedAt !== null) alpha *= 1 - clamp01((now - this.landedAt - TOUCH.rest) / TOUCH.fadeOut);
      if (alpha <= 0) return;
      const R = this.flower.nr * width;
      push();
      noStroke();
      translate(this.x * width, this.y * height);
      rotate(this.rot);
      for (const d of this.dots) {
        fill(d.rgb[0], d.rgb[1], d.rgb[2], 255 * alpha);
        circle(d.x * R, d.y * R, d.size * R);
      }
      pop();
    }
  }

  // A flower planted by a click on empty space. It goes through three
  // phases, moved on by update() every frame:
  //   seed — a small dot in the new flower's colour drops to the ground
  //   grow — a Stem rises from the ground to the click point, with a bud
  //   live — a WindLeaf unfolds and the FlowerDotAnimator's bloom clock
  //          starts now, so it draws itself; when it is complete, a
  //          FlowerWilt (time mechanic) makes it wilt and regrow like the
  //          others. All its parts are drawn together by draw().
  // The flower, stem and leaf are the team's own classes.
  class PlantedFlower {
    constructor(nx, ny, now) {
      this.nx = nx;
      this.ny = ny;
      const nr = PLANT.radius[0] + Math.random() * (PLANT.radius[1] - PLANT.radius[0]);
      this.flower = new FlowerDotAnimator(nx, ny, nr);
      this.flower.clockName = Math.random() < 0.5 ? 'sundial' : 'heartbeat';
      this.groundX = nx + (Math.random() - 0.5) * 0.04;   // the stem leans a little
      this.rgb = this.flower.pens[0].rgb;                 // outer petal colour, for the seed
      this.stem = null;
      this.leaf = null;
      this.wilt = null;
      this.phase = 'seed';
      this.start = now;
      this.leaving = null;                                // when it started to fade away
      this.removed = false;
      plantOf.set(this.flower, this);
    }

    // Still a seed or a growing stem (and not fading away)?
    isGrowing() {
      return this.phase !== 'live' && this.leaving === null;
    }

    // Opacity while it fades away (1 otherwise).
    alpha(now) {
      return this.leaving === null ? 1 : 1 - clamp01((now - this.leaving) / PLANT.fade);
    }

    fadeAway(now) {
      this.leaving = now;
    }

    // Moves the plant on to its next phase and grows its stem. Runs before
    // the team's draw() each frame.
    update(now) {
      const t = now - this.start;

      if (this.phase === 'seed' && t >= PLANT.seedFall) {
        this.stem = new Stem(this.nx, 1.02, this.groundX, 1.02, 0.022);
        plantOf.set(this.stem, this);
        stemOfFlower.set(this.flower, this.stem);
        this.phase = 'grow';
        this.start = now;
      } else if (this.phase === 'grow') {
        const k = clamp01(t / PLANT.grow);
        this.stem.topY = 1.02 + (this.ny - 1.02) * easeOutCubic(k);
        if (k >= 1) this.bloom(now);
      }

      if (this.leaving !== null && now - this.leaving >= PLANT.fade) this.remove();
    }

    // The stem has reached the click point: a leaf unfolds half way up, on
    // a random side, and the flower starts its bloom clock.
    bloom(now) {
      if (typeof WindLeaf !== 'undefined') {
        this.leaf = new WindLeaf(this.stem.pointAt(0.55), 0.12 + Math.random() * 0.05,
          Math.random() < 0.5 ? 1 : -1, 0.2);
        plantOf.set(this.leaf, this);
        growingLeaves.set(this.leaf, { start: now });
      }
      this.flower.resetLayer();
      this.flower.onCreated = () => this.startWilt();   // when complete, it wilts
      this.flower.bloomStart = typeof clockNow === 'function' ? clockNow() : undefined;
      // listed in the team's array so the other mechanics (e.g. the audio
      // light) can find it; withBounce() keeps sketch.js from drawing it
      if (typeof animatedFlowers !== 'undefined') animatedFlowers.push(this.flower);
      this.phase = 'live';
      this.start = now;
    }

    // The time mechanic's FlowerWilt finds a flower's stem and leaves in the
    // team's lists (findStem / findLeaves). So the stem and leaf are put in
    // those lists only while the FlowerWilt is made, then taken out again:
    // the wilt keeps them, dries them and regrows them with the flower, but
    // the team's draw() never draws them on a separate layer.
    startWilt() {
      if (typeof FlowerWilt === 'undefined') return;
      const added = [];
      if (this.stem && typeof stems !== 'undefined') { stems.push(this.stem); added.push([stems, this.stem]); }
      if (this.leaf && typeof leaves !== 'undefined') { leaves.push(this.leaf); added.push([leaves, this.leaf]); }
      try {
        this.wilt = new FlowerWilt(this.flower);
        if (typeof wilts !== 'undefined') wilts.push(this.wilt);   // visible to the audio mechanic
      } finally {
        for (const [list, item] of added) list.splice(list.indexOf(item), 1);
      }
    }

    // Forget the plant once it has faded away.
    remove() {
      const flower = this.flower;
      if (flower.layer) flower.layer.remove();
      if (typeof animatedFlowers !== 'undefined' && animatedFlowers.includes(flower)) {
        animatedFlowers.splice(animatedFlowers.indexOf(flower), 1);
      }
      if (typeof wilts !== 'undefined') {
        for (let i = wilts.length - 1; i >= 0; i--) if (wilts[i].flower === flower) wilts.splice(i, 1);
      }
      for (const part of [flower, this.stem, this.leaf]) {
        plantOf.delete(part);
        fallingLeaves.delete(part);
        growingLeaves.delete(part);
        stemSway.delete(part);
        leafSwing.delete(part);
      }
      stemOfFlower.delete(flower);
      flowerBounce.delete(flower);
      touches.delete(flower);
      headless.delete(flower);
      recolours = recolours.filter((r) => r.flower !== flower);
      this.removed = true;
    }

    // Seed, stem, bud, leaf, flower and its wilting dots, all in one go, so
    // the plant is always one piece on one layer.
    draw(t, now, wind) {
      const age = now - this.start;
      const rgb = this.rgb;
      push();
      noStroke();
      if (this.phase === 'seed') {
        const k = clamp01(age / PLANT.seedFall);
        const fall = k * k;                                 // speeds up as it drops, like gravity
        const x = (this.nx + (this.groundX - this.nx) * fall) * width;
        const y = (this.ny + (1.0 - this.ny) * fall) * height;
        withAlpha(this.alpha(now), () => {
          fill(rgb[0], rgb[1], rgb[2]);
          circle(x, y, width * 0.014);
        });
      } else {
        this.stem.draw();
        if (this.phase === 'grow') {
          const k = clamp01(age / PLANT.grow);
          fill(66, 158, 84);                                // bud green, as in the time mechanic
          circle(this.stem.topX * width, this.stem.topY * height, width * (0.012 + 0.012 * k));
        } else {
          if (this.leaf) this.leaf.draw(t, wind);
          this.flower.update(t);
          if (this.wilt) this.wilt.update(wind);
        }
      }
      pop();
    }
  }

  // The small ring of dots after a colour change: two thin rings in the new
  // colour spread a little way out from the petal edge and fade.
  class Ripple {
    constructor(flower, rgb) {
      this.flower = flower;
      this.rgb = rgb;
      this.start = performance.now();
      this.reach = TOUCH.rippleReach[0] + Math.random() * (TOUCH.rippleReach[1] - TOUCH.rippleReach[0]);
    }

    finished(now) {
      return now - this.start >= TOUCH.ripple;
    }

    draw(now) {
      const flower = this.flower;
      if (headless.has(flower)) return;
      const p = (now - this.start) / TOUCH.ripple;
      const cx = flower.nx * width + flowerShift(flower);
      const cy = flower.ny * height;
      const R = flower.nr * width;
      const dot = Math.max(1.5, R * 0.022);
      for (let i = 0; i < 2; i++) {
        const q = clamp01((p - i * 0.2) / 0.8);
        if (q <= 0 || q >= 1) continue;
        const grow = 1.04 + this.reach * easeInOutSine(q);     // starts just outside the petals
        fill(this.rgb[0], this.rgb[1], this.rgb[2], 230 * (1 - q) * (1 - i * 0.35));
        const count = Math.max(24, Math.floor((Math.PI * 2 * grow * R) / (dot * 3)));
        for (let j = 0; j < count; j++) {
          const a = (j / count) * Math.PI * 2 + i * 0.25;
          const r = edgeOf(flower, a) * grow * R;              // the ring follows the petal shape
          circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dot);
        }
      }
    }
  }

  // A ring of small white dots slowly circles the flower that can be
  // clicked (mouse hover or keyboard). It turns slowly and a brightness
  // wave runs round it. Its size: "goal" is the size it is heading for, and
  // a Spring holds how far the ring still is from the goal, so a new goal
  // makes it jump there with a little overshoot.
  class HoverRing {
    constructor() {
      this.goal = 1.08;
      this.spring = new Spring(RING.spring);
      this.reach = new Map();           // flower → its furthest petal tip (× radius)
    }

    // How far the flower's furthest petal tip is from its centre, in
    // radii, found once from the petal outline at 72 angles. The ring is
    // drawn just outside this, so it hugs the flower whatever its shape.
    tipOf(flower) {
      if (!this.reach.has(flower)) {
        let most = 0;
        for (let i = 0; i < 72; i++) most = Math.max(most, edgeOf(flower, (i / 72) * Math.PI * 2));
        this.reach.set(flower, most > 0 ? most : 1);
      }
      return this.reach.get(flower);
    }

    current() {
      return this.goal + this.spring.value;
    }

    // Ring size right now (× flower radius), with a slow breathing on top.
    size(now) {
      this.spring.step(now);
      return this.current() * (1 + RING.breathe * Math.sin(now / 900));
    }

    // A new random size, at least RING.minJump away from the current goal, so every
    // click visibly makes the ring bigger or smaller. The ring stays where it
    // is for now, and the spring carries it to the new goal.
    jump() {
      const before = this.current();
      let next;
      do {
        next = RING.min + Math.random() * (RING.max - RING.min);
      } while (Math.abs(next - this.goal) < RING.minJump);
      this.goal = next;
      this.spring.value = before - next;
    }

    draw(now, flower) {
      const R = flower.nr * width;
      const cx = flower.nx * width + flowerShift(flower);
      const cy = flower.ny * height;
      const tip = this.tipOf(flower);
      const ringR = R * tip * this.size(now);
      const count = Math.round(30 * tip * this.current());   // more dots on a bigger ring
      const turn = now / 6000;                          // one turn every ~38 s
      const dot = Math.max(2, R * 0.034);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + turn;
        const glint = 0.7 + 0.3 * Math.sin(a * 3 - now / 500);   // a slow shimmer runs round the ring
        fill(255, 255, 255, 230 * glint);
        circle(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, dot);
      }
    }
  }

  // The dot cursor. Each trail dot moves a fixed fraction of the way towards
  // the dot in front of it every frame, so the trail lags behind and curls
  // when the mouse turns. Over something clickable the dot grows and takes
  // that thing's colour; a click squeezes it on a quick spring.
  class DotCursor {
    constructor() {
      this.trail = [];                  // trail dot positions; [0] is the mouse
      this.size = 0;                    // eased towards the target size
      this.rgb = [245, 242, 235];       // eased towards the target colour
      this.inside = false;              // is the pointer over the canvas?
      this.press = new Spring(CURSOR.press);
    }

    squeeze() {
      this.press.kick(CURSOR.press.kick);
    }

    // target: { rgb } of what is under the mouse, or null over empty space.
    draw(now, target, hidden) {
      // hidden when the pointer has left the canvas (p5 keeps the last
      // mouseX) or while the keyboard is being used
      if (!this.inside || hidden) {
        this.trail = [];
        return;
      }

      if (!this.trail.length) {
        for (let i = 0; i <= CURSOR.trail; i++) this.trail.push({ x: mouseX, y: mouseY });
      }
      this.trail[0].x = mouseX;
      this.trail[0].y = mouseY;
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i];
        const b = this.trail[i - 1];
        a.x += (b.x - a.x) * CURSOR.follow;
        a.y += (b.y - a.y) * CURSOR.follow;
      }

      // size and colour ease towards what is under the mouse
      const goal = (target ? CURSOR.hoverSize : CURSOR.size) * width;
      this.size += (goal - this.size) * 0.2;
      const goalRgb = target ? target.rgb : [245, 242, 235];
      this.rgb = this.rgb.map((c, i) => c + (goalRgb[i] - c) * 0.15);

      this.press.step(now);
      const squeeze = Math.max(0.4, 1 + this.press.value);

      // trail dots: smaller and fainter towards the end
      for (let i = this.trail.length - 1; i >= 1; i--) {
        const k = 1 - i / (this.trail.length + 1);
        fill(this.rgb[0], this.rgb[1], this.rgb[2], 200 * k);
        circle(this.trail[i].x, this.trail[i].y, this.size * 0.55 * k);
      }

      // the dot itself: a plain solid dot, no outline
      fill(this.rgb[0], this.rgb[1], this.rgb[2]);
      circle(mouseX, mouseY, this.size * squeeze);
    }
  }

  // The colour chime and the falling-flower and falling-leaf sounds, made
  // with the Web Audio API
  // (oscillators and filtered noise — no sound files).
  //   https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
  // Browsers only allow sound after the visitor has clicked, so the first
  // sound is made inside the click handler.
  // Link to the audio mechanic: while the team's music is playing, my sounds
  // go into its master volume (window.GroupEGeneratedAudio.master). That
  // way the music's volume slider controls them too, and its analyser
  // "hears" them, so a falling flower also makes the audio light pulse.
  // When the music is off, they play through a small output of my own.
  class GardenSounds {
    constructor() {
      this.ctx = null;                  // my own AudioContext, made on the first sound
      this.out = null;                  // its output volume
      this.enabled = true;              // the "Sounds" switch in the panel
      this.noise = new Map();           // AudioContext → 2 s of white noise
    }

    // Where to play: { ctx, dest }, or null when sound is off or unsupported.
    output() {
      if (!this.enabled) return null;
      const music = window.GroupEGeneratedAudio;
      if (music && music.playing && music.ctx && music.master && music.ctx.state === 'running') {
        return { ctx: music.ctx, dest: music.master };
      }
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          this.ctx = new AC();
        } catch (e) {
          this.enabled = false;
          return null;
        }
        // same level and a gentle limiter, like the music's own output
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.55;
        const limiter = this.ctx.createDynamicsCompressor();
        this.out.connect(limiter);
        limiter.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        const resumed = this.ctx.resume();
        if (resumed && resumed.catch) resumed.catch(() => {});   // blocked until a click
      }
      return { ctx: this.ctx, dest: this.out };
    }

    // White noise, made once per AudioContext, used for air and rustles.
    noiseFor(ctx) {
      if (!this.noise.has(ctx)) {
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise.set(ctx, buffer);
      }
      return this.noise.get(ctx);
    }

    // A gain envelope: silent → peak after "attack" s → silent at "length" s.
    // Exponential ramps sound natural for loudness; they cannot reach 0,
    // so 0.0001 stands for silence.
    envelope(ctx, at, attack, length, peak) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * SOUND.volume), at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + length);
      return g;
    }

    // One soft "dot" note: a sine with a quiet octave above, like a small bell.
    tone(o, midi, at, length, peak) {
      const g = this.envelope(o.ctx, at, 0.01, length, peak);
      g.connect(o.dest);
      for (const [mult, level] of [[1, 1], [2, 0.18]]) {
        const osc = o.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = midiHz(midi) * mult;
        const v = o.ctx.createGain();
        v.gain.value = level;
        osc.connect(v);
        v.connect(g);
        osc.start(at);
        osc.stop(at + length + 0.05);
      }
    }

    // Noise through a band-pass filter whose centre slides from "fromHz" to
    // "toHz": a breath of air (wide) or a rustle (narrow). Returns its
    // volume node, already connected to the output. A band-pass lets only
    // part of the noise through (about a fifth of its loudness), so noise
    // peaks are set higher than note peaks to sound about as loud.
    breath(o, at, length, fromHz, toHz, q, peak, attack = 0.05) {
      const src = o.ctx.createBufferSource();
      src.buffer = this.noiseFor(o.ctx);
      const filter = o.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = q;
      filter.frequency.setValueAtTime(fromHz, at);
      filter.frequency.exponentialRampToValueAtTime(toHz, at + length);
      const g = this.envelope(o.ctx, at, attack, length, peak);
      src.connect(filter);
      filter.connect(g);
      g.connect(o.dest);
      src.start(at, Math.random());           // start somewhere in the noise
      src.stop(at + length + 0.05);
      return g;
    }

    // The flower head lets go: a soft snap, then a falling run of dot notes
    // (the dots tumbling down) over a breath of air that drops in pitch.
    // Bigger flowers sound a fourth lower.
    flowerFall(flower) {
      const o = this.output();
      if (!o) return;
      const at = o.ctx.currentTime + 0.01;
      const shift = flower && flower.nr > 0.14 ? -5 : 0;
      this.breath(o, at, 0.08, 2600, 1800, 1.5, 0.6, 0.005);               // snap
      SOUND.flowerNotes.forEach((note, i) => {
        this.tone(o, note + shift, at + 0.04 + i * 0.11, 0.9, 0.12 * (1 - i * 0.12));
      });
      this.breath(o, at + 0.05, 1.1, 2400, 450, 1.1, 0.35, 0.25);           // air
    }

    // The head lands: a soft low thump (a sine that drops in pitch) and a
    // little puff of dust.
    flowerLand(nr = 0.12) {
      const o = this.output();
      if (!o) return;
      const at = o.ctx.currentTime + 0.01;
      const low = midiHz(SOUND.landNote + (nr > 0.14 ? -5 : 0));
      const g = this.envelope(o.ctx, at, 0.006, 0.4, 0.2);
      const osc = o.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(low * 1.8, at);
      osc.frequency.exponentialRampToValueAtTime(low, at + 0.12);
      osc.connect(g);
      g.connect(o.dest);
      osc.start(at);
      osc.stop(at + 0.45);
      this.breath(o, at, 0.3, 900, 300, 0.8, 0.36, 0.01);                   // dust
    }

    // A leaf lets go. Four layers:
    //   tick    — a tiny dry snap as the stalk breaks
    //   rustle  — papery noise that drifts down in pitch and flutters in
    //             loudness (an LFO, a slow oscillator, moves its volume up
    //             and down, slowing from 7 to 2.5 times a second, like the
    //             leaf rocking on its way down)
    //   crinkle — a dozen tiny random crackles that thin out, like a dry
    //             leaf brushing the air
    //   glide   — a very quiet sine sliding from A5 down to D5: the drift
    leafFall() {
      const o = this.output();
      if (!o) return;
      const ctx = o.ctx;
      const at = ctx.currentTime + 0.01;
      this.breath(o, at, 0.05, 5200, 4200, 2, 0.48, 0.003);                 // tick

      const rustle = this.breath(o, at + 0.02, 2.2, 3800, 1300, 1.0, 0.48, 0.15);
      const flutter = ctx.createGain();
      flutter.gain.value = 0.65;
      rustle.disconnect();
      rustle.connect(flutter);
      flutter.connect(o.dest);
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(7, at);
      lfo.frequency.linearRampToValueAtTime(2.5, at + 2.2);
      const depth = ctx.createGain();
      depth.gain.value = 0.35;
      lfo.connect(depth);
      depth.connect(flutter.gain);
      lfo.start(at);
      lfo.stop(at + 2.3);

      let t = at + 0.06;
      for (let i = 0; i < 12; i++) {                                         // crinkle
        t += 0.05 + Math.random() * 0.12 * (1 + i / 6);                      // further apart over time
        const hz = 2800 + Math.random() * 2600;
        this.breath(o, t, 0.03 + Math.random() * 0.03, hz, hz * 0.8, 0.9, 0.4 * (1 - i / 14), 0.003);
      }

      const glide = this.envelope(ctx, at, 0.3, 1.8, 0.04);                  // glide
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiHz(SOUND.leafGlide[0]), at);
      osc.frequency.exponentialRampToValueAtTime(midiHz(SOUND.leafGlide[1]), at + 1.8);
      osc.connect(glide);
      glide.connect(o.dest);
      osc.start(at);
      osc.stop(at + 1.9);
    }

    // The leaf touches the ground: a soft, short tap.
    leafLand() {
      const o = this.output();
      if (!o) return;
      this.breath(o, o.ctx.currentTime + 0.01, 0.12, 1400, 700, 1.2, 1.9, 0.005);
    }

    // A colour change: a soft two-note chime (the second note a fifth or
    // fourth above, a moment later), higher on each click in a row.
    colourChange(count) {
      const o = this.output();
      if (!o) return;
      const at = o.ctx.currentTime + 0.01;
      const chime = SOUND.colourChimes[Math.min(count, SOUND.colourChimes.length) - 1];
      this.tone(o, chime[0], at, 0.7, 0.19);
      this.tone(o, chime[1], at + 0.07, 0.8, 0.14);
    }
  }

  // The background's colour scheme (see BACKDROPS). "from" is the scheme
  // being covered and "to" the one spreading out from the click at (x, y).
  class Backdrop {
    constructor() {
      this.from = 0;
      this.to = 0;
      this.start = -Infinity;
      this.x = 0;
      this.y = 0;
    }

    scheme(i) {
      if (BACKDROPS[i]) return BACKDROPS[i];
      return {
        bg: typeof MIDNIGHT !== 'undefined' ? MIDNIGHT : [6, 8, 18],
        net: typeof NET_BLUES !== 'undefined' ? NET_BLUES : []
      };
    }

    // 0 → 1 while the new colour spreads, then 1.
    progress(now) {
      return clamp01((now - this.start) / BACKDROP.spread);
    }

    // Is anything different from the team's own colours right now?
    changed(now) {
      return this.to !== 0 || this.progress(now) < 1;
    }

    // An empty-space click at (x, y) in pixels: the next scheme spreads
    // from there. A click during a change finishes the old one at once.
    next(x, y, now) {
      this.from = this.to;
      this.to = (this.to + 1) % BACKDROPS.length;
      this.start = now;
      this.x = x;
      this.y = y;
    }

    // Draws the background: the old colour, then the new colour as a
    // circle growing from the click until it covers the whole canvas.
    drawBackground(teamBackground, now) {
      const k = this.progress(now);
      const to = this.scheme(this.to).bg;
      if (k >= 1) return teamBackground(to[0], to[1], to[2]);
      const from = this.scheme(this.from).bg;
      teamBackground(from[0], from[1], from[2]);
      const far = Math.max(Math.hypot(this.x, this.y), Math.hypot(width - this.x, this.y),
        Math.hypot(this.x, height - this.y), Math.hypot(width - this.x, height - this.y));
      push();
      noStroke();
      fill(to[0], to[1], to[2]);
      circle(this.x, this.y, 2 * far * easeOutCubic(k));
      pop();
    }

    // The colour of net line colour number i (its place in NET_BLUES).
    netColour(i, now) {
      const a = this.scheme(this.from).net[i];
      const b = this.scheme(this.to).net[i];
      if (!a || !b) return b || a;
      const k = easeInOutSine(this.progress(now));
      return a.map((c, j) => c + (b[j] - c) * k);
    }
  }

  // The single cursor, hover ring, sound player and backdrop used below.
  const backdrop = new Backdrop();
  const cursor = new DotCursor();
  const ring = new HoverRing();
  const sounds = new GardenSounds();

  // ------------------------------------------------------- the team's flowers
  // All clickable flowers: the team's self-drawing and noisy ones, plus the
  // flowers planted by clicks.
  // typeof checks keep this file working even if a teammate renames a list.
  function flowers() {
    return perFrame('flowers', listFlowers);
  }

  function listFlowers() {
    const list = [];
    if (typeof animatedFlowers !== 'undefined') list.push(...animatedFlowers);
    if (typeof noisyFlowers !== 'undefined') list.push(...noisyFlowers);
    for (const plant of plants) if (plant.phase === 'live') list.push(plant.flower);   // planted ones
    return [...new Set(list)];                              // planted ones are also in animatedFlowers
  }

  // nx, ny are 0–1 canvas coordinates; returns the flower under that point.
  // The vertical distance is multiplied by height / width because flower
  // radii (nr) are measured as a fraction of the canvas WIDTH. The 1.15
  // tolerance makes the petal tips count as part of the flower.
  function flowerAt(nx, ny) {
    let best = null;
    let bestDistance = Infinity;
    for (const flower of flowers()) {
      if (!flowerVisible(flower)) continue;
      const d = Math.hypot(nx - flower.nx, (ny - flower.ny) * height / width);
      if (d < flower.nr * 1.15 && d < bestDistance) {
        best = flower;
        bestDistance = d;
      }
    }
    return best;
  }

  // How long a life cycle (the time mechanic's FlowerWilt or NoisyFlowerLife)
  // keeps the flower in full bloom ("hold") and how long it wilts. Newer
  // versions of time-mechanic.js give every flower its own values (set by
  // the shared GARDEN_CYCLE); older ones used MATURE_SECONDS and
  // WILT_SECONDS for all flowers. Both are supported.
  function holdOf(life) {
    if (typeof life.hold === 'number') return life.hold;
    return typeof MATURE_SECONDS === 'number' ? MATURE_SECONDS : 6;
  }
  function wiltLengthOf(life) {
    if (typeof life.wilt === 'number') return life.wilt;
    return typeof WILT_SECONDS === 'number' ? WILT_SECONDS : 15;
  }

  // Whether a flower can be seen right now. While the time mechanic shows only
  // a dry stem (after most dots have fallen, until the flower regrows), its
  // place counts as empty space, so a click there plants a new flower.
  function flowerVisible(flower) {
    if (headless.has(flower)) return false;                 // its head has fallen off
    if (typeof clockNow !== 'function') return true;
    const life = flower.life;                               // a noisy flower's NoisyFlowerLife
    if (life && life.clock) {
      const now = clockNow() - life.clock.start;
      if (now < 0) return true;                             // still a bud
      const gone = holdOf(life) + wiltLengthOf(life) * 0.7; // most dots have fallen by then
      return now % life.period < life.clock.bloom + gone;
    }
    if (flower.finished && typeof wilts !== 'undefined') {  // a finished self-drawing flower
      const plant = plantOf.get(flower);
      const wilt = plant ? plant.wilt : wilts.find((w) => w.flower === flower && !w.gone);
      if (!wilt || wilt.gone) return true;
      return wilt.phase === 'wilt' && wilt.timer.seconds() < holdOf(wilt) + wiltLengthOf(wilt) * 0.7;
    }
    return true;                                            // still drawing itself
  }

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
      if (flower && headless.has(flower)) return;          // its head has fallen off
      // planted flowers are listed in the team's arrays (so the audio mechanic
      // can light them too) but only drawn by drawPlantsBehind()
      if (flower && plantOf.has(flower) && !drawingPlants) return;
      const spring = flower && flowerBounce.get(flower);
      const shift = flower ? flowerShift(flower) : 0;      // carried by a swaying stem
      const alpha = flower ? plantAlpha(flower, performance.now()) : 1;
      if (!spring && !shift) {
        if (alpha >= 0.999) return original.apply(this, args);   // the usual case: no extra work
        return withAlpha(alpha, () => original.apply(this, args));
      }

      let grow = 1;
      if (spring) {
        if (spring.step(performance.now())) flowerBounce.delete(flower);
        grow = 1 + spring.value;
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
        return withAlpha(alpha, () => original.apply(this, args));
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

  // A click kicks the flower's spring, so the head grows and settles back.
  function bounceFlower(flower) {
    springFor(flowerBounce, flower, BOUNCE).kick(BOUNCE.kick * strength());
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

  // Each frame, a leaf is drawn in one of three ways:
  //   falling  — at its falling position and angle (drawFallingLeaf)
  //   growing  — at its stem, scaled up from nothing (a new leaf)
  //   normal   — at its stem, with its flutter spring and stem sway added:
  //              wind + springAngle / (0.28 · lengthFactor) makes
  //              WindLeaf.draw() rotate it by exactly springAngle more.
  function wrapLeaves() {
    if (typeof WindLeaf === 'undefined') return;
    const teamDraw = WindLeaf.prototype.draw;
    WindLeaf.prototype.draw = function (t, wind) {
      const now = performance.now();
      const alpha = plantAlpha(this, now);

      const fall = fallingLeaves.get(this);
      if (fall) {
        if (fall.update(wind, now)) return fall.draw(t, alpha, teamDraw);
        fallingLeaves.delete(this);                           // gone: a new leaf will grow
        growingLeaves.set(this, { start: now + FALL.regrowDelay });
        return;
      }

      // a new leaf grows from nothing to its full length
      let size = 1;
      const grow = growingLeaves.get(this);
      if (grow) {
        if (now < grow.start) return;                       // not grown back yet
        const k = clamp01((now - grow.start) / FALL.regrow);
        size = 0.05 + 0.95 * easeOutCubic(k);
        if (k >= 1) growingLeaves.delete(this);
      }

      const spring = leafSwing.get(this);
      let extra = 0;
      if (spring) {
        if (spring.step(now)) leafSwing.delete(this);
        extra = spring.value;
      }
      // a leaf on a swaying stem is carried sideways with it
      const follow = leafOnSwayingStem(this);
      const home = { px: this.px, lengthN: this.lengthN };
      if (follow) this.px += follow.offset;
      this.lengthN = home.lengthN * size;

      // remember what was drawn, so a click can be tested against it
      const lf = leafLengthFactor(this);
      this.uiSwing = (wind * 0.28) * lf + extra;
      try {
        return withAlpha(alpha, () => teamDraw.call(this, t, wind + extra / (0.28 * lf)));
      } finally {
        this.uiX = this.px;
        this.px = home.px;
        this.lengthN = home.lengthN;
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

  // Leaves drawn later are on top, so they are tested first. Falling and
  // regrowing leaves cannot be clicked.
  function leafAt(x, y) {
    const list = allLeaves();
    for (let i = list.length - 1; i >= 0; i--) {     // top-most first
      if (fallingLeaves.has(list[i]) || growingLeaves.has(list[i])) continue;
      const hit = leafHit(list[i], x, y);
      if (hit) return { leaf: list[i], hit };
    }
    return null;
  }

  // The planted plants are drawn behind the team's plants, so they come
  // first in these lists (the last one is tested first, as the top-most).
  function allLeaves() {
    const list = plants.filter((p) => p.leaf).map((p) => p.leaf);
    if (typeof leaves !== 'undefined') list.push(...leaves);
    return list;
  }

  // Let go of a leaf: it starts falling from where it is now (FallingLeaf),
  // with a rustling sound.
  function dropLeaf(leaf) {
    leafSwing.delete(leaf);
    fallingLeaves.set(leaf, new FallingLeaf(leaf));
    sounds.leafFall();
    if (status) status.textContent = 'A leaf falls';
  }

  // ----------------------------------------------------------- stems (sway)
  // A pushed stem leans from its base: the top moves sideways by the spring
  // offset, and anything further down moves less (nothing at the base).
  // A rigid lean is a good match for a short sway and keeps Stem.draw()
  // unchanged: only the top point moves, the base stays planted.
  function stemsList() {
    const list = plants.filter((p) => p.stem).map((p) => p.stem);
    if (typeof stems !== 'undefined') list.push(...stems);
    return list;
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
    const spring = stem && stemSway.get(stem);
    return spring ? spring.value * width : 0;
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
    for (const [stem, spring] of stemSway) {
      const where = alongStem(stem, leaf.px * width, leaf.py * height);
      if (where.distance < width * 0.012) return { offset: spring.value * (1 - where.f) };
    }
    return null;
  }

  function wrapStems() {
    if (typeof Stem === 'undefined') return;
    const teamDraw = Stem.prototype.draw;
    Stem.prototype.draw = function (...args) {
      const alpha = plantAlpha(this, performance.now());
      const spring = stemSway.get(this);
      if (!spring) {
        if (alpha >= 0.999) return teamDraw.apply(this, args);   // the usual case: no extra work
        return withAlpha(alpha, () => teamDraw.apply(this, args));
      }
      if (spring.step(performance.now())) stemSway.delete(this);
      const homeX = this.topX;
      this.topX = homeX + spring.value;          // lean for this drawing only
      try {
        return withAlpha(alpha, () => teamDraw.apply(this, args));
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
    const stemX = (stem.topX + (stem.bottomX - stem.topX) * f) * width;
    const away = clickX < stemX ? 1 : -1;
    springFor(stemSway, stem, STEM).kick(away * STEM.kick * strength() * (0.4 + 0.6 * (1 - f)));

    // Secondary motion: as the stem jerks one way, its leaves lag behind and
    // flick the other way, which makes the plant look flexible, not rigid.
    for (const leaf of allLeaves()) {
      if (fallingLeaves.has(leaf)) continue;
      if (alongStem(stem, leaf.px * width, leaf.py * height).distance < width * 0.012) {
        springFor(leafSwing, leaf, LEAF).kick(-away * (leaf.direction === 1 ? 1 : -1) * 1.4 * strength());
      }
    }
    if (status) status.textContent = 'Stem';
  }

  // ------------------------------------------------------ planting flowers
  // A click on empty space plants a PlantedFlower there (see the class).
  function plantFlower(nx, ny) {
    const now = performance.now();
    if (typeof FlowerDotAnimator === 'undefined' || typeof Stem === 'undefined') return;

    // one seed at a time: wait until the last one has grown and a short
    // pause has passed, so the garden does not fill up with stems at once
    if (plants.some((p) => p.isGrowing()) || now - lastPlantAt < PLANT.cooldown) {
      if (status) status.textContent = 'Wait for the last seed to grow';
      return;
    }
    lastPlantAt = now;

    nx = Math.min(0.94, Math.max(0.06, nx));
    ny = Math.min(0.85, Math.max(0.1, ny));
    plants.push(new PlantedFlower(nx, ny, now));

    // keep at most PLANT.max: the oldest grown one fades away
    const staying = plants.filter((p) => p.leaving === null);
    if (staying.length > PLANT.max) staying[0].fadeAway(now);
    if (status) status.textContent = 'A seed is planted';
  }

  // Moves every plant on and forgets the ones that have faded away.
  function updatePlants(now) {
    for (const plant of plants) plant.update(now);
    plants = plants.filter((p) => !p.removed);
  }

  // Draws every planted plant, each one in one piece. Called right after the
  // background net, so planted plants sit in front of the net and behind
  // the team's original plants.
  function drawPlantsBehind(t, now) {
    if (!plants.length) return;
    const wind = typeof windStrength === 'function' ? windStrength(t) : 0;
    drawingPlants = true;
    try {
      for (const plant of plants) plant.draw(t, now, wind);
      drawHeads(now, true);                                 // falling heads of planted flowers
    } finally {
      drawingPlants = false;
    }
  }

  // ------------------------------------------------- pressing the net
  // An empty-space click presses into the background net at that point.
  function pressNet(x, y) {
    dents.push({ x, y, start: performance.now() });
    if (dents.length > 3) dents.shift();
  }

  // How far a net point at (x, y) is pushed away from all running presses.
  function dentOffset(x, y, now) {
    let ox = 0;
    let oy = 0;
    for (const dent of dents) {
      const t = (now - dent.start) / 1000;
      const dx = x - dent.x;
      const dy = y - dent.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) continue;
      const R = NET.radius * width;
      const push = NET.depth * width * Math.exp(-(d * d) / (R * R)) *
        Math.exp(-t / NET.decay) * Math.sin(2 * Math.PI * NET.freq * t) * strength();
      ox += dx / d * push;
      oy += dy / d * push;
    }
    return [ox, oy];
  }

  // perlin-layer.js draws each net line from many vertex() points. While the
  // net is drawn, vertex() is swapped for a version that moves each point by
  // dentOffset(), then the real vertex() is put back. After the net, the
  // planted plants are drawn, so they sit in front of it.
  // While the net is drawn, three p5 functions are swapped for versions
  // that add my changes, then the real ones are put back:
  //   vertex()     — moves each net point by dentOffset() (a pressed dent)
  //   background() — paints the backdrop's colour (and its spreading circle)
  //   stroke()     — gives each net line its colour in the current scheme
  // After the net, the planted plants are drawn, so they sit in front of it.
  function wrapBackground() {
    if (typeof PerlinBackground === 'undefined') return;
    const teamDraw = PerlinBackground.prototype.draw;
    PerlinBackground.prototype.draw = function (t, ...rest) {
      const now = performance.now();
      if (dents.length) dents = dents.filter((dent) => now - dent.start < NET.life);
      const swaps = [];
      if (dents.length && typeof window.vertex === 'function') {
        const teamVertex = window.vertex;
        swaps.push(['vertex', teamVertex]);
        window.vertex = function (x, y, ...more) {
          const o = dentOffset(x, y, now);
          return teamVertex.call(this, x + o[0], y + o[1], ...more);
        };
      }
      if (backdrop.changed(now) && typeof window.background === 'function' && typeof window.stroke === 'function') {
        const teamBackground = window.background;
        const teamStroke = window.stroke;
        swaps.push(['background', teamBackground], ['stroke', teamStroke]);
        window.background = function () {
          return backdrop.drawBackground((r, g, b) => teamBackground.call(this, r, g, b), now);
        };
        const blues = typeof NET_BLUES !== 'undefined' ? NET_BLUES : [];
        window.stroke = function (r, g, b, ...more) {
          const i = blues.findIndex((c) => c[0] === r && c[1] === g && c[2] === b);
          if (i < 0) return teamStroke.call(this, r, g, b, ...more);
          const c = backdrop.netColour(i, now);
          return teamStroke.call(this, c[0], c[1], c[2], ...more);
        };
      }
      let result;
      try {
        result = teamDraw.call(this, t, ...rest);
      } finally {
        for (const [name, original] of swaps) window[name] = original;
      }
      drawPlantsBehind(typeof t === 'number' ? t : 0, now);
      return result;
    };
  }

  // The main petal colour of a flower: its most common outer-dot colour.
  // The cursor needs it every frame while it is over a flower, but counting
  // ~2000 dots each frame is wasteful, so the answer is kept for a short
  // while (PETAL_CACHE_MS, or until the flower's colours change).
  const PETAL_CACHE_MS = 400;
  const petalCache = new Map();           // flower → { rgb, at }
  function petalColour(flower) {
    const now = performance.now();
    const hit = petalCache.get(flower);
    if (hit && now - hit.at < PETAL_CACHE_MS) return hit.rgb;
    const counts = new Map();
    let best = null;
    let bestCount = 0;
    for (const rgb of edgeColours(flower)) {
      const key = rgb.join(',');
      const n = (counts.get(key) || 0) + 1;
      counts.set(key, n);
      if (n > bestCount) { best = rgb; bestCount = n; }
    }
    const rgb = best || [235, 230, 220];
    petalCache.set(flower, { rgb, at: now });
    return rgb;
  }

  // ------------------------------------------------------- touching a flower
  // Colours of the outer (petal) dots of a flower, used for the cursor.
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

  // The flower's current FlowerWilt (time mechanic), if it has one.
  function activeWilt(flower) {
    const plant = plantOf.get(flower);
    if (plant) return plant.wilt && !plant.wilt.gone ? plant.wilt : null;
    if (typeof wilts === 'undefined') return null;
    return wilts.find((w) => w.flower === flower && !w.gone) || null;
  }

  // A click on a flower. Clicks on the same flower less than TOUCH.window
  // apart are counted: the 1st to 3rd give it new colours (with a bounce
  // and a small ring of dots), the 4th makes the whole flower head fall.
  // Clicks closer than 150 ms are ignored, so a double click counts once.
  function touchFlower(flower, nx = flower.nx, ny = flower.ny) {
    const now = performance.now();
    if (now - lastClickAt < 150) return false;
    lastClickAt = now;

    const last = touches.get(flower);
    const count = last && now - last.at < TOUCH.window ? last.count + 1 : 1;
    touches.set(flower, { count, at: now });

    if (count >= TOUCH.toDrop && dropHead(flower)) {
      touches.delete(flower);
      if (status) status.textContent = 'The flower falls';
      return true;
    }

    // where the click was, in flower units (the new colour spreads from there)
    const from = [(nx - flower.nx) / flower.nr, (ny - flower.ny) * height / (flower.nr * width)];
    const rgb = recolourFlower(flower, from) || petalColour(flower);
    bounceFlower(flower);
    ripples.push(new Ripple(flower, rgb));
    sounds.colourChange(count);
    if (ripples.length > 4) ripples.shift();
    if (status) {
      status.textContent = 'New colours (' + count + '/' + TOUCH.toDrop + ')' +
        (count === TOUCH.toDrop - 1 ? ' · once more and it falls' : '');
    }
    return true;
  }

  // New colours for a flower. A different colour scheme from the team's
  // FLOWER_SCHEMES is chosen and each pen gets a colour from it, like
  // pickFlowerColours() in perlin-layer.js does. The dots already drawn
  // (and the time mechanic's wilting copies of them) swap each old colour
  // for its new one, separately for the petals and the centre, so the
  // flower keeps its pattern of rings and only its colours change. The new
  // colours stay when the flower regrows, because the pens keep them.
  // The team's colour arrays are never changed: only references are swapped.
  function recolourFlower(flower, from = [0, 0]) {
    if (typeof PALETTE === 'undefined' || typeof FLOWER_SCHEMES === 'undefined' || !Array.isArray(flower.pens)) return null;
    applyRecolours(Infinity, flower);       // finish any colour change still spreading
    const current = flower.colours && flower.colours.scheme;
    const choices = FLOWER_SCHEMES.filter((s) => s !== current);
    const scheme = choices[Math.floor(Math.random() * choices.length)] || FLOWER_SCHEMES[0];
    const pick = (names) => names[Math.floor(Math.random() * names.length)];
    const petalNames = [scheme.petalBase, ...scheme.petalDots];
    const coreNames = [scheme.coreBase, ...scheme.coreDots];
    const colours = {
      scheme,
      petal: [0, 1, 2, 3, 4].map(() => pick(petalNames)),
      core: [0, 1, 2, 3, 4, 5, 6].map(() => pick(coreNames))
    };

    // old colour → new colour, separately for petal pens (first 5) and centre pens
    const swap = new Map();
    flower.pens.forEach((pen, i) => {
      const petal = i < 5;
      const next = PALETTE[petal ? colours.petal[i] : colours.core[i - 5]];
      if (!next || !Array.isArray(pen.rgb)) return;
      const key = (petal ? 'p' : 'c') + pen.rgb.join(',');
      if (!swap.has(key)) swap.set(key, next);
      pen.rgb = next;
    });
    const recolour = (rgb, x, y) => {
      const petal = Math.hypot(x, y) > (flower.coreRatio || 0.5) * 1.02;
      const key = rgb.join(',');
      return swap.get((petal ? 'p' : 'c') + key) || swap.get((petal ? 'c' : 'p') + key) || rgb;
    };

    for (const d of flower.dots || []) {
      if (Array.isArray(d.rgb)) d.rgb = recolour(d.rgb, d.x, d.y);
    }
    const wilt = activeWilt(flower);
    // the dots on screen change one after another, sooner the closer they
    // are to the click, so the new colour visibly spreads across the flower
    if (wilt && Array.isArray(wilt.dots)) {
      const now = performance.now();
      for (const w of wilt.dots) {
        const next = recolour(w.rgb, w.x, w.y);
        if (next === w.rgb) continue;
        const wiltRgb = typeof mixRgb === 'function' && typeof WILT_COLOURS !== 'undefined'
          ? mixRgb(next, WILT_COLOURS[Math.floor(Math.random() * WILT_COLOURS.length)], 0.85) : next;
        const distance = Math.hypot(w.x - from[0], w.y - from[1]);
        recolours.push({ flower, dot: w, rgb: next, wiltRgb, at: now + TOUCH.sweep * Math.min(1, distance / 1.6) });
      }
    }
    flower.colours = colours;
    petalCache.delete(flower);              // the cursor takes the new colour at once

    // A flower that is still drawing itself keeps its dots on an off-screen
    // layer. Clear that same layer and redraw its dots in the new colours
    // (the same drawing as the team's resetLayer(), but without making a new
    // canvas-sized layer, which would cause a stutter on every click).
    if (!flower.finished && flower.layer) {
      const layer = flower.layer;
      const cx = flower.nx * width;
      const cy = flower.ny * height;
      const R = flower.nr * width;
      layer.clear();
      layer.noStroke();
      for (const d of flower.dots) {
        layer.fill(d.rgb[0], d.rgb[1], d.rgb[2]);
        layer.circle(cx + d.x * R, cy + d.y * R, d.size * R);
      }
    }
    return PALETTE[colours.petal[0]] || null;
  }

  // Gives each waiting dot its new colour once its time has come (or all of
  // one flower's dots at once, when `only` is given and now is Infinity).
  function applyRecolours(now, only = null) {
    if (!recolours.length) return;
    recolours = recolours.filter((r) => {
      if ((only && r.flower !== only) || r.at > now) return true;
      r.dot.rgb = r.rgb;
      r.dot.wiltRgb = r.wiltRgb;
      return false;
    });
  }

  // The dots of the flower head as they look right now (flower units).
  function headDots(flower) {
    applyRecolours(Infinity, flower);
    const wilt = activeWilt(flower);
    if (flower.finished && wilt && wilt.phase === 'wilt' && Array.isArray(wilt.dots)) {
      const wiltTime = Math.max(0, wilt.timer.seconds() - holdOf(wilt));
      return wilt.dots.filter((d) => d.state === 'attached').map((d) => ({
        x: d.x, y: d.y + d.droop(wiltTime), size: d.size, rgb: d.colourAt(wiltTime)
      }));
    }
    return (flower.dots || []).map((d) => ({ x: d.x, y: d.y, size: d.size, rgb: rgbOfDot(d) }));
  }

  // The flower head lets go of its stem: its dots are copied into a
  // FallingHead and the real flower is hidden until it regrows.
  function dropHead(flower) {
    const dots = headDots(flower);
    if (!dots.length) return false;
    headless.add(flower);
    flowerBounce.delete(flower);
    heads.push(new FallingHead(flower, dots));
    sounds.flowerFall(flower);
    return true;
  }

  function updateHeads(now) {
    for (const head of heads) head.update(now);
    heads = heads.filter((head) => !head.done);
  }

  // The flower starts again: its old life cycle is ended (the stem turns
  // green again) and the team's redrawFlower() makes it draw itself anew,
  // starting now (its next FlowerWilt then fits it back into its slot of
  // the time mechanic's GARDEN_CYCLE).
  function regrowFlower(flower) {
    headless.delete(flower);
    petalCache.delete(flower);
    const wilt = activeWilt(flower);
    if (wilt) {
      wilt.gone = true;
      if (wilt.stemWilt) wilt.stemWilt.restore();
    }
    if (typeof redrawFlower === 'function') {
      redrawFlower(flower, typeof clockNow === 'function' ? clockNow() : undefined);   // its resetLayer() frees the old layer
    }
  }

  // Falling heads: the ones of planted flowers are drawn with the planted
  // plants (behind = true), the others on top of the garden.
  function drawHeads(now, behind) {
    for (const head of heads) if (head.behind === behind) head.draw(now);
  }

  function drawRipples(now) {
    ripples = ripples.filter((r) => !r.finished(now));
    for (const ripple of ripples) ripple.draw(now);
  }

  // The dotted ring goes round the flower chosen with the keyboard, or else
  // the one under the mouse.
  function drawHover(now) {
    let flower = null;
    const mouseIn = typeof mouseX === 'number' && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
    if (keyboardIndex >= 0) {
      flower = flowers()[keyboardIndex] || null;
    } else if (mouseIn) {
      flower = flowerUnderMouse();
    }
    if (flower) ring.draw(now, flower);
  }

  // The flower under the mouse, worked out once per frame (the hover ring
  // and the cursor both need it).
  function flowerUnderMouse() {
    return perFrame('hover', () => flowerAt(mouseX / width, mouseY / height));
  }

  // What is under the mouse and its colour (for the cursor).
  function cursorTarget() {
    if (typeof mouseX !== 'number') return null;
    const flower = flowerUnderMouse();
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
    push();
    noStroke();
    drawHover(now);
    drawRipples(now);
    drawHeads(now, false);
    cursor.draw(now, cursorTarget(), keyboardIndex >= 0);
    pop();
  }

  // --------------------------------------------------------- control panel
  // The panel is plain HTML placed over the canvas (not drawn with p5), so it
  // stays sharp, works with the keyboard and screen readers, and does not
  // have to be redrawn every frame.
  function makeControls() {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed; z-index:30; left:14px; top:14px;   /* top left: the music panel sits at the bottom */
      background:rgba(8,12,27,.92); color:#e8eaf2;
      padding:12px 14px; border:1px solid #3b4f72; border-radius:12px;
      font:12px/1.5 system-ui,sans-serif; width:250px;
      box-shadow:0 8px 30px #0008;
    `;

    const title = document.createElement('div');
    title.textContent = 'USER INPUT · TOUCH THE GARDEN';
    title.style.cssText = 'letter-spacing:.11em;font-weight:700;margin-bottom:8px;color:#d8e0f5';
    panel.append(title);

    // what each kind of click does, so the viewer knows what to try
    const help = document.createElement('div');
    help.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:3px 8px;color:#c9d3ea';
    for (const [where, what] of [
      ['Empty space', 'plant a flower · new background colour'],
      ['Flower', 'new colours · 4th click: it falls and regrows'],
      ['Leaf', 'it falls, then grows back'],
      ['Stem', 'the plant sways']
    ]) {
      const a = document.createElement('span');
      a.textContent = where;
      a.style.cssText = 'color:#f3f5ff;font-weight:600';
      const b = document.createElement('span');
      b.textContent = what;
      help.append(a, b);
    }
    panel.append(help);

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

    // the colour chime and the falling sounds can be switched off
    const soundRow = document.createElement('label');
    soundRow.style.cssText = 'margin-top:6px;display:flex;align-items:center;gap:6px;cursor:pointer';
    const soundBox = document.createElement('input');
    soundBox.type = 'checkbox';
    soundBox.checked = sounds.enabled;
    soundBox.style.accentColor = '#95b9df';
    soundBox.addEventListener('change', () => { sounds.enabled = soundBox.checked; });
    const soundLabel = document.createElement('span');
    soundLabel.textContent = 'Sounds (colour · flower · leaf)';
    soundRow.append(soundBox, soundLabel);
    panel.append(soundRow);

    status = document.createElement('div');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Click empty space to plant a flower';
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
        'Interactive flower garden. Click empty space to plant a flower and change the background colour, a leaf to make it fall, a flower to change its colours (three clicks make it fall), or a stem to make the plant sway. Arrow keys and Enter choose and trigger flowers.');

      // One pointer handler covers mouse, pen and touch. Only the left button
      // / first finger counts. Flowers are checked first, then leaves, then
      // stems, because a flower head sits on top of its stem and leaves;
      // anywhere else plants a new flower.
      canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        keyboardIndex = -1;
        cursor.squeeze();                               // squeeze the dot cursor
        const rect = canvas.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = (event.clientY - rect.top) / rect.height;
        const px = nx * width;
        const py = ny * height;
        const flower = flowerAt(nx, ny);
        if (flower) {
          if (touchFlower(flower, nx, ny)) ring.jump();
          return;
        }
        const onLeaf = leafAt(px, py);
        if (onLeaf) {
          dropLeaf(onLeaf.leaf);
          return;
        }
        const onStem = stemAt(px, py);
        if (onStem) pushStem(onStem.stem, onStem.f, px);
        else {                                               // empty space:
          pressNet(px, py);                                  // the net gives way under the click
          backdrop.next(px, py, performance.now());          // the next background colour spreads out
          plantFlower(nx, ny);                               // and a flower is planted there
        }
      });

      // Keyboard access: arrow keys move between flowers (shown by the dot
      // ring), Enter or Space clicks the chosen flower.
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
          if (touchFlower(f)) ring.jump();
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

  // Safety check before each frame. If the page is first shown at zero size
  // (for example inside a hidden or collapsed preview panel), the self-drawing
  // flowers create zero-size drawing layers, and drawing one of them throws
  // an error that stops p5's draw loop for good. So: skip frames while the
  // canvas has no size, and rebuild any layer whose size no longer matches
  // the canvas (resetLayer() is the team's own method and redraws its dots).
  function canvasReady() {
    if (!(width >= 1 && height >= 1)) return false;
    const all = plants.filter((p) => p.phase === 'live').map((p) => p.flower);
    if (typeof animatedFlowers !== 'undefined') all.push(...animatedFlowers);
    {
      for (const f of all) {
        const layer = f.layer;
        if (layer && layer.width !== undefined && (layer.width !== width || layer.height !== height)) f.resetLayer();
      }
    }
    return true;
  }

  window.draw = function (...args) {
    if (!canvasReady()) return;
    frame++;                                  // a new frame: per-frame answers are worked out again
    updatePlants(performance.now());          // grow planted stems before the garden is drawn
    updateHeads(performance.now());           // move falling flower heads
    applyRecolours(performance.now());        // spread new colours across flowers
    const result = originalDraw.apply(this, args);
    display();
    return result;
  };
})();
