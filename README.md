# IDEA9103 Creative Coding — Major Project

An interactive p5.js reinterpretation of Yayoi Kusama's sunflower painting, built by a team of [3–4] people. Each team member is creative director for one mechanic, and each mechanic lives in its own script file.

## How to run

Open `index.html` in a browser (an internet connection is needed, because p5.js loads from a CDN). With VS Code, the Live Server extension works too.

## Interaction instructions

- **Watch:** the flowers draw themselves in, dots drift, leaves sway and the background lines wander.
- **Refresh the page:** every refresh generates a new composition (new colours, petal counts and dot layouts).
- [Teammates: add how to interact with your mechanic, e.g. "move the mouse", "click to start audio".]

## Inspiration

[Group: describe the source artwork (title, year, Yayoi Kusama) and how it shaped the approach. Credit the artwork with a link.]

## Mechanic ownership

| Mechanic | Team member | Script |
| --- | --- | --- |
| Perlin noise and randomness | Jackie | `perlin-layer.js` |
| Audio | [name] | `[audio-mechanic.js]` |
| Time-based | [name] | `[time-mechanic.js]` |
| User input | [name] | `[input-controls.js]` |

`plants.js` holds the static stems. `sketch.js` brings all the scripts together.

### Perlin noise and randomness (Jackie)

Randomness decides everything that stays fixed for one viewing; Perlin noise drives everything that moves.

- **A · FlowerDotAnimator:** a flower that draws itself. It contains 12 DotPen objects; each pen circles the flower leaving dots, and noise wobbles its path so the flower looks hand-painted. Extends the Week 8 DotAnimator.
- **B · NoisyFlower:** a flower filled with about 290 NoisyDot objects. Each dot gets a random home spot, and noise makes it drift around it (the Week 8 randomNoisyShape pattern). `keepInside()` stops dots leaving their petal.
- **C · WindLeaf:** leaves swaying in a shared noise "wind", plus each leaf's own flutter.
- **D · PerlinBackground:** wavy background lines shaped by 2D Perlin noise, reinterpreting Kusama's painted net.

Colours are picked at random from a palette sampled from the painting, so every refresh is different but still reads as Kusama.

## Techniques

- **Perlin noise (`noise()`)** for smooth, continuous movement; **`random()`** for one-off decisions.
- **Classes and composition:** flowers contain many pen or dot objects and update them every frame.
- **Polar coordinates** to trace petal shapes around a centre.
- **Off-screen buffer (`createGraphics()`)** so flower A keeps its dot trail while the background redraws.
- **Normalised coordinates and `windowResized()`** so the piece rescales to any window (Week 8).
- [Teammates: add the techniques your mechanic uses.]

## AI acknowledgement

- **Jackie (`perlin-layer.js`, `plants.js`, `sketch.js`):** parts of this code were generated with the help of Claude (Anthropic) and then edited. Claude helped structure the classes, write the petal-shape and noise logic, and debug the layout. This is also noted in comments at the top of each file.
- [Teammates: add your own acknowledgement, or "None".]

## External references

- IDEA9103 Week 8 tutorial: the DotAnimator and randomNoisyShape patterns that A and B extend.
- p5.js reference: https://p5js.org/reference/
- [Add any other code sources with a link and a one-line explanation, and comment them in the code too.]
