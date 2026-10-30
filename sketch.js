let t = 0;
let timeStep = 0.01;

let perlinBackground;
let animatedFlowers = [];
let wilts = [];
let noisyFlowers = [];
let stems = [];
let leaves = [];

function canvasSize() {
  let h = min(windowHeight, windowWidth * 4 / 3);
  return [h * 0.75, h];
}

function setup() {
  let size = canvasSize();
  createCanvas(size[0], size[1]);

  noiseDetail(3, 0.5);

  perlinBackground = new PerlinBackground(18, 14);

  stems.push(new Stem(0.22, 0.17, 0.19, 1.02, 0.03));
  stems.push(new Stem(0.67, 0.18, 0.69, 1.02, 0.034));
  stems.push(new Stem(0.36, 0.47, 0.33, 1.02, 0.036, "blue"));
  stems.push(new Stem(0.84, 0.78, 0.85, 1.02, 0.03));

  leaves.push(new WindLeaf(stems[1].pointAt(0.40), 0.36, 1, 0.15));
  leaves.push(new WindLeaf(stems[1].pointAt(0.64), 0.30, -1, -0.05));
  leaves.push(new WindLeaf(stems[0].pointAt(0.36), 0.26, -1, 0.2));
  leaves.push(new WindLeaf(stems[2].pointAt(0.72), 0.32, -1, 0.3));

  let coloursA = pickFlowerColours();
  let coloursB = pickFlowerColours(random(FLOWER_SCHEMES.filter((s) => s !== coloursA.scheme)));

  animatedFlowers.push(new FlowerDotAnimator(0.22, 0.17, 0.19, coloursA));
  animatedFlowers.push(new FlowerDotAnimator(0.84, 0.78, 0.15, coloursA));
  animatedFlowers.push(new FlowerDotAnimator(0.67, 0.18, 0.25, coloursB));
  animatedFlowers.push(new FlowerDotAnimator(0.37, 0.47, 0.27, coloursB));
  for (const f of animatedFlowers) {
    f.resetLayer();
    f.onCreated = (flower) => wilts.push(new FlowerWilt(flower));
  }

function draw() {
  perlinBackground.draw(t);

  for (const stem of stems) {
    stem.draw();
  }

  let wind = windStrength(t);
  for (const leaf of leaves) {
    leaf.draw(t, wind);
  }

  for (const f of animatedFlowers) {
    f.update(t);
  }

  for (const w of wilts) {
    w.update(wind);
  }

  for (const flower of noisyFlowers) {
    flower.draw();
  }

  t += timeStep;
}

function windowResized() {
  let size = canvasSize();
  resizeCanvas(size[0], size[1]);

  for (const f of animatedFlowers) {
    f.resetLayer();
  }
}
