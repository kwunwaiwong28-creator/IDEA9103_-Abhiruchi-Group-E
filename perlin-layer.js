/* ============================================================
   perlin-layer.js
   MECHANIC: Perlin noise AND randomness
   Creative director: Jackie

   Four parts, labelled to match the concept sketch:

     A  FlowerDotAnimator — a flower that DRAWS ITSELF. Extends the
        Week 8 DotAnimator: several "pens" travel around the flower's
        contours leaving dots behind, with Perlin noise distorting
        their path. The trail is kept on its own off-screen layer.

     B  NoisyFlower — a solid flower shape filled with dots. Each dot
        follows the Week 8 randomNoisyShape pattern: randomness picks
        where it lives, Perlin noise makes it wander around that home,
        and it is kept inside its part of the flower.

     C  WindLeaf — a leaf pinned to a stem that swings up and down.
        One shared noise value acts as the wind for every leaf; each
        leaf also has its own flutter noise so they don't move as one.

     D  PerlinBackground — a midnight field crossed by wandering lines
        in both directions. Every line's shape comes from noise and
        slowly drifts over time.

   Randomness decides everything that is fixed for a page load
   (colours, petal counts, dot homes, pen speeds and directions, line
   positions). Nothing is seeded, so each refresh is a new variation.

   Parts of this code were generated with the help of Claude
   (Anthropic) and then edited. The DotAnimator and randomNoisyShape
   patterns come from the IDEA9103 Week 8 tutorial.
   ============================================================ */


/* ------------------------------------------------------------
   PALETTE
   Drawn from the source painting. Randomness picks FROM this list
   rather than generating arbitrary RGB values, so every variation
   still feels like the same artwork.
   ------------------------------------------------------------ */
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

/*
Colour schemes a flower can use. A flower picks one at random, then
each dot or pen picks at random within it, so a bloom stays harmonious
while the details change on every refresh.
*/
const FLOWER_SCHEMES = [
  { petalBase: "deepRed", petalDots: ["white"],              coreBase: "violet",  coreDots: ["skyBlue", "cobalt", "white"] },
  { petalBase: "amber",   petalDots: ["crimson", "deepRed"], coreBase: "violet",  coreDots: ["skyBlue", "cobalt"] },
  { petalBase: "white",   petalDots: ["crimson", "deepRed"], coreBase: "deepRed", coreDots: ["gold", "silver"] },
  { petalBase: "crimson", petalDots: ["white", "amber"],     coreBase: "cobalt",  coreDots: ["skyBlue", "white", "violet"] }
];

//Background colours
const MIDNIGHT = [6, 8, 18];
const NET_BLUES = [[30, 110, 190], [45, 130, 210], [22, 86, 160]];

//Leaf colour sets. The source has green leaves and one blue one.
const LEAF_SETS = [
  { dark: [38, 118, 58],  light: [96, 176, 88],   vein: [170, 220, 140] },
  { dark: [30, 100, 50],  light: [80, 160, 78],   vein: [150, 210, 130] },
  { dark: [40, 110, 170], light: [126, 175, 219], vein: [200, 225, 245] }
];

function paletteColour(name) {
  let c = PALETTE[name];
  return color(c[0], c[1], c[2]);
}


/* ------------------------------------------------------------
   PETAL OUTLINE
   Returns the edge of a flower at a given angle, as a fraction of
   its radius (1 = petal tip, `inner` = the dip between petals).

   "spiky"  — a triangle wave, giving straight-edged pointed petals
   "round"  — a sine lobe, giving soft rounded petals
   ------------------------------------------------------------ */
function petalOutline(angle, style, count, rotation, inner) {
  //How far through the current petal we are, from 0 to 1
  let f = (((angle - rotation) * count) / TWO_PI) % 1;
  if (f < 0) f += 1;

  let shape;
  if (style === "spiky") {
    //Rises in a straight line to the tip and back down; the power
    //curves the edges slightly inward, like the painted petals
    shape = pow(1 - abs(f * 2 - 1), 1.4);
  } else {
    //A smooth hump; the power below 1 makes the petals fuller
    shape = pow(sin(f * PI), 0.6);
  }

  return inner + (1 - inner) * shape;
}


