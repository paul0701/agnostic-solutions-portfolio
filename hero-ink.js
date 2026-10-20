/* Home hero: a pencil you can pick up and scribble with, just for fun.
   Pointer drawing on its own canvas above the hero, so Replay never wipes it. */
(function () {
  'use strict';
  var cv = document.getElementById('inkFx'), pen = document.getElementById('penBtn'), clr = document.getElementById('penClear');
  if (!cv || !pen) return;
  var hero = cv.parentElement, ctx = cv.getContext('2d');
  var INK = '#2f3744', W = 0, H = 0, strokes = [], cur = null, on = false;

  function size() {
    var r = hero.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  function line(s) {
    var p = s.pts; if (!p.length) return;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    if (p.length === 1) { ctx.lineTo(p[0][0] + 0.1, p[0][1]); }
    for (var i = 1; i < p.length - 1; i++) {
      var mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
    }
    if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
  }
  function redraw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.globalAlpha = 0.92;
    for (var i = 0; i < strokes.length; i++) line(strokes[i]);
    if (clr) clr.hidden = !strokes.length;
  }
  function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  function setOn(v) {
    on = v; hero.classList.toggle('is-inking', on);
    pen.setAttribute('aria-pressed', on ? 'true' : 'false');
    pen.setAttribute('aria-label', on ? 'Put the pencil down' : 'Pick up the pencil and draw on the page');
  }
  pen.addEventListener('click', function () { setOn(!on); });
  if (clr) clr.addEventListener('click', function () { strokes = []; cur = null; redraw(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && on) setOn(false); });

  cv.addEventListener('pointerdown', function (e) {
    if (!on) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    cur = { pts: [pos(e)] }; strokes.push(cur); redraw();
  });
  cv.addEventListener('pointermove', function (e) {
    if (!cur) return;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (var i = 0; i < evs.length; i++) cur.pts.push(pos(evs[i]));
    redraw();
  });
  function end() { cur = null; }
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(size, 120); });
  size();
})();
