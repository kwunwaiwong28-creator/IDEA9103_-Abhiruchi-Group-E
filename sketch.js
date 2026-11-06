// Time for noise(). It goes up a little every frame, so the noise changes smoothly.
let t = 0;
let timeStep = 0.01;

// Lists that hold every part of the artwork.
let perlinBackground;
let animatedFlowers = [];
let wilts = [];
let stems = [];
let leaves = [];

// Keeps the canvas in a 3:4 portrait shape, as big as the window allows.
function canvasSize() {
  let h = min(windowHeight, windowWidth * 4 / 3);
  return [h * 0.75, h];
}

// Runs once at the start: builds the background, stems, leaves and flowers.
function setup() {
  let size = canvasSize();
  createCanvas(size[0], size[1]);

  // Softer noise, which looks more natural.
  noiseDetail(3, 0.5);

  // Dragon-scale background.
  perlinBackground = new PerlinBackground();

  // Randomly picks which flower pair gets green and which gets blue.
  let plantColours = shuffle(["green", "blue"]);
  let colourA = plantColours[0];
  let colourB = plantColours[1];
  // Leaf colours that match each stem colour.
  let leafSets = { green: LEAF_SETS[0], blue: LEAF_SETS[2] };

  // Stems: top x, top y, bottom x, bottom y, thickness, colour.
  // Positions are fractions of the canvas, so it fits any window size.
  stems.push(new Stem(0.22, 0.17, 0.19, 1.02, 0.03, colourA));
  stems.push(new Stem(0.67, 0.18, 0.69, 1.02, 0.034, colourB));
  stems.push(new Stem(0.36, 0.47, 0.33, 1.02, 0.036, colourB));
  stems.push(new Stem(0.84, 0.78, 0.85, 1.02, 0.03, colourA));

  // Leaves: where they attach on a stem, length, right (1) or left (-1), tilt, colour.
  leaves.push(new WindLeaf(stems[1].pointAt(0.40), 0.36, 1, 0.15, leafSets[colourB]));
  leaves.push(new WindLeaf(stems[1].pointAt(0.64), 0.30, -1, -0.05, leafSets[colourB]));
  leaves.push(new WindLeaf(stems[0].pointAt(0.36), 0.26, -1, 0.2, leafSets[colourA]));
  leaves.push(new WindLeaf(stems[2].pointAt(0.72), 0.32, -1, 0.3, leafSets[colourB]));

  // Two colour sets for the flowers. The second pair always gets a different set.
  let coloursA = pickFlowerColours();
  let coloursB = pickFlowerColours(random(FLOWER_SCHEMES.filter((s) => s !== coloursA.scheme)));

  // Four self-drawing flowers: x, y, size, colours. Each pair shares one colour set.
  animatedFlowers.push(new FlowerDotAnimator(0.22, 0.17, 0.19, coloursA));
  animatedFlowers.push(new FlowerDotAnimator(0.84, 0.78, 0.15, coloursA));
  animatedFlowers.push(new FlowerDotAnimator(0.67, 0.18, 0.25, coloursB));
  animatedFlowers.push(new FlowerDotAnimator(0.37, 0.47, 0.27, coloursB));
  // Give each flower a layer to draw on.
  for (const f of animatedFlowers) {
    f.resetLayer();
    f.onCreated = (flower) => wilts.push(new FlowerWilt(flower));
  }
}

// Runs every frame, drawing from back to front.
function draw() {
  perlinBackground.draw(t);

  for (const stem of stems) {
    stem.draw();
  }

  // One shared wind from noise moves all the leaves.
  let wind = windStrength(t);
  for (const leaf of leaves) {
    leaf.draw(t, wind);
  }

  // The flowers draw themselves a few dots at a time.
  for (const f of animatedFlowers) {
    f.update(t);
  }

  for (const w of wilts) {
    w.update(wind);
  }

  // Move time forward so the noise keeps changing.
  t += timeStep;
}

// When the window changes size, resize the canvas and rebuild the flower layers.
function windowResized() {
  let size = canvasSize();
  resizeCanvas(size[0], size[1]);

  for (const f of animatedFlowers) {
    f.resetLayer();
  }
}
