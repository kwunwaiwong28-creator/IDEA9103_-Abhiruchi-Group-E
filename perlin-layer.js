/*

  random() picks things that stay the same until the page is refreshed:
  colours, petal counts, where each pen starts.
  noise() gives smooth, natural change: wobbly dots, wind, leaf edges, the scales.

  DotPen and NoisyDot build on the IDEA9103 Week 8 tutorial.
*/

// Colours picked from the Kusama painting.
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

// Colour sets for the flowers. Each flower uses one set.
const FLOWER_SCHEMES = [
  { petalBase: "deepRed", petalDots: ["white"],              coreBase: "violet",  coreDots: ["skyBlue", "cobalt", "white"] },
  { petalBase: "amber",   petalDots: ["crimson", "deepRed"], coreBase: "violet",  coreDots: ["skyBlue", "cobalt"] },
  { petalBase: "white",   petalDots: ["crimson", "deepRed"], coreBase: "deepRed", coreDots: ["gold", "silver"] },
  { petalBase: "crimson", petalDots: ["white", "amber"],     coreBase: "cobalt",  coreDots: ["skyBlue", "white", "violet"] }
];

// Background colours: a black base and three greys for the scale lines.
const MIDNIGHT = [9, 9, 11];
const NET_BLUES = [[132, 132, 137], [168, 168, 173], [98, 98, 103]];

// Colour sets for the leaves: two greens and one blue.
const LEAF_SETS = [
  { dark: [38, 118, 58],  light: [96, 176, 88],   vein: [170, 220, 140] },
  { dark: [30, 100, 50],  light: [80, 160, 78],   vein: [150, 210, 130] },
  { dark: [40, 110, 170], light: [126, 175, 219], vein: [200, 225, 245] }
];

// Turns a colour name (like "gold") into a p5 colour.
function paletteColour(name) {
  let c = PALETTE[name];
  return color(c[0], c[1], c[2]);
}

// Says how far the petal edge is from the centre at any angle.
// "spiky" gives pointed petals, "round" gives soft ones.
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

// D · Background: dragon scales made with Perlin noise.
class PerlinBackground {
  constructor() {
    // How many scales fit across the canvas. Bigger number = smaller scales.
    this.columns = 16;
    // 0 = still background. A small number like 0.12 makes it shift slowly.
    this.shift = 0;
    this.seed = random(1000);
    this.size = "";
  }

  // Works out the shape of every scale, then sorts them by brightness.
  buildScales(t) {
    // Width of one scale, and the gap between rows (smaller gap = tighter scales).
    let w = width / this.columns;
    let h = w * 0.48;
    let rowCount = ceil(height / h) + 4;
    let z = t * this.shift;
    let grid = [];

    // Step 1: a grid of points where the scales meet.
    // Every second row moves half a scale across, like bricks.
    for (let r = 0; r <= rowCount; r++) {
      let points = [];
      for (let c = -2; c <= this.columns + 2; c++) {
        let x = (c + (r % 2) * 0.5) * w;
        let y = (r - 2) * h;
        let nx = x / width;
        let ny = y / height;
        // Noise pushes each point a little, so the scales grow, shrink
        // and curve like a dragon's body instead of a flat pattern.
        points.push({
          x: x + (noise(this.seed + nx * 1.3, ny * 1.3, z) - 0.5) * width * 0.24,
          y: y + (noise(this.seed + 20 + nx * 1.3, ny * 1.3, z) - 0.5) * width * 0.22,
          nx: nx,
          ny: ny
        });
      }
      grid.push(points);
    }

    this.outlines = [[], [], [], [], []];
    this.inners = [[], [], [], [], []];

    // Step 2: each scale hangs between two points and points down to the row below.
    for (let r = 0; r < grid.length - 1; r++) {
      let tipShift = r % 2 === 0 ? 0 : 1;
      let run = null;
      let runLevel = -1;

      for (let c = 0; c < grid[r].length - 1; c++) {
        let left = grid[r][c];
        let right = grid[r][c + 1];
        let tip = grid[r + 1][c + tipShift];
        if (!tip) continue;

        let nx = (left.nx + right.nx) / 2;
        let ny = left.ny;
        // Noise decides how sharp the tip is and how much light the scale catches.
        let point = map(noise(this.seed + 30 + nx * 3, ny * 3), 0, 1, 0.7, 1.25);
        let sheen = noise(this.seed + 40 + nx * 1.6 - z * 0.4, ny * 1.6 + z * 0.2);
        // Brightness is sorted into 5 levels: 0 = darkest, 4 = brightest.
        let level = constrain(floor(map(sheen, 0.3, 0.7, 0, 5)), 0, 4);

        // Scales next to each other with the same brightness join into one line.
        let outline = this.scaleCurve(left, right, tip, point, 1);
        if (level !== runLevel) {
          run = outline;
          runLevel = level;
          this.outlines[level].push(run);
        } else {
          run.push(...outline.slice(1));
        }

        // Brighter scales get one or two smaller curves inside, like a shine.
        if (level >= 1) {
          this.inners[level].push(this.scaleCurve(left, right, tip, point, 0.58));
        }
        if (level >= 3) {
          this.inners[level].push(this.scaleCurve(left, right, tip, point, 0.3));
        }
      }
    }
  }

