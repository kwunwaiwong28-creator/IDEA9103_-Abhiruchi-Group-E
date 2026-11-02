# IDEA9103 Creative Coding — Major Project

An interactive p5.js reinterpretation of Yayoi Kusama's sunflower painting, built by a team of [3–4] people. Each team member is creative director for one mechanic, and each mechanic lives in its own script file.

## How to run

Open `index.html` in a browser (an internet connection is needed, because p5.js loads from a CDN). With VS Code, the Live Server extension works too.

## Interaction instructions

- **Watch:** the four flowers open quickly one after another, each keeping a different kind of time (see *Time-based* below). Then they take turns: one shared 30-second garden cycle gives each flower its own slot, so while one flower wilts (its dots fall in the wind, its stem and leaves dry and bend), the others stay open. After a short rest as a dry stem it blooms again with its own clock, forever, so the picture never empties. Flowers you plant by clicking join the same rhythm. Meanwhile dots drift inside the flowers, leaves sway in the wind and the background lines wander.
- **Refresh the page:** every refresh generates a new composition (new colours, petal counts and dot layouts) and starts the cycle again.
- **Move the mouse (user input):** the mouse is a small dot with a short trail of dots. It grows and takes the colour of anything you can touch; over a flower, a ring of small dots also circles it.
- **Click a flower:** it bounces with a soft chime (higher on each click) and a new set of colours spreads across it from where you clicked, with a small ring of dots in the new colour. The first three clicks in a row change its colours; on the fourth, its whole head falls off the stem to the ground with a falling run of soft notes and a low thump when it lands; a few seconds later it draws itself again on the stem.
- **Click empty space:** the background net gives way under the click and springs back, the background changes to its next colour (crimson, violet, forest green, amber, then back to the original midnight blue), spreading out from the click, and a new flower is planted there. A seed drops to the ground, a stem shoots up to where you clicked, a leaf unfolds and a new flower draws itself at the top; it then blooms, wilts and regrows with the rest of the garden. The new plant is drawn as one piece, just behind the original plants. Only one seed grows at a time, with a short pause after it, and up to two planted flowers stay; a third makes the oldest fade away.
- **Click a leaf:** the leaf lets go of the stem with a papery, fluttering rustle and drifts down, rocking in the wind, rests on the ground (a soft tap) and fades; a few seconds later a new leaf grows back on the stem.
- **Click a stem:** the whole plant is pushed away from your finger and sways from its base, carrying its flower and leaves; a push higher up the stem moves it more.
- **Control panel (top left):** lists what each kind of click does; drag *Click strength* to make the motion gentler or stronger; untick *Sounds* to mute the click sounds; the last line tells you what your last click did.
- **Keyboard:** press Tab to focus the canvas, use the arrow keys to choose a flower (a ring of dots shows which), and press Enter or Space to click it.
- **Play Music (audio):** click *Play Music* at the bottom centre to start the soundtrack (browsers only allow sound after a click). While it plays, light on the flowers follows the music: the bass drives a halo in the centre, the mids a turning ring and the treble glints on the dots. The slider next to the button sets the volume.

## Inspiration

**Source artwork:** Yayoi Kusama, *Flowers* (2015), painting. Artist's official website: https://yayoi-kusama.jp/

The painting shows four sunflower-like flowers rising from bold green stems and leaves on a dark ground covered with a fine net of small marks. Every part of it is built from dots: the spiky petals are lined with rows of dots, and each flower's centre is a set of concentric rings of dots in contrasting colours. The colours are flat and bright — crimson, orange-gold, white, sky blue and violet against the near-black background.

These features shaped our approach:

