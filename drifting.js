const AUTO_ZOOM_AFTER = 6;  // seconds of no scrolling (after the opening lines) before Drifting zooms out by itself
const DRIFT_RANGE = 60;     // how far the First Spore wanders from home, in world units
const LEAN_MAX = 30;        // how far it leans toward the cursor
const LEAN_FALLOFF = 120;   // world units over which the lean eases up to LEAN_MAX
const DRIFT_SPRING = 20;     // how eagerly the spore chases where it wants to be

const Drifting = {
  idle: 0,
  narrationDone: false,

  enter(firstVisit) {
    this.idle = 0;
    this.narrationDone = !firstVisit;
    Camera.easeTo(world.first.homeX, world.first.homeY, Camera.closeZoom());
    if (firstVisit) Caption.say(SCRIPT.drifting.enter, () => { this.narrationDone = true; });
  },

  update(dt) {
    const first = world.first;
    if (!first.germinated) driftFirstSpore(first, dt);

    // The camera slides from the First Spore to the middle of the world as it zooms out.
    const progress = Camera.zoomOutProgress();
    Camera.target.x = lerp(first.homeX, 0, progress);
    Camera.target.y = lerp(first.homeY, 0, progress);

    if (this.narrationDone) this.idle += dt;
    if (!journey.done[0] && this.idle > AUTO_ZOOM_AFTER) {
      Camera.target.zoom *= Math.exp(-dt * 0.2);
    }

    if (Camera.isFullyOut() && complete(Drifting)) {
      Caption.say(SCRIPT.drifting.zoomedOut);
    }
  },

  wheel(deltaY) {
    this.idle = 0;
    Camera.zoomBy(deltaY);
  }
};

function driftFirstSpore(spore, dt) {
  let leanX = 0;
  let leanY = 0;
  if (pointer.moved) {
    const cursor = Camera.screenToWorld(pointer.sx, pointer.sy);
    const dx = cursor.x - spore.homeX;
    const dy = cursor.y - spore.homeY;
    const distance = Math.hypot(dx, dy) || 1;
    // Eases up to LEAN_MAX instead of ramping and then hitting a hard cap, so
    // the pull has no corner in it as the cursor crosses that distance.
    const amount = LEAN_MAX * (1 - Math.exp(-distance / LEAN_FALLOFF));
    leanX = (dx / distance) * amount;
    leanY = (dy / distance) * amount;
  }
  const wanderX = (noise(clock * 0.12, 0) - 0.5) * 3 * DRIFT_RANGE;
  const wanderY = (noise(0, clock * 0.12 + 50) - 0.5) * 3 * DRIFT_RANGE;
  springToward(spore, spore.homeX + wanderX + leanX, spore.homeY + wanderY + leanY, dt, DRIFT_SPRING);
}
