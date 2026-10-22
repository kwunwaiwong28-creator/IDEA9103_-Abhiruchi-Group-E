/* =================================================================================================
   time-mechanic.js  -  TIME-BASED MECHANIC  (IDEA9103 Major Project)
   Mechanic owner: Yeheng Li

   IDEA
   Four flowers, four clocks. Each flower in the garden keeps a different kind of time, so each one
   blooms in its own way:

     SUNDIAL    top-left flower      all dot pens line up like one clock hand and sweep clockwise
     HOURGLASS  top-right flower     centre dots pile up like falling sand, then spikes break out
     TICKING    middle flower        a green bud opens one petal per beat, top first, then left/right
     HEARTBEAT  bottom-right flower  dots are added in beats that get faster; the flower pulses

   When a self-drawing flower is complete, its onCreated event starts a FlowerWilt: the dots dry to
   browns and fall away on scheduled timer events.

   HOW IT WORKS WITH THE TEAM'S FILES
   - The flower shapes, colours, dots and Perlin-noise movement all come from perlin-layer.js
     (Perlin noise mechanic). Stems come from plants.js. Those files are NOT edited.
   - This file only decides WHEN dots appear and HOW FAR each petal or centre is open.
     It connects to the team code in section 8 (see notes there).

   CODE STRUCTURE
     Section 1  Settings ........................ global constants
     Section 2  Helper functions ................ clockNow(), smooth01(), mixRgb(), rgbOf()
     Section 3  class Timer ..................... at(seconds, action), start(), seconds(), update()
     Section 4  Bloom clocks .................... CLOCKS, clockOf(), penBudget(), lastHeartBeat()
     Section 5  class WiltingDot ................ drop(), colourAt(), update(), draw()
     Section 6  class FlowerWilt ................ scheduled wilting of a finished self-drawing flower
     Section 7  class NoisyFlowerBloom .......... bud -> bloom for a noisy flower (hourglass, ticking)
     Section 8  Connecting to the team's classes  bloomUpdate(), bloomDraw()

   VARIABLES
     Global   : the settings in section 1, CLOCKS, clockZero
     Instance : e.g. Timer.events, WiltingDot.state, NoisyFlowerBloom.tickOrder
     Local    : values worked out fresh each frame, e.g. tau, budget, pulse

   AI ACKNOWLEDGEMENT
   The first version of this file (Timer, WiltingDot, FlowerWilt: the wilting of the self-drawing
   flowers) was written by Yeheng Li. The four bloom clocks (the CLOCKS settings and sections 2, 4, 7 and 8) were written
   with the help of Claude (Anthropic): Claude helped design the clocks and wrote and tested that
   code, which was then reviewed and adjusted by Yeheng Li.

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
const BUD_GREEN = [66, 158, 84];


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
   5. WILTING DOT  -  one dot that dries, sags, then falls in the wind and fades
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
   6. FLOWER WILT  -  scheduled wilting of a finished self-drawing flower (sundial, heartbeat)
   Started by the flower's onCreated event (set up in sketch.js).
   Every dot gets its own drop event: petal tips first, the centre last, in noisy patches.
------------------------------------------------------------------------------------------------- */

class FlowerWilt {
  constructor(flower) {
    this.flower = flower;
    this.timer = new Timer();
    this.gone = false;
    this.lastNow = 0;

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

    // schedule a drop event for every dot
    let ranked = this.dots.map((dot, i) => i).sort((a, b) => orders[a] - orders[b]);
    ranked.forEach((index, rank) => {
      let dot = this.dots[index];
      dot.release = pow(rank / (ranked.length - 1), 0.75) * (WILT_SECONDS - MAX_FALL_SECONDS);
      this.timer.at(dot.release, (now) => dot.drop(now));
    });

    // event: every dot has fallen
    this.timer.at(WILT_SECONDS, () => {
      this.gone = true;
    });

    this.timer.start();
  }

  // Called every frame from sketch.js.
  update(wind) {
    if (this.gone) return;

    this.timer.update();
    if (this.gone) return;

    let now = this.timer.seconds();
    let dt = now - this.lastNow;
    this.lastNow = now;

    let cx = this.flower.nx * width;
    let cy = this.flower.ny * height;
    let R = this.flower.nr * width;

    noStroke();
    for (const dot of this.dots) {
      dot.update(now, dt, wind);
      dot.draw(cx, cy, R, now);
    }
  }
}


/* -------------------------------------------------------------------------------------------------
   7. NOISY FLOWER BLOOM  -  bud -> bloom for a noisy flower (hourglass, ticking)
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

class NoisyFlowerBloom {
  constructor(flower) {
    this.flower = flower;
    this.clockName = clockOf(flower);
    this.clock = CLOCKS[this.clockName];
    this.petalRgb = rgbOf(flower.petalBase);

    // remember facts about every dot that the clocks need
    for (const d of flower.dots) {
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

  // Called every frame instead of the noisy flower's plain draw().
  draw() {
    let flower = this.flower;
    let tau = clockNow() - this.clock.start;              // seconds since this bloom began

    if (tau < 0) {                                        // a closed green bud waiting for its turn
      drawNoisyAs(flower, {
        core: 0.2, open: () => 0, petal: this.colour(BUD_GREEN), coreColour: this.colour(BUD_GREEN), dots: []
      });
    } else if (tau < this.clock.bloom) {
      drawNoisyAs(flower, this.bloomLook(tau / this.clock.bloom));
    } else {
      teamNoisyDraw.call(flower);                         // fully open: exactly as perlin-layer.js draws it
    }
  }
}


/* -------------------------------------------------------------------------------------------------
   8. CONNECTING TO THE TEAM'S CLASSES
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

// Noisy flowers: drawn through their bloom clock.
function bloomDraw() {
  if (!this.bloomClock) this.bloomClock = new NoisyFlowerBloom(this);
  this.bloomClock.draw();
}

FlowerDotAnimator.prototype.update = bloomUpdate;
NoisyFlower.prototype.draw = bloomDraw;
