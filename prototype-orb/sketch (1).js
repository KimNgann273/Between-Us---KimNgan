(function () {
  "use strict";

  // ---- 2D value noise ------------------------------------------------------
  // Cheap hash-based lattice noise with smoothstep interpolation. Good enough
  // for an organic outline and far lighter than importing a noise library.
  var perm = new Uint8Array(512);
  (function seedPerm() {
    var p = new Uint8Array(256);
    for (var i = 0; i < 256; i++) p[i] = i;
    for (var j = 255; j > 0; j--) {
      var k = (Math.random() * (j + 1)) | 0;
      var tmp = p[j]; p[j] = p[k]; p[k] = tmp;
    }
    for (var n = 0; n < 512; n++) perm[n] = p[n & 255];
  })();

  function fade(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash2(ix, iy) {
    return (perm[(ix + perm[iy & 255]) & 255] / 255) * 2 - 1;
  }

  function noise2(x, y) {
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var fx = fade(x - x0), fy = fade(y - y0);
    var n00 = hash2(x0, y0), n10 = hash2(x0 + 1, y0);
    var n01 = hash2(x0, y0 + 1), n11 = hash2(x0 + 1, y0 + 1);
    return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy);
  }

  // Two octaves of noise sampled on a circle of radius `freq` around `phase`.
  // Sampling a full circle keeps the result periodic in `angle`.
  function loopNoise(angle, freq, phase) {
    var cx = Math.cos(angle), cy = Math.sin(angle);
    var a = noise2(cx * freq + phase, cy * freq + phase);
    var b = noise2(cx * freq * 2.3 + 40 + phase * 1.7,
                   cy * freq * 2.3 + 40 + phase * 1.7) * 0.5;
    return (a + b) / 1.5;
  }

  // ---- setup -------------------------------------------------------------
  var canvas = document.querySelector("canvas.orb-scene");
  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var THEMES = {
    ember:  { a: "#ff8f5e", b: "#ffc98a", glow: "rgba(255, 143, 94, 0.55)", hex: "#ff8f5e" },
    tide:   { a: "#4fb3d9", b: "#8fe3d0", glow: "rgba(79, 179, 217, 0.55)",  hex: "#4fb3d9" },
    nebula: { a: "#ea5252", b: "#ae3434", glow: "rgba(234, 82, 82, 0.6)", hex: "#ea5252" },
    calm:   { a: "#7d8fa8", b: "#4a5a70", glow: "rgba(125, 143, 168, 0.4)", hex: "#7d8fa8" },
    happy:  { a: "#ffd45c", b: "#ffe38a", glow: "rgba(255, 212, 92, 0.6)", hex: "#ffd45c" }
  };

  var params = {
    wobble: 0.28,   // fraction of base radius the outline can travel
    speed: 1.0,     // time multiplier
    size: 1.0,      // base radius multiplier
    theme: THEMES.ember
  };

  var SEGMENTS = 160;      // outline samples
  var motionScale = reduceMotion ? 0.15 : 1.0;

  var dpr = 1, W = 0, H = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  var pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", function (e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // ---- name gate -----------------------------------------------------------
  // The orb is already rendering underneath; "Continue" just fades the
  // overlay away instead of swapping views.
  var nameScreen = document.getElementById("nameScreen");
  var nameInput = document.getElementById("nameInput");
  var continueBtn = document.getElementById("continueBtn");
  var greeting = document.getElementById("orbGreeting");

  function revealOrb() {
    if (nameScreen.classList.contains("is-hidden")) return;

    var name = nameInput.value.trim();
    if (greeting) {
      greeting.textContent = name
        ? "Hey " + name + "."
        : "...";
    }

    nameScreen.classList.add("is-hidden");
    nameScreen.addEventListener("transitionend", function onFade(e) {
      if (e.propertyName !== "opacity") return;
      nameScreen.style.display = "none";
      nameScreen.removeEventListener("transitionend", onFade);
    });

    startDialogue(name);
  }

  continueBtn.addEventListener("click", revealOrb);
  nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") revealOrb();
  });
  nameInput.focus();

  // Manual sliders removed. params are now driven by dialogue state below.

  // ---- dialogue system -----------------------------------------------
  var playerName = "";
  var score = 0;
  var currentLine = 0;
  var angryCount = 0;
  var GLITCH_THRESHOLD = 2;

  var dialogue = [
    {
      orbLine: "...it's cold in here. Colder than it should be.",
      replies: [
        { text: "I'm here now. You're not alone.", score: 1, mood: "happy",
          orbReact: "The orb's glow softens, pulsing slower. \"...you came.\"" },
        { text: "What happened to you?", score: -1, mood: "sad",
          orbReact: "The orb shrinks slightly, dimming. \"I don't... I don't want to say it yet.\"" }
      ]
    },
    {
      orbLine: "I don't think anyone was looking for me.",
      replies: [
        { text: "I was. I found you, didn't I?", score: 1, mood: "happy",
          orbReact: "A small flicker, almost a laugh. \"...maybe you were.\"" },
        { text: "Maybe you weren't hiding well enough.", score: -1, mood: "angry",
          orbReact: "The orb flares, sharp and sudden. \"That's not fair. That's not fair!\"" }
      ]
    },
    {
      orbLine: "Do you ever feel like you're made of the wrong shape?",
      replies: [
        { text: "All the time. It's okay to feel that way.", score: 1, mood: "happy",
          orbReact: "The orb steadies, its edges less jagged. \"...oh. Okay.\"" },
        { text: "You just need to stop thinking like that.", score: -1, mood: "angry",
          orbReact: "The orb pulses hard, light stuttering. \"You don't understand anything.\"" }
      ]
    },
    {
      orbLine: "I get scared you'll leave like the others did.",
      replies: [
        { text: "I'm not going anywhere.", score: 1, mood: "happy",
          orbReact: "The orb brightens, warm and steady. \"...say that again.\"" },
        { text: "I can't promise forever. No one can.", score: -1, mood: "sad",
          orbReact: "The orb dims and curls inward, quiet. \"...right. Of course.\"" }
      ]
    },
    {
      orbLine: "...why does it feel like I'm holding my breath, even now?",
      replies: [
        { text: "Maybe you can let it go, just for a second.", score: 1, mood: "happy",
          orbReact: "A long, slow exhale of light. \"...I forgot I could do that.\"" },
        { text: "You don't need to overthink everything.", score: -1, mood: "angry",
          orbReact: "The orb tightens, light going sharp at the edges. \"Easy for you to say.\"" }
      ]
    },
    {
      orbLine: "Are you going to remember me after this?",
      replies: [
        { text: "Always. This mattered.", score: 1, mood: "happy",
          orbReact: "The orb glows fully, almost too bright to look at. \"...thank you.\"" },
        { text: "I mean... we'll see.", score: -1, mood: "sad",
          orbReact: "The orb flickers, uncertain, and doesn't answer right away." }
      ]
    }
  ];

  // Each mood eases the orb's live params toward a target rather than
  // snapping instantly, so the shape genuinely drifts over time.
  var moodTargets = {
    neutral: { wobble: 0.28, speed: 1.0, theme: THEMES.ember },
    happy:   { wobble: 0.18, speed: 0.7, theme: THEMES.happy },
    sad:     { wobble: 0.12, speed: 0.4, theme: THEMES.calm },
    angry:   { wobble: 0.55, speed: 2.2, theme: THEMES.nebula }
  };

  var targetParams = moodTargets.neutral;

  function setMood(mood) {
    targetParams = moodTargets[mood] || moodTargets.neutral;
    params.theme = targetParams.theme; // theme swap is instant, shape eases below
  }

  var dialogueBox = document.getElementById("dialogueBox");
  var orbLineEl = document.getElementById("orbLine");
  var reactionEl = document.getElementById("reaction");
  var repliesEl = document.getElementById("replies");
  var endingScreen = document.getElementById("endingScreen");
  var endingTextEl = document.getElementById("endingText");
  var glitchOverlay = document.getElementById("glitchOverlay");

  function startDialogue(name) {
    playerName = name || "friend";
    setTimeout(function () {
      dialogueBox.classList.add("is-visible");
      showLine();
    }, 900);
  }

  function showLine() {
    var line = dialogue[currentLine];
    orbLineEl.textContent = line.orbLine;
    reactionEl.textContent = "";
    repliesEl.innerHTML = "";

    line.replies.forEach(function (reply, index) {
      var btn = document.createElement("button");
      btn.className = "replyBtn";
      btn.textContent = reply.text;
      btn.onclick = function () { pickReply(index); };
      repliesEl.appendChild(btn);
    });
  }

  function pickReply(index) {
    var reply = dialogue[currentLine].replies[index];
    score += reply.score;
    if (reply.mood === "angry") angryCount++;

    reactionEl.textContent = reply.orbReact;
    repliesEl.innerHTML = "";
    setMood(reply.mood);

    if (reply.mood === "angry" && angryCount >= GLITCH_THRESHOLD) {
      triggerGlitch();
    }

    setTimeout(function () {
      currentLine++;
      if (currentLine < dialogue.length) {
        showLine();
      } else {
        showEnding();
      }
    }, 2600);
  }

  function triggerGlitch() {
    document.body.classList.add("glitching");
    glitchOverlay.classList.add("active");
    setTimeout(function () {
      document.body.classList.remove("glitching");
      glitchOverlay.classList.remove("active");
    }, 900);
  }

  function showEnding() {
    dialogueBox.classList.remove("is-visible");
    endingScreen.classList.remove("hidden");
    requestAnimationFrame(function () { endingScreen.classList.add("is-visible"); });

    if (score >= 2) {
      setMood("happy");
      endingTextEl.textContent = playerName + ", they're happy because of you... You need to keep it going so they don't get upset again. It's unsettling when they're sad.";
    } else {
      setMood("angry");
      endingTextEl.textContent = "Is there something wrong in what " + playerName + " said? I'm sorry... I'll try to change next time. Don't be mad at me.";
    }
  }

  // ---- animation loop ---------------------------------------------------
  // Build the wobbled outline as an array of {x, y} points around the centre.
  function outlinePoints(cx, cy, baseR, freq, phase, amp) {
    var pts = [];
    for (var i = 0; i < SEGMENTS; i++) {
      var ang = (i / SEGMENTS) * Math.PI * 2;
      var r = baseR * (1 + amp * loopNoise(ang, freq, phase));
      pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
    return pts;
  }

  // Trace a closed Catmull-Rom spline through the points as smooth beziers.
  function tracePath(pts) {
    var n = pts.length;
    ctx.beginPath();
    ctx.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
    for (var i = 0; i < n; i++) {
      var p1 = pts[i];
      var p2 = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    }
    ctx.closePath();
  }

  var t = 0;
  var lean = { x: 0, y: 0 };
  var spin = 0;
  var last = performance.now();

  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // Ease live params toward the current mood's target instead of
    // snapping, so the orb's shape visibly drifts as feelings shift.
    params.wobble += (targetParams.wobble - params.wobble) * 0.02;
    params.speed  += (targetParams.speed  - params.speed)  * 0.02;

    t += dt * params.speed * motionScale;
    spin += dt * 0.05 * motionScale;

    lean.x += (pointer.x * 40 * motionScale - lean.x) * 0.04;
    lean.y += (pointer.y * 40 * motionScale - lean.y) * 0.04;

    ctx.clearRect(0, 0, W, H);

    var cx = W / 2 + lean.x;
    var cy = H / 2 + lean.y;
    var baseR = Math.min(W, H) * 0.24 * params.size;
    var th = params.theme;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(spin) * 0.15);
    ctx.translate(-cx, -cy);

    // Wide soft glow behind everything.
    var glow = outlinePoints(cx, cy, baseR * 1.12, 1.4, t * 0.5, params.wobble * 0.7);
    ctx.save();
    ctx.filter = "blur(40px)";
    tracePath(glow);
    ctx.fillStyle = th.glow;
    ctx.fill();
    ctx.restore();

    // Trailing back layer, slightly out of phase.
    var back = outlinePoints(cx, cy, baseR * 0.94, 2.1, t * 0.8 + 12, params.wobble * 0.85);
    tracePath(back);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = th.b;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Main blob with a radial gradient body.
    var main = outlinePoints(cx, cy, baseR, 1.7, t, params.wobble);
    tracePath(main);
    var grad = ctx.createRadialGradient(
      cx - baseR * 0.35, cy - baseR * 0.4, baseR * 0.1,
      cx, cy, baseR * 1.3
    );
    grad.addColorStop(0, th.b);
    grad.addColorStop(0.55, th.a);
    grad.addColorStop(1, th.a);
    ctx.fillStyle = grad;
    ctx.fill();

    // Specular highlight.
    var hl = ctx.createRadialGradient(
      cx - baseR * 0.4, cy - baseR * 0.45, 0,
      cx - baseR * 0.4, cy - baseR * 0.45, baseR * 0.9
    );
    hl.addColorStop(0, "rgba(255,255,255,0.5)");
    hl.addColorStop(0.3, "rgba(255,255,255,0.08)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fill();

    ctx.restore();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