/* ============================================================
   D — PERLIN BACKGROUND
   ============================================================ */
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
      //RANDOM — evenly spread, then nudged so the spacing is irregular.
      //Stored as a 0–1 fraction so the sketch scales with the window.
      position: (index + 0.5 + random(-0.3, 0.3)) / total,
      //RANDOM — this line's own place in the noise field
      seed: random(1000),
      //RANDOM — how far this line wanders from straight
      amplitude: random(0.02, 0.05),
      colour: random(NET_BLUES),
      weight: random(1.2, 2.4)
    };
  }

  draw(t) {
    background(MIDNIGHT[0], MIDNIGHT[1], MIDNIGHT[2]);
    noFill();

    //Line weights were designed at 900px wide; scale with the canvas
    let scaleFactor = width / 900;

    for (const line of this.lines) {
      stroke(line.colour[0], line.colour[1], line.colour[2], 210);
      strokeWeight(line.weight * scaleFactor);

      beginShape();
      if (line.horizontal) {
        for (let x = -20; x <= width + 20; x += 10) {
          /*
          NOISE — 2D noise: the first input moves along the line, which
          gives it its wavy shape; the second is time, which makes that
          shape slowly change. Dividing x by width keeps the waves the
          same at any canvas size.
          */
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


/* ============================================================
   A — FLOWER DOT ANIMATOR
   Extends the Week 8 DotAnimator. Instead of one dot tracing an
   ellipse, several DotPens each trace one contour of the flower.

   WHY AN OFF-SCREEN LAYER:
   The tutorial DotAnimator builds its picture by never fully
   clearing the background. Here the background (D) is redrawn every
   frame, which would wipe the trail. So the pens draw onto their own
   createGraphics() layer, which keeps its contents, and that layer is
   placed over the background each frame. It fades very slowly so
   the drawing stays alive rather than filling up solid.
   ============================================================ */
class DotPen {
  /*
  radiusFn  — for a given angle, how far out this pen's contour is
              (as a fraction of the flower's radius)
  dotSize   — dot diameter, as a fraction of the radius
  spacing   — distance between dots, as a fraction of the radius
  */
  constructor(radiusFn, colourName, dotSize, spacing) {
    this.radiusFn = radiusFn;
    this.colour = paletteColour(colourName);
    this.dotSize = dotSize;
    this.spacing = spacing;

    //RANDOM — where the pen starts, and which way it travels
    this.angle = random(TWO_PI);
    this.direction = random([-1, 1]);

    //RANDOM — this pen's own places in the noise field
    this.distortSeed = random(1000);
    this.sizeSeed = random(1000);

    //How many dots each pen lays down per frame. Higher = draws faster.
    this.stepsPerFrame = 2;
  }

  update(layer, cx, cy, R, t) {
    layer.noStroke();
    layer.fill(this.colour);

    for (let i = 0; i < this.stepsPerFrame; i++) {
      let base = this.radiusFn(this.angle);

      /*
      NOISE — the same idea as drawDistortion in the tutorial: a noise
      value nudges the pen off its perfect path. Reading noise by angle
      AND time means the wobble differs around the flower and changes
      on every lap, so the drawing slowly thickens like hand painting.
      */
      let distort = map(noise(this.distortSeed + this.angle * 0.6, t * 0.5), 0, 1, -0.05, 0.05);
      let r = (base + distort) * R;

      //NOISE — dot size swells and shrinks along the path
      let s = this.dotSize * R * map(noise(this.sizeSeed + this.angle * 1.5, t * 0.3), 0, 1, 0.6, 1.3);

      layer.circle(cx + cos(this.angle) * r, cy + sin(this.angle) * r, s);

      //Step so the gap between dots is the same on every contour.
      //Arc length = radius × angle, so angle step = spacing / radius.
      this.angle += this.direction * (this.spacing / max(base, 0.05));
    }
  }
}

class FlowerDotAnimator {
  //nx, ny — centre as a fraction of canvas width/height
  //nr     — radius as a fraction of canvas width
  constructor(nx, ny, nr) {
    this.nx = nx;
    this.ny = ny;
    this.nr = nr;

    //RANDOM — structure of this bloom
    this.petalCount = floor(random(13, 18));
    this.rotation = random(TWO_PI);
    this.inner = random(0.58, 0.66);
    this.coreRatio = 0.5;

    //RANDOM — colour scheme
    let scheme = random(FLOWER_SCHEMES);
    let petalColours = [scheme.petalBase].concat(scheme.petalDots);
    let coreColours = [scheme.coreBase].concat(scheme.coreDots);

    this.pens = [];

    /*
    Petal pens. Each traces a contour partway between the core edge
    and the petal outline, so the dots follow the shape of the petals
    the way they do in the painting.
    */
    for (const k of [1.0, 0.82, 0.64, 0.46, 0.28]) {
      let fn = (a) => lerp(this.coreRatio * 1.05, this.outline(a), k);
      this.pens.push(new DotPen(fn, random(petalColours), 0.05, 0.07));
    }

    //Core pens — plain circles: an outer ring, then the centre
    for (const rr of [0.46, 0.4, 0.33, 0.26, 0.19, 0.12, 0.06]) {
      this.pens.push(new DotPen(() => rr, random(coreColours), 0.055, 0.07));
    }

    this.layer = null;
  }

  outline(angle) {
    return petalOutline(angle, "spiky", this.petalCount, this.rotation, this.inner);
  }

  //Called in setup() and whenever the window is resized
  resetLayer() {
    if (this.layer) this.layer.remove();
    this.layer = createGraphics(width, height);
    this.layer.clear();
  }

  update(t) {
    let cx = this.nx * width;
    let cy = this.ny * height;
    let R = this.nr * width;

    //Very slow fade, so old dots gradually give way to new ones
    if (frameCount % 5 === 0) {
      this.layer.erase(6);
      this.layer.noStroke();
      this.layer.rect(0, 0, this.layer.width, this.layer.height);
      this.layer.noErase();
    }

    for (const pen of this.pens) {
      pen.update(this.layer, cx, cy, R, t);
    }

    image(this.layer, 0, 0);
  }
}


/* ============================================================
   B — NOISY FLOWER
   A solid flower shape whose dots each behave like a Week 8
   randomNoisyShape: a random home, a random noiseLocation and
   noiseScale, and two noise reads (x, and x + 10 for y) moving it.
   ============================================================ */
class NoisyDot {
  //hx, hy — home position in units of the flower's radius
  constructor(hx, hy, region, colourName, size) {
    this.hx = hx;
    this.hy = hy;
    this.x = hx;
    this.y = hy;
    this.region = region;
    this.colour = paletteColour(colourName);
    this.size = size;

    //RANDOM — as in randomNoisyShape: where along the noise function
    //this dot starts, and how far it is allowed to move
    this.noiseLocation = random(1000);
    this.noiseScale = random(0.1, 0.3);

    //RANDOM — each dot moves through the noise at its own pace
    this.speed = random(0.004, 0.012);
  }

  update(flower) {
    /*
    NOISE — two values, one for x and one for y. As in the tutorial,
    the y value is read from slightly further along the noise function
    (+ 10) so the two axes move independently.
    */
    let ox = map(noise(this.noiseLocation), 0, 1, -1, 1) * this.noiseScale;
    let oy = map(noise(this.noiseLocation + 10), 0, 1, -1, 1) * this.noiseScale;

    //Keep the dot inside its own part of the flower
    let p = flower.keepInside(this.hx + ox, this.hy + oy, this.region);
    this.x = p[0];
    this.y = p[1];

    //Move along the noise function for next frame
    this.noiseLocation += this.speed;
  }
}

class NoisyFlower {
  //style is "round" or "spiky"
  constructor(nx, ny, nr, style) {
    this.nx = nx;
    this.ny = ny;
    this.nr = nr;
    this.style = style;

    //RANDOM — structure
    this.petalCount = style === "round" ? floor(random(10, 14)) : floor(random(14, 19));
    this.rotation = random(TWO_PI);
    this.inner = style === "round" ? random(0.55, 0.62) : random(0.62, 0.7);

    //The core is sized from the petal dips, so the dips always sit
    //outside the core and there is always room for petal dots
    this.coreRatio = this.inner * random(0.72, 0.8);

    //RANDOM — colours
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

  /*
  RANDOM — scatter dot homes through a region by picking random points
  in a square and keeping only the ones that land inside.
  */
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

  //Pull a point back inside its region if noise has pushed it out
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

    //Petal shape
    fill(this.petalBase);
    beginShape();
    for (let i = 0; i < 180; i++) {
      let a = (TWO_PI / 180) * i;
      let r = this.outline(a) * R;
      vertex(cos(a) * r, sin(a) * r);
    }
    endShape(CLOSE);

    //Core disc
    fill(this.coreBase);
    circle(0, 0, this.coreRatio * 2 * R);

    //Dots
    for (const dot of this.dots) {
      dot.update(this);
      fill(dot.colour);
      circle(dot.x * R, dot.y * R, dot.size * R);
    }

    pop();
  }
}


/* ============================================================
   C — WIND LEAF
   ============================================================ */

//NOISE — one shared wind value, read from its own part of the noise
//field, so every leaf feels the same gust at the same moment
function windStrength(t) {
  return map(noise(5000 + t * 0.25), 0, 1, -1, 1);
}

class WindLeaf {
  /*
  pivot      — {x, y} as fractions of the canvas, where the leaf joins its stem
  lengthN    — leaf length as a fraction of canvas width
  direction  — 1 points right, -1 points left
  tilt       — resting angle: positive reaches up, negative droops
  */
  constructor(pivot, lengthN, direction, tilt = 0.3) {
    this.px = pivot.x;
    this.py = pivot.y;
    this.lengthN = lengthN;
    this.direction = direction;

    //Resting angle in radians. Positive reaches up, negative droops,
    //matching the heavy leaves that hang off the stems in the painting.
    this.tilt = tilt;

    //RANDOM — proportions and colour. Broad, like the painted leaves.
    this.widthRatio = random(0.46, 0.6);
    this.colours = random(LEAF_SETS);

    //RANDOM — this leaf's own flutter, on top of the shared wind
    this.flutterSeed = random(1000);
    this.flutterAmount = random(0.08, 0.16);
  }

  draw(t, wind) {
    let L = this.lengthN * width;
    let W = L * this.widthRatio;

    //NOISE — a quicker, smaller flutter unique to this leaf
    let flutter = map(noise(this.flutterSeed + t * 1.2), 0, 1, -1, 1) * this.flutterAmount;

    //How far the leaf swings from its resting angle, in radians
    //Longer leaves swing through a smaller angle, so their tips travel
    //a believable distance rather than whipping around
    let swing = (wind * 0.28 + flutter) * map(this.lengthN, 0.1, 0.4, 1, 0.55, true);

    push();
    translate(this.px * width, this.py * height);

    /*
    Rotating around the point where the leaf meets the stem makes the
    tip rise and fall. The left and right leaves rotate in opposite
    directions so both tips move up and down together.
    */
    if (this.direction === 1) {
      rotate(-this.tilt + swing);
    } else {
      rotate(PI + this.tilt - swing);
      //Mirror so the darker half stays on top
      scale(1, -1);
    }

    noStroke();

    //Lower half, lighter
    fill(this.colours.light[0], this.colours.light[1], this.colours.light[2]);
    beginShape();
    vertex(0, 0);
    bezierVertex(L * 0.25, W, L * 0.7, W * 0.85, L, 0);
    endShape(CLOSE);

    //Upper half, darker
    fill(this.colours.dark[0], this.colours.dark[1], this.colours.dark[2]);
    beginShape();
    vertex(0, 0);
    bezierVertex(L * 0.25, -W, L * 0.7, -W * 0.85, L, 0);
    endShape(CLOSE);

    //Midrib and veins
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
