/* =================================================================================================
   time-mechanic.js  -  TIME-BASED MECHANIC  (IDEA9103 Major Project)
   Mechanic owner: Yeheng Li

   IDEA
   Four flowers, four clocks. Each flower in the garden keeps a different kind of time, so each one
   blooms in its own way. Once it is fully open it stays in bloom for a while, then wilts: its dots
   dry and fall, and its stem and leaves dry and bend with it.

     SUNDIAL    top-left flower      all dot pens line up like one clock hand and sweep clockwise
     HOURGLASS  top-right flower     centre dots pile up like falling sand, then spikes break out
     TICKING    middle flower        a green bud opens one petal per beat, top first, then left/right
     HEARTBEAT  bottom-right flower  dots are added in beats that get faster; the flower pulses

   LIFE CYCLE OF EVERY FLOWER (all driven by timers and scheduled events)
     bud -> BLOOM (its own clock) -> MATURE (stays open) -> WILT (dots dry and fall, stem bends)
         -> only the dry stem is left

   HOW IT WORKS WITH THE TEAM'S FILES
   - The flower shapes, colours, dots and Perlin-noise movement all come from perlin-layer.js
     (Perlin noise mechanic). Stems come from plants.js. Those files are NOT edited.
   - This file only decides WHEN dots appear, HOW FAR each petal or centre is open, and WHEN a
     flower wilts. It connects to the team code in section 9 (see notes there).
   - The self-drawing flowers fire `onCreated` when complete (set up in sketch.js); that event
     starts a FlowerWilt here.

   CODE STRUCTURE
     Section 1  Settings ........................ global constants
     Section 2  Helper functions ................ clockNow(), smooth01(), mixRgb(), rgbOf()
     Section 3  class Timer ..................... at(seconds, action), start(), seconds(), update()
     Section 4  Bloom clocks .................... CLOCKS, clockOf(), penBudget(), lastHeartBeat()
     Section 5  class StemWilt .................. apply(dryness)
     Section 6  class WiltingDot ................ drop(), colourAt(), update(), draw()
     Section 7  class FlowerWilt ................ mature -> wilt for a self-drawing flower
     Section 8  class NoisyFlowerLife ........... bloom -> mature -> wilt for a noisy flower
     Section 9  Connecting to the team's classes  bloomUpdate(), lifeDraw()

   VARIABLES
     Global   : the settings in section 1, CLOCKS, clockZero, STEM_HOME, LEAF_HOME
     Instance : e.g. Timer.events, FlowerWilt.phase, NoisyFlowerLife.wiltStarted, WiltingDot.state
     Local    : values worked out fresh each frame, e.g. tau, budget, dryness, pulse, wind

   AI ACKNOWLEDGEMENT
   Parts of this code were written with the help of Claude (Anthropic) and then edited by Yeheng Li.
   Yeheng Li wrote the first version (Timer, WiltingDot, FlowerWilt), chose the idea of four flowers
   keeping four kinds of time, and decided how each flower blooms, stays open and wilts. Claude
   helped suggest code for the four bloom clocks, the full-bloom pause and the wilting of the stems,
   leaves and noisy flowers. Yeheng Li re-checked, edited and tested all of the code before
   committing it.

   REFERENCES
   - p5.js reference: https://p5js.org/reference/ (millis, noise, random, lerp, push/pop, scale, image)
   - IDEA9103 Week 8 tutorial: DotAnimator / randomNoisyShape patterns used by perlin-layer.js
================================================================================================= */


/* -------------------------------------------------------------------------------------------------
   1. SETTINGS (global constants)
------------------------------------------------------------------------------------------------- */

// Wilting
const WILT_SECONDS = 15;          // how long a flower takes to wilt completely
const MAX_FALL_SECONDS = 2.6;     // longest time a falling dot stays visible
const DROOP = 0.12;               // how far the petals sag before their dots fall

// Life cycle
const MATURE_SECONDS = 6;         // a grown flower stays in full bloom before wilting (time for the audio mechanic)

// Stem and leaves
const STEM_LEAN = 0.05;           // how far a dry stem bends sideways (fraction of canvas width)
const STEM_SAG = 0.035;           // how far a dry stem top sinks (fraction of canvas height)
const WILT_LEAVES = true;         // leaves on a wilting stem dry out and droop with it

