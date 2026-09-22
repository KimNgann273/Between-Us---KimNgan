

const GIVING = {
  firstReachDelay: 3,       // seconds into Giving before the First Spore starts reaching
  firstReachers: 3,         // hyphae the First Spore sends toward the nearest struggling spores
  reachersPerSpore: 2,      // how many each newly joined spore sends on in turn
  reachDistance: 560,       // how far away a spore will reach for another
  strandSpeed: 3.2,         // strands in a Cord grow this many times faster than normal
  reachPull: 3.5,           // how firmly they steer toward the spore they want, once close
  strandSpread: 0.22,       // radians between the headings strands leave on
  reachCommit: 5,           // how late a strand commits to its spore: higher = wanders longer, and strays more
  cordSettle: 3,            // seconds after a Cord arrives before any strand still out stops
  joinRadius: 14,           // a strand's tip this close to its spore joins it
  handOnDelay: 1.6,         // seconds a newly joined spore glows before it reaches on
  joinedHyphae: 5,          // the short hyphae a joined spore grows of its own (× its variation)
  joinedReach: 90,          //   ...and how far they go (short, so the screen stays readable)
  joinedBudget: 900,
 
  reachedBands: [
    { upTo: 2, hue: [150, 175] },         // generations 1-2: green
    { upTo: 3, hue: [200, 225] },         // generation 3:    blue
    { upTo: Infinity, hue: [255, 275] }   // generation 4 on:  purple
  ],
  doneFraction: 0.8,        // share of all spores joined before Giving counts as done.
                            // High enough that all three colours are on screen by then;
                            // the spread carries on afterwards either way
  autoZoomAfter: 8,         // seconds without scrolling before the camera zooms out by itself
  flexReach: 160,           // how far along a hypha a pulled spore's movement carries
  flexCoupling: 0.6,        // each junction further from the pulled spore moves this share as far
  flexSpring: 9,
  holdSpring: 14,
  pullMax: 150,             
  pullNotice: 40            
};

// ---- the phase -----------------------------------------------------------------

const Giving = {
  pannable: true,

  enter(firstVisit) {
    const s = givingState();
    s.idle = 0;
    if (firstVisit) Caption.say(SCRIPT.giving.enter);
  },

  update(dt) {
    const s = givingState();
    s.time += dt;
    s.idle += dt;

    if (!s.zoomedByHand && s.idle > GIVING.autoZoomAfter && !Camera.isFullyOut()) {
      Camera.target.zoom *= Math.exp(-dt * 0.25);
    }

    spread(s);
    flex(s, dt);

    const needed = Math.ceil(world.spores.length * GIVING.doneFraction);
    if (s.joined.size >= needed && complete(Giving)) Caption.say(SCRIPT.giving.done);
  },

  wheel(deltaY, at) {
    givingState().zoomedByHand = true;
    Camera.zoomBy(deltaY, at);
  },

  grab(point) {
    const s = givingState();
    let best = null;
    let bestGap = Infinity;
    for (const spore of s.joined) {
      const gap = Math.hypot(point.x - spore.x, point.y - spore.y);
      if (hitsSpore(point, spore) && gap < bestGap) {
        best = spore;
        bestGap = gap;
      }
    }
    if (!best) return false;
    s.held = best;
    s.hold = point;
    return true;
  },

  dragTo(point) {
    const s = givingState();
    if (!s.held) return;
    s.hold = point;
    const pull = Math.hypot(point.x - s.held.homeX, point.y - s.held.homeY);
    if (!s.pulled && pull > GIVING.pullNotice) {
      s.pulled = true;
      Caption.say(SCRIPT.giving.firstPull);
    }
  },

  release(point, dragged) {
    const s = givingState();
    if (s.held && !dragged) pulseFrom(s.held);
    s.held = null;
  }
};

function givingState() {
  if (world.giving) return world.giving;
  const joined = connectedTo(world.first);
  const s = {
    joined,               
    quota: new Map(),     
    readyAt: new Map(),   
    targeted: new Set(),  
    cords: [],     
    time: 0, idle: 0, zoomedByHand: false,
    held: null, hold: null, pulled: false,
    firstJoin: false, handedOn: false
  };
  for (const spore of joined) {
    s.quota.set(spore, spore === world.first ? GIVING.firstReachers : GIVING.reachersPerSpore);
    s.readyAt.set(spore, GIVING.firstReachDelay);
  }
  return (world.giving = s);
}

// ---- spreading -----------------------------------------------------------------

function spread(s) {
  for (const spore of s.joined) {
    let left = s.quota.get(spore) || 0;
    if (left <= 0 || s.time < s.readyAt.get(spore)) continue;
    while (left > 0) {
      const target = nearestStruggling(s, spore);
      if (!target) break;
      sendCord(s, spore, target);
      left--;
    }
    s.quota.set(spore, left);
    if (left > 0) s.readyAt.set(spore, s.time + 1);
  }


  s.cords = s.cords.filter((cord) => {
    for (const strand of cord.strands) {
      if (!strand.growing) continue;
      const tip = strand.tip();
      if (Math.hypot(tip.x - cord.target.homeX, tip.y - cord.target.homeY) >= GIVING.joinRadius) continue;
      if (cord.joined) {
        stopHypha(strand, 'bundled');
      } else {
        joinNetwork(s, cord, strand);
        cord.joined = s.time;
      }
    }

    if (cord.joined && s.time - cord.joined > GIVING.cordSettle) {
      for (const strand of cord.strands) stopHypha(strand, 'bundled');
    }

    if (cord.strands.some((strand) => strand.growing)) return true;
    if (!cord.joined) {
      s.targeted.delete(cord.target);
      s.quota.set(cord.from, (s.quota.get(cord.from) || 0) + 1);
    }
    return false;
  });
}

