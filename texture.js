const TEXTURE = {
  grain: 0.055,        // strength of the film grain over the whole picture
  grainTiles: 3,       // how many noise tiles are cycled
  grainSize: 512,      // tile size in pixels; the tiles are repeated to fill the screen
  grainFps: 24,        // the grain swaps this often, not once per frame: film, not static
  soil: 0.55,          // strength of the mottled soil behind the world
  soilRes: 5,          // world units per soil pixel (bigger = coarser and cheaper)
  soilBleed: 1.12,     // how far the soil runs past the world edge, so no hard border shows
  vignette: 0.5,       // how dark the corners go
  motes: 90,           // specks of dust drifting in the soil
  moteDrift: 26        // world units a mote wanders from where it sits
};

const Texture = {
  grainTiles: [],
  soil: null,
  vignette: null,
  motes: [],
  build() {
    if (TEXTURE.grain > 0 && !this.grainTiles.length) this.buildGrain();
    if (TEXTURE.soil > 0 && !this.soil) this.buildSoil();
    if (TEXTURE.motes > 0 && !this.motes.length) this.buildMotes();
    this.buildVignette();
  },

  // ---- generated once ----------------------------------------------------
  buildGrain() {
    for (let t = 0; t < TEXTURE.grainTiles; t++) {
      const tile = createGraphics(TEXTURE.grainSize, TEXTURE.grainSize);
      tile.pixelDensity(1);
      tile.loadPixels();
      for (let i = 0; i < tile.pixels.length; i += 4) {
        const v = Math.random();
        tile.pixels[i] = tile.pixels[i + 1] = tile.pixels[i + 2] = 255;
        tile.pixels[i + 3] = v * v * 255;
      }
      tile.updatePixels();
      this.grainTiles.push(tile);
    }
  },

  buildSoil() {
    const w = Math.round(WORLD.w * TEXTURE.soilBleed / TEXTURE.soilRes);
    const h = Math.round(WORLD.h * TEXTURE.soilBleed / TEXTURE.soilRes);
    const layer = createGraphics(w, h);
    layer.pixelDensity(1);

    noiseSeed(WORLD.seed);      // same ground every visit, like the spore layout
    noiseDetail(4, 0.55);
    layer.loadPixels();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const broad = noise(x * 0.012, y * 0.012);
        const fine = noise(x * 0.06 + 100, y * 0.06 + 100);
        const v = Math.pow(broad * 0.75 + fine * 0.25, 1.7);
        const i = 4 * (y * w + x);
        layer.pixels[i] = 14 + v * 22;          // a cold slate, a touch of teal
        layer.pixels[i + 1] = 26 + v * 44;
        layer.pixels[i + 2] = 34 + v * 50;
        layer.pixels[i + 3] = 255 * v * TEXTURE.soil * edgeFade(x, y, w, h);
      }
    }
    layer.updatePixels();
    noiseDetail(4, 0.5);        // back to p5's default, which the phases use
    this.soil = layer;
  },

  buildMotes() {
    for (let i = 0; i < TEXTURE.motes; i++) {
      this.motes.push({
        x: (Math.random() - 0.5) * WORLD.w,
        y: (Math.random() - 0.5) * WORLD.h,
        size: 0.8 + Math.random() * 1.6,
        alpha: 0.08 + Math.random() * 0.2,
        offset: Math.random() * 1000
      });
    }
  },

  buildVignette() {
    if (TEXTURE.vignette <= 0) return;
    if (this.vignette) this.vignette.remove();
    const layer = createGraphics(width, height);
    const ctx = layer.drawingContext;
    const cx = width / 2;
    const cy = height / 2;
    const gradient = ctx.createRadialGradient(
      cx, cy, Math.min(width, height) * 0.3,
      cx, cy, Math.hypot(width, height) * 0.62
    );
    gradient.addColorStop(0, 'rgba(2, 3, 6, 0)');
    gradient.addColorStop(1, `rgba(2, 3, 6, ${TEXTURE.vignette})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    this.vignette = layer;
  },

  // ---- drawn each frame --------------------------------------------------
  ground(time) {
    if (this.soil) {
      const w = WORLD.w * TEXTURE.soilBleed;
      const h = WORLD.h * TEXTURE.soilBleed;
      image(this.soil, -w / 2, -h / 2, w, h);
    }
    if (!this.motes.length) return;
    push();
    colorMode(RGB, 255);
    noStroke();
    for (const mote of this.motes) {
      const dx = (noise(mote.offset, time * 0.05) - 0.5) * 2 * TEXTURE.moteDrift;
      const dy = (noise(mote.offset + 50, time * 0.05) - 0.5) * 2 * TEXTURE.moteDrift;
      const twinkle = 0.6 + 0.4 * Math.sin(time * 0.7 + mote.offset);
      fill(190, 205, 215, 255 * mote.alpha * twinkle);
      circle(mote.x + dx, mote.y + dy, mote.size);
    }
    pop();
  },


  overlay(time) {
    if (this.vignette) image(this.vignette, 0, 0, width, height);
    if (!this.grainTiles.length) return;
    const step = Math.floor(time * TEXTURE.grainFps);
    const tile = this.grainTiles[step % this.grainTiles.length];
    const size = TEXTURE.grainSize;
    const ox = -((step * 37) % size);
    const oy = -((step * 53) % size);
    push();
    tint(255, 255 * TEXTURE.grain);
    for (let y = oy; y < height; y += size) {
      for (let x = ox; x < width; x += size) image(tile, x, y);
    }
    pop();
  }
};

function edgeFade(x, y, w, h) {
  const margin = Math.min(w, h) * 0.12;
  const near = Math.min(x, y, w - 1 - x, h - 1 - y);
  const t = constrain(near / margin, 0, 1);
  return t * t * (3 - 2 * t);   // smoothstep
}
