# IDEA9103 Creative Coding — Major Project

An interactive p5.js reinterpretation of Yayoi Kusama's sunflower painting, built by a team of [3–4] people. Each team member is creative director for one mechanic, and each mechanic lives in its own script file.

## How to run

Open `index.html` in a browser (an internet connection is needed, because p5.js loads from a CDN). With VS Code, the Live Server extension works too.

## Interaction instructions

- **Watch:** the four flowers bloom one after another, each keeping a different kind of time (see *Time-based* below). Each flower then stays in full bloom for 6 seconds and wilts over 15 seconds: its colours fade to dry browns, its dots fall away in the wind, and its stem and leaves dry and bend with it, until only dry stems are left. Meanwhile dots drift inside the flowers, leaves sway in the wind and the background lines wander.
- **Refresh the page:** every refresh generates a new composition (new colours, petal counts and dot layouts) and starts the cycle again.
- [Teammates: add how to interact with your mechanic, e.g. "move the mouse", "click to start audio".]

## Inspiration

[Group: describe the source artwork (title, year, Yayoi Kusama) and how it shaped the approach. Credit the artwork with a link.]

## Mechanic ownership

| Mechanic | Team member | Script |
| --- | --- | --- |
| Perlin noise and randomness | Jackie | `perlin-layer.js` & `plants.js`|
| Time-based | Yeheng Li | `time-mechanic.js` |
| Audio | Rongwei Zhao | `[audio-mechanic.js]` |
| User input | HANGJING YE | `[input-controls.js]` |

`plants.js` holds the static stems. `sketch.js` brings all the scripts together.

### Perlin noise and randomness (`perlin-layer.js` & `plants.js`)

Randomness decides everything that stays fixed for one viewing; Perlin noise drives everything that moves.

- **A · FlowerDotAnimator:** a flower that draws itself. Its DotPen objects travel around the petal and core contours leaving dots, and noise wobbles each pen's path so it looks hand-painted. After four laps every pen stops and the flower is complete, which fires an `onCreated` event. Extends the Week 8 DotAnimator.
- **B · NoisyFlower:** a solid flower filled with NoisyDot objects. Each dot gets a random home, and noise makes it drift around that home (the Week 8 randomNoisyShape pattern). `keepInside()` keeps it inside its petal or the core.
- **C · WindLeaf:** leaves swaying in a shared noise "wind", plus each leaf's own flutter.
- **D · PerlinBackground:** wavy background lines shaped by 2D Perlin noise, reinterpreting Kusama's painted net.

### Time-based (`time-mechanic.js`) — Yeheng Li

**Four flowers, four clocks.** Timers and scheduled events decide when and how each flower blooms, how long it stays open, and when it wilts. Each flower keeps a different kind of time, so each one opens in its own way. The flower shapes, colours, dots and noise movement all come from `perlin-layer.js`; the time mechanic decides *when* dots appear, *how far* each petal or centre is open, and *when* everything dries and falls.

Life of every flower: bud → **bloom** (its own clock) → **full bloom** (6 s) → **wilt** (15 s; dots dry and fall, stem and leaves bend) → dry stem.

| Flower | Clock | How it blooms | Timing |
| --- | --- | --- | --- |
| Top-left (self-drawing) | **Sundial** | All dot pens line up like one clock hand and sweep clockwise from twelve o'clock, leaving dots behind them. | 0–8 s, steady |
| Top-right (spiky) | **Hourglass** | Centre dots pile up like falling sand, faster and faster; then the spikes push out and turn from white to their own colour. | 2.5–12.5 s, speeds up |
| Middle (round) | **Ticking** | A green bud opens one petal per beat, from the top, then left and right in turn; the petals change from green to their own colour. | 5–16 s, one petal per beat |
| Bottom-right (self-drawing) | **Heartbeat** | Dots are added in bursts that come faster and faster, and the flower swells slightly on every beat. | 9.5–17.5 s, beats speed up |

