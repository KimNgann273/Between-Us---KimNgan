const Camera = {
  x: 0,
  y: 0,
  zoom: 1,
  target: { x: 0, y: 0, zoom: 1 },

  // Zoom at which the whole world fits on screen.
  fitZoom() {
    return Math.min(width / WORLD.w, height / WORLD.h) * 1;
  },

  // Zoom for looking closely at a single spore.
  closeZoom() {
    return this.fitZoom() * 5;
  },

  maxZoom() {
    return this.closeZoom() * 1.5;
  },

  snapTo(x, y, zoom) {
    this.x = this.target.x = x;
    this.y = this.target.y = y;
    this.zoom = this.target.zoom = zoom;
  },

  easeTo(x, y, zoom) {
    this.target.x = x;
    this.target.y = y;
    if (zoom !== undefined) this.target.zoom = zoom;
  },

  // Frame-rate independent easing. Zoom eases in log space so zooming in
  // and zooming out feel equally smooth.
  update(dt) {
    const k = 1 - Math.exp(-dt * 3);
    this.target.zoom = constrain(this.target.zoom, this.fitZoom(), this.maxZoom());
    this.x += (this.target.x - this.x) * k;
    this.y += (this.target.y - this.y) * k;
    this.zoom = Math.exp(lerp(Math.log(this.zoom), Math.log(this.target.zoom), k));
  },

  // Call inside push()/pop() before drawing anything in world units.
  apply() {
    translate(width / 2, height / 2);
    scale(this.zoom);
    translate(-this.x, -this.y);
  },

  screenToWorld(sx, sy) {
    return {
      x: (sx - width / 2) / this.zoom + this.x,
      y: (sy - height / 2) / this.zoom + this.y
    };
  },

  zoomBy(deltaY, anchor) {
    const before = this.target.zoom;
    const after = constrain(before * Math.exp(-deltaY * 0.0015), this.fitZoom(), this.maxZoom());
    if (anchor) {
      const ax = anchor.x - width / 2;
      const ay = anchor.y - height / 2;
      this.target.x += ax / before - ax / after;
      this.target.y += ay / before - ay / after;
    }
    this.target.zoom = after;
    this.clamp();
  },

  panBy(dxScreen, dyScreen) {
    this.target.x -= dxScreen / this.zoom;
    this.target.y -= dyScreen / this.zoom;
    this.clamp();
    this.x = this.target.x;
    this.y = this.target.y;
  },

  // Keeps the edge of the world at the edge of the screen. When the view is
  // wider than the world on an axis, that axis is pinned to the middle.
  clamp() {
    const limitX = Math.max(0, WORLD.w / 2 - width / (2 * this.zoom));
    const limitY = Math.max(0, WORLD.h / 2 - height / (2 * this.zoom));
    this.target.x = constrain(this.target.x, -limitX, limitX);
    this.target.y = constrain(this.target.y, -limitY, limitY);
  },

  zoomOutProgress() {
    const close = this.closeZoom();
    const fit = this.fitZoom();
    return constrain(Math.log(close / this.zoom) / Math.log(close / fit), 0, 1);
  },

  isFullyOut() {
    return this.zoom <= this.fitZoom() * 1.04;
  }
};
