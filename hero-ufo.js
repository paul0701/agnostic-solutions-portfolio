/* Games hero: a small 3D flying saucer drawn from a real mesh, with stars, a ground
   shadow and laser bolts. Runs only while the hero is on screen. */
(function () {
  'use strict';
  var cv = document.getElementById('ufoFx');
  if (!cv) return;
  var hero = cv.parentElement, ctx = cv.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 8, H = 8, T = 0, last = 0, raf = 0, visible = true, narrow = false;
  var stars = [], bolts = [], sparks = [], ufo = { t: 1.2, fire: 0.6, side: 1 };
  var view = { f: 600, cx: 0, cy: 0, ground: 1, gy: 0 };

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

  function resize() {
    var r = hero.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    narrow = r.width < 760;
    W = Math.max(8, Math.round(r.width * dpr)); H = Math.max(8, Math.round(r.height * dpr));
    cv.width = W; cv.height = H;
    view.gy = H * (narrow ? 0.93 : 0.88);
    view.cx = narrow ? W * 0.5 : W * 0.7;
    view.cy = narrow ? H * 0.66 : H * 0.36;
    view.f = narrow ? Math.min(W * 0.95, H * 0.85) : Math.min(W * 0.6, H * 1.0);
    view.ground = (view.gy - view.cy) * 3.4 / view.f;
    stars = [];
    for (var i = 0; i < 120; i++) stars.push({ x: Math.random(), y: Math.random() * 0.85, z: rnd(0.3, 1), p: Math.random() * 6 });
    if (reduce) { for (var k = 0; k < 70; k++) step(1 / 30); draw(); }
  }

  function step(dt) {
    T += dt; ufo.t += dt; var t = ufo.t;
    ufo.x = Math.sin(t * 0.55) * (narrow ? 0.7 : 1.0);
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

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var S = narrow ? 0.46 : 0.52, i;

    stars.forEach(function (s) {
      var x = ((s.x - T * 0.004 * s.z) % 1 + 1) % 1 * W, y = s.y * H, tw = 0.55 + 0.45 * Math.sin(T * 2 + s.p);
      ctx.fillStyle = 'rgba(210,235,255,' + (0.25 + 0.6 * s.z * tw).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(x, y, 0.5 + s.z * 0.9, 0, 6.283); ctx.fill();
    });

    var gr = ctx.createLinearGradient(0, view.gy, 0, H);
    gr.addColorStop(0, '#16224d'); gr.addColorStop(1, '#070b22');
    ctx.fillStyle = gr; ctx.fillRect(0, view.gy, W, H - view.gy);
    ctx.fillStyle = 'rgba(140,170,255,0.35)'; ctx.fillRect(0, view.gy, W, 1);

    var g = proj(ufo.x, view.ground, ufo.z), sr = view.f * S * 1.05 / ufo.z;
    ctx.save(); ctx.translate(g[0], g[1]); ctx.scale(1, 0.18);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(0, 0, sr, 0, 6.283); ctx.fill(); ctx.restore();

    var pitch = 0.42, yaw = ufo.yaw, roll = ufo.roll, list = [];
    for (i = 0; i < mesh.length; i++) {
      var f = mesh[i], n = rot(f.n, yaw, roll, pitch), pts = [], zs = 0, k;
      for (k = 0; k < 4; k++) {
        var r = rot([f.v[k][0] * S, f.v[k][1] * S, f.v[k][2] * S], yaw, roll, pitch);
        pts.push([r[0] + ufo.x, r[1] + ufo.y, r[2] + ufo.z]); zs += r[2] + ufo.z;
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
      var spec = Math.pow(Math.max(0, (q.n[0] * hx + q.n[1] * hy + q.n[2] * hz) / hl), 18) * (q.f.m === 0 ? 1.0 : q.f.m === 1 ? 0.7 : 0.25) * 70;
      var b = BASE[q.f.m];
      var col = 'rgb(' + clamp(Math.round(b[0] * kk + spec), 0, 255) + ',' + clamp(Math.round(b[1] * kk + spec), 0, 255) + ',' + clamp(Math.round(b[2] * kk + spec), 0, 255) + ')';
      ctx.beginPath();
      for (var k2 = 0; k2 < 4; k2++) { var p = proj(q.pts[k2][0], q.pts[k2][1], q.pts[k2][2]); if (k2 === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
      ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.stroke();
    });

    for (var li = 0; li < 10; li++) {
      var ang = yaw + li / 10 * 6.283, rp = rot([Math.cos(ang) * 0.98 * S, 0.05 * S, Math.sin(ang) * 0.98 * S], 0, roll, pitch);
      if (rp[2] > 0.15 * S) continue;
      var lz = rp[2] + ufo.z, ps = proj(rp[0] + ufo.x, rp[1] + ufo.y, lz), on = (Math.floor(T * 4 + li) % 3) !== 0;
      ctx.fillStyle = li % 2 ? '#ffd23f' : '#ff5f8a'; ctx.globalAlpha = on ? 1 : 0.4;
      ctx.beginPath(); ctx.arc(ps[0], ps[1], Math.max(1, view.f * 0.035 * S / lz * (on ? 1 : 0.5)), 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
    }

    bolts.forEach(function (b) {
      var a = proj(b.x, b.y, b.z), c = proj(b.x - b.dx * 0.32, b.y - b.dy * 0.32, b.z - b.dz * 0.32);
      ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = Math.max(1, view.f * 0.012 / b.z); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    });
    sparks.forEach(function (s) {
      var p = proj(s.x, s.y, s.z), r = Math.max(0.8, view.f * 0.006 / s.z) * 1.6;
      ctx.fillStyle = 'rgba(190,240,255,' + clamp(s.life * 3, 0, 1).toFixed(2) + ')'; ctx.fillRect(p[0], p[1], r, r);
    });
  }

  function loop(ts) {
    raf = 0;
    if (!visible || document.hidden) return;
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.033;
    if (!last || ts - last >= 28) { last = ts; step(dt); draw(); }
    raf = requestAnimationFrame(loop);
  }
  function run() { if (reduce || raf || !visible || document.hidden) return; last = 0; raf = requestAnimationFrame(loop); }

  resize();
  if (!reduce) { draw(); run(); }
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(hero);
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) run(); }).observe(hero);
  document.addEventListener('visibilitychange', run);
})();
