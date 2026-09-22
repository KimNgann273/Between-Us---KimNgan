const PALETTE = {
  background: '#06070c',
  nutrientHue: 38            // warm amber, so the Nutrient stands apart from the teal-blue living things
};

const Glow = {
  sprites: new Map(),
  resolution: 256,
  falloff: 2.6,              // higher = tighter core and a longer, fainter tail
  hueStep: 6,                // degrees of hue per cached sprite
  satStep: 10,               // ...and percent of saturation

  build() {
    this.sprites.clear();
    this.ready = true;
  },

  _rgb(hue, saturation) {
    const h = ((hue % 360) + 360) % 360, s = saturation / 100;
    const k = (n) => (n + h / 60) % 6;
    const f = (n) => 255 * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
    return [f(5), f(3), f(1)];
  },

  _sprite(hue, saturation) {
    const h = Math.round(hue / this.hueStep) * this.hueStep;
    const s = Math.round(saturation / this.satStep) * this.satStep;
    const key = h * 1000 + s;
    let sprite = this.sprites.get(key);
    if (sprite) return sprite;

    const size = this.resolution;
    const [r, g, b] = this._rgb(h, s);
    sprite = createGraphics(size, size);
    sprite.pixelDensity(1);
    sprite.loadPixels();
    const radius = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - radius, y - radius) / radius;
        const i = 4 * (y * size + x);
        sprite.pixels[i] = r;
        sprite.pixels[i + 1] = g;
        sprite.pixels[i + 2] = b;
        sprite.pixels[i + 3] = d >= 1 ? 0 : Math.pow(1 - d, this.falloff) * 255;
      }
    }
    sprite.updatePixels();
    this.sprites.set(key, sprite);
    return sprite;
  },

  draw(x, y, diameter, hue, saturation, alpha) {
    if (!this.ready || alpha <= 0) return;
    push();
    imageMode(CENTER);
    tint(0, 0, 100, alpha);    // white: the cheap path through p5's tinting
    image(this._sprite(hue, saturation), x, y, diameter, diameter);
    pop();
  }
};

function renderWorld(world, time) {
  background(PALETTE.background);
  if (!world) return;

  push();
  Camera.apply();
  colorMode(HSB, 360, 100, 100, 1);
  Texture.ground(time);
  for (const spore of world.spores) {
    if (spore.hyphae.length) drawHyphae(spore);
  }

  noStroke();
  drawNutrient(world.nutrient, time);
  drawJunctions(world);
  for (const spore of world.spores) {
    if (!spore.isFirst) drawSpore(spore, time);
  }
  drawSpore(world.first, time); // always on top
  drawPulses(world);

  pop();
  Texture.overlay(time);
}

function drawHyphae(spore) {
  const saturation = spore.isFirst ? 85 : 55;
  const glow = spore.glow;
  const ox = spore.x - spore.homeX;
  const oy = spore.y - spore.homeY;
  strokeCap(ROUND);
  strokeJoin(ROUND);
  noFill();

  for (const hypha of spore.hyphae) {
    const vary = spore.isFirst ? 1 : spore.variation.weight;
    const weight = Math.max(0.6, 1 - hypha.tier * 0.5) * vary;
    stroke(spore.hue, saturation, 100, 0.12 * glow);
    strokeWeight(weight * 2);
    traceHypha(hypha, ox, oy);

    stroke(spore.hue, saturation * 0.8, 100, 0.8 * glow);
    strokeWeight(weight);
    traceHypha(hypha, ox, oy);

    if (hypha.growing) {
      const tip = hypha.tip();
      const w = flexWeight(hypha.lastPoint().d);
      noStroke();
      fill(spore.hue, saturation * 0.4, 100, 0.9 * glow);
      circle(tip.x + ox * w, tip.y + oy * w, weight * 2.2);
      noFill();
    }
  }
}

