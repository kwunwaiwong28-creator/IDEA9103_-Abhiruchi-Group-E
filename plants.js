const STEM_COLOURS = {
  green: { dark: [30, 92, 46],   mid: [70, 150, 72] },
  blue:  { dark: [40, 110, 170], mid: [126, 175, 219] }
};

class Stem {
  constructor(topX, topY, bottomX, bottomY, thicknessN, colourName = "green") {
    this.topX = topX;
    this.topY = topY;
    this.bottomX = bottomX;
    this.bottomY = bottomY;
    this.thicknessN = thicknessN;
    this.colours = STEM_COLOURS[colourName];

    this.textureSeed = topX * 1000 + bottomX * 100;
  }

  pointAt(f) {
    return {
      x: lerp(this.topX, this.bottomX, f),
      y: lerp(this.topY, this.bottomY, f)
    };
  }

  shade(across, dark, mid, pale, shadow) {
    let b = 0.5 + 0.5 * cos((across + 0.4) * PI * 0.7);
    if (b > 0.75) {
      let k = (b - 0.75) / 0.25;
      return [lerp(mid[0], pale[0], k), lerp(mid[1], pale[1], k), lerp(mid[2], pale[2], k)];
    }
    let k = b / 0.75;
    return [lerp(shadow[0], mid[0], k), lerp(shadow[1], mid[1], k), lerp(shadow[2], mid[2], k)];
  }

  draw() {
    let x1 = this.topX * width;
    let y1 = this.topY * height;
    let x2 = this.bottomX * width;
    let y2 = this.bottomY * height;
    let thick = this.thicknessN * width;

    let len = dist(x1, y1, x2, y2);
    let dx = (x2 - x1) / len;
    let dy = (y2 - y1) / len;
    let px = -dy;
    let py = dx;

    let dark = this.colours.dark;
    let mid = this.colours.mid;
    let pale = [lerp(mid[0], 255, 0.22), lerp(mid[1], 255, 0.22), lerp(mid[2], 255, 0.22)];
    let shadow = [dark[0] * 0.75, dark[1] * 0.75, dark[2] * 0.75];
    let seed = this.textureSeed;

    let steps = max(16, floor(len / 8));
    let centre = [];
    for (let i = 0; i <= steps; i++) {
      let f = i / steps;
      let d = f * len;
      let bend = map(noise(seed + f * 2.5), 0, 1, -1, 1) * thick * 0.15;
      let half = lerp(0.42, 0.55, f) * thick * map(noise(seed + 20 + f * 12), 0, 1, 0.93, 1.07);
      centre.push({ x: x1 + dx * d + px * bend, y: y1 + dy * d + py * bend, half: half, f: f });
    }

    noStroke();
    let strips = 9;
    for (let k = 0; k < strips; k++) {
      let a = -1 + (2 * k) / strips;
      let b = -1 + (2 * (k + 1)) / strips;
      let c = this.shade((a + b) / 2, dark, mid, pale, shadow);
      fill(c[0], c[1], c[2]);
      this.drawBand(centre, a, b, px, py);
    }

    for (let i = 0; i < steps; i += 3) {
      let next = min(i + 3, steps);
      let p = centre[i];
      let q = centre[next];
      let n = noise(seed + 60 + p.f * 7);
      let alpha = abs(n - 0.5) * 2 * 70 + p.f * p.f * 50;
      let c = n > 0.5 || p.f > 0.7 ? shadow : pale;
      fill(c[0], c[1], c[2], alpha);
      quad(
        p.x - px * p.half, p.y - py * p.half,
        p.x + px * p.half, p.y + py * p.half,
        q.x + px * q.half, q.y + py * q.half,
        q.x - px * q.half, q.y - py * q.half
      );
    }

    noFill();
    strokeWeight(max(0.8, thick * 0.03));
    let ridges = [-0.72, -0.48, -0.22, 0.04, 0.3, 0.55, 0.78];
    ridges.forEach((r, j) => {
      let c = j % 2 === 0 ? shadow : pale;
      stroke(c[0], c[1], c[2], j % 2 === 0 ? 80 : 60);
      beginShape();
      for (const p of centre) {
        let off = (r + map(noise(seed + 100 + j * 3.1 + p.f * 5), 0, 1, -1, 1) * 0.05) * p.half;
        vertex(p.x + px * off, p.y + py * off);
      }
      endShape();
    });

    strokeWeight(max(0.6, thick * 0.025));
    stroke(pale[0], pale[1], pale[2], 120);
    for (let i = 1; i < steps; i++) {
      let p = centre[i];
      for (const side of [-1, 1]) {
        let n = noise(seed + 300 + i * 0.37 + side * 5);
        if (n < 0.45) continue;
        let hair = thick * map(n, 0.45, 1, 0.08, 0.26);
        let ex = p.x + px * side * p.half;
        let ey = p.y + py * side * p.half;
        let hx = px * side * 0.6 - dx * 0.8;
        let hy = py * side * 0.6 - dy * 0.8;
        line(ex, ey, ex + hx * hair, ey + hy * hair);
      }
    }

    strokeWeight(max(1, thick * 0.05));
    let gap = thick * 1.6;
    let d = gap * map(noise(seed + 400), 0, 1, 0.5, 1);
    while (d < len) {
      let p = centre[round((d / len) * steps)];
      stroke(shadow[0], shadow[1], shadow[2], 150);
      beginShape();
      for (let u = 0; u <= 1.0001; u += 1 / 6) {
        let across = lerp(-0.85, 0.85, u) * p.half;
        let bulge = sin(PI * u) * thick * 0.1;
        vertex(p.x + px * across + dx * bulge, p.y + py * across + dy * bulge);
      }
      endShape();
      d += gap * map(noise(seed + 450 + d / len * 9), 0, 1, 0.7, 1.4);
    }
  }

  drawBand(centre, a, b, px, py) {
    beginShape();
    for (const c of centre) vertex(c.x + px * a * c.half, c.y + py * a * c.half);
    for (let i = centre.length - 1; i >= 0; i--) {
      let c = centre[i];
      vertex(c.x + px * b * c.half, c.y + py * b * c.half);
    }
    endShape(CLOSE);
  }
}