- **Dots as the building block.** Instead of drawing solid shapes, our flowers are made of dots, as in Kusama's work: the self-drawing flowers (`FlowerDotAnimator`) are traced dot by dot along their petal and ring outlines, and the noisy flowers (`NoisyFlower`) are filled with hundreds of drifting dots.
- **Rings in the centres and spiky petals.** The concentric rings of the flower centres became separate dot pens that circle the core, and the spiky and rounded petal shapes are generated from an outline function with a random petal count, so each refresh gives a new flower in the same spirit.
- **The painted net.** The fine mesh in the background became the Perlin-noise net of wavy lines (`PerlinBackground`).
- **Four flowers, one palette.** Like the painting, the composition has four flowers of different sizes on tall stems, and our palette is taken from the painting's colours.

Our reinterpretation is not a copy: we simplified the shapes into flat vector forms and asked what would happen if Kusama's still image were alive. Each mechanic answers that question in its own way — the flowers keep their own time as they bloom, wilt and regrow (time), their dots drift and the net wanders (Perlin noise and randomness), they pulse with music (audio), and they respond to the viewer's touch (user input). For the user input mechanic we were also inspired by teamLab's *Flowers and People, Cannot be Controlled but Live Together, for Eternity* (2014, Tokyo; https://www.teamlab.art/), where the presence of visitors changes how the flowers behave.

## Mechanic ownership

| Mechanic | Team member | Script |
| --- | --- | --- |
| Perlin noise and randomness | Jackie | `perlin-layer.js` & `plants.js`|
| Time-based | Yeheng Li | `time-mechanic.js` |
| Audio | Rongwei Zhao | `audio-mechanic.js` |
| User input | Hangjing Ye | `user-input.js` |

`plants.js` holds the static stems. `sketch.js` brings all the scripts together.

### Perlin noise and randomness (`perlin-layer.js` & `plants.js`)

Randomness decides everything that stays fixed for one viewing; Perlin noise drives everything that moves.

- **A · FlowerDotAnimator:** a flower that draws itself. Its DotPen objects travel around the petal and core contours leaving dots, and noise wobbles each pen's path so it looks hand-painted. After four laps every pen stops and the flower is complete, which fires an `onCreated` event. Extends the Week 8 DotAnimator.
- **B · NoisyFlower:** a solid flower filled with NoisyDot objects. Each dot gets a random home, and noise makes it drift around that home (the Week 8 randomNoisyShape pattern). `keepInside()` keeps it inside its petal or the core.
- **C · WindLeaf:** leaves swaying in a shared noise "wind", plus each leaf's own flutter.
- **D · PerlinBackground:** wavy background lines shaped by 2D Perlin noise, reinterpreting Kusama's painted net.

### Time-based (`time-mechanic.js`) — Yeheng Li

**Four flowers, four clocks, one garden rhythm.** Timers and scheduled events decide when and how each flower blooms, how long it stays open, and when it wilts. Each flower keeps a different kind of time, so each one opens in its own way. Following our tutor's feedback that time should set the rhythm of the whole picture, one shared **garden cycle** now conducts all the flowers: they take turns, so the composition always stays balanced and full. The flower shapes, colours, dots and noise movement all come from `perlin-layer.js`; the time mechanic decides *when* dots appear, *how fast* each flower draws itself, and *when* everything dries, falls and regrows.

Life of every flower: bud → **bloom** (its own clock) → **full bloom** → **wilt** (dots dry and fall, stem and leaves bend) → **rest** (2 s, dry stem) → bloom again at its next slot in the garden cycle, forever.

| Flower | Clock | How it blooms | Bloom | Wilt | Slot in the 30 s cycle |
| --- | --- | --- | --- | --- | --- |
| Top-left | **Sundial** | All dot pens line up like one clock hand and sweep clockwise from twelve o'clock. | 6 s, steady | 10 s | 0 s |
| Middle | **Ticking** | The dot pens move only on each tick, a short step per beat, like a second hand. | 8 s, 14 ticks | 9 s | 7.5 s |
| Top-right | **Hourglass** | The centre fills like falling sand, faster and faster; then the petals break out. | 7 s, speeds up | 9 s | 15 s |
| Bottom-right | **Heartbeat** | Dots are added in bursts that come faster and faster; the flower swells on every beat. | 6 s, beats speed up | 10 s | 22.5 s |

