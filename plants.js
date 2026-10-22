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
  }

  pointAt(f) {
    return {
      x: lerp(this.topX, this.bottomX, f),
      y: lerp(this.topY, this.bottomY, f)
    };
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

    noStroke();

    fill(dark[0], dark[1], dark[2]);
    this.drawTaper(x1, y1, x2, y2, px, py, thick * 0.42, thick * 0.55);

    fill(mid[0], mid[1], mid[2]);
    this.drawTaper(x1, y1, x2, y2, px, py, thick * 0.26, thick * 0.34);

    stroke(dark[0], dark[1], dark[2]);
    strokeWeight(max(1, thick * 0.07));
    let gap = thick * 0.9;
    for (let d = gap; d < len; d += gap) {
      let cx = x1 + dx * d;
      let cy = y1 + dy * d;
      let half = lerp(thick * 0.26, thick * 0.34, d / len);
      line(cx - px * half, cy - py * half, cx + px * half, cy + py * half);
    }
  }

  drawTaper(x1, y1, x2, y2, px, py, topHalf, bottomHalf) {
    quad(
      x1 - px * topHalf, y1 - py * topHalf,
      x1 + px * topHalf, y1 + py * topHalf,
      x2 + px * bottomHalf, y2 + py * bottomHalf,
      x2 - px * bottomHalf, y2 - py * bottomHalf
    );
  }
}