  // Makes the curved, pointed edge of one scale.
  // k = 1 is the outline. A smaller k makes a smaller curve inside it.
  scaleCurve(left, right, tip, point, k) {
    let cx = (left.x + right.x) / 2;
    let cy = (left.y + right.y) / 2;
    let dropX = tip.x - cx;
    let dropY = tip.y - cy;
    let lift = (1 - k) * 0.35;
    let curve = [];

    for (let s = 0; s <= 10; s++) {
      let f = s / 10;
      let u = abs(f * 2 - 1);
      let d = pow(1 - pow(u, point), 0.55);
      let bx = lerp(left.x, right.x, f);
      let by = lerp(left.y, right.y, f);
      let x = cx + (bx - cx) * k + dropX * (d * k - lift);
      let y = cy + (by - cy) * k + dropY * (d * k - lift);
      curve.push([x, y]);
    }
    return curve;
  }

  // Sets the grey colour and transparency for a brightness level.
  shade(level, alphaScale) {
    let grey = NET_BLUES[[2, 2, 0, 0, 1][level]];
    stroke(grey[0], grey[1], grey[2], [140, 165, 190, 215, 240][level] * alphaScale);
  }

  // Draws many lines as one shape, which is much faster.
  // vertex(x, y, true) starts a new line without joining it to the last one.
  drawLines(lines) {
    beginShape();
    for (const line of lines) {
      vertex(line[0][0], line[0][1], true);
      for (let j = 1; j < line.length; j++) {
        vertex(line[j][0], line[j][1]);
      }
    }
    endShape();
  }

  // Runs every frame: paints the background, then the scale lines.
  draw(t) {
    background(MIDNIGHT[0], MIDNIGHT[1], MIDNIGHT[2]);
    noFill();

    // The scales are only worked out once, or again if the window changes size.
    let size = width + "x" + height;
    if (this.shift > 0 || this.size !== size) {
      this.buildScales(t);
      this.size = size;
    }

    let scaleFactor = width / 900;

    // Outlines first, then the shine lines inside.
    strokeWeight(1.5 * scaleFactor);
    for (let level = 0; level < 5; level++) {
      if (this.outlines[level].length === 0) continue;
      this.shade(level, 1);
      this.drawLines(this.outlines[level]);
    }

    strokeWeight(1 * scaleFactor);
    for (let level = 1; level < 5; level++) {
      if (this.inners[level].length === 0) continue;
      this.shade(level - 1, 0.8);
      this.drawLines(this.inners[level]);
    }
  }
}

