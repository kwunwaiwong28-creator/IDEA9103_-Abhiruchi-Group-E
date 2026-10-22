const PALETTE = {
  deepRed: [155, 17, 30],
  crimson: [200, 40, 45],
  white:   [245, 242, 235],
  gold:    [201, 162, 58],
  violet:  [124, 106, 189],
  cobalt:  [42, 96, 168],
  skyBlue: [126, 175, 219],
  amber:   [233, 166, 41],
  silver:  [190, 190, 200]
};

const FLOWER_SCHEMES = [
  { petalBase: "deepRed", petalDots: ["white"],              coreBase: "violet",  coreDots: ["skyBlue", "cobalt", "white"] },
  { petalBase: "amber",   petalDots: ["crimson", "deepRed"], coreBase: "violet",  coreDots: ["skyBlue", "cobalt"] },
  { petalBase: "white",   petalDots: ["crimson", "deepRed"], coreBase: "deepRed", coreDots: ["gold", "silver"] },
  { petalBase: "crimson", petalDots: ["white", "amber"],     coreBase: "cobalt",  coreDots: ["skyBlue", "white", "violet"] }
];

const MIDNIGHT = [6, 8, 18];
const NET_BLUES = [[30, 110, 190], [45, 130, 210], [22, 86, 160]];

const LEAF_SETS = [
  { dark: [38, 118, 58],  light: [96, 176, 88],   vein: [170, 220, 140] },
  { dark: [30, 100, 50],  light: [80, 160, 78],   vein: [150, 210, 130] },
  { dark: [40, 110, 170], light: [126, 175, 219], vein: [200, 225, 245] }
];

function paletteColour(name) {
  let c = PALETTE[name];
  return color(c[0], c[1], c[2]);
}

function petalOutline(angle, style, count, rotation, inner) {
  let f = (((angle - rotation) * count) / TWO_PI) % 1;
  if (f < 0) f += 1;

  let shape;
  if (style === "spiky") {
    shape = pow(1 - abs(f * 2 - 1), 1.4);
  } else {
    shape = pow(sin(f * PI), 0.6);
  }

  return inner + (1 - inner) * shape;
}

class PerlinBackground {
  constructor(horizontalCount, verticalCount) {
    this.lines = [];

    for (let i = 0; i < horizontalCount; i++) {
      this.lines.push(this.makeLine(true, i, horizontalCount));
    }
    for (let i = 0; i < verticalCount; i++) {
      this.lines.push(this.makeLine(false, i, verticalCount));
    }
  }

  makeLine(horizontal, index, total) {
    return {
      horizontal: horizontal,
      position: (index + 0.5 + random(-0.3, 0.3)) / total,
      seed: random(1000),
      amplitude: random(0.02, 0.05),
      colour: random(NET_BLUES),
      weight: random(1.2, 2.4)
    };
  }

  draw(t) {
    background(MIDNIGHT[0], MIDNIGHT[1], MIDNIGHT[2]);
    noFill();

    let scaleFactor = width / 900;

    for (const line of this.lines) {
      stroke(line.colour[0], line.colour[1], line.colour[2], 210);
      strokeWeight(line.weight * scaleFactor);

      beginShape();
      if (line.horizontal) {
        for (let x = -20; x <= width + 20; x += 10) {
          let n = noise(line.seed + (x / width) * 3, t * 0.12);
          let y = line.position * height + map(n, 0, 1, -1, 1) * line.amplitude * height;
          vertex(x, y);
        }
      } else {
        for (let y = -20; y <= height + 20; y += 10) {
          let n = noise(line.seed + (y / height) * 3, t * 0.12);
          let x = line.position * width + map(n, 0, 1, -1, 1) * line.amplitude * width;
          vertex(x, y);
        }
      }
      endShape();
    }
  }
}

const DRAW_LAPS = 4;

class DotPen {
  constructor(radiusFn, colourName, dotSize, spacing, laps) {
    this.radiusFn = radiusFn;
    this.rgb = PALETTE[colourName];
    this.dotSize = dotSize;
    this.spacing = spacing;

    this.angle = random(TWO_PI);
    this.direction = random([-1, 1]);

    this.distortSeed = random(1000);
    this.sizeSeed = random(1000);

    this.stepsPerFrame = 1;
    this.laps = laps;
    this.turned = 0;
    this.finished = false;
  }