- **Timer and events:** a `Timer` class (`millis()`-based) with `at(seconds, action)` fires actions in time order. One shared garden clock gives each flower its own start time and bloom length (`CLOCKS`).
- **Full bloom:** every flower stays fully open for `MATURE_SECONDS` (6 s) before it starts to wilt. This pause also gives the audio mechanic a calm moment to respond to the music.
- **Wilting (self-drawing flowers):** when a self-drawing flower is complete, its `onCreated` event creates a `FlowerWilt`. After the full-bloom pause, every dot gets a scheduled drop event (petal tips first, the centre last, in noisy patches); it then falls with gravity, drifts in the same wind as the leaves and fades out.
- **Wilting (noisy flowers):** `NoisyFlowerLife` uses the same drop rule for the two noisy flowers. Their colours fade to brown, the dots let go and fall, and the petals then shrivel back into the centre.
- **Stem and leaves:** `StemWilt` dries each flower's stem and leaves together with the flower: the stem bends outwards and sinks, the leaves droop and turn brown. The original stem and leaf values are recorded first (`STEM_HOME`, `LEAF_HOME`), so the team's objects are only changed, never replaced.
- **Working with the other files:** `sketch.js` calls `FlowerDotAnimator.update()` and `NoisyFlower.draw()` every frame. So that the other team files stay unchanged, `time-mechanic.js` (loaded after `perlin-layer.js`) replaces these two methods with timed versions that still use the team's own pens, dots, noise and drawing code.

 ### Audio (`audio-mechanic.js`) — Rongwei zhao

**Music-driven flower movement.** My audio mechanic explores how sound can influence the visual behaviour of flowers. Instead of using music only as background sound, I use audio amplitude to create a direct relationship between sound intensity and flower size.

The mechanic analyses the volume of the playing audio and maps it to a scaling factor. Quieter sounds produce smaller flower heads, while louder sounds cause the flowers to expand. Smoothing is applied to the scaling changes so that the movement feels organic rather than sudden or mechanical.

- **Audio analysis:** the sound amplitude is measured continuously to determine the intensity of the music.
- **Amplitude mapping:** audio levels are converted into flower-head scaling values.
- **Smooth transitions:** interpolation (`lerp()`) reduces abrupt changes and creates a natural breathing or pulsing effect.
- **Visual consistency:** flower heads respond to the music while the stems remain anchored in their original positions.
- **Collaboration:** the audio mechanic is designed to work alongside the team's Perlin Noise and Time-based mechanics, allowing sound to influence the flowers without replacing their existing animations.

The audio logic is contained in `audio-mechanic.js` so that it can be integrated into the shared `sketch.js` separately.
## Techniques

- **Perlin noise (`noise()`)** for smooth, continuous movement; **`random()`** for one-off decisions.
- **Timers and scheduled events:** a `Timer` class with `at(seconds, action)` fires actions in order as time passes; one shared garden clock gives each flower its own bloom clock (sundial, hourglass, ticking, heartbeat), a full-bloom pause and a scheduled wilt.
- **Colour blending:** `mixRgb()` fades flowers, stems and leaves gradually from their own colours to dry browns.
- **Easing:** a smooth-step function (`smooth01`) makes every opening and colour change gradual.
- **Callbacks:** `onCreated` lets one mechanic start another without the files depending on each other.
- **Classes and composition:** flowers contain many pen or dot objects and update them every frame.
- **Off-screen buffer (`createGraphics()`)** so flower A keeps its dot trail while the background redraws.
- **Normalised coordinates and `windowResized()`** so the piece rescales to any window (Week 8).
- **Audio amplitude analysis:** measuring sound intensity to drive visual changes.
- **Mapping (`map()`):** converting audio levels into flower-head scaling values.
- **Interpolation (`lerp()`):** smoothing size transitions to create organic, music-responsive movement.
- [Teammates: add the techniques your mechanic uses.]

## AI acknowledgement

- **Jackie (`perlin-layer.js`,`plants.js`, `sketch.js`):** parts of this code were generated with the help of Claude and then edited. Claude helped structure the classes, write the petal-shape, noise and debug the layout.
- **Yeheng Li (`time-mechanic.js`):** parts of this code were written with the help of Claude and then edited by me. I wrote the first version myself (`Timer`, `WiltingDot`, `FlowerWilt`), chose the idea of four flowers keeping four kinds of time, and decided how each flower blooms, stays open and wilts. Claude helped suggest code for the four bloom clocks, the full-bloom pause and the wilting of the stems, leaves and noisy flowers. I re-checked, edited and tested all of the code myself before committing it.
- **Rongwei Zhao (`audio-mechanic.js`): I used ChatGPT (OpenAI) as a support tool while developing my Audio Mechanic. My creative direction was to make the flowers respond to music by changing their size according to sound intensity. I used AI assistance to troubleshoot compatibility with the team's existing code.
- [Teammates: add your own acknowledgement, or "None".]

## External references

- IDEA9103 Week 8 tutorial: the DotAnimator and randomNoisyShape patterns that A and B extend.
- p5.js reference: https://p5js.org/reference/
- [Add any other code sources with a link and a one-line explanation, and comment them in the code too.]
