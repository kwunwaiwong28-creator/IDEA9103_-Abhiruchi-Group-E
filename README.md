# IDEA9103 Creative Coding — Major Project

An interactive p5.js reinterpretation of Yayoi Kusama's sunflower painting, built by a team of [3–4] people. Each team member is creative director for one mechanic, and each mechanic lives in its own script file.

## How to run

Open `index.html` in a browser (an internet connection is needed, because p5.js loads from a CDN). With VS Code, the Live Server extension works too.

## Interaction instructions

- **Watch:** the four flowers bloom one after another, each keeping a different kind of time (see *Time-based* below). Each flower then stays in full bloom for 6 seconds and wilts over 15 seconds: its colours fade to dry browns, its dots fall away in the wind, and its stem and leaves dry and bend with it. After 2 seconds as a dry stem, the stem turns green again and the flower blooms again with its own clock, so the garden repeats this life cycle forever. Meanwhile dots drift inside the flowers, leaves sway in the wind and the background lines wander.
- **Refresh the page:** every refresh generates a new composition (new colours, petal counts and dot layouts) and starts the cycle again.
- **Click a flower (user input):** move the mouse over a flower; a ring of small dots circles it to show it can be clicked. Click or tap it: the flower bounces gently and a few of its dots are released around it (or rings of dots spread out from it), without covering the flower.
- **Click a leaf:** the leaf is flicked away from your finger and swings back and forth until it settles into the wind again.
- **Click a stem:** the whole plant is pushed away from your finger and sways from its base, carrying its flower and leaves; a push higher up the stem moves it more.
- **Control panel (bottom left):** choose *Random* or one of the three flower effects (Breeze, Pollen, Ripple), and drag *Click strength* to make the motion gentler or stronger.
- **Keyboard:** press Tab to focus the canvas, use the arrow keys to choose a flower, and press Enter or Space to trigger it.
- [Teammates: add how to interact with your mechanic, e.g. "click to start audio".]

## Inspiration

[Group: describe the source artwork (title, year, Yayoi Kusama) and how it shaped the approach. Credit the artwork with a link.]

## Mechanic ownership

| Mechanic | Team member | Script |
| --- | --- | --- |
| Perlin noise and randomness | Jackie | `perlin-layer.js` & `plants.js`|
| Time-based | Yeheng Li | `time-mechanic.js` |
| Audio | Rongwei Zhao | `[audio-mechanic.js]` |
| User input | Hangjing Ye | `user-input.js` |

`plants.js` holds the static stems. `sketch.js` brings all the scripts together.

### Perlin noise and randomness (`perlin-layer.js` & `plants.js`)

Randomness decides everything that stays fixed for one viewing; Perlin noise drives everything that moves.

- **A · FlowerDotAnimator:** a flower that draws itself. Its DotPen objects travel around the petal and core contours leaving dots, and noise wobbles each pen's path so it looks hand-painted. After four laps every pen stops and the flower is complete, which fires an `onCreated` event. Extends the Week 8 DotAnimator.
- **B · NoisyFlower:** a solid flower filled with NoisyDot objects. Each dot gets a random home, and noise makes it drift around that home (the Week 8 randomNoisyShape pattern). `keepInside()` keeps it inside its petal or the core.
- **C · WindLeaf:** leaves swaying in a shared noise "wind", plus each leaf's own flutter.
- **D · PerlinBackground:** wavy background lines shaped by 2D Perlin noise, reinterpreting Kusama's painted net.

### Time-based (`time-mechanic.js`) — Yeheng Li

**Four flowers, four clocks.** Timers and scheduled events decide when and how each flower blooms, how long it stays open, and when it wilts. Each flower keeps a different kind of time, so each one opens in its own way. The flower shapes, colours, dots and noise movement all come from `perlin-layer.js`; the time mechanic decides *when* dots appear, *how far* each petal or centre is open, and *when* everything dries and falls.

Life of every flower: bud → **bloom** (its own clock) → **full bloom** (6 s) → **wilt** (15 s; dots dry and fall, stem and leaves bend) → **rest** (2 s, dry stem) → bloom again, forever.

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
- **Rest and regrow:** after the wilt, a scheduled event leaves only the dry stem for `REST_SECONDS` (2 s). The next event restarts the flower's own bloom clock with new noise seeds, so every new bloom is slightly different, while the stem and leaves recover over `RECOVER_SECONDS` (3 s) and return exactly to their original values. The cycle repeats forever.
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
### User input (`user-input.js`) — Hangjing Ye

**Touch the garden.** The flowers and leaves answer a click the way real plants answer a light touch. I designed the mechanic so it never hides the other mechanics: the blooming clocks, the wilting and the noisy drifting dots always stay fully visible, and everything my mechanic draws happens outside the flower.

**Clicking a flower.** The flower head gives a small springy bounce. Then, outside the flower, one of three things happens (chosen at random, or picked in the panel):

| Effect | What happens |
| --- | --- |
| 01 Breeze | A few dots are blown off the far edge of the petals, away from the click, and drift on the wind. A gust goes through the whole garden: the leaves and the falling wilted dots sway with it. |
| 02 Pollen | A few dots pop off the petal edge and fall slowly with a sideways flutter, like pollen shaken from a flower. |
| 03 Ripple | Rings of small dots spread out from the flower's edge, following the shape of its petals, like a drop on a pond. |