// Bloom clocks: when each flower starts (seconds) and how long its bloom takes
const CLOCKS = {
  sundial:   { start: 0.0, bloom: 8 },
  hourglass: { start: 2.5, bloom: 10 },
  ticking:   { start: 5.0, bloom: 11 },
  heartbeat: { start: 9.5, bloom: 8 }
};
const HEART_BEATS = 12;           // number of beats in the heartbeat bloom

// Colours
const WILT_COLOURS = [[122, 84, 46], [98, 72, 50], [142, 112, 72], [80, 60, 42]];
const WILT_BROWN = [122, 84, 46];
const BUD_GREEN = [66, 158, 84];
const DRY_STEM = { dark: [82, 62, 36], mid: [150, 122, 70] };
const DRY_LEAF = { dark: [96, 66, 34], light: [160, 124, 70], vein: [196, 168, 118] };


/* -------------------------------------------------------------------------------------------------
   2. HELPER FUNCTIONS
------------------------------------------------------------------------------------------------- */

// One shared clock for the whole garden, in seconds since the first frame.
let clockZero = null;
function clockNow() {
  if (clockZero === null) clockZero = millis();
  return (millis() - clockZero) / 1000;
}

// Smooth step from 0 to 1 (eases in and out), clamped to the 0..1 range.
function smooth01(x) {
  x = constrain(x, 0, 1);
  return x * x * (3 - 2 * x);
}

