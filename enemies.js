/* RUNZ enemies, rendered on the web.
   Port of the game's enemy look (scripts/effects/chunky_shape.gd + enemy.gd):
   flat saturated chunky blobs with a boiled/ragged edge and a white socket +
   dark square pupil. The body edge BOILS (a few pre-baked frames cycled at the
   game's ~6 Hz shimmer), the eye occasionally BLINKS, and the pupil snaps
   toward the cursor in 32 directional buckets. Decorative hosts: aria-hidden +
   pointer-events:none. Hidden on mobile (no pointer). Honours reduced-motion. */
(function () {
  "use strict";

  // Roster from data/enemies/*.tres. shape: 0 CIRCLE 1 TRI 2 SQUARE 3 DIAMOND
  // 4 RING 5 STAR 6 CROSS 7 ROCKET 8 WIDE_HEX. colour = round(tres rgb * 255).
  var ROSTER = {
    skitter:     { shape: 3, color: [255, 64, 191],  r: 16.9 },
    spitter:     { shape: 1, color: [245, 140, 46],  r: 16.9 },
    splitter:    { shape: 4, color: [128, 199, 71],  r: 18.2 },
    drifter:     { shape: 3, color: [158, 77, 219],  r: 16.9 },
    predictor:   { shape: 3, color: [89, 217, 230],  r: 16.9 },
    bomber:      { shape: 4, color: [242, 89, 89],   r: 20.8 },
    bulwark:     { shape: 2, color: [232, 59, 61],   r: 23.4 },
    warden:      { shape: 2, color: [252, 212, 54],  r: 31.2 },
    fan_sprayer: { shape: 1, color: [242, 199, 64],  r: 18.2 },
    gem_shard:   { shape: 3, color: [87, 199, 245],  r: 18.0 },
    gem_cluster: { shape: 5, color: [252, 199, 61],  r: 28.0 },
    maw:         { shape: 0, color: [150, 54, 128],  r: 40.0 }
  };

  var CHUNK = 3.0;
  var EDGE_DROP = 0.32;
  var STRAY = 0.05;
  var STRAY_REACH = 1.18;
  var CORE = 0.82;
  var CHIP = 0.25;
  var BUCKETS = 32;
  var STEP = (Math.PI * 2) / BUCKETS;
  var BLACK = "#080709";
  var SCLERA = "#ece7dd";
  var FRAMES = 5;            // baked boil frames
  var BOIL_MS = 1000 / 6;    // ~6 Hz shimmer, matching the game

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cross(ax, ay, bx, by) { return ax * by - ay * bx; }
  function triInside(px, py, ax, ay, bx, by, cx, cy) {
    var d1 = cross(ax - px, ay - py, bx - px, by - py);
    var d2 = cross(bx - px, by - py, cx - px, cy - py);
    var d3 = cross(cx - px, cy - py, ax - px, ay - py);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  function trapInside(px, py, xMin, xMax, rearHalf, frontHalf) {
    if (px < xMin || px > xMax) return false;
    var t = (px - xMin) / (xMax - xMin);
    return Math.abs(py) <= rearHalf + (frontHalf - rearHalf) * t;
  }
  function inside(px, py, r, shape) {
    var ax, ay;
    switch (shape) {
      case 0: return px * px + py * py <= r * r;
      case 1: return triInside(px, py, r * 1.1, 0, -r * 0.7, r * 0.85, -r * 0.7, -r * 0.85);
      case 2: return Math.abs(px) <= r && Math.abs(py) <= r;
      case 3: return Math.abs(px) / (r * 1.4) + Math.abs(py) / (r * 0.7) <= 1.0;
      case 4: { var d = px * px + py * py; return d <= r * r && d >= (r * 0.55) * (r * 0.55); }
      case 5:
        ax = Math.abs(px); ay = Math.abs(py);
        if (ax / (r * 1.15) + ay / (r * 0.95) > 1.0) return false;
        if (ay <= r * 0.32 || ax <= r * 0.32) return true;
        return px * px + py * py <= (r * 0.45) * (r * 0.45);
      case 6:
        ax = Math.abs(px); ay = Math.abs(py);
        var arm = r * 0.38;
        return (ax <= r && ay <= arm) || (ay <= r && ax <= arm);
      case 7:
        if (px >= -r * 0.72 && px <= r * 0.36 && Math.abs(py) <= r * 0.36) return true;
        if (triInside(px, py, r * 1.18, 0, r * 0.32, -r * 0.56, r * 0.32, r * 0.56)) return true;
        return trapInside(px, py, -r * 1.02, -r * 0.48, r * 0.72, r * 0.38);
      case 8: {
        ax = Math.abs(px); ay = Math.abs(py);
        var hw = r * 1.22, hh = r * 0.62, ss = r * 0.58;
        if (ax > hw || ay > hh) return false;
        if (ax <= ss) return true;
        return ay <= hh * (1.0 - (ax - ss) / Math.max(0.001, hw - ss));
      }
      default: return false;
    }
  }

  function fillBody(g, origin, ext, r, shape, color, rng, angle) {
    var ca = Math.cos(-angle), sa = Math.sin(-angle);
    g.fillStyle = color;
    for (var x = -ext; x < ext; x += 1) {
      for (var y = -ext; y < ext; y += 1) {
        var cxp = x + 0.5, cyp = y + 0.5;
        var lx = cxp * ca - cyp * sa, ly = cxp * sa + cyp * ca;
        var full = inside(lx, ly, r, shape);
        var core = inside(lx, ly, r * CORE, shape);
        var roll = rng();
        var f = false;
        if (full) { if (core || roll > EDGE_DROP) f = true; }
        else if (roll < STRAY && inside(lx, ly, r * STRAY_REACH, shape)) f = true;
        if (f) g.fillRect(Math.round(origin + x), Math.round(origin + y), 1, 1);
      }
    }
  }

  function newCanvas(size) {
    var c = document.createElement("canvas");
    c.width = size; c.height = size;
    return c;
  }

  function bake(def, seed, angle) {
    var r = Math.max(3, def.r / CHUNK);
    var ext = r * STRAY_REACH + 2;
    var size = Math.ceil(ext * 2) + 4;
    var origin = size / 2;
    var col = "rgb(" + def.color.join(",") + ")";

    // eye centred on the shape's visual centre (triangles/rockets are front-heavy)
    var exl = def.shape === 1 ? 0.2 * r : def.shape === 7 ? 0.1 * r : 0;
    var eyeX = origin + exl * Math.cos(angle);
    var eyeY = origin + exl * Math.sin(angle);

    // body, one canvas per boil frame (edge cells differ → the silhouette boils)
    var bodyFrames = [];
    for (var fr = 0; fr < FRAMES; fr++) {
      var bc = newCanvas(size);
      fillBody(bc.getContext("2d"), origin, ext, r, def.shape, col, rngFrom((seed + fr * 0x9e3779b9) >>> 0), angle);
      bodyFrames.push(bc);
    }

    // white socket, sized per shape; baked once (stable while the body boils)
    var socketDiam;
    if (def.shape === 4) socketDiam = clamp(Math.round(r * 1.15), 5, 18);
    else if (def.shape === 3) socketDiam = clamp(Math.round(r * 0.95), 5, 14);
    else socketDiam = clamp(Math.round(r * 1.1), 5, 18);
    var socketR = socketDiam / 2;
    var sc = newCanvas(size);
    var sg = sc.getContext("2d");
    sg.fillStyle = SCLERA;
    var srng = rngFrom((seed ^ 0x51) >>> 0);
    var R = Math.ceil(socketR);
    for (var sx = -R; sx <= R; sx++) {
      for (var sy = -R; sy <= R; sy++) {
        var dist = Math.sqrt(sx * sx + sy * sy);
        if (dist > socketR + 0.2) continue;
        if (dist > socketR - 0.85 && srng() < CHIP) continue;
        sg.fillRect(Math.round(eyeX + sx), Math.round(eyeY + sy), 1, 1);
      }
    }

    var pupilSide = Math.max(2, Math.round(socketR * 0.5));
    var travel = Math.max(0.7, socketR * 0.42);
    return {
      bodyFrames: bodyFrames, socket: sc, size: size,
      eyeX: eyeX, eyeY: eyeY, socketR: socketR, pupilSide: pupilSide, travel: travel
    };
  }

  // deterministic spread of orientations + blink phases (no Math.random at bake)
  var ANGLES = [0, 0.5, -0.4, 1.1, -0.9, 2.3, 0.9, -1.6];

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hosts = [];
  var nodes = document.querySelectorAll(".enemy");
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var def = ROSTER[node.getAttribute("data-enemy")] || ROSTER.skitter;
    var cell = parseFloat(node.getAttribute("data-cell")) || 4;
    var angAttr = node.getAttribute("data-angle");
    var angle = angAttr !== null ? parseFloat(angAttr) * Math.PI / 180 : ANGLES[i % ANGLES.length];
    var baked = bake(def, (((def.shape + 1) * 2654435761) ^ ((i + 1) * 40503)) >>> 0, angle);

    var view = newCanvas(baked.size);
    view.style.width = baked.size * cell + "px";
    view.style.height = baked.size * cell + "px";
    node.appendChild(view);

    hosts.push({
      node: node, ctx: view.getContext("2d"), b: baked,
      cx: 0, cy: 0, on: false,
      nextBlink: 1500 + (i % 6) * 900 + (i * 617 % 2500),
      blinkUntil: 0
    });
  }
  if (!hosts.length) return;

  var px = window.innerWidth / 2;
  var py = window.innerHeight * 0.42;

  // cache each host's screen-centre; recompute on scroll/resize (not per frame)
  function recalcCenters() {
    for (var i = 0; i < hosts.length; i++) {
      var r = hosts[i].node.getBoundingClientRect();
      hosts[i].cx = r.left + r.width / 2;
      hosts[i].cy = r.top + r.height / 2;
      hosts[i].on = r.width > 0;
    }
  }

  function render(h, frameIdx, blinking) {
    if (!h.on) return;
    var b = h.b;
    var ang = Math.round(Math.atan2(py - h.cy, px - h.cx) / STEP) * STEP;
    var ox = Math.round(Math.cos(ang) * b.travel);
    var oy = Math.round(Math.sin(ang) * b.travel);
    var ctx = h.ctx;
    ctx.clearRect(0, 0, b.size, b.size);
    ctx.drawImage(b.bodyFrames[frameIdx], 0, 0);
    if (blinking) {
      ctx.fillStyle = SCLERA;
      ctx.fillRect(Math.round(b.eyeX - b.socketR), Math.round(b.eyeY - 1), Math.max(2, Math.round(b.socketR * 2)), 2);
    } else {
      ctx.drawImage(b.socket, 0, 0);
      ctx.fillStyle = BLACK;
      ctx.fillRect(Math.round(b.eyeX + ox - b.pupilSide / 2), Math.round(b.eyeY + oy - b.pupilSide / 2), b.pupilSide, b.pupilSide);
    }
  }

  // render every frame so the pupil always follows the cursor (no button needed)
  function frame(now) {
    var fi = reduced ? 0 : Math.floor(now / BOIL_MS) % FRAMES;
    for (var i = 0; i < hosts.length; i++) {
      var h = hosts[i];
      var blinking = false;
      if (!reduced) {
        if (now >= h.nextBlink) { h.blinkUntil = now + 130; h.nextBlink = now + 2600 + (i * 911 % 4200); }
        blinking = now < h.blinkUntil;
      }
      render(h, fi, blinking);
    }
    window.requestAnimationFrame(frame);
  }

  function onMove(x, y) { px = x; py = y; }
  window.addEventListener("mousemove", function (e) { onMove(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener("pointermove", function (e) { onMove(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener("touchmove", function (e) { var t = e.touches && e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener("scroll", recalcCenters, { passive: true });
  window.addEventListener("resize", recalcCenters, { passive: true });
  recalcCenters();
  window.requestAnimationFrame(frame);
})();
