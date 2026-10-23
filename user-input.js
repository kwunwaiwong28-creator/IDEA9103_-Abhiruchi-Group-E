/*
 * User input — HANGJING YE
 * Click or tap to send a gentle breeze through the garden.
 * Developed with assistance from ChatGPT (OpenAI).
 */

class GardenBreeze {
  constructor() {
    this.pulses = [];
    this.lastInput = -Infinity;

    this.motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
  }

  trigger(x, y, now = millis()) {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 || x > 1 ||
      y < 0 || y > 1 ||
      now - this.lastInput < 250
    ) {
      return false;
    }

    this.update(now);
    this.lastInput = now;

    // Limit overlapping waves to keep the movement quiet.
    if (this.pulses.length >= 3) {
      return false;
    }

    this.pulses.push({
      x,
      y,
      start: now,
      direction: x < 0.5 ? 1 : -1
    });

    return true;
  }

  update(now = millis()) {
    this.pulses = this.pulses.filter(
      pulse => now - pulse.start < 5200
    );
  }

  strengthAt(x, y, now = millis()) {
    let total = 0;

    for (const pulse of this.pulses) {
      const distance = Math.hypot(
        x - pulse.x,
        y - pulse.y
      );

      // The breeze reaches nearby plants first.
      const age = (
        now - pulse.start - distance * 900
      ) / 3600;

      if (age <= 0 || age >= 1) continue;

      // Smoothly rise from rest and return to rest.
      const envelope = Math.sin(Math.PI * age) ** 2;

      total +=
        pulse.direction *
        Math.cos(age * Math.PI * 3) *
        envelope /
        (1 + distance * 1.5);
    }

    const motionScale = this.motionPreference.matches
      ? 0.2
      : 1;

    return Math.tanh(total) * motionScale;
  }

  drawFlower(flower, render) {
    // Maximum rotation is approximately 1.4 degrees.
    const angle =
      this.strengthAt(flower.nx, flower.ny) * 0.025;

    const cx = flower.nx * width;
    const cy = flower.ny * height;

    push();
    translate(cx, cy);
    rotate(angle);
    translate(-cx, -cy);

    try {
      render();
    } finally {
      pop();
    }
  }

  attach(canvas) {
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");

    canvas.setAttribute(
      "aria-label",
      "Animated sunflower garden. Click or tap for a gentle " +
      "breeze. With the garden focused, press Enter or Space " +
      "for a breeze from the centre."
    );

    canvas.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;

      const rect = canvas.getBoundingClientRect();

      this.trigger(
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height
      );
    });

    canvas.addEventListener("keydown", event => {
      if (
        (event.key === "Enter" || event.key === " ") &&
        !event.repeat
      ) {
        event.preventDefault();
        this.trigger(0.5, 0.5);
      }
    });
  }
}
