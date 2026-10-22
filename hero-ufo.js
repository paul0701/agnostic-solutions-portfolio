/* Games hero: a small 3D flying saucer drawn from a real mesh, with stars, a ground
   shadow and laser bolts. A "definition" switch re-renders the same scene at four
   fidelities: 16-bit and 32-bit (pixel-art), HD (clean) and Next-gen (bloom + beam).
   Runs only while the hero is on screen. */
(function () {
  'use strict';
  var cv = document.getElementById('ufoFx');
  if (!cv) return;
  var hero = cv.parentElement, ctx = cv.getContext('2d');
  var oc = document.createElement('canvas'), octx = oc.getContext('2d', { willReadFrequently: true });   // low-res buffer (pixel modes)
  var uc = document.createElement('canvas'), uctx = uc.getContext('2d', { willReadFrequently: true });   // saucer layer (pixel modes)
  var bc = document.createElement('canvas'), bctx = bc.getContext('2d');   // bloom buffer (next-gen)
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 8, H = 8, dprK = 1, T = 0, last = 0, raf = 0, visible = true, narrow = false;
  var stars = [], bolts = [], sparks = [], ufo = { t: 1.2, fire: 0.6, side: 1 };
  var view = { f: 600, cx: 0, cy: 0, ground: 1, gy: 0 };

  /* definition tiers. px>0 renders the scene into a small buffer whose pixels are px device
     pixels square, then upscales with smoothing off. 16-bit snaps every colour to a fixed
     16-colour palette, flat shaded with a hard outline; 32-bit keeps 64 colours and shine. */
  var MODES = {
    '16-bit':  { px: 5, pal: true, flat: true, outline: true, stars: 70 },
    '32-bit':  { px: 3, levels: 4, flat: false, outline: false, stars: 110 },
    'hd':      { px: 0 },
    'next-gen':{ px: 0, nextgen: true }
  };
  var PAL = [[10,14,39],[27,42,94],[58,79,160],[122,142,224],[159,230,255],[232,251,255],[255,210,63],[255,95,138],
             [74,84,112],[141,154,181],[201,211,230],[45,54,82],[90,58,122],[182,156,255],[255,162,74],[22,34,77]];
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  var mode = '16-bit';   /* first impression starts blocky; climbs as you pick higher */
  try { var saved = localStorage.getItem('pj_defn'); if (saved && MODES[saved]) mode = saved; } catch (e) {}

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var PROFILE = [[0, -0.60], [0.20, -0.55], [0.36, -0.40], [0.45, -0.20], [0.95, -0.04], [1.0, 0.04], [0.9, 0.12], [0.5, 0.22], [0.28, 0.27], [0, 0.27]];
  var MAT = [0, 0, 0, 1, 2, 1, 3, 3, 3]; /* 0 glass dome, 1 hull, 2 rim, 3 underside */
  var BASE = [[140, 205, 255], [175, 190, 210], [75, 90, 115], [115, 130, 155]];
  var LIGHT = (function () { var l = [-0.45, -0.65, -0.62], m = Math.sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })();
  var SEGS = 28, mesh = [];

  (function buildMesh() {
    for (var i = 0; i < PROFILE.length - 1; i++) for (var j = 0; j < SEGS; j++) {
      var a0 = j / SEGS * Math.PI * 2, a1 = (j + 1) / SEGS * Math.PI * 2, p0 = PROFILE[i], p1 = PROFILE[i + 1];
      var v = [[p0[0] * Math.cos(a0), p0[1], p0[0] * Math.sin(a0)], [p0[0] * Math.cos(a1), p0[1], p0[0] * Math.sin(a1)],
               [p1[0] * Math.cos(a1), p1[1], p1[0] * Math.sin(a1)], [p1[0] * Math.cos(a0), p1[1], p1[0] * Math.sin(a0)]];
      var ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
      var wx = v[3][0] - v[0][0], wy = v[3][1] - v[0][1], wz = v[3][2] - v[0][2];
      if (i === 0) { wx = v[2][0] - v[0][0]; wy = v[2][1] - v[0][1]; wz = v[2][2] - v[0][2]; }
      var n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx], l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
      var cx = (v[0][0] + v[2][0]) / 2, cy = (v[0][1] + v[2][1]) / 2, cz = (v[0][2] + v[2][2]) / 2;
      if (n[0] * cx + n[1] * cy + n[2] * cz < 0) n = [-n[0], -n[1], -n[2]];
      mesh.push({ v: v, n: n, m: MAT[i] });
    }
  })();

  function rot(v, yaw, roll, pitch) {
    var c = Math.cos(yaw), s = Math.sin(yaw), x1 = v[0] * c + v[2] * s, z1 = -v[0] * s + v[2] * c, y1 = v[1];
    c = Math.cos(roll); s = Math.sin(roll); var x2 = x1 * c - y1 * s, y2 = x1 * s + y1 * c;
    c = Math.cos(pitch); s = Math.sin(pitch);
    return [x2, y2 * c - z1 * s, y2 * s + z1 * c];
  }
  function proj(x, y, z) { return [view.cx + view.f * x / z, view.cy + view.f * y / z]; }

  /* view params for a given pixel size (shared by main and low-res buffers) */
  function computeView(w, h) {
    var v = {};
    v.gy = h * (narrow ? 0.94 : 0.88);
    v.cx = narrow ? w * 0.7 : w * 0.7;
    v.cy = narrow ? h * 0.2 : h * 0.36;
    v.f = narrow ? Math.min(w * 0.78, h * 0.7) : Math.min(w * 0.6, h * 1.0);
    v.ground = (v.gy - v.cy) * 3.4 / v.f;
    return v;
  }

  function resize() {
    var r = hero.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    narrow = r.width < 760;
    dprK = dpr; W = Math.max(8, Math.round(r.width * dpr)); H = Math.max(8, Math.round(r.height * dpr));
    cv.width = W; cv.height = H;
    stars = []; buildTown();
    for (var i = 0; i < 120; i++) stars.push({ x: Math.random(), y: Math.random() * 0.85, z: rnd(0.3, 1), p: Math.random() * 6 });
    if (reduce) { for (var k = 0; k < 70; k++) step(1 / 30); frame(); }
  }

  function step(dt) {
    view = computeView(W, H);   // keep ground height current for physics
    T += dt; ufo.t += dt; var t = ufo.t;
    ufo.x = Math.sin(t * 0.55) * (narrow ? 0.55 : 1.0);
    ufo.z = 3.4 + 0.75 * Math.sin(t * 0.55 + 1.4);
    ufo.y = -0.05 + 0.07 * Math.sin(t * 1.7);
    ufo.vx = Math.cos(t * 0.55);
    ufo.roll = -ufo.vx * 0.22 + 0.04 * Math.sin(t * 2.1);
    ufo.yaw = t;
    ufo.fire -= dt;
    if (ufo.fire <= 0) {
      ufo.fire = 0.4; ufo.side = -ufo.side;
      bolts.push({ x: ufo.x + ufo.side * 0.34, y: ufo.y + 0.08, z: ufo.z - 0.1, dx: ufo.side * 0.25 + ufo.vx * 0.3, dy: 1.0, dz: -0.28 });
    }
    bolts = bolts.filter(function (b) {
      b.x += b.dx * 2.6 * dt; b.y += b.dy * 2.6 * dt; b.z += b.dz * 2.6 * dt;
      if (b.y >= view.ground) {
        for (var i = 0; i < 6; i++) sparks.push({ x: b.x, y: b.y, z: b.z, vx: rnd(-0.9, 0.9), vy: rnd(-1.4, -0.3), vz: rnd(-0.3, 0.3), life: rnd(0.2, 0.45) });
        return false;
      }
      return b.z > 0.8;
    });
    sparks = sparks.filter(function (s) { s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy += 3.2 * dt; s.life -= dt; return s.life > 0; });
  }

  /* draw the whole scene into context g at size w*h. opts: {flat, nextgen} */
  function renderScene(g, w, h, opts) {
    view = computeView(w, h);
    var S = narrow ? 0.46 : 0.52, i, ng = opts && opts.nextgen, flat = opts && opts.flat;
    var ufoOnly = opts && opts.layer === 'ufo';
    g.clearRect(0, 0, w, h);

    if (!ufoOnly) {
    if (ng) { /* a soft nebula glow behind everything */
      var bg = g.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, Math.max(w, h) * 0.7);
      bg.addColorStop(0, 'rgba(70,110,220,0.28)'); bg.addColorStop(0.5, 'rgba(40,30,90,0.14)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
    }

    stars.forEach(function (s) {
      var x = ((s.x - T * 0.004 * s.z) % 1 + 1) % 1 * w, y = s.y * h, tw = 0.55 + 0.45 * Math.sin(T * 2 + s.p);
      g.fillStyle = 'rgba(210,235,255,' + (0.25 + 0.6 * s.z * tw).toFixed(2) + ')';
      g.beginPath(); g.arc(x, y, (0.5 + s.z * 0.9) * (ng ? 1.3 : 1), 0, 6.283); g.fill();
    });

    var gr = g.createLinearGradient(0, view.gy, 0, h);
    gr.addColorStop(0, '#16224d'); gr.addColorStop(1, '#070b22');
    g.fillStyle = gr; g.fillRect(0, view.gy, w, h - view.gy);
    g.fillStyle = 'rgba(140,170,255,0.35)'; g.fillRect(0, view.gy, w, 1);
    drawTown(g, w, h, Math.round(view.gy), Math.max(2, h * 0.005), false);
    }

    var gpt = proj(ufo.x, view.ground, ufo.z), sr = view.f * S * 1.05 / ufo.z;

    if (ng) { /* tractor beam: a translucent cone from the underside to the ground */
      var top = proj(ufo.x, ufo.y + 0.2 * S, ufo.z), halfTop = view.f * 0.1 * S / ufo.z, halfBot = sr * 0.85;
      var beam = g.createLinearGradient(0, top[1], 0, gpt[1]);
      beam.addColorStop(0, 'rgba(150,240,255,0.33)'); beam.addColorStop(1, 'rgba(120,220,255,0)');
      g.fillStyle = beam; g.beginPath();
      g.moveTo(top[0] - halfTop, top[1]); g.lineTo(top[0] + halfTop, top[1]);
      g.lineTo(gpt[0] + halfBot, gpt[1]); g.lineTo(gpt[0] - halfBot, gpt[1]); g.closePath(); g.fill();
    }

    if (!ufoOnly) { g.save(); g.translate(gpt[0], gpt[1]); g.scale(1, 0.18);
    g.fillStyle = ng ? 'rgba(10,20,60,0.5)' : 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(0, 0, sr, 0, 6.283); g.fill(); g.restore(); }

    var pitch = 0.42, yaw = ufo.yaw, roll = ufo.roll, list = [];
    for (i = 0; i < mesh.length; i++) {
      var f = mesh[i], n = rot(f.n, yaw, roll, pitch), pts = [], zs = 0, k;
      for (k = 0; k < 4; k++) {
        var rr = rot([f.v[k][0] * S, f.v[k][1] * S, f.v[k][2] * S], yaw, roll, pitch);
        pts.push([rr[0] + ufo.x, rr[1] + ufo.y, rr[2] + ufo.z]); zs += rr[2] + ufo.z;
      }
      var cxm = (pts[0][0] + pts[2][0]) / 2, cym = (pts[0][1] + pts[2][1]) / 2, czm = (pts[0][2] + pts[2][2]) / 2;
      if (n[0] * cxm + n[1] * cym + n[2] * czm >= 0) continue;
      list.push({ f: f, n: n, pts: pts, z: zs / 4, c: [cxm, cym, czm] });
    }
    list.sort(function (a, b) { return b.z - a.z; });
    list.forEach(function (q) {
      var lam = Math.max(0, q.n[0] * LIGHT[0] + q.n[1] * LIGHT[1] + q.n[2] * LIGHT[2]), kk = 0.45 + 0.75 * lam;
      var cl = Math.sqrt(q.c[0] * q.c[0] + q.c[1] * q.c[1] + q.c[2] * q.c[2]) || 1, vx = -q.c[0] / cl, vy = -q.c[1] / cl, vz = -q.c[2] / cl;
      var hx = LIGHT[0] + vx, hy = LIGHT[1] + vy, hz = LIGHT[2] + vz, hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
      var base = q.f.m === 0 ? 1.0 : q.f.m === 1 ? 0.7 : 0.25;
      var spec = Math.pow(Math.max(0, (q.n[0] * hx + q.n[1] * hy + q.n[2] * hz) / hl), ng ? 26 : 18) * base * (ng ? 95 : 70);
      if (flat) spec = 0;
      var b = BASE[q.f.m], rim = 0;
      if (ng) { var fres = Math.pow(1 - Math.max(0, -vz), 3); rim = fres * 55 * (q.f.m === 0 ? 1.1 : 0.7); }  /* fresnel edge light */
      var col = 'rgb(' + clamp(Math.round(b[0] * kk + spec + rim * 0.6), 0, 255) + ',' + clamp(Math.round(b[1] * kk + spec + rim * 0.8), 0, 255) + ',' + clamp(Math.round(b[2] * kk + spec + rim), 0, 255) + ')';
      g.beginPath();
      for (var k2 = 0; k2 < 4; k2++) { var p = proj(q.pts[k2][0], q.pts[k2][1], q.pts[k2][2]); if (k2 === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
      g.closePath(); g.fillStyle = col;
      g.fill();
      if (!ng) { g.strokeStyle = col; g.lineWidth = 0.8; g.stroke(); }   /* HD/pixel: hide seams; next-gen: smoother */
    });

    for (var li = 0; li < 10; li++) {
      var ang = yaw + li / 10 * 6.283, rp = rot([Math.cos(ang) * 0.98 * S, 0.05 * S, Math.sin(ang) * 0.98 * S], 0, roll, pitch);
      if (rp[2] > 0.15 * S) continue;
      var lz = rp[2] + ufo.z, ps = proj(rp[0] + ufo.x, rp[1] + ufo.y, lz), on = (Math.floor(T * 4 + li) % 3) !== 0;
      g.fillStyle = li % 2 ? '#ffd23f' : '#ff5f8a'; g.globalAlpha = on ? 1 : 0.4;
      g.beginPath(); g.arc(ps[0], ps[1], Math.max(1, view.f * 0.035 * S / lz * (on ? 1 : 0.5)), 0, 6.283); g.fill(); g.globalAlpha = 1;
    }

    bolts.forEach(function (b) {
      var a = proj(b.x, b.y, b.z), c = proj(b.x - b.dx * 0.32, b.y - b.dy * 0.32, b.z - b.dz * 0.32);
      g.strokeStyle = '#9fe6ff'; g.lineWidth = Math.max(1, view.f * 0.012 / b.z); g.lineCap = 'round';
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke();
    });
    sparks.forEach(function (s) {
      var p = proj(s.x, s.y, s.z), r = Math.max(0.8, view.f * 0.006 / s.z) * 1.6;
      g.fillStyle = 'rgba(190,240,255,' + clamp(s.life * 3, 0, 1).toFixed(2) + ')'; g.fillRect(p[0], p[1], r, r);
    });
  }

  /* pixel-art background: hard 1px stars, a flat ground with a scrolling retro grid, a dithered shadow */
  function drawPixelBg(g, w, h, m) {
    g.clearRect(0, 0, w, h);
    view = computeView(w, h);
    var gy = Math.round(view.gy), i, n = Math.min(stars.length, m.stars);
    for (i = 0; i < n; i++) {
      var s = stars[i], x = Math.floor(((s.x - T * 0.004 * s.z) % 1 + 1) % 1 * w), y = Math.floor(s.y * h);
      if (y >= gy - 1) continue;
      if (Math.sin(T * 2 + s.p) < -0.7) continue;                       /* blink */
      g.fillStyle = rgb(s.z > 0.8 ? PAL[5] : s.z > 0.55 ? PAL[3] : PAL[2]);
      g.fillRect(x, y, 1, 1);
      if (s.z > 0.93) { g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); }
    }
    g.fillStyle = rgb(PAL[15]); g.fillRect(0, gy, w, h - gy);
    g.fillStyle = rgb(PAL[3]); g.fillRect(0, gy, w, 1);
    drawTown(g, w, h, gy, 1, true);
    var gh = h - gy, rows = m.pal ? 5 : 8, k;
    g.fillStyle = rgb(PAL[2]);
    for (k = 0; k < rows; k++) {                                        /* horizontal lines rush toward you */
      var u = (k + (T * 0.5) % 1) / rows; g.fillRect(0, gy + Math.round(gh * u * u) + 1, w, 1);
    }
    var gpt = proj(ufo.x, view.ground, ufo.z), sr = view.f * (narrow ? 0.46 : 0.52) * 1.05 / ufo.z, ry = sr * 0.18;
    g.fillStyle = rgb(PAL[0]);
    for (var py = Math.floor(gpt[1] - ry); py <= gpt[1] + ry; py++) for (var px = Math.floor(gpt[0] - sr); px <= gpt[0] + sr; px++) {
      var ex = (px - gpt[0]) / sr, ey = (py - gpt[1]) / ry;
      if (ex * ex + ey * ey <= 1 && ((px + py) & 1) === 0) g.fillRect(px, py, 1, 1);
    }
  }


  /* a little town on the horizon, built once per size: houses, a church spire and a few lit windows */
  var town = [];
  function buildTown() {
    var seed = 7, x = -0.01;
    function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    town = [];
    while (x < 1.02) {
      var bw = 0.022 + r() * 0.03, kind = r();
      town.push({ x: x, w: bw, h: 0.045 + r() * 0.06, roof: kind < 0.45 ? 'gable' : 'flat', hue: r(), seed: Math.floor(r() * 1000) });
      x += bw + 0.004 + r() * 0.01;
    }
    var ci = Math.floor(town.length * 0.7); town[ci].roof = 'spire'; town[ci].h = 0.14; town[ci].w = 0.032;
  }
  /* u = size of one window in drawing units; pixel modes pass 1 so everything stays on the pixel grid */
  function drawTown(g, w, h, gy, u, pixel) {
    var T4 = Math.floor(T / 5);
    town.forEach(function (b) {
      var fall = 0.55 + 0.45 * b.x, bx = Math.round(b.x * w), bw = Math.max(5, Math.round(b.w * w)), bh = Math.round(b.h * h * fall);
      var top = gy - bh;
      g.fillStyle = pixel ? rgb(b.hue > 0.5 ? PAL[1] : PAL[15]) : (b.hue > 0.5 ? '#1b2a5e' : '#141c44');
      g.fillRect(bx, top, bw, bh);
      if (b.roof === 'gable') {
        for (var i = 0; i < Math.ceil(bw / 2); i++) g.fillRect(bx + i, top - Math.ceil(bw / 2) + i + 1, bw - i * 2, 1);
      } else if (b.roof === 'spire') {
        var sw = Math.max(1, Math.round(bw * 0.3)), sh = Math.round(h * 0.07);
        g.fillRect(bx + Math.round((bw - sw) / 2), top - sh, sw, sh);
        g.fillRect(bx + Math.round(bw / 2), top - sh - Math.max(2, Math.round(u * 2)), Math.max(1, Math.round(u * 0.8)), Math.max(2, Math.round(u * 2)));
      }
      var step = Math.max(2, Math.round(u * 2.6)), ww = Math.max(1, Math.round(u)), wh = Math.max(1, Math.round(u * 1.4)), n = 0;
      for (var wy = top + step; wy < gy - step; wy += step + 1) for (var wx = bx + 2; wx < bx + bw - ww - 1; wx += step) {
        n++;
        if ((b.seed + n * 7 + T4) % 5 === 0) continue;
        g.fillStyle = pixel ? rgb((b.seed + n) % 4 === 0 ? PAL[14] : PAL[6]) : ((b.seed + n) % 4 === 0 ? '#ffa24a' : '#ffd23f');
        g.fillRect(wx, wy, ww, wh);
      }
    });
  }

  function nearest(r, g, b) {
    var best = 0, bd = 1e9;
    for (var i = 0; i < PAL.length; i++) {
      var dr = r - PAL[i][0], dg = g - PAL[i][1], db = b - PAL[i][2], d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = i; }
    }
    return PAL[best];
  }

  /* make the saucer layer proper pixel art: hard edges, limited colours, optional outline */
  function crisp(c, w, h, m) {
    var img = c.getImageData(0, 0, w, h), d = img.data, i, o, x, y;
    var lv = m.levels ? 255 / (m.levels - 1) : 0;
    for (i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      if (m.pal) { o = nearest(d[i], d[i + 1], d[i + 2]); d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; }
      else if (lv) { d[i] = Math.round(d[i] / lv) * lv; d[i + 1] = Math.round(d[i + 1] / lv) * lv; d[i + 2] = Math.round(d[i + 2] / lv) * lv; }
    }
    if (m.outline) {
      var src = new Uint8ClampedArray(d), ol = PAL[11];
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = (y * w + x) * 4;
        if (src[i + 3]) continue;
        if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 7]) || (y > 0 && src[i - w * 4 + 3]) || (y < h - 1 && src[i + w * 4 + 3])) {
          d[i] = ol[0]; d[i + 1] = ol[1]; d[i + 2] = ol[2]; d[i + 3] = 255;
        }
      }
    }
    c.putImageData(img, 0, 0);
  }

  function frame() {
    var m = MODES[mode];
    if (m.px) {                                    /* pixel-art: render small, scale up hard */
      var sc = Math.max(2, Math.round(m.px * dprK)), pw = Math.ceil(W / sc), ph = Math.ceil(H / sc);
      if (oc.width !== pw || oc.height !== ph) { oc.width = pw; oc.height = ph; uc.width = pw; uc.height = ph; }
      drawPixelBg(octx, pw, ph, m);
      renderScene(uctx, pw, ph, { flat: m.flat, layer: 'ufo' });
      crisp(uctx, pw, ph, m);
      octx.drawImage(uc, 0, 0);
      ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(oc, 0, 0, pw, ph, 0, 0, pw * sc, ph * sc);
    } else {
      renderScene(ctx, W, H, { nextgen: m.nextgen });
      if (m.nextgen) {                             /* bloom: blur a bright copy back over */
        if (bc.width !== W || bc.height !== H) { bc.width = W; bc.height = H; }
        bctx.clearRect(0, 0, W, H); bctx.drawImage(cv, 0, 0);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
        if ('filter' in ctx) ctx.filter = 'blur(6px)';
        ctx.drawImage(bc, 0, 0, W, H); ctx.restore();
        if ('filter' in ctx) ctx.filter = 'none';
      }
    }
  }

  function loop(ts) {
    raf = 0;
    if (!visible || document.hidden) return;
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.033;
    if (!last || ts - last >= 28) { last = ts; step(dt); frame(); }
    raf = requestAnimationFrame(loop);
  }
  function run() { if (reduce || raf || !visible || document.hidden) return; last = 0; raf = requestAnimationFrame(loop); }

  /* ---- the definition switch ---- */
  (function wireSwitch() {
    var btns = [].slice.call(document.querySelectorAll('[data-defn]'));
    if (!btns.length) return;
    function paint() {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-defn') === mode ? 'true' : 'false'); });
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.getAttribute('data-defn');
        if (!MODES[m]) return;
        mode = m;
        try { localStorage.setItem('pj_defn', mode); } catch (e) {}
        paint();
        if (reduce) frame();   /* static: repaint immediately */
      });
    });
    paint();
  })();

  resize();
  step(0.016);   /* the saucer needs a position before the very first frame */
  if (!reduce) { frame(); run(); } else { frame(); }
  window.addEventListener('load', function () { resize(); step(0); frame(); });   /* layout settles after fonts and images */
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); if (reduce) frame(); }).observe(hero);
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) run(); }).observe(hero);
  document.addEventListener('visibilitychange', run);
})();