The loose dots are small, solid and in the flower's own petal colours (no blur or glow), so they read as Kusama-style dots. They start on the petal edge and only move outwards, so they never cover the flower.

**Clicking a leaf.** Clicking a leaf flicks it. Each leaf has a damped spring (`a'' = −ω²·a − 2ζω·a'`, about 1.3 swings per second), stepped every frame: the tip is pushed away from the click, harder near the tip, then swings back and forth and settles into the shared Perlin wind. The spring angle is added through the wind value passed to `WindLeaf.draw()`, so `perlin-layer.js` is not edited, and the click is tested against the leaf's current rotated shape.

**Clicking a stem.** Clicking a stem pushes the whole plant. The stem leans from its base on a slower, heavier spring (about 0.9 swings per second) and sways back and forth before it settles. Its flower head and its leaves are carried with it (a point further up the stem moves further), and the leaves give a small flutter of their own as the stem starts to move. The stem top is moved only while `Stem.draw()` runs and is put straight back afterwards, so `time-mechanic.js` still controls the real stem when it wilts and bends it.

- **Hit test:** the click position is turned into 0–1 canvas coordinates and compared with each flower's centre and radius (`flowerAt()`) with each leaf's rotated shape (`leafAt()`) and with each stem as a line segment (`stemAt()`), so clicking still works after the window is resized.
- **Bounce without hiding:** the flower head is scaled around its own centre by a second damped spring, by wrapping the existing draw methods (`FlowerDotAnimator.update`, `NoisyFlower.draw`, `FlowerWilt.update`) without editing them, the same pattern `time-mechanic.js` uses. Nothing is faded or covered.
- **Sharing the wind:** Breeze wraps `windStrength()` from `perlin-layer.js` and adds a gust while it plays, so the garden reacts as one.
- **Soft motion:** `easeInOutSine` gives the gust and the breeze a soft start and stop; `noise()` gives each loose dot a wandering path; pollen falls with a simple gravity curve.
- **Feedback:** a ring of small dots slowly circles the flower under the mouse, the cursor changes over flowers, leaves and stems, and the panel names the effect.
- **Accessibility:** keyboard control (arrow keys + Enter), `aria-label`s, and smaller motion when the system asks for reduced motion.

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
- **Pointer events and normalised hit testing:** one handler for mouse, pen and touch; clicks are matched to flowers in 0–1 coordinates.
- **Wrapping functions:** `setup()`, `draw()` and the flowers' draw methods are wrapped so the user-input layer adds behaviour without editing teammates' files.
- **Easing:** `easeInOutSine` gives the gust and the breeze a soft start and stop.
- **Perlin noise for soft paths:** `noise()` makes each loose dot in Breeze wander instead of flying in a straight line.
- **Damped springs:** each clicked leaf, stem and flower is a small physics simulation (stiffness and damping) stepped with the frame time; a stem's sway is passed on to its flower and leaves.
- **Polar coordinates:** loose dots and ripple rings are placed on the flower's own outline (`outline(angle)`) with `cos`/`sin`.
- **Wrapping the shared wind:** Breeze adds a gust to `windStrength()` so the leaves react to the click.
- [Teammates: add the techniques your mechanic uses.]

## AI acknowledgement

- **Jackie (`perlin-layer.js`,`plants.js`, `sketch.js`):** parts of this code were generated with the help of Claude and then edited. Claude helped structure the classes, write the petal-shape, noise and debug the layout.
- **Yeheng Li (`time-mechanic.js`):** parts of this code were generated with the help of Claude and then edited by me. I wrote the first version (`Timer`, `WiltingDot`, `FlowerWilt`) myself, designed the four bloom clocks, the wilting and the life cycle, and re-checked, edited and tested all of the code before committing it.
- **Rongwei Zhao (`audio-mechanic.js`): I used ChatGPT (OpenAI) as a support tool while developing my Audio Mechanic. My creative direction was to make the flowers respond to music by changing their size according to sound intensity. I used AI assistance to troubleshoot compatibility with the team's existing code.
- **Hangjing Ye (`user-input.js`):** I chose the idea of touching the garden (flowers that bounce and shed dots, leaves that swing, stems that sway), the effects and the control panel, and I asked for the changes after testing each version (softer motion, smaller crisp dots, never covering the other mechanics). The first version (click detection, panel and copying the dots) was written with help from ChatGPT (OpenAI). Claude (Anthropic) helped me rewrite it: the flower bounce, the three edge effects (Breeze, Pollen, Ripple), the gust added to the shared wind, the leaf spring, the stem sway, the dotted hover ring and keyboard control. I tested every effect in the browser and edited the code; the same note is in the comments at the top of the file.
- [Teammates: add your own acknowledgement, or "None".]

## External references

- IDEA9103 Week 8 tutorial: the DotAnimator and randomNoisyShape patterns that A and B extend.
- p5.js reference: https://p5js.org/reference/
- MDN, Pointer events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events — one click handler for mouse, pen and touch (`user-input.js`).
- MDN, `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — smaller motion for users who ask for it (`user-input.js`).
- Ryan Juckett, Damped springs: https://www.ryanjuckett.com/damped-springs/ — the spring model for the leaf swing, the stem sway and the flower bounce (`user-input.js`).
- Easings.net, easeInOutSine: https://easings.net/#easeInOutSine — the soft start and stop of the gust and breeze (`user-input.js`).
- [Add any other code sources with a link and a one-line explanation, and comment them in the code too.]
