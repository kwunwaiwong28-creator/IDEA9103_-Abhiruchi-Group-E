/* ============================================================
   sketch.js
   Main file. Sets up the scene and brings the scripts together.

     plants.js        — static stems (base structure)
     perlin-layer.js  — Perlin noise and randomness mechanic (Jackie)
                        A flower animator, B noisy flowers,
                        C wind leaves, D perlin background

   All positions and sizes are fractions of the canvas (the Week 8
   normalised-coordinate approach), so the piece rescales cleanly
   when the window changes size.

   Parts of this code were generated with the help of Claude
   (Anthropic) and then edited. See README for details.
   ============================================================ */

//Global time for all noise reads
let t = 0;
let timeStep = 0.01;

let perlinBackground;
let animatedFlowers = [];
let noisyFlowers = [];
let stems = [];
let leaves = [];

//Keep the portrait 3:4 shape of the sketch, as large as the window allows
function canvasSize() {
  let h = min(windowHeight, windowWidth * 4 / 3);
  return [h * 0.75, h];
}

function setup() {
  let size = canvasSize();
  createCanvas(size[0], size[1]);

  /*
  No seed, so every refresh is a new variation. To lock one you like,
  uncomment these two lines.
  */
  //randomSeed(7);
  //noiseSeed(7);

  noiseDetail(3, 0.5);

  //D — background lines: 18 horizontal, 14 vertical
  perlinBackground = new PerlinBackground(18, 14);

  /*
  Layout follows the painting: four flowers, two of each kind.
    top-left      A  (draws itself)
    top-right     B  (spiky, dotted)
    middle-left   B  (round, dotted) — the largest, in front
    bottom-right  A  (draws itself)
  All numbers are fractions of the canvas.
  */

  //Stems (static). Arguments: topX, topY, bottomX, bottomY, thickness, colour
  stems.push(new Stem(0.22, 0.17, 0.19, 1.02, 0.03));           //0 top-left A
  stems.push(new Stem(0.67, 0.18, 0.69, 1.02, 0.034));          //1 top-right B
  stems.push(new Stem(0.36, 0.47, 0.33, 1.02, 0.036, "blue"));  //2 middle-left B
  stems.push(new Stem(0.84, 0.78, 0.85, 1.02, 0.03));           //3 bottom-right A

  /*
  C — large leaves, as in the painting.
  Arguments: pivot on a stem, length, direction (1 right / -1 left), tilt
  */
  leaves.push(new WindLeaf(stems[1].pointAt(0.40), 0.36, 1, 0.15));    //big right leaf
  leaves.push(new WindLeaf(stems[1].pointAt(0.64), 0.30, -1, -0.05));  //lower middle, drooping left
  leaves.push(new WindLeaf(stems[0].pointAt(0.36), 0.26, -1, 0.2));    //left edge
  leaves.push(new WindLeaf(stems[2].pointAt(0.72), 0.32, -1, 0.3));    //bottom left

  //A — the two self-drawing flowers. Arguments: x, y, radius
  animatedFlowers.push(new FlowerDotAnimator(0.22, 0.17, 0.19));
  animatedFlowers.push(new FlowerDotAnimator(0.84, 0.78, 0.15));
  for (const f of animatedFlowers) {
    f.resetLayer();
  }

  //B — the two dotted flowers. Drawn after A, so they sit in front.
  //Arguments: x, y, radius, petal style
  noisyFlowers.push(new NoisyFlower(0.67, 0.18, 0.25, "spiky"));
  noisyFlowers.push(new NoisyFlower(0.37, 0.47, 0.27, "round"));
}

function draw() {
  //D
  perlinBackground.draw(t);

  for (const stem of stems) {
    stem.draw();
  }

  //C
  let wind = windStrength(t);
  for (const leaf of leaves) {
    leaf.draw(t, wind);
  }

  //A
  for (const f of animatedFlowers) {
    f.update(t);
  }

  //B
  for (const flower of noisyFlowers) {
    flower.draw();
  }

  t += timeStep;
}

function windowResized() {
  let size = canvasSize();
  resizeCanvas(size[0], size[1]);

  //Each animator's layer is canvas-sized, so it has to be rebuilt.
  //This clears the A flowers, which then redraw themselves.
  for (const f of animatedFlowers) {
    f.resetLayer();
  }
}