// How many times each pen goes around before the flower is finished.
const DRAW_LAPS = 4;

// A pen that walks around one ring of the flower and leaves a dot at each step.
// Builds on the Week 8 DotAnimator.
class DotPen {
  constructor(radiusFn, colourName, dotSize, spacing, laps) {
    this.radiusFn = radiusFn;
    this.rgb = PALETTE[colourName];
    this.dotSize = dotSize;
    this.spacing = spacing;

    // Random start point and direction, so every flower is drawn differently.
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

      // Noise moves each dot slightly in or out, so the ring looks hand-painted.
      let distort = map(noise(this.distortSeed + this.angle * 0.6, t * 0.5), 0, 1, -0.05, 0.05);
      let r = base + distort;

      // Noise also changes the dot size along the ring.
      let s = this.dotSize * map(noise(this.sizeSeed + this.angle * 1.5, t * 0.3), 0, 1, 0.6, 1.3);

      // Every dot is saved so the finished flower can be redrawn later.
      let dot = { x: cos(this.angle) * r, y: sin(this.angle) * r, size: s, rgb: this.rgb };
      dots.push(dot);
      layer.circle(cx + dot.x * R, cy + dot.y * R, dot.size * R);

      let step = this.spacing / max(base, 0.05);
      this.angle += this.direction * step;
      this.turned += step;

      // Stop after the set number of laps.
      if (this.turned >= this.laps * TWO_PI) {
        this.finished = true;
      }
    }
  }
}

// Picks one colour set and gives a colour to each ring.
// Two flowers given the same result will have matching colours.
function pickFlowerColours(scheme = random(FLOWER_SCHEMES)) {
  let petalColours = [scheme.petalBase].concat(scheme.petalDots);
  let coreColours = [scheme.coreBase].concat(scheme.coreDots);
  return {
    scheme: scheme,
    petal: [0, 1, 2, 3, 4].map(() => random(petalColours)),
    core: [0, 1, 2, 3, 4, 5, 6].map(() => random(coreColours))
  };
}

// A · A flower that draws itself with 12 pens: 5 on the petals, 7 in the centre.
class FlowerDotAnimator {
  constructor(nx, ny, nr, colours = pickFlowerColours()) {
    this.nx = nx;
    this.ny = ny;
    this.nr = nr;

    // Random petal count and turn, so each flower looks different.
    this.petalCount = floor(random(13, 18));
    this.rotation = random(TWO_PI);
    this.inner = random(0.58, 0.66);
    this.coreRatio = 0.5;

    this.colours = colours;

    this.pens = [];

    // Petal pens: 5 rings that follow the petal shape, from the edge inwards.
    [1.0, 0.82, 0.64, 0.46, 0.28].forEach((k, i) => {
      let fn = (a) => lerp(this.coreRatio * 1.05, this.outline(a), k);
      this.pens.push(new DotPen(fn, colours.petal[i], 0.05, 0.07, DRAW_LAPS));
    });

    // Centre pens: 7 circles, from the outside in.
    [0.46, 0.4, 0.33, 0.26, 0.19, 0.12, 0.06].forEach((rr, i) => {
      this.pens.push(new DotPen(() => rr, colours.core[i], 0.055, 0.07, DRAW_LAPS));
    });

    this.dots = [];
    this.layer = null;
    this.finished = false;
    // Called once the flower has finished drawing.
    this.onCreated = null;
  }

  outline(angle) {
    return petalOutline(angle, "spiky", this.petalCount, this.rotation, this.inner);
  }

  // Makes a fresh layer to draw on (also after a window resize)
  // and puts back the dots already drawn.
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

  // Runs every frame while the flower is being drawn.
  update(t) {
    if (this.finished) return;

    let cx = this.nx * width;
    let cy = this.ny * height;
    let R = this.nr * width;

    for (const pen of this.pens) {
      pen.update(this.layer, cx, cy, R, t, this.dots);
    }

    image(this.layer, 0, 0);

    // When every pen is done, the flower is finished.
    if (this.pens.every((p) => p.finished)) {
      this.finished = true;
      this.layer.remove();
      this.layer = null;
      if (this.onCreated) this.onCreated(this);
    }
  }
}