function traceHypha(hypha, ox, oy) {
  const flexing = Math.abs(ox) + Math.abs(oy) > 0.05;
  beginShape();
  for (const p of hypha.points) {
    if (flexing) {
      const w = flexWeight(p.d);
      vertex(p.x + ox * w, p.y + oy * w);
    } else {
      vertex(p.x, p.y);
    }
  }
  const tip = hypha.tip();
  const w = flexing ? flexWeight(hypha.lastPoint().d) : 0;
  vertex(tip.x + ox * w, tip.y + oy * w);
  endShape();
}

function drawSpore(spore, time) {
  const v = spore.variation;
  const glow = spore.glow;
  const wobble = spore.isFirst ? firstWobble(spore, time) : null;
  const breathe = wobble ? wobble.breathe : 1 + 0.08 * Math.sin(time * 1.6 + spore.offset);
  const x = spore.x + (wobble ? wobble.x : 0);
  const y = spore.y + (wobble ? wobble.y : 0);

  if (glow < 1) {
    const dim = 1 - glow;
    const body = 9 * v.size * breathe;
    Glow.draw(x, y, body * 6, 0, 0, 0.09 * dim);
    fill(0, 0, 100, 0.45 * dim);
    circle(x, y, body);
    if (glow <= 0) return;
  }

  const saturation = spore.isFirst ? 85 : 55;
  const base = spore.isFirst ? 22 : 14 * v.size;
  const size = base * breathe * (0.6 + 0.4 * glow) * (1 + 0.35 * spore.flash);
  const lit = wobble ? wobble.brightness : 1;
  Glow.draw(x, y, size * (spore.isFirst ? 7 : 5.5), spore.hue, saturation,
            0.2 * glow * lit * (1 + 1.6 * spore.flash));

  if (wobble && WOBBLE.squish > 0) {
    drawWobblyBody(spore, x, y, size, saturation, glow, time, wobble);
    return;
  }

  fill(spore.hue, saturation, 100, 0.9 * glow);
  circle(x, y, size);
  fill(spore.hue, saturation * 0.3, 100, 0.9 * glow);
  circle(x, y, size * 0.45);
}

function drawWobblyBody(spore, x, y, size, saturation, glow, time, wobble) {
  push();
  translate(x, y);
  rotate(Math.sin(time * 0.05 * WOBBLE.speed) * WOBBLE.rock);
  translate(-x, -y);

  const body = WOBBLE_LAYERS[WOBBLE_LAYERS.length - 1];
  fill(spore.hue, saturation, 100, WOBBLE_AURA.alpha * glow);
  for (let ring = WOBBLE_AURA.rings; ring >= 1; ring--) {
    const spread = 1 + (WOBBLE_AURA.to - 1) * (ring / WOBBLE_AURA.rings);
    blob(x, y, (size / 2) * spread, body.freq, time * body.rate * WOBBLE.speed,
         WOBBLE.squish * WOBBLE_AURA.amp);
  }

  for (const layer of WOBBLE_LAYERS) {
    fill(spore.hue, saturation * layer.saturation, 100, layer.alpha * glow);
    blob(x, y, (size / 2) * layer.radius,
         layer.freq, time * layer.rate * WOBBLE.speed + layer.offset,
         WOBBLE.squish * layer.amp);
  }
  Glow.draw(x + wobble.x * 0.6 - size * 0.13, y + wobble.y * 0.6 - size * 0.15,
            size * 0.95, spore.hue, saturation * 0.15, 0.62 * glow);
  pop();
}

const NOISE_ORIGIN = 50; // keeps every sample positive: p5 mirrors noise across 0, which would crease the outline too
function loopNoise(angle, freq, phase) {
  const cx = Math.cos(angle);
  const cy = Math.sin(angle);
  const broad = noise(cx * freq + phase + NOISE_ORIGIN,
                      cy * freq + phase + NOISE_ORIGIN) * 2 - 1;
  const fine = (noise(cx * freq * 2.3 + phase * 1.7 + NOISE_ORIGIN + 40,
                      cy * freq * 2.3 + phase * 1.7 + NOISE_ORIGIN + 40) * 2 - 1) * 0.5;
  return (broad + fine) / 1.5;
}

