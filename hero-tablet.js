/* Socratic Suite hero: a wax tablet. A stylus scratches a question into the wax, then the
   flat end smooths it over and a different question appears. */
(function () {
  'use strict';
  var host = document.getElementById('tablet');
  if (!host) return;
  var cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var QUESTIONS = ['What is actually going wrong here?', 'What would you try first?', 'Why does that work?'];
  var FONT = '"Source Serif 4 Variable", Georgia, serif';
  var W = 0, H = 0, dpr = 1, wax = document.createElement('canvas'), scr = document.createElement('canvas'), sctx = scr.getContext('2d');
  var G = null, chars = [], fs = 28, qi = 0, phase = 'type', pt = 0, shown = 0, raf = 0, last = 0, visible = true;
  var TYPE_MS = 64, HOLD_MS = 1900, WIPE_MS = 1200, GAP_MS = 600, wipeX = 0, prevWipe = 0;

  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  function geometry() {
    var fp = W * 0.05;
    G = { fp: fp, x: fp, y: fp, w: W - 2 * fp, h: H - 2 * fp, pad: W * 0.065 };
  }

  function paintWax() {
    wax.width = W * dpr; wax.height = H * dpr;
    var c = wax.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#9a6a3e'); g.addColorStop(0.5, '#7b4f2b'); g.addColorStop(1, '#5d3a20');
    rr(c, 0, 0, W, H, 14); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(40,22,10,0.35)'; c.lineWidth = 1;
    for (var i = 0; i < 26; i++) { var y = Math.random() * H; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(W * 0.3, y + Math.random() * 8 - 4, W * 0.7, y + Math.random() * 8 - 4, W, y + Math.random() * 6 - 3); c.stroke(); }
    c.strokeStyle = 'rgba(255,225,180,0.25)'; rr(c, 1.5, 1.5, W - 3, H - 3, 13); c.stroke();
    var wg = c.createLinearGradient(0, G.y, 0, G.y + G.h);
    wg.addColorStop(0, '#2c2019'); wg.addColorStop(1, '#3a2a21');
    rr(c, G.x, G.y, G.w, G.h, 6); c.fillStyle = wg; c.fill();
    c.save(); rr(c, G.x, G.y, G.w, G.h, 6); c.clip();
    for (var k = 0; k < 2600; k++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(255,230,200,0.05)' : 'rgba(0,0,0,0.12)'; c.fillRect(G.x + Math.random() * G.w, G.y + Math.random() * G.h, 1.4, 1.4); }
    for (var s = 0; s < 14; s++) { c.fillStyle = 'rgba(255,230,200,0.035)'; c.fillRect(G.x + Math.random() * G.w * 0.5, G.y + Math.random() * G.h, G.w * (0.2 + Math.random() * 0.5), 1); }
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 2; rr(c, G.x, G.y, G.w, G.h, 6); c.stroke();
  }

  function layout() {
    fs = W * 0.056;
    ctx.font = '500 ' + fs + 'px ' + FONT;
    var words = QUESTIONS[qi].split(' '), lines = [''], maxw = G.w - 2 * G.pad, i;
    for (i = 0; i < words.length; i++) {
      var tryLine = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + words[i] : words[i];
      if (ctx.measureText(tryLine).width > maxw && lines[lines.length - 1]) lines.push(words[i]); else lines[lines.length - 1] = tryLine;
    }
    chars = [];
    var top = G.y + G.h * 0.5 - (lines.length - 1) * fs * 0.7;
    lines.forEach(function (ln, li) {
      for (var k = 0; k < ln.length; k++) {
        var pre = ctx.measureText(ln.slice(0, k)).width, cw = ctx.measureText(ln[k]).width;
        if (ln[k] !== ' ') chars.push({ ch: ln[k], x: G.x + G.pad + pre, y: top + li * fs * 1.4, w: cw, jx: Math.random() * 1.2 - 0.6, jy: Math.random() * 1.2 - 0.6, jr: (Math.random() - 0.5) * 0.07 });
        else chars.push({ ch: ' ', x: G.x + G.pad + pre, y: top + li * fs * 1.4, w: cw, skip: true });
      }
    });
  }

  function etch(c) {
    if (c.skip) return;
    sctx.save(); sctx.translate(c.x + c.jx, c.y + c.jy); sctx.rotate(c.jr);
    sctx.font = '500 ' + fs + 'px ' + FONT; sctx.textBaseline = 'alphabetic';
    sctx.fillStyle = 'rgba(0,0,0,0.55)'; sctx.fillText(c.ch, 1.6, 1.6);
    sctx.fillStyle = '#ecdbb8'; sctx.fillText(c.ch, 0, 0);
    sctx.strokeStyle = 'rgba(236,219,184,0.55)'; sctx.lineWidth = 0.6; sctx.strokeText(c.ch, 0, 0);
    sctx.restore();
  }

  function clearScratch() { sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, scr.width, scr.height); sctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

  function stylus(tx, ty, flat) {
    var w = W * 0.015, L = W * 0.36;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(-1.0);
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 7;
    var g = ctx.createLinearGradient(0, -w, 0, w); g.addColorStop(0, '#e6c88f'); g.addColorStop(0.5, '#b98c4c'); g.addColorStop(1, '#7a5528');
    ctx.fillStyle = g; ctx.beginPath();
    if (!flat) {
      ctx.moveTo(0, 0); ctx.lineTo(L * 0.14, -w * 0.62); ctx.lineTo(L, -w * 0.5); ctx.lineTo(L, w * 0.5); ctx.lineTo(L * 0.14, w * 0.62);
    } else {
      ctx.moveTo(0, -w * 2.2); ctx.lineTo(w * 1.2, -w * 2.2); ctx.lineTo(w * 1.2, -w * 0.6); ctx.lineTo(L, -w * 0.5); ctx.lineTo(L, w * 0.5);
      ctx.lineTo(w * 1.2, w * 0.6); ctx.lineTo(w * 1.2, w * 2.2); ctx.lineTo(0, w * 2.2);
    }
    ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#5b3d1c'; ctx.fillRect(L * 0.82, -w * 0.56, L * 0.04, w * 1.12); ctx.fillRect(L * 0.88, -w * 0.56, L * 0.04, w * 1.12);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.drawImage(wax, 0, 0, W, H);
    ctx.save(); rr(ctx, G.x, G.y, G.w, G.h, 6); ctx.clip(); ctx.drawImage(scr, 0, 0, W, H); ctx.restore();
    var last = chars[Math.max(0, Math.min(chars.length, shown) - 1)] || chars[0];
    if (phase === 'type' || phase === 'hold') {
      var tx = last ? last.x + last.w : G.x + G.pad, ty = last ? last.y - fs * 0.22 : G.y + G.h * 0.5;
      if (phase === 'type') ty += Math.sin(pt / 55) * 1.4;
      stylus(tx, ty, false);
    } else if (phase === 'wipe') {
      stylus(wipeX, G.y + G.h * 0.5 + Math.sin(pt / 90) * 3, true);
    }
  }

  function startQuestion() { layout(); clearScratch(); shown = 0; pt = 0; phase = 'type'; }

  function tick(dt) {
    pt += dt;
    if (phase === 'type') {
      var want = Math.min(chars.length, Math.floor(pt / TYPE_MS));
      while (shown < want) { etch(chars[shown]); shown++; }
      if (shown >= chars.length) { phase = 'hold'; pt = 0; }
    } else if (phase === 'hold') {
      if (pt > HOLD_MS) { phase = 'wipe'; pt = 0; prevWipe = G.x; wipeX = G.x; }
    } else if (phase === 'wipe') {
      var p = Math.min(1, pt / WIPE_MS); wipeX = G.x + (G.w) * ease(p);
      sctx.save(); sctx.globalCompositeOperation = 'destination-out';
      sctx.fillRect(prevWipe - 2, G.y, wipeX - prevWipe + 6, G.h); sctx.restore();
      sctx.fillStyle = 'rgba(255,236,205,0.05)'; sctx.fillRect(prevWipe, G.y, wipeX - prevWipe, G.h);
      prevWipe = wipeX;
      if (p >= 1) { phase = 'gap'; pt = 0; }
    } else if (phase === 'gap') {
      if (pt > GAP_MS) { qi = (qi + 1) % QUESTIONS.length; startQuestion(); }
    }
  }

  function loop(ts) {
    raf = 0; if (!visible || document.hidden) return;
    var dt = last ? Math.min(60, ts - last) : 16; last = ts;
    tick(dt); render();
    raf = requestAnimationFrame(loop);
  }
  function run() { if (reduce || raf || !visible || document.hidden) return; last = 0; raf = requestAnimationFrame(loop); }

  function size() {
    var r = host.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    [cv, scr].forEach(function (c) { c.width = W * dpr; c.height = H * dpr; });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geometry(); paintWax(); startQuestion();
    if (reduce) { while (shown < chars.length) { etch(chars[shown]); shown++; } phase = 'hold'; render(); }
  }

  function init() {
    size();
    if (!reduce) run();
    if (window.ResizeObserver) { var t; new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { var r = host.getBoundingClientRect(); if (Math.round(r.width) !== W) size(); }, 120); }).observe(host); }
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) run(); }).observe(host);
    document.addEventListener('visibilitychange', run);
  }
  if (document.fonts && document.fonts.load) document.fonts.load('500 28px ' + FONT).then(init, init); else init();
})();