// One dot that drifts around its home spot using noise (Week 8 randomNoisyShape idea).
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
    // Two noise values give a smooth drift left-right and up-down.
    let ox = map(noise(this.noiseLocation), 0, 1, -1, 1) * this.noiseScale;
    let oy = map(noise(this.noiseLocation + 10), 0, 1, -1, 1) * this.noiseScale;

    // Stops the dot drifting out of its part of the flower.
    let p = flower.keepInside(this.hx + ox, this.hy + oy, this.region);
    this.x = p[0];
    this.y = p[1];

    this.noiseLocation += this.speed;
  }
}

// B · A filled flower covered in drifting dots.
// Not placed in the current layout.
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

  // Picks random spots and keeps only the ones inside the petals or the centre.
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

  // Pulls a point back inside its area if it drifts too far.
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

  // Draws the petal shape, the centre, then every dot.
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

// One shared wind for all the leaves, made with noise. Goes from -1 to 1.
function windStrength(t) {
  return map(noise(5000 + t * 0.25), 0, 1, -1, 1);
}

// C · A leaf that swings in the wind, with a Perlin noise texture.
class WindLeaf {
    constructor(pivot, lengthN, direction, tilt = 0.3, colours = random(LEAF_SETS)) {
    this.px = pivot.x;
    this.py = pivot.y;
    this.lengthN = lengthN;
    this.direction = direction;

    this.tilt = tilt;

    this.widthRatio = random(0.46, 0.6);
    this.colours = colours;

    // Each leaf also flutters on its own, so they don't all move together.
    this.flutterSeed = random(1000);
    this.flutterAmount = random(0.08, 0.16);

    this.textureSeed = this.flutterSeed + 500;
  }

  // Noise makes the leaf edge slightly uneven, like a real leaf.
  edgeAt(s, side) {
    let seed = this.textureSeed + (side > 0 ? 0 : 50);
    return map(noise(seed + s * 9), 0, 1, 0.86, 1.1);
  }

  // A point on the leaf edge. s goes from 0 (stem end) to 1 (tip).
  outlinePoint(s, side, L, W) {
    return {
      x: bezierPoint(0, L * 0.25, L * 0.7, L, s),
      y: side * bezierPoint(0, W, W * 0.85, 0, s) * this.edgeAt(s, side)
    };
  }

  // The middle vein wobbles slightly using noise.
  midribY(s, W) {
    return map(noise(this.textureSeed + 300 + s * 3), 0, 1, -1, 1) * W * 0.025;
  }

  // Draws one half of the leaf (the light side or the dark side).
  drawHalf(L, W, side) {
    beginShape();
    for (let i = 0; i <= 40; i++) {
      let p = this.outlinePoint(i / 40, side, L, W);
      vertex(p.x, p.y);
    }
    endShape(CLOSE);
  }

