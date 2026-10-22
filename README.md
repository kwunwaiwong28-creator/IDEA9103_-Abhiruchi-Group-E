# IDEA9103 Creative Coding — Major Project

An interactive p5.js reinterpretation of Yayoi Kusama's sunflower painting, built by a team of [3–4] people. Each team member is creative director for one mechanic, and each mechanic lives in its own script file.

## How to run

Open `index.html` in a browser (an internet connection is needed, because p5.js loads from a CDN). With VS Code, the Live Server extension works too.

## Interaction instructions

- **Watch:** two flowers draw themselves dot by dot. Once each one is complete, it wilts over 15 seconds: its colours fade to dry browns and its dots fall away until only the stem and leaves are left. Meanwhile dots drift inside the other two flowers, leaves sway in the wind and the background lines wander.
- **Refresh the page:** every refresh generates a new composition (new colours, petal counts and dot layouts) and starts the cycle again.
- [Teammates: add how to interact with your mechanic, e.g. "move the mouse", "click to start audio".]

## Inspiration

[Group: describe the source artwork (title, year, Yayoi Kusama) and how it shaped the approach. Credit the artwork with a link.]

## Mechanic ownership

| Mechanic | Team member | Script |
| --- | --- | --- |
| Perlin noise and randomness | Jackie | `perlin-layer.js` |
| Time-based | [name] | `time-mechanic.js` |
| Audio | [name] | `[audio-mechanic.js]` |
| User input | [name] | `[input-controls.js]` |

`plants.js` holds the static stems. `sketch.js` brings all the scripts together.

### Perlin noise and randomness (`perlin-layer.js`)

Randomness decides everything that stays fixed for one viewing; Perlin noise drives everything that moves.

- **A · FlowerDotAnimator:** a flower that draws itself. Its DotPen objects travel around the petal and core contours leaving dots, and noise wobbles each pen's path so it looks hand-painted. After four laps every pen stops and the flower is complete, which fires an `onCreated` event. Extends the Week 8 DotAnimator.
- **B · NoisyFlower:** a solid flower filled with NoisyDot objects. Each dot gets a random home, and noise makes it drift around that home (the Week 8 randomNoisyShape pattern). `keepInside()` keeps it inside its petal or the core.
- **C · WindLeaf:** leaves swaying in a shared noise "wind", plus each leaf's own flutter.
- **D · PerlinBackground:** wavy background lines shaped by 2D Perlin noise, reinterpreting Kusama's painted net.

### Time-based (`time-mechanic.js`)

Timers and events drive the wilting of flower A.

- When a flower A is complete, its `onCreated` event creates a **FlowerWilt**, which starts a **Timer** (`millis()`-based).
- Every dot gets a scheduled **drop event** between 0 and about 12.4 seconds: petal tips go first and the core last, in patches set by noise. When its event fires, the dot falls with gravity, drifts in the same wind as the leaves and fades out.
- Until it drops, each dot's colour fades toward a dry brown and the petals sag slightly, so the flower looks like it is wilting.
- A final **gone event** fires at 15 seconds. By then every dot has fallen and only the stem and leaves remain.

## Techniques

- **Perlin noise (`noise()`)** for smooth, continuous movement; **`random()`** for one-off decisions.
- **Timers and scheduled events:** a `Timer` class with `at(seconds, action)` fires actions in order as time passes.
- **Callbacks:** `onCreated` lets one mechanic start another without the files depending on each other.
- **Classes and composition:** flowers contain many pen or dot objects and update them every frame.
- **Off-screen buffer (`createGraphics()`)** so flower A keeps its dot trail while the background redraws.
- **Normalised coordinates and `windowResized()`** so the piece rescales to any window (Week 8).
- [Teammates: add the techniques your mechanic uses.]

## AI acknowledgement

- **Jackie (`perlin-layer.js`, `time-mechanic.js`, `plants.js`, `sketch.js`):** parts of this code were generated with the help of Claude (Anthropic) and then edited. Claude helped structure the classes, write the petal-shape, noise and timer logic, and debug the layout.
- [Teammates: add your own acknowledgement, or "None".]

## External references

- IDEA9103 Week 8 tutorial: the DotAnimator and randomNoisyShape patterns that A and B extend.
- p5.js reference: https://p5js.org/reference/
- [Add any other code sources with a link and a one-line explanation, and comment them in the code too.]