  update(layer, cx, cy, R, t, dots) {
    layer.noStroke();
    layer.fill(this.rgb[0], this.rgb[1], this.rgb[2]);

    for (let i = 0; i < this.stepsPerFrame && !this.finished; i++) {
      let base = this.radiusFn(this.angle);

      let distort = map(noise(this.distortSeed + this.angle * 0.6, t * 0.5), 0, 1, -0.05, 0.05);
      let r = base + distort;

      let s = this.dotSize * map(noise(this.sizeSeed + this.angle * 1.5, t * 0.3), 0, 1, 0.6, 1.3);

      let dot = { x: cos(this.angle) * r, y: sin(this.angle) * r, size: s, rgb: this.rgb };
      dots.push(dot);
      layer.circle(cx + dot.x * R, cy + dot.y * R, dot.size * R);

      let step = this.spacing / max(base, 0.05);
      this.angle += this.direction * step;
      this.turned += step;

      if (this.turned >= this.laps * TWO_PI) {
        this.finished = true;
      }
    }
  }
}

class FlowerDotAnimator {
  constructor(nx, ny, nr) {
    this.nx = nx;
    this.ny = ny;
    this.nr = nr;

    this.petalCount = floor(random(13, 18));
    this.rotation = random(TWO_PI);
    this.inner = random(0.58, 0.66);
    this.coreRatio = 0.5;

    let scheme = random(FLOWER_SCHEMES);
    let petalColours = [scheme.petalBase].concat(scheme.petalDots);
    let coreColours = [scheme.coreBase].concat(scheme.coreDots);

    this.pens = [];

    for (const k of [1.0, 0.82, 0.64, 0.46, 0.28]) {
      let fn = (a) => lerp(this.coreRatio * 1.05, this.outline(a), k);
      this.pens.push(new DotPen(fn, random(petalColours), 0.05, 0.07, DRAW_LAPS));
    }

    for (const rr of [0.46, 0.4, 0.33, 0.26, 0.19, 0.12, 0.06]) {
      this.pens.push(new DotPen(() => rr, random(coreColours), 0.055, 0.07, DRAW_LAPS));
    }

    this.dots = [];
    this.layer = null;
    this.finished = false;
    this.onCreated = null;
  }

  outline(angle) {
    return petalOutline(angle, "spiky", this.petalCount, this.rotation, this.inner);
  }

  resetLayer() {
    if (this.layer) this.layer.remove();
    this.layer = null;
    if (this.finished) return;

    this.layer = createGraphics(width, height);
    this.layer.clear();

    let cx = this.nx * width;
    let cy = this.ny * height;
    let R = this.nr * width;
    this.layer.noStroke();
    for (const d of this.dots) {
      this.layer.fill(d.rgb[0], d.rgb[1], d.rgb[2]);
      this.layer.circle(cx + d.x * R, cy + d.y * R, d.size * R);
    }
  }

  update(t) {
    if (this.finished) return;

    let cx = this.nx * width;
    let cy = this.ny * height;
    let R = this.nr * width;

    for (const pen of this.pens) {
      pen.update(this.layer, cx, cy, R, t, this.dots);
    }

    image(this.layer, 0, 0);

    if (this.pens.every((p) => p.finished)) {
      this.finished = true;
      this.layer.remove();
      this.layer = null;
      if (this.onCreated) this.onCreated(this);
    }
  }
}

class NoisyDot {
  constructor(hx, hy, region, colourName, size) {
    this.hx = hx;
    this.hy = hy;
    this.x = hx;
    this.y = hy;
    this.region = region;
    this.colour = paletteColour(colourName);
    this.size = size;

    this.noiseLocation = random(1000);
    this.noiseScale = random(0.1, 0.3);

    this.speed = random(0.004, 0.012);
  }

  update(flower) {
    let ox = map(noise(this.noiseLocation), 0, 1, -1, 1) * this.noiseScale;
    let oy = map(noise(this.noiseLocation + 10), 0, 1, -1, 1) * this.noiseScale;

    let p = flower.keepInside(this.hx + ox, this.hy + oy, this.region);
    this.x = p[0];
    this.y = p[1];

    this.noiseLocation += this.speed;
  }
}

class NoisyFlower {
  constructor(nx, ny, nr, style) {
    this.nx = nx;
    this.ny = ny;
    this.nr = nr;
    this.style = style;

    this.petalCount = style === "round" ? floor(random(10, 14)) : floor(random(14, 19));
    this.rotation = random(TWO_PI);
    this.inner = style === "round" ? random(0.55, 0.62) : random(0.62, 0.7);

    this.coreRatio = this.inner * random(0.72, 0.8);

    this.scheme = random(FLOWER_SCHEMES);
    this.petalBase = paletteColour(this.scheme.petalBase);
    this.coreBase = paletteColour(this.scheme.coreBase);

    this.dots = [];
    this.buildDots(170, "petal");
    this.buildDots(120, "core");
  }

