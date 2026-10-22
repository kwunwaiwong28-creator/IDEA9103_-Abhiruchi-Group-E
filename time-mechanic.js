const WILT_SECONDS = 15;
const MAX_FALL_SECONDS = 2.6;
const DROOP = 0.12;

const WILT_COLOURS = [
  [122, 84, 46],
  [98, 72, 50],
  [142, 112, 72],
  [80, 60, 42]
];

class Timer {
  constructor() {
    this.events = [];
    this.next = 0;
    this.startTime = 0;
    this.running = false;
  }

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

  update() {
    if (!this.running) return;

    let now = this.seconds();
    while (this.next < this.events.length && this.events[this.next].seconds <= now) {
      this.events[this.next].action(now);
      this.next++;
    }
  }
}

class WiltingDot {
  constructor(dot, f) {
    this.x = dot.x;
    this.y = dot.y;
    this.size = dot.size;
    this.rgb = dot.rgb;
    this.f = f;

    let brown = random(WILT_COLOURS);
    this.wiltRgb = [
      lerp(dot.rgb[0], brown[0], 0.85),
      lerp(dot.rgb[1], brown[1], 0.85),
      lerp(dot.rgb[2], brown[2], 0.85)
    ];

    this.release = 0;
    this.fallSeconds = random(1.6, MAX_FALL_SECONDS);
    this.gravity = random(1.2, 2.2);
    this.driftSeed = random(1000);

    this.state = "attached";
    this.dropTime = 0;
    this.fallX = 0;
    this.fallY = 0;
    this.drift = 0;
  }

  droop(now) {
    let g = now / WILT_SECONDS;
    return DROOP * g * g * this.f;
  }

  drop(now) {
    this.state = "falling";
    this.dropTime = now;
    this.fallX = this.x;
    this.fallY = this.y + this.droop(now);
  }

  colourAt(now) {
    let w = constrain(now / (this.release + this.fallSeconds * 0.6), 0, 1);
    return [
      lerp(this.rgb[0], this.wiltRgb[0], w),
      lerp(this.rgb[1], this.wiltRgb[1], w),
      lerp(this.rgb[2], this.wiltRgb[2], w)
    ];
  }

  update(now, dt, wind) {
    if (this.state !== "falling") return;

    let sway = map(noise(this.driftSeed, now * 0.7), 0, 1, -1, 1) * 0.8;
    this.drift += (wind * 0.5 + sway) * dt;

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
      let ft = now - this.dropTime;
      let p = ft / this.fallSeconds;
      x = this.fallX + this.drift;
      y = this.fallY + 0.5 * this.gravity * ft * ft;
      s *= 1 - 0.3 * p;
      alpha = 255 * (1 - p * p);
    }

    fill(c[0], c[1], c[2], alpha);
    circle(cx + x * R, cy + y * R, s * R);
  }
}

class FlowerWilt {
  constructor(flower) {
    this.flower = flower;
    this.timer = new Timer();
    this.gone = false;
    this.lastNow = 0;

    let patchSeed = random(1000);
    let orders = [];
    this.dots = [];

    for (const d of flower.dots) {
      let r = sqrt(d.x * d.x + d.y * d.y);
      let f = constrain(r / flower.outline(atan2(d.y, d.x)), 0, 1);
      this.dots.push(new WiltingDot(d, f));
      orders.push(0.65 * (1 - f) + 0.25 * noise(patchSeed + d.x * 1.8, d.y * 1.8) + random(0.1));
    }

    let ranked = this.dots.map((dot, i) => i).sort((a, b) => orders[a] - orders[b]);
    ranked.forEach((index, rank) => {
      let dot = this.dots[index];
      dot.release = pow(rank / (ranked.length - 1), 0.75) * (WILT_SECONDS - MAX_FALL_SECONDS);
      this.timer.at(dot.release, (now) => dot.drop(now));
    });

    this.timer.at(WILT_SECONDS, () => {
      this.gone = true;
    });

    this.timer.start();
  }

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
