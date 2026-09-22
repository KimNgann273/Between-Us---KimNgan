const HOME_ZOOM_SCALE = 0.8;   
const HOME_SPORE_Y = 0.33;     
const LEAVE_MS = 1400;         

const CROSS_GAP = 34;          
const CROSS_ARM = 40;
const CROSS_BREATH = 3.5;
const BRACKET = 104;        
const BRACKET_ARM = 26;
const DOT_STEP = 4.6;        
const DOT_JITTER = 1.7;

// Its own generator, so the stipple never touches p5's random stream — the
// world's layout is seeded from that and has to stay identical (ADR 0002).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Landing = {
  hover: false,
  jitter: [],     
  lastTel: 0,

  init() {
    const rand = mulberry32(0x5EED);
    for (let i = 0; i < 512; i++) {
      this.jitter.push({
        off: (rand() - 0.5) * 2 * DOT_JITTER,
        along: (rand() - 0.5) * 2.2,
        size: 0.55 + rand() * 0.85,
        alpha: 0.45 + rand() * 0.55
      });
    }
    const button = document.getElementById('beginBtn');
    button.addEventListener('pointerenter', () => { this.hover = true; });
    button.addEventListener('pointerleave', () => { this.hover = false; });
  },

  
  framing() {
    const zoom = Camera.closeZoom() * HOME_ZOOM_SCALE;
    return {
      x: world.first.homeX,
      y: world.first.homeY - (HOME_SPORE_Y - 0.5) * height / zoom,
      zoom
    };
  },


  draw(time) {
    const spore = world.first;
    const sx = (spore.x - Camera.x) * Camera.zoom + width / 2;
    const sy = (spore.y - Camera.y) * Camera.zoom + height / 2;
    const breath = Math.sin(time * 0.55) * CROSS_BREATH;
    push();
    colorMode(RGB, 255);
    noStroke();
    let index = 0;
    const dot = (x, y, nx, ny, alpha) => {
      const j = this.jitter[index++ % this.jitter.length];
      fill(200, 226, 212, alpha * j.alpha * 255);
      circle(x + nx * j.off + ny * j.along, y + ny * j.off - nx * j.along, j.size * 2);
    };

    const run = (x0, y0, x1, y1, alpha) => {
      const dx = x1 - x0, dy = y1 - y0;
      const length = Math.hypot(dx, dy);
      const ux = dx / length, uy = dy / length;
      const steps = Math.max(2, Math.round(length / DOT_STEP));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        dot(x0 + dx * t, y0 + dy * t, -uy, ux, alpha);
      }
    };

   
    const gap = CROSS_GAP + breath;
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2;
      const cx = Math.cos(ang), cy = Math.sin(ang);
      run(sx + cx * gap, sy + cy * gap, sx + cx * (gap + CROSS_ARM), sy + cy * (gap + CROSS_ARM), 0.5);
    }

  
    for (const [ox, oy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const bx = sx + ox * BRACKET, by = sy + oy * BRACKET;
      run(bx, by, bx - ox * BRACKET_ARM, by, 0.34);
      run(bx, by, bx, by - oy * BRACKET_ARM, 0.34);
    }


    const rect = document.getElementById('beginBtn').getBoundingClientRect();
    if (rect.width) {
      const p = 4;
      const x0 = rect.left - p, y0 = rect.top - p;
      const x1 = rect.right + p, y1 = rect.bottom + p;
      const alpha = this.hover ? 0.85 : 0.5;
      run(x0, y0, x1, y0, alpha);
      run(x1, y0, x1, y1, alpha);
      run(x1, y1, x0, y1, alpha);
      run(x0, y1, x0, y0, alpha);
    }
    pop();

    if (time - this.lastTel > 0.1) {
      this.lastTel = time;
      this.telemetry(time);
    }
  },




  telemetry(time) {
    const pad = (n, width, places) => {
      const s = Math.abs(n).toFixed(places);
      return (n < 0 ? '-' : '+') + s.padStart(width, '0');
    };
    const germinated = world.spores.filter((s) => s.germinated).length;
    const show = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    show('telCam',
      `CAM ${pad(Camera.x, 7, 1)} , ${pad(Camera.y, 7, 1)}   Z ${Camera.zoom.toFixed(3)}`);
    show('telWorld',
      `SPORES ${String(world.spores.length).padStart(2, '0')}   ` +
      `GERMINATED ${String(germinated).padStart(2, '0')}   ` +
      `JUNCTIONS ${String(world.junctions.length).padStart(2, '0')}`);
    show('telState',
      `STATE ${world.first.germinated ? 'GERMINATED' : 'DORMANT'}   T ${time.toFixed(1).padStart(5, '0')}`);
  }
};
