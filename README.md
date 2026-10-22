# IDEA9103 Creative Coding — Major Project

An interactive p5.js reinterpretation of Yayoi Kusama's sunflower painting, built by a team of [3–4] people. Each team member is creative director for one mechanic, and each mechanic lives in its own script file.

## How to run

Open `index.html` in a browser (an internet connection is needed, because p5.js loads from a CDN). With VS Code, the Live Server extension works too.

## Interaction instructions

- **Watch:** the four flowers bloom one after another, each keeping a different kind of time (see *Time-based* below). Once each self-drawing flower is complete, it wilts over 15 seconds: its colours fade to dry browns and its dots fall away until only the stem and leaves are left. Meanwhile dots drift inside the other two flowers, leaves sway in the wind and the background lines wander.
- **Refresh the page:** every refresh generates a new composition (new colours, petal counts and dot layouts) and starts the cycle again.
- [Teammates: add how to interact with your mechanic, e.g. "move the mouse", "click to start audio".]

## Inspiration

[Group: describe the source artwork (title, year, Yayoi Kusama) and how it shaped the approach. Credit the artwork with a link.]

## Mechanic ownership

| Mechanic | Team member | Script |
| --- | --- | --- |
| Perlin noise and randomness | Jackie | `perlin-layer.js` & `plants.js`|
| Time-based | Yeheng Li | `time-mechanic.js` |
| Audio | [name] | `[audio-mechanic.js]` |
| User input | [name] | `[input-controls.js]` |

`plants.js` holds the static stems. `sketch.js` brings all the scripts together.

### Perlin noise and randomness (`perlin-layer.js` & `plants.js`)

Randomness decides everything that stays fixed for one viewing; Perlin noise drives everything that moves.

- **A · FlowerDotAnimator:** a flower that draws itself. Its DotPen objects travel around the petal and core contours leaving dots, and noise wobbles each pen's path so it looks hand-painted. After four laps every pen stops and the flower is complete, which fires an `onCreated` event. Extends the Week 8 DotAnimator.
- **B · NoisyFlower:** a solid flower filled with NoisyDot objects. Each dot gets a random home, and noise makes it drift around that home (the Week 8 randomNoisyShape pattern). `keepInside()` keeps it inside its petal or the core.
- **C · WindLeaf:** leaves swaying in a shared noise "wind", plus each leaf's own flutter.
- **D · PerlinBackground:** wavy background lines shaped by 2D Perlin noise, reinterpreting Kusama's painted net.

### Time-based (`time-mechanic.js`) — Yeheng Li

**Four flowers, four clocks.** Timers and scheduled events decide when and how each flower blooms. Each flower keeps a different kind of time, so each one opens in its own way. The flower shapes, colours, dots and noise movement all come from `perlin-layer.js`; the time mechanic decides *when* dots appear and *how far* each petal or centre is open.

| Flower | Clock | How it blooms | Timing |
| --- | --- | --- | --- |
| Top-left (self-drawing) | **Sundial** | All dot pens line up like one clock hand and sweep clockwise from twelve o'clock, leaving dots behind them. | 0–8 s, steady |
| Top-right (spiky) | **Hourglass** | Centre dots pile up like falling sand, faster and faster; then the spikes push out and turn from white to their own colour. | 2.5–12.5 s, speeds up |
| Middle (round) | **Ticking** | A green bud opens one petal per beat, from the top, then left and right in turn; the petals change from green to their own colour. | 5–16 s, one petal per beat |
| Bottom-right (self-drawing) | **Heartbeat** | Dots are added in bursts that come faster and faster, and the flower swells slightly on every beat. | 9.5–17.5 s, beats speed up |

- **Timer and events:** a `Timer` class (`millis()`-based) with `at(seconds, action)` fires actions in time order. One shared garden clock gives each flower its own start time and bloom length (`CLOCKS`).
- **Wilting:** when a self-drawing flower is complete, its `onCreated` event creates a `FlowerWilt`. Every dot gets a scheduled drop event (petal tips first, the centre last, in noisy patches); it then falls with gravity, drifts in the same wind as the leaves and fades out.
- **Working with the other files:** `sketch.js` calls `FlowerDotAnimator.update()` and `NoisyFlower.draw()` every frame. So that the other team files stay unchanged, `time-mechanic.js` (loaded after `perlin-layer.js`) replaces these two methods with timed versions that still use the team's own pens, dots, noise and drawing code.

## Techniques

- **Perlin noise (`noise()`)** for smooth, continuous movement; **`random()`** for one-off decisions.
- **Timers and scheduled events:** a `Timer` class with `at(seconds, action)` fires actions in order as time passes; one shared garden clock gives each flower its own bloom clock (sundial, hourglass, ticking, heartbeat).
- **Easing:** a smooth-step function (`smooth01`) makes every opening and colour change gradual.
- **Callbacks:** `onCreated` lets one mechanic start another without the files depending on each other.
- **Classes and composition:** flowers contain many pen or dot objects and update them every frame.
- **Off-screen buffer (`createGraphics()`)** so flower A keeps its dot trail while the background redraws.
- **Normalised coordinates and `windowResized()`** so the piece rescales to any window (Week 8).
- [Teammates: add the techniques your mechanic uses.]

## AI acknowledgement

- **Jackie (`perlin-layer.js`,`plants.js`, `sketch.js`):** parts of this code were generated with the help of Claude and then edited. Claude helped structure the classes, write the petal-shape, noise and debug the layout.
- **Yeheng Li (`time-mechanic.js`):** I used Claude (Anthropic) only as a support tool while developing this mechanic. The creative direction and design decisions were mine: following my tutor's feedback, I chose the idea of four flowers keeping four different kinds of time, decided how each flower should bloom and wilt, and directed every change. Claude helped me explore options for the four bloom clocks (sundial, hourglass, ticking, heartbeat) and suggested code for them. After that, I personally re-checked, edited and tested all of the code line by line, adjusted it to fit our team's files, and only then committed it. I understand how every part of the code works and can explain it. The `Timer`, `WiltingDot` and `FlowerWilt` classes are my own earlier work. This is also noted in comments at the top of `time-mechanic.js`.
- [Teammates: add your own acknowledgement, or "None".]

## External references

- IDEA9103 Week 8 tutorial: the DotAnimator and randomNoisyShape patterns that A and B extend.
- p5.js reference: https://p5js.org/reference/
- [Add any other code sources with a link and a one-line explanation, and comment them in the code too.]