  // Soft light and dark patches. Noise decides where they go and how strong they are.
  drawMottling(L, W) {
    let light = this.colours.light;
    let dark = this.colours.dark;
    let seed = this.textureSeed;

    noStroke();
    for (let i = 0; i < 13; i++) {
      for (let j = -3; j <= 3; j++) {
        if (j === 0) continue;
        let tone = noise(seed + 800 + i * 0.4, j * 0.6);
        let alpha = abs(tone - 0.5) * 2 * 140;
        if (alpha < 18) continue;
        let side = j > 0 ? 1 : -1;
        let s = constrain((i + 0.5) / 13 + map(noise(seed + 700 + i * 0.9, j * 0.9), 0, 1, -0.03, 0.03), 0.04, 0.96);
        let k = (abs(j) - 0.4) / 3.2 + map(noise(seed + 750 + i * 0.7, j * 1.3), 0, 1, -0.08, 0.08);
        let edge = this.outlinePoint(s, side, L, W);
        let x = edge.x;
        let y = edge.y * constrain(k, 0.1, 0.8);

        let base = side > 0 ? light : dark;
        let c = tone > 0.5
          ? [lerp(base[0], dark[0] * 0.8, 0.5), lerp(base[1], dark[1] * 0.8, 0.5), lerp(base[2], dark[2] * 0.8, 0.5)]
          : [lerp(base[0], 255, 0.25), lerp(base[1], 255, 0.25), lerp(base[2], 255, 0.25)];
        let size = W * map(noise(seed + 900 + i, j), 0, 1, 0.06, 0.18);

        fill(c[0], c[1], c[2], alpha);
        ellipse(x, y, size * 1.8, size);
      }
    }
  }

  // Draws one side vein, from the middle vein out towards the edge.
  drawVein(s0, side, k, L, W, seed) {
    let x0 = bezierPoint(0, L * 0.25, L * 0.7, L, s0);
    let y0 = this.midribY(s0, W);
    let end = this.outlinePoint(min(s0 + 0.12, 0.97), side, L, W);
    let x1 = end.x;
    let y1 = end.y * k;

    beginShape();
    for (let i = 0; i <= 8; i++) {
      let u = i / 8;
      let wob = map(noise(seed + u * 2), 0, 1, -1, 1) * abs(y1 - y0) * 0.06;
      let x = lerp(x0, x1, u) - sin(PI * u) * L * 0.015;
      let y = lerp(y0, y1, pow(u, 0.85)) + wob;
      vertex(x, y);
    }
    endShape();
  }

  // Runs every frame: works out the swing, turns the leaf, then draws it.
  draw(t, wind) {
    let L = this.lengthN * width;
    let W = L * this.widthRatio;

    let flutter = map(noise(this.flutterSeed + t * 1.2), 0, 1, -1, 1) * this.flutterAmount;

    // Swing = shared wind + the leaf's own flutter. Bigger leaves move less.
    let swing = (wind * 0.28 + flutter) * map(this.lengthN, 0.1, 0.4, 1, 0.55, true);

    push();
    translate(this.px * width, this.py * height);

    // Leaves pointing left are flipped.
    if (this.direction === 1) {
      rotate(-this.tilt + swing);
    } else {
      rotate(PI + this.tilt - swing);
      scale(1, -1);
    }

    noStroke();

    let light = this.colours.light;
    let dark = this.colours.dark;
    let v = this.colours.vein;
    let seed = this.textureSeed;

    // Light half, dark half, then the patches.
    fill(light[0], light[1], light[2]);
    this.drawHalf(L, W, 1);

    fill(dark[0], dark[1], dark[2]);
    this.drawHalf(L, W, -1);

    this.drawMottling(L, W);

    // Middle vein.
    noFill();
    stroke(v[0], v[1], v[2], 230);
    strokeWeight(max(1, L * 0.012));
    beginShape();
    for (let i = 0; i <= 24; i++) {
      let s = i / 24;
      vertex(bezierPoint(0, L * 0.25, L * 0.7, L, s) * 0.96, this.midribY(s, W));
    }
    endShape();

    // Side veins. Noise sets how far each one reaches.
    strokeWeight(max(1, L * 0.007));
    let veins = 9;
    for (let i = 1; i <= veins; i++) {
      let s0 = (0.9 * i) / (veins + 1);
      let k1 = map(noise(seed + 400 + i * 0.6), 0, 1, 0.7, 0.92);
      let k2 = map(noise(seed + 450 + i * 0.6), 0, 1, 0.7, 0.92);
      this.drawVein(s0, -1, k1, L, W, seed + 500 + i * 3);
      this.drawVein(s0, 1, k2, L, W, seed + 600 + i * 3);
    }

    pop();
  }
}