function blob(x, y, radius, freq, phase, amp) {
  const steps = WOBBLE.steps;
  const points = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const r = radius * (1 + amp * loopNoise(angle, freq, phase));
    points.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r });
  }

  const last = points[steps - 1];
  beginShape();
  vertex((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
  for (let i = 0; i < steps; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % steps];
    quadraticVertex(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  }
  endShape(CLOSE);
}

const WOBBLE = {
  drift: 3.5,       // world units it wanders off centre. Keep this well under the
                    // body's radius (11 at rest): past that the body slides out
                    // from over the hyphae, which are drawn from its home position.
  swell: 0.16,      // how much the body size varies, either side of 1
  brightness: 0.3,  // how much the glow brightens and dims
  speed: 0.3,         // pace of every stream at once
  squish: 0.28,     // how far the outline travels off a circle. 0 = a plain circle again
  rock: 0.15,       // radians the whole body rocks back and forth
  steps: 72         // points around the outline (the prototype uses 160, at six times the size)
};

const WOBBLE_LAYERS = [
  { radius: 0.94, freq: 1.2, rate: 0.8, offset: 12, amp: 0.85, alpha: 0.3,  saturation: 0.7 },
  { radius: 1,    freq: 0.9, rate: 1,   offset: 0,  amp: 1,    alpha: 0.92, saturation: 1 }
];

const WOBBLE_AURA = { rings: 7, to: 1.38, alpha: 0.05, amp: 0.8 };

function firstWobble(spore, time) {
  const swell = noise(spore.offset, time * 0.35 * WOBBLE.speed);
  const lit = noise(spore.offset + 40, time * 0.5 * WOBBLE.speed);
  const swayX = noise(spore.offset + 80, time * 0.6 * WOBBLE.speed);
  const swayY = noise(spore.offset + 120, time * 0.55 * WOBBLE.speed);
  return {
    breathe: 1 + WOBBLE.swell * (swell - 0.5) * 2,
    brightness: 1 - WOBBLE.brightness / 2 + WOBBLE.brightness * lit,
    x: (swayX - 0.5) * 2 * WOBBLE.drift,
    y: (swayY - 0.5) * 2 * WOBBLE.drift
  };
}

const NUTRIENT = {
  grains: 14,
  spread: 0.52,        // how far across the radius the grains scatter
  grainSize: 0.19,     // ...and how big each one is, against that same radius
  halo: 4.2,           // the glow over the whole cluster, as a multiple of it
  jitter: 0.34,        // how far off the even spiral each grain sits
  dim: 0.45,           // how much grain-to-grain brightness varies
  twinkle: 0.12,       // per-grain brightness wobble
  twinkleRate: 2.3
};

function scatterAt(x, y) {
  let seed = (Math.floor(Math.abs(x) * 73856093) ^ Math.floor(Math.abs(y) * 19349663)) % 2147483647;
  if (seed <= 0) seed += 2147483646;
  return () => (seed = (seed * 48271) % 2147483647) / 2147483647;
}

function drawNutrient(nutrient, time) {
  if (!nutrient || nutrient.amount <= 0) return;
  push();
  noStroke();

  const amount = nutrient.amount;
  const cluster = nutrient.radius * NUTRIENT.spread;
  const grain = nutrient.radius * NUTRIENT.grainSize;

  Glow.draw(nutrient.x, nutrient.y, cluster * NUTRIENT.halo,
            PALETTE.nutrientHue, 70, 0.38 * (0.35 + 0.65 * amount));

  const next = scatterAt(nutrient.x, nutrient.y);
  for (let i = 0; i < NUTRIENT.grains; i++) {
    const t = (i + 0.5) / NUTRIENT.grains;
    const radius = cluster * Math.sqrt(t);
    const angle = i * 2.39996 + (next() - 0.5) * NUTRIENT.jitter;
    const wide = 1 + (next() - 0.5) * NUTRIENT.jitter;
    const depth = 1 - NUTRIENT.dim * next();   // some grains sit further down
    const scale = 0.7 + 0.6 * next();
    const lit = constrain((amount - t) * NUTRIENT.grains, 0, 1);
    if (lit <= 0) continue;

    const gx = nutrient.x + Math.cos(angle) * radius * wide;
    const gy = nutrient.y + Math.sin(angle) * radius * wide;
    const catches = 1 + NUTRIENT.twinkle * Math.sin(time * NUTRIENT.twinkleRate + i * 1.7);
    const size = grain * scale * catches;

    Glow.draw(gx, gy, size * 4, PALETTE.nutrientHue, 80, 0.13 * lit * depth);
    fill(PALETTE.nutrientHue, 62, 100, 0.9 * lit * depth);
    circle(gx, gy, size);
  }
  pop();
}

const JUNCTION = {
  core: 4.4,
  seam: 2.5,           // the resting ring, as a multiple of the core
  seamWeight: 1.0,
  ripple: 1.8,         // how far the ring opens when a pulse crosses
  halo: 6
};

function drawJunctions(world) {
  push();
  strokeCap(ROUND);
  for (const junction of world.junctions) {
    const p = junctionPosition(junction);
    const flash = junction.flash;
    const core = JUNCTION.core * (1 + 0.45 * flash);

    noStroke();
    Glow.draw(p.x, p.y, core * JUNCTION.halo * (1 + 0.45 * flash),
              junction.hue, 40, 0.15 + 0.34 * flash);

    // The seam at rest.
    noFill();
    stroke(junction.hue, 38, 100, 0.42 + 0.30 * flash);
    strokeWeight(JUNCTION.seamWeight);
    circle(p.x, p.y, core * JUNCTION.seam);

    if (flash > 0) {
      const opened = 1 - flash;
      stroke(junction.hue, 25, 100, 0.55 * flash);
      strokeWeight(JUNCTION.seamWeight * (0.4 + 0.6 * flash));
      circle(p.x, p.y, core * JUNCTION.seam * (1 + JUNCTION.ripple * opened));
    }

    // The fused point.
    noStroke();
    fill(junction.hue, 22, 100, 0.95);
    circle(p.x, p.y, core);
  }
  pop();
}

const PULSE = {
  tail: 58,            // world units of tail behind the head
  samples: 10,
  head: 5.5,
  halo: 5,
  passes: [
    { reach: 1.00, weight: 5.0, saturation: 50, alpha: 0.18 },   // the envelope
    { reach: 1.00, weight: 1.8, saturation: 28, alpha: 0.45 },
    { reach: 0.66, weight: 2.3, saturation: 20, alpha: 0.55 },
    { reach: 0.38, weight: 2.9, saturation: 12, alpha: 0.72 },
    { reach: 0.15, weight: 3.8, saturation: 4,  alpha: 0.95 }
  ]
};

function drawPulses(world) {
  push();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  noFill();

  for (const pulse of world.pulses) {
    if (pulse.delay > 0 || pulse.at <= 0) continue;
    const trace = [];
    for (let i = 0; i <= PULSE.samples; i++) {
      const at = pulse.at - (i / PULSE.samples) * PULSE.tail;
      if (at < 0) break;
      trace.push(flexed(pointAlong(pulse, at)));
    }

    if (trace.length > 1) {
      for (const pass of PULSE.passes) {
        // trace[0] is the head, so the pass covers its first `reach` of the tail.
        const span = Math.min(trace.length, Math.round(pass.reach * PULSE.samples) + 1);
        if (span < 2) continue;
        stroke(pulse.hue, pass.saturation, 100, pass.alpha);
        strokeWeight(pass.weight);
        beginShape();
        for (let i = span - 1; i >= 0; i--) vertex(trace[i].x, trace[i].y);
        endShape();
      }
    }

    const head = trace.length ? trace[0] : flexed(pointAlong(pulse, pulse.at));
    noStroke();
    Glow.draw(head.x, head.y, PULSE.head * PULSE.halo, pulse.hue, 45, 0.55);
    fill(pulse.hue, 10, 100, 0.95);
    circle(head.x, head.y, PULSE.head);
    noFill();
  }
  pop();
}