// Blend two [r, g, b] colours; k = 0 gives a, k = 1 gives b.
function mixRgb(a, b, k) {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

// Turn a p5 colour into an [r, g, b] array.
function rgbOf(c) {
  return [red(c), green(c), blue(c)];
}


/* -------------------------------------------------------------------------------------------------
   3. TIMER  -  schedules actions at set times (the core of the time-based mechanic)
------------------------------------------------------------------------------------------------- */

class Timer {
  constructor() {
    this.events = [];        // { seconds, action } pairs, run in time order
    this.next = 0;           // index of the next event to run
    this.startTime = 0;      // millis() when the timer started
    this.running = false;
  }

  // Schedule `action(now)` to run `seconds` after start().
  at(seconds, action) {
    this.events.push({ seconds: seconds, action: action });
  }

  start() {
    this.events.sort((a, b) => a.seconds - b.seconds);
    this.next = 0;
    this.startTime = millis();
    this.running = true;
  }

  seconds() {
    return this.running ? (millis() - this.startTime) / 1000 : 0;
  }

  // Run every event whose time has come. Called once per frame.
  update() {
    if (!this.running) return;

    let now = this.seconds();
    while (this.next < this.events.length && this.events[this.next].seconds <= now) {
      this.events[this.next].action(now);
      this.next++;
    }
  }
}


/* -------------------------------------------------------------------------------------------------
   4. BLOOM CLOCKS
------------------------------------------------------------------------------------------------- */

// Which clock a flower keeps, worked out once from its type and place in the picture.
function clockOf(flower) {
  if (!flower.clockName) {
    if (flower instanceof FlowerDotAnimator) {
      flower.clockName = flower.nx < 0.5 ? "sundial" : "heartbeat";
    } else {
      flower.clockName = flower.style === "spiky" ? "hourglass" : "ticking";
    }
  }
  return flower.clockName;
}

// Time of beat number i (beats come closer together as the bloom goes on).
function heartBeatTime(i, bloomSeconds) {
  return bloomSeconds * 0.92 * (1 - pow(1 - i / HEART_BEATS, 1.7));
}

// How far round (radians) each dot pen may have travelled after `tau` seconds of blooming.
function penBudget(clockName, tau, bloomSeconds) {
  let fullTurn = DRAW_LAPS * TWO_PI;              // DRAW_LAPS comes from perlin-layer.js
  if (tau >= bloomSeconds) return Infinity;       // bloom time is over: let every pen finish

  if (clockName === "sundial") {
    return fullTurn * tau / bloomSeconds;         // a steady sweep, like a sundial shadow
  }

  // heartbeat: each beat lets the pens draw a short burst
  let done = 0;
  for (let i = 0; i < HEART_BEATS; i++) {
    done += smooth01((tau - heartBeatTime(i, bloomSeconds)) / 0.22) / HEART_BEATS;
  }
  return fullTurn * done;
}

// Time of the most recent heartbeat, used for the pulse.
function lastHeartBeat(tau, bloomSeconds) {
  let last = -10;
  for (let i = 0; i < HEART_BEATS; i++) {
    let beat = heartBeatTime(i, bloomSeconds);
    if (beat <= tau) last = beat;
  }
  return last;
}


/* -------------------------------------------------------------------------------------------------
   5. STEM WILT  -  the stem (and its leaves) dries and bends with its flower
   The stem and leaf objects belong to plants.js / perlin-layer.js. This class only changes their
   position and colour values while a flower wilts, always starting from the original values.
------------------------------------------------------------------------------------------------- */

// Original stem and leaf values, recorded the first time they are seen,
// so the drying is always worked out from the fresh green stem.
const STEM_HOME = new Map();
const LEAF_HOME = new Map();

// The stem whose top sits at the flower centre.
function findStem(flower) {
  if (typeof stems === "undefined") return null;
  for (const stem of stems) {
    if (abs(stem.topX - flower.nx) < 0.02 && abs(stem.topY - flower.ny) < 0.02) return stem;
  }
  return null;
}

// The leaves whose pivot lies on that stem, and how far along the stem each one is (f = 0..1).
function findLeaves(stem) {
  let found = [];
  if (!stem || typeof leaves === "undefined") return found;

  for (const leaf of leaves) {
    if (LEAF_HOME.has(leaf)) {
      if (LEAF_HOME.get(leaf).stem === stem) found.push({ leaf: leaf, f: LEAF_HOME.get(leaf).f });
      continue;
    }
    let f = (leaf.py - stem.topY) / (stem.bottomY - stem.topY);
    let xOnStem = lerp(stem.topX, stem.bottomX, f);
    if (f > 0 && f < 1 && abs(xOnStem - leaf.px) < 0.01) found.push({ leaf: leaf, f: f });
  }
  return found;
}

class StemWilt {
  constructor(flower) {
    this.stem = findStem(flower);
    if (!this.stem) return;

    let stem = this.stem;
    if (!STEM_HOME.has(stem)) {
      STEM_HOME.set(stem, { topX: stem.topX, topY: stem.topY, colours: stem.colours });
    }
    this.home = STEM_HOME.get(stem);
    this.lean = flower.nx < 0.5 ? -1 : 1;        // bend outwards, away from the middle of the picture

    this.leaves = findLeaves(stem).map((entry) => {
      if (!LEAF_HOME.has(entry.leaf)) {
        LEAF_HOME.set(entry.leaf, { stem: stem, f: entry.f, colours: entry.leaf.colours, tilt: entry.leaf.tilt });
      }
      let home = LEAF_HOME.get(entry.leaf);
      return { leaf: entry.leaf, f: home.f, colours: home.colours, tilt: home.tilt };
    });
  }

  // dryness: 0 = fresh and green, 1 = fully dry and bent
  apply(dryness) {
    if (!this.stem) return;
    let stem = this.stem;
    let k = smooth01(dryness);

    stem.topX = this.home.topX + this.lean * STEM_LEAN * k;
    stem.topY = this.home.topY + STEM_SAG * k;
    stem.colours = {
      dark: mixRgb(this.home.colours.dark, DRY_STEM.dark, k),
      mid: mixRgb(this.home.colours.mid, DRY_STEM.mid, k)
    };

    for (const item of this.leaves) {
      item.leaf.px = lerp(stem.topX, stem.bottomX, item.f);     // the leaf stays attached to the bending stem
      item.leaf.py = lerp(stem.topY, stem.bottomY, item.f);
      if (WILT_LEAVES) {
        item.leaf.tilt = item.tilt - 0.45 * k;                   // a dry leaf hangs lower
        item.leaf.colours = {
          dark: mixRgb(item.colours.dark, DRY_LEAF.dark, k),
          light: mixRgb(item.colours.light, DRY_LEAF.light, k),
          vein: mixRgb(item.colours.vein, DRY_LEAF.vein, k)
        };
      }
    }
  }
}


/* -------------------------------------------------------------------------------------------------
   6. WILTING DOT  -  one dot that dries, sags, then falls in the wind and fades
   Positions are in flower units (1 = flower radius), like the dots in perlin-layer.js.
------------------------------------------------------------------------------------------------- */

class WiltingDot {
  constructor(dot, f) {
    this.x = dot.x;
    this.y = dot.y;
    this.size = dot.size;
    this.rgb = dot.rgb;
    this.f = f;                                   // 0 at the centre, 1 at a petal tip

    let brown = random(WILT_COLOURS);
    this.wiltRgb = mixRgb(dot.rgb, brown, 0.85);

    this.release = 0;                             // when this dot lets go (set by FlowerWilt)
    this.fallSeconds = random(1.6, MAX_FALL_SECONDS);
    this.gravity = random(1.2, 2.2);
    this.driftSeed = random(1000);

    this.state = "attached";                      // attached -> falling -> gone
    this.dropTime = 0;
    this.fallX = 0;
    this.fallY = 0;
    this.drift = 0;
  }

  // Petal tips sag more than the centre as time goes on.
  droop(now) {
    let g = now / WILT_SECONDS;
    return DROOP * g * g * this.f;
  }

  // Event action: the dot lets go of the flower.
  drop(now) {
    this.state = "falling";
    this.dropTime = now;
    this.fallX = this.x;
    this.fallY = this.y + this.droop(now);
  }

  colourAt(now) {
    let w = constrain(now / (this.release + this.fallSeconds * 0.6), 0, 1);
    return mixRgb(this.rgb, this.wiltRgb, w);
  }

  update(now, dt, wind) {
    if (this.state !== "falling") return;

    let sway = map(noise(this.driftSeed, now * 0.7), 0, 1, -1, 1) * 0.8;
    this.drift += (wind * 0.5 + sway) * dt;       // drifts in the same wind as the leaves

    if (now - this.dropTime >= this.fallSeconds) {
      this.state = "gone";
    }
  }

  draw(cx, cy, R, now) {
    if (this.state === "gone") return;

    let c = this.colourAt(now);
    let x = this.x;
    let y = this.y + this.droop(now);
    let s = this.size;
    let alpha = 255;

    if (this.state === "falling") {
      let fallTime = now - this.dropTime;
      let p = fallTime / this.fallSeconds;
      x = this.fallX + this.drift;
      y = this.fallY + 0.5 * this.gravity * fallTime * fallTime;
      s *= 1 - 0.3 * p;
      alpha = 255 * (1 - p * p);
    }

    fill(c[0], c[1], c[2], alpha);
    circle(cx + x * R, cy + y * R, s * R);
  }
}


/* -------------------------------------------------------------------------------------------------
   7. FLOWER WILT  -  what happens to a self-drawing flower (sundial, heartbeat) after it is complete
   Started by the flower's onCreated event. Timeline (seconds after onCreated):
     0 .. MATURE                     full bloom
     MATURE .. +WILT                 every dot has a scheduled drop event; petal tips first, centre last
     after that                      only the dry stem is left
------------------------------------------------------------------------------------------------- */

class FlowerWilt {
  constructor(flower) {
    this.flower = flower;
    this.timer = new Timer();
    this.lastWiltTime = 0;
    this.stemWilt = new StemWilt(flower);
    this.phase = "wilt";             // wilt -> dry

    // copy every dot of the finished flower into a WiltingDot
    let patchSeed = random(1000);
    let orders = [];
    this.dots = [];
    for (const d of flower.dots) {
      let r = sqrt(d.x * d.x + d.y * d.y);
      let f = constrain(r / flower.outline(atan2(d.y, d.x)), 0, 1);
      this.dots.push(new WiltingDot(d, f));
      orders.push(0.65 * (1 - f) + 0.25 * noise(patchSeed + d.x * 1.8, d.y * 1.8) + random(0.1));
    }

    // schedule a drop event for every dot: petal tips first, the centre last, in noisy patches
    let ranked = this.dots.map((dot, i) => i).sort((a, b) => orders[a] - orders[b]);
    ranked.forEach((index, rank) => {
      let dot = this.dots[index];
      dot.release = pow(rank / (ranked.length - 1), 0.75) * (WILT_SECONDS - MAX_FALL_SECONDS);
      this.timer.at(MATURE_SECONDS + dot.release, (now) => dot.drop(now - MATURE_SECONDS));
    });

    // event: every dot has fallen, only the dry stem is left
    this.timer.at(MATURE_SECONDS + WILT_SECONDS, () => {
      this.phase = "dry";
    });

    this.timer.start();
  }

  // Called every frame from sketch.js.
  update(wind) {
    this.timer.update();

    let now = this.timer.seconds();
    let wiltTime = max(0, now - MATURE_SECONDS);      // 0 while the flower is still in full bloom
    let dt = wiltTime - this.lastWiltTime;
    this.lastWiltTime = wiltTime;

    // the stem dries along with the flower and stays dry
    this.stemWilt.apply(min(1, wiltTime / WILT_SECONDS));

    if (this.phase !== "wilt") return;

    let cx = this.flower.nx * width;
    let cy = this.flower.ny * height;
    let R = this.flower.nr * width;

    noStroke();
    for (const dot of this.dots) {
      dot.update(wiltTime, dt, wind);
      dot.draw(cx, cy, R, wiltTime);
    }
  }
}


/* -------------------------------------------------------------------------------------------------
   8. NOISY FLOWER LIFE  -  life of a noisy flower (hourglass, ticking)
   bloom (its own clock) -> MATURE seconds in full bloom -> WILT seconds of wilting -> dry stem.
   The flower is always drawn by perlin-layer.js's own draw(); this class only lends it a
   temporary shape, colours and set of visible dots for each moment (see drawNoisyAs()).
------------------------------------------------------------------------------------------------- */

// Index of the petal at a given angle (petals as defined in perlin-layer.js).
function petalIndex(flower, angle) {
  let f = ((angle - flower.rotation) * flower.petalCount) / TWO_PI;
  return ((floor(f) % flower.petalCount) + flower.petalCount) % flower.petalCount;
}

// Draw a noisy flower with its own draw(), but with a temporary look:
//   look.core       centre size (1 = normal)
//   look.open(a)    how open the petal at angle a is (0 = hidden inside the centre, 1 = normal)
//   look.petal / look.coreColour   colours to use
//   look.dots       which dots are visible
function drawNoisyAs(flower, look) {
  let saved = {
    coreRatio: flower.coreRatio,
    petalBase: flower.petalBase,
    coreBase: flower.coreBase,
    dots: flower.dots
  };
  let baseCore = flower.coreRatio;
  let fullOutline = (a) => NoisyFlower.prototype.outline.call(flower, a);

  flower.coreRatio = baseCore * look.core;
  flower.outline = (a) => flower.coreRatio + (fullOutline(a) - baseCore) * look.open(a);
  flower.petalBase = look.petal;
  flower.coreBase = look.coreColour || saved.coreBase;
  flower.dots = look.dots;

  teamNoisyDraw.call(flower);

  delete flower.outline;               // back to the normal outline() method
  Object.assign(flower, saved);        // and the normal size, colours and dots
}

class NoisyFlowerLife {
  constructor(flower) {
    this.flower = flower;
    this.clockName = clockOf(flower);
    this.clock = CLOCKS[this.clockName];
    this.stemWilt = new StemWilt(flower);

    this.wiltStarted = false;
    this.falling = [];                 // WiltingDots that have let go
    this.lastWiltTime = 0;

    this.petalRgb = rgbOf(flower.petalBase);
    this.coreRgb = rgbOf(flower.coreBase);

    // remember facts about every dot that the clocks need
    for (const d of flower.dots) {
      d.homeColour = d.colour;
      d.petal = d.region === "petal" ? petalIndex(flower, atan2(d.hy, d.hx)) : -1;
      d.radius = sqrt(d.hx * d.hx + d.hy * d.hy);
      d.order = random();              // random order for dots appearing
    }
    this.coreDots = flower.dots.filter((d) => d.region === "core").sort((a, b) => a.radius - b.radius);
    this.petalDots = flower.dots.filter((d) => d.region === "petal");

    // ticking clock: petals open from the top, then left and right in turn
    let petals = [];
    for (let i = 0; i < flower.petalCount; i++) {
      let a = flower.rotation + ((i + 0.5) * TWO_PI) / flower.petalCount;
      let fromTop = abs(((a + HALF_PI + PI) % TWO_PI + TWO_PI) % TWO_PI - PI);
      petals.push({ index: i, fromTop: fromTop });
    }
    petals.sort((p, q) => p.fromTop - q.fromTop);
    this.tickOrder = [];
    petals.forEach((p, rank) => (this.tickOrder[p.index] = rank));
  }

  colour(rgb) {
    return color(rgb[0], rgb[1], rgb[2]);
  }

  // The flower's look while blooming; q goes from 0 (bud) to 1 (fully open).
  bloomLook(q) {
    let flower = this.flower;

    if (this.clockName === "hourglass") {
      let sand = smooth01(q / 0.6);                         // the centre fills like an hourglass
      let spikes = smooth01((q - 0.45) / 0.55);             // then the spikes push out
      let redden = smooth01((q - 0.5) / 0.5);               // white spikes take on their colour
      let grainsShown = floor(this.coreDots.length * pow(constrain(q / 0.6, 0, 1), 1.6)); // speeds up
      return {
        core: 0.25 + 0.75 * sand,
        open: () => spikes,
        petal: this.colour(mixRgb(PALETTE.white, this.petalRgb, redden)),
        dots: this.coreDots.slice(0, grainsShown).concat(this.petalDots.filter((d) => d.order < spikes))
      };
    }

    // ticking: one petal per beat, each one gliding open
    let beats = q * (flower.petalCount + 1.4);
    let openOf = (i) => smooth01((beats - this.tickOrder[i]) / 2.4);
    return {
      core: 0.3 + 0.7 * smooth01(q / 0.3),
      open: (a) => openOf(petalIndex(flower, a)),
      petal: this.colour(mixRgb(BUD_GREEN, this.petalRgb, smooth01((q - 0.1) / 0.7))),
      dots: this.coreDots.filter((d) => d.order < smooth01(q / 0.4))
        .concat(this.petalDots.filter((d) => openOf(d.petal) > 0.55))
    };
  }

  // Schedule when each dot lets go: petal tips first, the centre last (same rule as FlowerWilt).
  startWilt() {
    let all = this.flower.dots.slice();
    for (const d of all) {
      let f = d.region === "core" ? 0 : d.radius;
      d.dropOrder = 0.65 * (1 - f) + 0.25 * noise(d.hx * 1.8, d.hy * 1.8) + random(0.1);
      d.dropped = false;
    }
    all.sort((a, b) => a.dropOrder - b.dropOrder);
    all.forEach((d, rank) => {
      d.dropAt = pow(rank / (all.length - 1), 0.75) * (WILT_SECONDS - MAX_FALL_SECONDS);
    });
    this.falling = [];
    this.lastWiltTime = 0;
  }

  // The flower's look while wilting; w goes from 0 to 1, secs is seconds since wilting began.
  wiltLook(w, secs) {
    let brownness = smooth01(w / 0.6);
    let petalsLeft = 1 - smooth01((w - 0.45) / 0.45);     // petals shrivel after most dots have gone
    let kept = [];

    for (const d of this.flower.dots) {
      if (!d.dropped && secs >= d.dropAt) {               // drop event for this dot
        d.dropped = true;
        let rgb = mixRgb(rgbOf(d.homeColour), WILT_BROWN, brownness);
        let falling = new WiltingDot({ x: d.x, y: d.y, size: d.size, rgb: rgb }, 0);
        falling.drop(secs);
        this.falling.push(falling);
      }
      if (!d.dropped) {
        d.colour = this.colour(mixRgb(rgbOf(d.homeColour), WILT_BROWN, brownness * 0.85));
        kept.push(d);
      }
    }

    return {
      core: 1 - smooth01((w - 0.8) / 0.2),
      open: () => petalsLeft,
      petal: this.colour(mixRgb(this.petalRgb, WILT_BROWN, brownness)),
      coreColour: this.colour(mixRgb(this.coreRgb, WILT_BROWN, brownness)),
      dots: kept
    };
  }

  // Called every frame instead of the noisy flower's plain draw().
  draw() {
    let flower = this.flower;
    let tau = clockNow() - this.clock.start;              // seconds since this flower's life began

    if (tau < 0) {                                        // a closed green bud waiting for its turn
      drawNoisyAs(flower, {
        core: 0.2, open: () => 0, petal: this.colour(BUD_GREEN), coreColour: this.colour(BUD_GREEN), dots: []
      });
      return;
    }

    let bloomSeconds = this.clock.bloom;

    // stem: green until wilting begins, then dries with the flower and stays dry
    let dryness = 0;
    if (tau >= bloomSeconds + MATURE_SECONDS) {
      dryness = min(1, (tau - bloomSeconds - MATURE_SECONDS) / WILT_SECONDS);
    }
    this.stemWilt.apply(dryness);

    if (tau < bloomSeconds) {
      drawNoisyAs(flower, this.bloomLook(tau / bloomSeconds));      // BLOOM
      return;
    }
    if (tau < bloomSeconds + MATURE_SECONDS) {
      teamNoisyDraw.call(flower);                                    // MATURE: exactly as perlin-layer.js draws it
      return;
    }

    // WILT, then only the dry stem
    let secs = tau - bloomSeconds - MATURE_SECONDS;
    if (!this.wiltStarted) {                              // event: wilting begins
      this.startWilt();
      this.wiltStarted = true;
    }
    if (secs < WILT_SECONDS) drawNoisyAs(flower, this.wiltLook(secs / WILT_SECONDS, secs));

    // dots that have let go keep falling in the shared wind
    let dt = secs - this.lastWiltTime;
    this.lastWiltTime = secs;
    let wind = typeof windStrength === "function" ? windStrength(typeof t === "number" ? t : 0) : 0;
    noStroke();
    for (const dot of this.falling) {
      dot.update(secs, dt, wind);
      dot.draw(flower.nx * width, flower.ny * height, flower.nr * width, secs);
    }
  }
}


/* -------------------------------------------------------------------------------------------------
   9. CONNECTING TO THE TEAM'S CLASSES
   sketch.js calls FlowerDotAnimator.update() and NoisyFlower.draw() every frame. So that the team's
   files stay unchanged, these two methods are replaced here (index.html loads this file after
   perlin-layer.js and before sketch.js). The new versions still use the team's own pens, dots,
   noise and draw code; they only add the timing. The original draw() is kept as teamNoisyDraw.
------------------------------------------------------------------------------------------------- */

const teamNoisyDraw = NoisyFlower.prototype.draw;

// Self-drawing flowers: the pens draw only as fast as the flower's clock allows.
function bloomUpdate(t) {
  if (this.finished) return;
  if (!this.layer) this.resetLayer();

  let clockName = clockOf(this);
  let clock = CLOCKS[clockName];
  let tau = clockNow() - clock.start;                   // seconds since this bloom began

  let cx = this.nx * width;
  let cy = this.ny * height;
  let R = this.nr * width;

  if (tau < 0) {                                        // a closed green bud waiting for its turn
    noStroke();
    fill(BUD_GREEN[0], BUD_GREEN[1], BUD_GREEN[2]);
    circle(cx, cy, R * 0.16);
    return;
  }

  if (!this.clockReady) {
    if (clockName === "sundial") {                      // every pen starts at twelve o'clock, turning clockwise
      for (const pen of this.pens) {
        pen.angle = -HALF_PI;
        pen.direction = 1;
      }
    }
    this.clockReady = true;
  }

  // each DotPen takes as many single steps as the clock allows this frame
  let budget = penBudget(clockName, tau, clock.bloom);
  for (const pen of this.pens) {
    pen.stepsPerFrame = 1;
    let steps = 0;
    while (!pen.finished && pen.turned < budget && steps < 400) {
      pen.update(this.layer, cx, cy, R, t, this.dots);
      steps++;
    }
  }

  let pulse = 1;
  if (clockName === "heartbeat") {
    pulse = 1 + 0.07 * exp(-(tau - lastHeartBeat(tau, clock.bloom)) / 0.12);   // swells on each beat
  }

  push();
  translate(cx, cy);
  scale(pulse);
  translate(-cx, -cy);
  image(this.layer, 0, 0);
  pop();

  // same completion as perlin-layer.js: the finished flower fires onCreated (which starts FlowerWilt)
  if (this.pens.every((p) => p.finished)) {
    this.finished = true;
    this.layer.remove();
    this.layer = null;
    if (this.onCreated) this.onCreated(this);
  }
}

// Noisy flowers: drawn through their life cycle.
function lifeDraw() {
  if (!this.life) this.life = new NoisyFlowerLife(this);
  this.life.draw();
}

FlowerDotAnimator.prototype.update = bloomUpdate;
NoisyFlower.prototype.draw = lifeDraw;