function nearestStruggling(s, from) {
  let best = null;
  let bestGap = GIVING.reachDistance;
  for (const spore of world.spores) {
    if (!spore.dormant || s.targeted.has(spore)) continue;
    const gap = Math.hypot(spore.homeX - from.homeX, spore.homeY - from.homeY);
    if (gap < bestGap) {
      best = spore;
      bestGap = gap;
    }
  }
  return best;
}

function sendCord(s, from, target) {
  const heading = Math.atan2(target.homeY - from.homeY, target.homeX - from.homeX);
  const count = target.variation.strands < 0.5 ? 2 : 3;
  const strands = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * GIVING.strandSpread;
    const strand = new Hypha(from.homeX, from.homeY, heading + offset, 0, from);
    strand.target = target;
    strand.lure = { x: target.homeX, y: target.homeY };
    strand.lureStrength = GIVING.reachPull;
    strand.lureRamp = { near: GIVING.joinRadius * 4, far: GIVING.reachDistance, power: GIVING.reachCommit };
    strand.maxReach = Infinity;
    strand.speed *= GIVING.strandSpeed;
    from.hyphae.push(strand);
    strands.push(strand);
  }
  s.targeted.add(target);
  s.cords.push({ strands, from, target, joined: 0 });
}


function reachedHue(generation, tint) {
  const band = GIVING.reachedBands.find((b) => generation <= b.upTo);
  return band.hue[0] + tint * (band.hue[1] - band.hue[0]);
}

function joinNetwork(s, cord, arriving) {
  const { from, target } = cord;
  stopHypha(arriving, 'joined');
  addJunction(world, from, target, arriving, arriving.points.length - 1, null, 0, target.homeX, target.homeY);

  const v = target.variation;
  target.generation = from.generation + 1;
  target.hue = reachedHue(target.generation, v.tint);
  target.reachLimit = GIVING.joinedReach * v.reach;
  target.budget = GIVING.joinedBudget * v.reach;
  target.germinate({ count: Math.max(3, Math.round(GIVING.joinedHyphae * v.count)) });
  for (const hypha of target.hyphae) hypha.wanderScale = v.curl;
  s.joined.add(target);
  s.quota.set(target, GIVING.reachersPerSpore);
  s.readyAt.set(target, s.time + GIVING.handOnDelay);

  if (!s.firstJoin) {
    s.firstJoin = true;
    Caption.say(SCRIPT.giving.firstJoin);
  } else if (!s.handedOn && from !== world.first && from !== world.neighbour) {
    // The first time a spore you helped goes on to help another.
    s.handedOn = true;
    Caption.say(SCRIPT.giving.handedOn);
  }
}

// ---- the network -----------------------------------------------------------------

function junctionsBySpore(world) {
  const bySpore = new Map();
  for (const j of world.junctions) {
    for (const spore of [j.a, j.b]) {
      if (!bySpore.has(spore)) bySpore.set(spore, []);
      bySpore.get(spore).push(j);
    }
  }
  return bySpore;
}

function connectedTo(start) {
  const bySpore = junctionsBySpore(world);
  const found = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const spore = queue.shift();
    for (const j of bySpore.get(spore) || []) {
      const other = j.a === spore ? j.b : j.a;
      if (!found.has(other)) {
        found.add(other);
        queue.push(other);
      }
    }
  }
  return found;
}

function flex(s, dt) {
  const pull = new Map(); 
  if (s.held) {
    const dx = s.hold.x - s.held.homeX;
    const dy = s.hold.y - s.held.homeY;
    const len = Math.hypot(dx, dy) || 1;
    const reach = GIVING.pullMax * Math.tanh(len / GIVING.pullMax); // gives less the harder you pull
    const ox = (dx / len) * reach;
    const oy = (dy / len) * reach;

    const bySpore = junctionsBySpore(world);
    pull.set(s.held, { x: ox, y: oy });
    const queue = [s.held];
    while (queue.length) {
      const spore = queue.shift();
      const here = pull.get(spore);
      for (const j of bySpore.get(spore) || []) {
        const other = j.a === spore ? j.b : j.a;
        if (pull.has(other)) continue;
        pull.set(other, { x: here.x * GIVING.flexCoupling, y: here.y * GIVING.flexCoupling });
        queue.push(other);
      }
    }
  }

  for (const spore of s.joined) {
    const offset = pull.get(spore);
    const stiffness = spore === s.held ? GIVING.holdSpring : GIVING.flexSpring;
    springToward(spore, spore.homeX + (offset ? offset.x : 0), spore.homeY + (offset ? offset.y : 0), dt, stiffness);
  }
}


function pulseFrom(origin) {
  const bySpore = junctionsBySpore(world);
  const reached = new Set([origin]);
  origin.flash = 1;
  const carry = (from) => {
    for (const junction of bySpore.get(from) || []) {
      const to = junction.a === from ? junction.b : junction.a;
      if (reached.has(to)) continue;
      reached.add(to);
      sendPulse(world, pathThrough(junction, from), { hue: junction.hue, onArrive: () => carry(to) });
    }
  };
  carry(origin);
}

function flexWeight(d) {
  return Math.exp(-d / GIVING.flexReach);
}

function flexed(node) {
  const w = flexWeight(node.d);
  return { x: node.x + (node.spore.x - node.spore.homeX) * w, y: node.y + (node.spore.y - node.spore.homeY) * w };
}

function junctionPosition(j) {
  const wa = flexWeight(j.dA);
  const wb = flexWeight(j.dB);
  return {
    x: j.x + (j.a.x - j.a.homeX) * wa + (j.b.x - j.b.homeX) * wb,
    y: j.y + (j.a.y - j.a.homeY) * wa + (j.b.y - j.b.homeY) * wb
  };
}