- **Garden cycle (rhythm and balance):** `GARDEN_CYCLE` (30 s) is shared by every flower, and each flower has its own slot, a quarter cycle apart. Opposite corners (top-left and bottom-right) are half a cycle apart, so when one wilts the other is open. At the start all four open within a few seconds so the picture is full at once; after that each flower settles into its slot. The full bloom stretches to fill the time until the flower's next slot (at least `MIN_HOLD`, 6 s), so the bare-stem rest is always short and no part of the picture stays empty for long.
- **Planted flowers:** a flower planted by the user-input mechanic gets its own slot from the moment it is planted (`flower.gardenSlot`), so it lives the same cycle without wilting at the same time as the others.
- **Timer and events:** a `Timer` class (`millis()`-based) with `at(seconds, action)` fires actions in time order: every dot's drop, the rest, the regrow and the stem's recovery are scheduled events.
- **Four clocks on self-drawing flowers:** all four flowers are `FlowerDotAnimator`s, so each clock is a different *pen budget* (`penBudget()`): how far each dot pen may travel at each moment of the bloom. The sundial is steady, the hourglass fills the centre pens first and faster and faster, the ticking clock moves in steps, and the heartbeat moves in bursts.
- **Wilting:** when a flower is complete, its `onCreated` event creates a `FlowerWilt`. After the full bloom, every dot gets a scheduled drop event (petal tips first, the centre last, in noisy patches); it then falls with gravity, drifts in the same wind as the leaves and fades out.
- **Stem and leaves:** `StemWilt` dries each flower's stem and leaves together with the flower: the stem bends outwards and sinks, the leaves droop and turn brown. The original values are recorded first (`STEM_HOME`, `LEAF_HOME`), so the team's objects are only changed, never replaced, and they recover over `RECOVER_SECONDS` (3 s) as the flower regrows.
- **Regrow:** the regrow event restarts the flower's own bloom clock with new noise seeds, so every new bloom is slightly different.
- **Working with the other files:** `sketch.js` calls `FlowerDotAnimator.update()` every frame. So that the other team files stay unchanged, `time-mechanic.js` (loaded after `perlin-layer.js`) replaces this method with a timed version that still uses the team's own pens, dots, noise and drawing code. Colours, background, wind and the other mechanics are not changed.

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

**Touch the garden.** The viewer can change the garden, not only decorate it: a click on empty ground plants a new flower that then lives the same life as the others, and a click on a leaf makes it fall. Clicks on flowers and stems give smaller, plant-like answers. I designed the mechanic so it never hides the other mechanics: the blooming clocks, the wilting and the noisy drifting dots always stay fully visible.

**Clicking a flower.** Each click gives the flower a new set of colours. A different colour scheme from the team's `FLOWER_SCHEMES` is chosen and every dot pen gets a colour from it, in the same way as `pickFlowerColours()` in `perlin-layer.js`. The dots already drawn, and the time mechanic's wilting copies of them, swap each old colour for its new one (separately for the petals and the centre), so the flower keeps its rings and pattern and only its colours change; because the pens keep the new colours, the flower also regrows in them. The team's colour arrays are never edited: only which colour a dot points to changes. The new colour does not appear all at once: each dot on screen changes a little later the further it is from the click (over half a second), so the colour visibly spreads across the flower from the finger. Each colour change also comes with a springy bounce and two thin rings of small dots in the new colour, which spread just a little way out from the petal edge and fade.