  outline(angle) {
    return petalOutline(angle, this.style, this.petalCount, this.rotation, this.inner);
  }

  buildDots(count, region) {
    let made = 0;
    while (made < count) {
      let x = random(-1, 1);
      let y = random(-1, 1);
      let r = sqrt(x * x + y * y);
      let a = atan2(y, x);

      let inside = region === "core"
        ? r < this.coreRatio * 0.88
        : r > this.coreRatio * 1.1 && r < this.outline(a) * 0.88;

      if (inside) {
        let colours = region === "core" ? this.scheme.coreDots : this.scheme.petalDots;
        let size = region === "core" ? random(0.035, 0.06) : random(0.025, 0.045);
        this.dots.push(new NoisyDot(x, y, region, random(colours), size));
        made++;
      }
    }
  }

  keepInside(px, py, region) {
    let r = sqrt(px * px + py * py);
    if (r === 0) return [px, py];
    let a = atan2(py, px);

    let minR, maxR;
    if (region === "core") {
      minR = 0;
      maxR = this.coreRatio * 0.9;
    } else {
      minR = this.coreRatio * 1.06;
      maxR = this.outline(a) * 0.9;
    }

    let clamped = constrain(r, minR, maxR);
    return [cos(a) * clamped, sin(a) * clamped];
  }

  draw() {
    let R = this.nr * width;

    push();
    translate(this.nx * width, this.ny * height);
    noStroke();

    fill(this.petalBase);
    beginShape();
    for (let i = 0; i < 180; i++) {
      let a = (TWO_PI / 180) * i;
      let r = this.outline(a) * R;
      vertex(cos(a) * r, sin(a) * r);
    }
    endShape(CLOSE);

    fill(this.coreBase);
    circle(0, 0, this.coreRatio * 2 * R);

    for (const dot of this.dots) {
      dot.update(this);
      fill(dot.colour);
      circle(dot.x * R, dot.y * R, dot.size * R);
    }

    pop();
  }
}

function windStrength(t) {
  return map(noise(5000 + t * 0.25), 0, 1, -1, 1);
}

class WindLeaf {
  constructor(pivot, lengthN, direction, tilt = 0.3) {
    this.px = pivot.x;
    this.py = pivot.y;
    this.lengthN = lengthN;
    this.direction = direction;

    this.tilt = tilt;

    this.widthRatio = random(0.46, 0.6);
    this.colours = random(LEAF_SETS);

    this.flutterSeed = random(1000);
    this.flutterAmount = random(0.08, 0.16);
  }

  draw(t, wind) {
    let L = this.lengthN * width;
    let W = L * this.widthRatio;

    let flutter = map(noise(this.flutterSeed + t * 1.2), 0, 1, -1, 1) * this.flutterAmount;

    let swing = (wind * 0.28 + flutter) * map(this.lengthN, 0.1, 0.4, 1, 0.55, true);

    push();
    translate(this.px * width, this.py * height);

    if (this.direction === 1) {
      rotate(-this.tilt + swing);
    } else {
      rotate(PI + this.tilt - swing);
      scale(1, -1);
    }

    noStroke();

    fill(this.colours.light[0], this.colours.light[1], this.colours.light[2]);
    beginShape();
    vertex(0, 0);
    bezierVertex(L * 0.25, W, L * 0.7, W * 0.85, L, 0);
    endShape(CLOSE);

    fill(this.colours.dark[0], this.colours.dark[1], this.colours.dark[2]);
    beginShape();
    vertex(0, 0);
    bezierVertex(L * 0.25, -W, L * 0.7, -W * 0.85, L, 0);
    endShape(CLOSE);

    let v = this.colours.vein;
    stroke(v[0], v[1], v[2]);
    strokeWeight(max(1, L * 0.012));
    line(0, 0, L * 0.96, 0);

    strokeWeight(max(1, L * 0.007));
    let veins = 9;
    for (let i = 1; i <= veins; i++) {
      let px = (L * 0.9 * i) / (veins + 1);
      let reach = W * 0.68 * sin(PI * px / L);
      line(px, 0, px + L * 0.1, -reach);
      line(px, 0, px + L * 0.1, reach);
    }

    pop();
  }
}
