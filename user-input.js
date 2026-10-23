
/*
 * USER INPUT — HANGJING YE
 * Random mouse-click particle effects:
 * Drift / Vortex / Growth / Weaving
 *
 * Non-destructive interaction layer.
 * Does not modify the team's original flower,
 * Perlin noise, time or audio mechanics.
 *
 * Developed with assistance from ChatGPT (OpenAI).
 */

(() => {
  'use strict';

  const EFFECTS = ['drift', 'vortex', 'growth', 'weave'];

  const LABELS = {
    drift: 'PARTICLE DRIFT',
    vortex: 'PARTICLE VORTEX',
    growth: 'PARTICLE GROWTH',
    weave: 'PARTICLE WEAVING'
  };

  const LIFETIME = 4400;

  let active = [];
  let lastEffect = -1;
  let lastClickAt = -Infinity;
  let intensity = 1.3;
  let selection = 'random';
  let status = null;

  const reduceMotion = !!(
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // User Input control panel
  function makeControls() {
    const panel = document.createElement('div');

    panel.style.cssText = `
      position:fixed;
      z-index:30;
      left:14px;
      bottom:14px;
      background:rgba(8,12,27,.92);
      color:#e8eaf2;
      padding:12px 14px;
      border:1px solid #3b4f72;
      border-radius:12px;
      font:12px/1.5 system-ui,sans-serif;
      max-width:275px;
      box-shadow:0 8px 30px #0008;
    `;

    const title = document.createElement('div');
    title.textContent = 'USER INPUT · CLICK EFFECTS';
    title.style.cssText =
      'letter-spacing:.11em;font-weight:700;margin-bottom:8px;color:#d8e0f5';
    panel.append(title);

    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Choose click effect');
    select.style.cssText = `
      width:100%;
      padding:7px;
      border:1px solid #526180;
      border-radius:6px;
      background:#121b30;
      color:white;
    `;

    const options = [
      ['random', 'Random · Four effects'],
      ['drift', 'Particle Drift'],
      ['vortex', 'Particle Vortex'],
      ['growth', 'Particle Growth'],
      ['weave', 'Particle Weaving']
    ];

    for (const [value, label] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }

    select.addEventListener('change', () => {
      selection = select.value;
    });

    panel.append(select);

    const row = document.createElement('div');
    row.style.cssText =
      'margin-top:10px;display:flex;justify-content:space-between';

    const amountLabel = document.createElement('span');
    amountLabel.textContent = 'Click strength';

    const amount = document.createElement('span');
    amount.textContent = '1.3×';

    row.append(amountLabel, amount);
    panel.append(row);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.6';
    slider.max = '2.4';
    slider.step = '0.1';
    slider.value = '1.3';
    slider.style.cssText = 'width:100%;accent-color:#95b9df';

    slider.addEventListener('input', () => {
      intensity = Number(slider.value);
      amount.textContent = intensity.toFixed(1) + '×';
    });

    panel.append(slider);

    status = document.createElement('div');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Click a flower · Recover in 4.4s';
    status.style.cssText = 'margin-top:8px;color:#aebdd5';

    panel.append(status);
    document.body.append(panel);
  }

  // Read the team's existing flower objects
  function flowers() {
    const list = [];

    if (typeof animatedFlowers !== 'undefined') {
      list.push(...animatedFlowers);
    }

    if (typeof noisyFlowers !== 'undefined') {
      list.push(...noisyFlowers);
    }

    return list;
  }

  // Find which flower was clicked
  function chooseFlower(nx, ny) {
    let best = null;
    let bestDistance = Infinity;

    for (const flower of flowers()) {
      const distance = Math.hypot(
        nx - flower.nx,
        (ny - flower.ny) * height / width
      );

      if (
        distance < flower.nr * 1.10 &&
        distance < bestDistance
      ) {
        best = flower;
        bestDistance = distance;
      }
    }

    return best;
  }

  // Trigger a random particle effect
  function trigger(nx, ny) {
    const now = performance.now();

    if (now - lastClickAt < 180) return false;

    const flower = chooseFlower(nx, ny);

    if (!flower) {
      if (status) status.textContent = 'Click directly on a flower';
      return false;
    }

    lastClickAt = now;

    let index = EFFECTS.indexOf(selection);

    if (index < 0) {
      index = Math.floor(Math.random() * EFFECTS.length);

      if (index === lastEffect) {
        index = (index + 1 +
          Math.floor(Math.random() * 3)) % EFFECTS.length;
      }
    }

    lastEffect = index;
    const type = EFFECTS[index];

    // Copy visual particles, preserving original data
    const source = [];

    if (Array.isArray(flower.dots) && flower.dots.length) {
      const step = Math.max(
        1,
        Math.floor(flower.dots.length / 600)
      );

      for (let i = 0; i < flower.dots.length; i += step) {
        const d = flower.dots[i];

        const x = Number.isFinite(d.x) ? d.x : d.hx;
        const y = Number.isFinite(d.y) ? d.y : d.hy;

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          continue;
        }

        let rgb;

        if (Array.isArray(d.rgb)) {
          rgb = d.rgb;
        } else if (d.colour && typeof red === 'function') {
          rgb = [
            red(d.colour),
            green(d.colour),
            blue(d.colour)
          ];
        } else {
          rgb = [232, 190, 160];
        }

        source.push({
          x,
          y,
          r: Math.hypot(x, y),
          angle: Math.atan2(y, x),
          size: Math.max(
            0.015,
            Math.min(0.07, d.size || 0.035)
          ),
          rgb,
          seed: Math.random() * 10
        });
      }
    }

    // Allow interaction before a flower has fully bloomed
    if (source.length < 25) {
      const count = 190;

      const palette =
        typeof PALETTE !== 'undefined'
          ? [
              PALETTE.crimson,
              PALETTE.gold,
              PALETTE.white,
              PALETTE.skyBlue
            ]
          : [
              [200, 50, 70],
              [220, 160, 65],
              [235, 230, 220]
            ];

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 0.9;

        const outline =
          typeof flower.outline === 'function'
            ? flower.outline(angle)
            : 1;

        source.push({
          x: Math.cos(angle) * r * outline,
          y: Math.sin(angle) * r * outline,
          r,
          angle,
          size: 0.025,
          rgb: palette[i % palette.length],
          seed: Math.random() * 10
        });
      }
    }

    active = active.filter(
      p => now - p.start < LIFETIME
    );

    active.push({
      flower,
      type,
      start: now,
      particles: source,
      seed: Math.random() * 10,
      clickX: (nx - flower.nx) / flower.nr,
      clickY: (ny - flower.ny) * height /
              (flower.nr * width)
    });

    // Prevent excessive overlapping effects
    if (active.length > 2) {
      active.shift();
    }

    if (status) {
      status.textContent =
        LABELS[type] + ' · ' + source.length + ' particles';
    }

    return true;
  }

  // Render mouse-click particle animations
  function display() {
    if (
      typeof push !== 'function' ||
      typeof width !== 'number'
    ) return;

    const now = performance.now();

    active = active.filter(
      p => now - p.start < LIFETIME
    );

    push();
    noStroke();

    for (const pulse of active) {
      const p = (now - pulse.start) / LIFETIME;

      // Smooth emergence and recovery
      const envelope =
        Math.sin(Math.PI * p) ** 2 *
        (reduceMotion ? 0.25 : 1) *
        intensity;

      const flower = pulse.flower;
      const cx = flower.nx * width;
      const cy = flower.ny * height;
      const R = flower.nr * width;

      for (const dot of pulse.particles) {
        const dist = Math.hypot(
          dot.x - pulse.clickX,
          dot.y - pulse.clickY
        );

        const influence =
          Math.exp(-dist * dist / 1.7) * envelope;

        let x = dot.x;
        let y = dot.y;

        // 01 — PARTICLE DRIFT
        if (pulse.type === 'drift') {
          x += influence * (
            0.22 * Math.sin(dot.seed * 2.1 + p * 5) +
            0.09 * Math.cos(dot.angle * 5)
          );

          y += influence * (
            -0.16 +
            0.13 * Math.cos(dot.seed * 1.5 + p * 4)
          );
        }

        // 02 — PARTICLE VORTEX
        else if (pulse.type === 'vortex') {
          const angle = 0.92 * influence;

          const rx = x - pulse.clickX;
          const ry = y - pulse.clickY;

          x = pulse.clickX +
              rx * Math.cos(angle) -
              ry * Math.sin(angle);

          y = pulse.clickY +
              rx * Math.sin(angle) +
              ry * Math.cos(angle);
        }

        // 03 — PARTICLE GROWTH
        else if (pulse.type === 'growth') {
          const outward =
            0.20 * influence *
            (
              0.6 +
              0.4 * Math.sin(dot.r * 9 - p * 11) ** 2
            );

          x += Math.cos(dot.angle) * outward;
          y += Math.sin(dot.angle) * outward;
        }

        // 04 — PARTICLE WEAVING
        else if (pulse.type === 'weave') {
          const shift =
            0.14 *
            influence *
            Math.sin(
              dot.angle * 12 +
              dot.r * 20 -
              p * 13
            );

          x -= Math.sin(dot.angle) * shift;
          y += Math.cos(dot.angle) * shift;
        }

        // Draw without altering the original dots
        const rgb = dot.rgb;

        fill(
          rgb[0],
          rgb[1],
          rgb[2],
          210 * envelope
        );

        circle(
          cx + x * R,
          cy + y * R,
          dot.size * R * 0.70
        );
      }
    }

    pop();
  }

  // Connect to the team's existing p5.js lifecycle
  const originalSetup = window.setup;
  const originalDraw = window.draw;

  if (
    typeof originalSetup !== 'function' ||
    typeof originalDraw !== 'function'
  ) {
    console.error(
      'user-input.js must load AFTER sketch.js'
    );
    return;
  }

  window.setup = function (...args) {
    const result = originalSetup.apply(this, args);
    const canvas = document.querySelector('canvas');

    if (canvas) {
      canvas.style.cursor = 'crosshair';
      canvas.setAttribute('tabindex', '0');

      canvas.setAttribute(
        'aria-label',
        'Interactive flower garden. Click a flower to animate its particles.'
      );

      canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) {
          return;
        }

        const rect = canvas.getBoundingClientRect();

        trigger(
          (event.clientX - rect.left) / rect.width,
          (event.clientY - rect.top) / rect.height
        );
      });

      // Keyboard accessibility
      canvas.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();

          const flower = flowers()[0];

          if (flower) {
            trigger(flower.nx, flower.ny);
          }
        }
      });
    }

    makeControls();
    return result;
  };

  window.draw = function (...args) {
    const result = originalDraw.apply(this, args);
    display();
    return result;
  };
})();