**Four clicks: the flower falls.** Clicks on the same flower less than 2.5 seconds apart are counted; the panel shows the count (1/4, 2/4, 3/4). On the fourth, the whole head lets go of its stem: its dots, exactly as they look at that moment (including any wilting colours), are copied into a falling head and the real flower is hidden. The head speeds up under gravity until air resistance stops it speeding up, sways a little and turns slowly as it falls, rests on the ground, and fades. Then its old life cycle is ended (the stem turns green again) and the time mechanic's own `redrawFlower()` makes it draw itself again on the stem. A planted flower's head falls on the planted plants' layer, so it stays behind the original plants.

**Changing the background.** Every click on empty space gives the background its next colour scheme: midnight blue (the team's own `MIDNIGHT` and `NET_BLUES`), then crimson, violet, forest green and amber, and round again. Each scheme is a dark ground colour with three matching net-line colours, so the flowers still stand out, like the different grounds of Kusama's flower paintings. The new ground colour spreads out from the click as a growing circle (with an ease-out curve, over about a second) until it covers the canvas, while each net line fades from its old colour to its new one at the same time. `perlin-layer.js` is not edited: while `PerlinBackground.draw()` runs, p5's `background()` is swapped for one that paints the scheme's colour and the spreading circle, and `stroke()` for one that recognises each `NET_BLUES` colour and gives the line its colour in the new scheme; both are put back straight afterwards.

**Planting a flower.** A click on empty space (including the place of a flower that is currently only a dry stem) plants a flower there in three phases. *Seed*: a small dot in the new flower's petal colour drops from the click to the ground, speeding up like a falling object. *Grow*: a new `Stem` (from `plants.js`) shoots up from the ground to the click point with an ease-out curve, carrying a green bud. *Live*: a `WindLeaf` unfolds half way up the stem and a new `FlowerDotAnimator` (from `perlin-layer.js`) starts its bloom clock. When it has drawn itself, it gets its own `FlowerWilt` from the time mechanic, so it stays in full bloom, wilts (its stem and leaf dry and droop too) and regrows forever, like the original flowers. The stem, leaf and flower of a planted plant are kept in my own list and drawn together, right after the background net, with the team's own draw methods (the flower and its `FlowerWilt` are also listed in the team's `animatedFlowers` and `wilts`, so the audio light finds them, but `sketch.js` skips drawing them): so a plant is never split across layers (a flower in front, its stem behind), and it always sits behind the original plants instead of covering them. While its `FlowerWilt` is made, its stem and leaf are briefly added to the team's lists, because the time mechanic finds a flower's stem and leaves there. To keep the garden from filling up, only one seed can grow at a time (a new click is ignored until it has grown, plus a 2.5-second pause), and at most two planted flowers are kept; planting a third fades the oldest away and removes it.

**Clicking a leaf.** A clicked leaf lets go of its stem and falls. Its stalk point falls at a speed that builds up like a leaf meeting air resistance (`v = v_max · (1 − e^(−2.2t))`), drifts sideways with the shared Perlin wind, and rocks from side to side on a sine wave while it slowly turns. It rests on the ground, fades out, and a few seconds later a new leaf grows back on the stem from nothing. The leaf is always drawn by the team's own `WindLeaf.draw()`: only its position, angle and size are changed for that one drawing and put straight back, so the time mechanic can still dry and droop it.

**Sounds.** A **colour change** plays a soft two-note chime (D5+A5, then F5+C6, then A5+D6), getting higher with each click in a row, so the viewer can hear the fall coming. The two "taking away" actions also have a sound, made in code with the Web Audio API (oscillators, filtered noise and volume envelopes — no sound files). When a **flower head** falls, a soft snap is followed by a falling run of five bell-like "dot" notes (D6, A5, F5, D5, A4), as if its dots were tumbling down, over a breath of air that drops in pitch; when it lands, a low sine thump and a little puff of dust. Bigger flowers sound a fourth lower. When a **leaf** falls, a tiny dry tick is followed by a papery rustle: noise through a band-pass filter that slides down in pitch, while a slow oscillator (LFO) makes its loudness flutter, slowing from 7 to 2.5 times a second like the leaf rocking on its way down. Over it, a dozen tiny random crackles thin out, and a very quiet sine glides from A5 down to D5 as the leaf drifts; when it touches the ground, a soft tap. The notes are in D minor, the key of the team's music, so they fit in when it is playing. **Link to the audio mechanic:** while the music in `audio-mechanic.js` is playing, my sounds are sent into its master volume (`window.GroupEGeneratedAudio.master`) instead of my own output. So the music's volume slider controls them too, and the music's frequency analysis hears them — a falling flower makes the audio light pulse. Browsers only allow sound after a click, so the first sound is started inside the click itself. *Sounds* in the panel switches them off.

**Clicking a stem.** Clicking a stem pushes the whole plant. The stem leans from its base on a slower, heavier spring (about 0.9 swings per second) and sways back and forth before it settles. Its flower head and its leaves are carried with it (a point further up the stem moves further), and the leaves give a small flutter of their own as the stem starts to move. The stem top is moved only while `Stem.draw()` runs and is put straight back afterwards, so `time-mechanic.js` still controls the real stem when it wilts and bends it.

**From the Week 9 plan to the final mechanic.** My Week 9 concept (inspired by teamLab's *Flowers and People, Cannot be Controlled but Live Together, for Eternity*, 2014) planned three inputs: the cursor's proximity enlarging nearby dots, a click sending a radial shockwave through the dots, and mouse speed controlling the strength. Testing it inside the team's garden changed the design:

| Version | What it did | What I learned |
| --- | --- | --- |
| 1 | Copied the clicked flower's dots and moved them a little | The effect was too faint: the real flower was still drawn underneath, so a click felt like nothing happened. |
| 2 | Faded the real flower and sent its dots far out (drift, vortex, burst, weaving) | Clearly visible, but it felt like an explosion: glowing, blurred dots filled the screen. |
| 3 | Softer, slower motions (breeze, diffuse, ripple, eddy) | Calmer, but the dots still covered the flower, so the time and noise mechanics behind them could no longer be seen. |
| 4 | The flower only bounces; a few small, crisp dots leave from its edge; leaves and stems swing on springs; a colour wave runs through the net | The other mechanics stay fully visible, but my tutor pointed out that many variations of the same "react to a click" idea split the viewer's attention. |
| 5 | Clicking empty space plants a new flower that joins the garden's life cycle; clicking a leaf makes it fall and grow back. The colour wave and the leaf flick were removed | The viewer now adds something new to the garden and takes something away, instead of only seeing more decoration. |
| 6 (final) | Clicking a flower changes its colours (spreading from the click), and a fourth click makes the whole head fall and regrow. The three flower effects (Breeze, Pollen, Ripple) and the effect menu were removed, and the click ring was made smaller | Every part of the plant now has one clear action: flowers change colour and fall, leaves fall, stems sway, empty ground grows something new. |

From this I kept four rules for the final version: **let the viewer change the garden** (add a flower, lose a leaf), not only decorate it; **never hide another mechanic** (nothing is drawn over a flower); **keep Kusama's look** (small, solid dots instead of blur or glow); and **move like a real plant** (springs that swing and settle, not instant jumps). The shockwave idea survives as the small ring of dots that spreads from a flower when its colours change. The proximity idea became the dot cursor and the dotted hover ring, which show what can be clicked without changing the flowers. I replaced mouse speed with the *Click strength* slider, because a fast flick of the mouse was hard to control and made the effect unpredictable.

**Responding to the Week 9 feedback.** My tutor said the user experience of my planned mechanic was not clear, that it did not connect well to the other mechanics, and that the interaction felt shallow; she suggested that user input could change the colours, generate more flowers or restart the growing cycle. The final mechanic is built around exactly those three ideas:

| Feedback | What the final mechanic does |
| --- | --- |
| Change the colours | Clicking a flower gives it a new colour scheme, which spreads across it from the click and stays when it regrows. Clicking empty space gives the whole background (ground and net) its next colour scheme, spreading from the click. |
| Generate more flowers | Clicking empty space plants a new flower, which then lives the same life as the original ones. |
| Restart the growing cycle | The fourth click on a flower makes its head fall; its life cycle is ended and it draws itself again from the start. A clicked leaf also falls and grows back. |
| Connect to the other mechanics | Planted and regrown flowers use the time mechanic's bloom clocks and `FlowerWilt` (they bloom, wilt and regrow, and their stems dry); falling leaves drift in the Perlin-noise wind and an empty-space click bends the Perlin net; planted flowers are listed with the team's flowers, so the audio light shines on them too. The link to the audio now goes both ways: falling flowers and leaves make sounds in the music's key, and while the music plays they are mixed into it, so its analyser hears them and the audio light pulses with every fall. |
| Make the experience clear | The panel lists what each click does, the dot cursor changes over anything clickable, a ring of dots circles the flower under the mouse, and the panel counts clicks on a flower (1/4 … 3/4 · once more and it falls). |

**How the code is organised.** Everything lives in `user-input.js` inside one closure, so none of its names can clash with teammates' code. Each moving thing is a small class that keeps its own state and knows how to update and draw itself; functions then find what was clicked and hook the classes into the team's drawing.

| Class | Job |
| --- | --- |
| `Spring` | A damped spring (`kick()`, `step()`). One class is used for the leaf flutter, stem sway, flower bounce, cursor squeeze and hover-ring size, each with its own settings. |
| `FallingLeaf` | A leaf that has been let go: falls, drifts in the wind, rocks, lands and fades (`update()`, `draw()`). |
| `FallingHead` | A fallen flower head: a copy of its dots that falls, turns, lands, fades and then lets the flower regrow. |
| `PlantedFlower` | Seed → stem → leaf → flower planted by a click: its phases (`update()`, `bloom()`), its life cycle (`startWilt()`), drawing in one piece (`draw()`) and fading out (`fadeAway()`, `remove()`). |
| `Ripple` | The small ring of dots after a colour change. |
| `Backdrop` | The background's colour scheme: moves to the next one on an empty-space click (`next()`), draws the spreading circle (`drawBackground()`) and fades the net lines (`netColour()`). |
| `HoverRing` | The dotted ring around the flower under the mouse, and its random size on each click (`jump()`). |
| `DotCursor` | The dot that replaces the mouse arrow, with its trail and squeeze. |
| `GardenSounds` | The colour-change chime and the falling-flower and falling-leaf sounds (`colourChange()`, `flowerFall()`, `flowerLand()`, `leafFall()`, `leafLand()`), sent into the music when it plays. |

| Part | Main functions | Job |
| --- | --- | --- |
| Flowers | `flowerAt()`, `flowerVisible()`, `touchFlower()`, `bounceFlower()`, `withBounce()` | Find the clicked (visible) flower, count the clicks, bounce the head. |
| Colour and falling | `recolourFlower()`, `applyRecolours()`, `dropHead()`, `regrowFlower()` | Give a flower new colours, make its head fall, then let it draw itself again. |
| Planting | `plantFlower()`, `updatePlants()`, `drawPlantsBehind()` | Plant a seed (one at a time, at most two kept) and draw the planted plants behind the original ones. |
| Net and background | `pressNet()`, `dentOffset()`, `wrapBackground()` | Push the background net's lines away from an empty-space click and let them spring back; give the background its new colours. |
| Leaves | `leafAt()`, `leafHit()`, `dropLeaf()`, `wrapLeaves()` | Test clicks against the rotated leaf, make it fall, regrow it, add its flutter when it is drawn. |
| Stems | `stemAt()`, `alongStem()`, `pushStem()`, `wrapStems()` | Test clicks against the stem line, push it, carry its flower and leaves. |
| Interface | `cursorTarget()`, `drawHover()`, `display()`, `makeControls()` | What is under the mouse, drawing the cursor, ring and ripples on top, and the control panel. |

**The dot cursor.** The system arrow is hidden and the mouse becomes a small Kusama-style dot with a trail of six smaller, fainter dots. Each trail dot moves 45 % of the way towards the one in front every frame, so the trail lags and curls when the mouse turns. The dot is plain and solid, with no outline. Over a flower, leaf or stem it grows and eases into that thing's colour, so the viewer can see what is touchable before clicking; a click squeezes the dot on a quick spring and it pops back. The cursor hides when the pointer leaves the canvas or when the keyboard is used.

**The hover ring.** Over a flower, a ring of small dots slowly turns around it, just outside its petal tips (the furthest tip is found once from the flower's own `outline()`), so the viewer can see what can be clicked without the ring standing far from the flower. Every click on a flower makes the ring jump to a new random size (1.04–1.14 × the distance to the furthest petal tip, always at least 0.04 away from the last size). A spring carries it to the new size with a small overshoot and wobble, and between clicks it breathes slowly in and out. A bigger ring gets more dots, so the spacing stays even.

- **Hit test:** the click position is turned into 0–1 canvas coordinates and compared with each flower's centre and radius (`flowerAt()`) with each leaf's rotated shape (`leafAt()`) and with each stem as a line segment (`stemAt()`), so clicking still works after the window is resized.
- **Bounce without hiding:** the flower head is scaled around its own centre by a second damped spring, by wrapping the existing draw methods (`FlowerDotAnimator.update`, `NoisyFlower.draw`, `FlowerWilt.update`) without editing them, the same pattern `time-mechanic.js` uses. Nothing is faded or covered.
- **Soft motion:** `easeInOutSine` gives the ring of dots a soft start and stop; a falling head speeds up under gravity until it reaches a top speed, like a falling leaf.
- **Feedback:** the dot cursor grows and changes colour over anything touchable, a ring of small dots circles the flower under the mouse, and the panel lists what each click does and what the last click did.
- **Accessibility:** keyboard control (arrow keys + Enter), `aria-label`s, and smaller motion when the system asks for reduced motion.
- **Efficiency:** answers needed several times in one frame (the list of flowers, the flower under the mouse) are worked out once per frame (`perFrame()`); the cursor's colour, which comes from counting a flower's ~2000 dots, is kept for 0.4 s or until the flower changes colour; and the wrapped draw methods skip extra work when nothing is changing. This halved the time my mechanic adds to each frame (measured with Node's CPU profiler: from about 8 % to 4.5 % of the frame).
- **Robustness:** if the page is first shown at zero size (for example in a hidden preview panel), the self-drawing flowers would create zero-size drawing layers and stop p5's draw loop with an error. `canvasReady()` skips frames until the canvas has a size and rebuilds any layer whose size no longer matches the canvas, using the team's own `resetLayer()`.

## Techniques

- **Perlin noise (`noise()`)** for smooth, continuous movement; **`random()`** for one-off decisions.
- **Timers and scheduled events:** a `Timer` class with `at(seconds, action)` fires actions in order as time passes; one shared garden cycle gives each flower its own bloom clock (sundial, hourglass, ticking, heartbeat) and its own slot, so the flowers take turns and set the rhythm of the whole picture.
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
- **Easing:** `easeInOutSine` gives the ring of dots after a colour change a soft start and stop.
- **Damped springs:** each clicked stem and flower is a small physics simulation (stiffness and damping) stepped with the frame time; a stem's sway is passed on to its flower and leaves.
- **Reusing the team's classes:** a planted flower is a new `Stem`, `WindLeaf` and `FlowerDotAnimator` with its own `FlowerWilt`, so the team's drawing code and the time mechanic's life cycle work on it unchanged.
- **Recolouring the background:** while `PerlinBackground.draw()` runs, p5's `background()` and `stroke()` are also swapped, so the ground colour spreads from the click as a growing circle and each net line fades to its colour in the new scheme, without editing `perlin-layer.js`.
- **Pressing the net:** while `PerlinBackground.draw()` runs, p5's `vertex()` is swapped for a version that pushes each point of the net away from an empty-space click (`depth · e^(−(d/r)²) · e^(−t/τ) · sin(2π f t)` — a dent that springs back with a small wobble), then the real `vertex()` is restored.
- **Simple falling physics:** a falling leaf uses a speed that approaches a limit (`1 − e^(−kt)`), wind drift and a sine-wave rocking motion; the seed falls with `t²`.
- **Polar coordinates:** the ring of dots after a colour change is placed on the flower's own outline (`outline(angle)`) with `cos`/`sin`.
- **Sharing the wind:** falling leaves drift with the team's shared Perlin wind (`windStrength()`).
- **Classes for each moving thing:** `Spring`, `FallingLeaf`, `FallingHead`, `PlantedFlower`, `Ripple`, `HoverRing`, `DotCursor` and `GardenSounds` each keep their own state and have their own `update()` / `draw()` methods; one `Spring` class with different settings replaces five copies of the same physics.
- **Web Audio synthesis:** the colour chime and the falling sounds are built from oscillators, a noise buffer, band-pass filters, exponential volume envelopes and an LFO, with notes turned into frequencies by `f = 440 · 2^((n − 69) / 12)`; while the music plays they are routed into its master volume, so the audio mechanic's analyser reacts to them.

## AI acknowledgement

- **Jackie (`perlin-layer.js`,`plants.js`, `sketch.js`):** parts of this code were generated with the help of Claude and then edited. Claude helped structure the classes, write the petal-shape, noise and debug the layout.
- **Yeheng Li (`time-mechanic.js`):** parts of this code were generated with the help of Claude and then edited by me. I wrote the first version (`Timer`, `WiltingDot`, `FlowerWilt`) myself, designed the four bloom clocks, the wilting and the life cycle, and re-checked, edited and tested all of the code before committing it.
- **Rongwei Zhao (`audio-mechanic.js`):** I used ChatGPT (OpenAI) as a support tool while developing my Audio Mechanic. My creative direction was to make the flowers respond to music by changing their size according to sound intensity. I used AI assistance to troubleshoot compatibility with the team's existing code.
- **Hangjing Ye (`user-input.js`):** I designed the mechanic (touching the garden: planting flowers, changing flower and background colours, falling flowers and leaves, swaying stems, the dot cursor and the sounds) and chose every change after testing each version and responding to my tutor's feedback. ChatGPT (OpenAI) helped with the first version (click detection and the control panel); Claude (Anthropic) helped me write the later versions, including the springs, the falling and planting logic, the Web Audio sounds and the reorganisation into classes. How each part works is explained in the User input section above. I tested everything in the browser and edited the code; the same note is at the top of `user-input.js`.

## External references

- IDEA9103 Week 8 tutorial: the DotAnimator and randomNoisyShape patterns that A and B extend.
- p5.js reference: https://p5js.org/reference/
- MDN, Pointer events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events — one click handler for mouse, pen and touch (`user-input.js`).
- MDN, `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — smaller motion for users who ask for it (`user-input.js`).
- Ryan Juckett, Damped springs: https://www.ryanjuckett.com/damped-springs/ — the spring model for the stem sway, the leaf flutter and the flower bounce (`user-input.js`).
- Easings.net, easeInOutSine: https://easings.net/#easeInOutSine — the soft start and stop of the ring of dots after a colour change (`user-input.js`).
- MDN, Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API — oscillators, noise buffers, filters, gain envelopes and the LFO used for the click sounds (`user-input.js`).
- MIDI tuning standard (note number → frequency): https://en.wikipedia.org/wiki/MIDI_tuning_standard — `f = 440 · 2^((n − 69) / 12)`, used to tune the falling notes to the music's key (`user-input.js`).
