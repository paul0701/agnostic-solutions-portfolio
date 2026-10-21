/* Lab hero: seven flasks and an empty one. Pour two flasks in and, if the pair is a real recipe,
   one of the ideas in the lab is revealed below. Found ideas are remembered in this browser. */
(function () {
  'use strict';
  var lab = document.getElementById('lab');
  if (!lab) return;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var STORE_KEY = 'pj_lab_found';

  /* glass outlines in a 120 x 200 box, plus where the liquid can sit (top of the body, bottom of the glass) */
  var KINDS = {
    conical: { d: 'M48 8 L48 66 L14 166 Q9 186 28 186 L92 186 Q111 186 106 166 L72 66 L72 8 Z', top: 38, bottom: 186 },
    round:   { d: 'M50 8 L50 79 A50 50 0 1 0 70 79 L70 8 Z', top: 46, bottom: 178 },
    beaker:  { d: 'M16 22 L16 178 Q16 187 25 187 L95 187 Q104 187 104 178 L104 22 Z', top: 26, bottom: 187 },
    tall:    { d: 'M38 8 L38 168 Q38 188 60 188 Q82 188 82 168 L82 8 Z', top: 14, bottom: 188 }
  };

  var INGS = [
    { id: 'dread',     name: 'Dread',         c: '#d9483b', kind: 'conical' },
    { id: 'puzzles',   name: 'Puzzles',       c: '#7a5ce0', kind: 'tall' },
    { id: 'pressure',  name: 'Pressure',      c: '#e8a33d', kind: 'beaker' },
    { id: 'data',      name: 'Data',          c: '#3f86e0', kind: 'round' },
    { id: 'plain',     name: 'Plain English', c: '#2bb5a0', kind: 'conical' },
    { id: 'questions', name: 'Questions',     c: '#e0657a', kind: 'tall' },
    { id: 'records',   name: 'Records',       c: '#7bb33a', kind: 'beaker' }
  ];

  /* pair of ingredients (in alphabetical order) -> the card it reveals */
  var RECIPES = {
    'dread+records': 'trial-log',
    'dread+pressure': 'the-hotel',
    'pressure+questions': '991',
    'dread+puzzles': 'last-light',
    'dread+questions': 'the-street',
    'plain+questions': 'query-triage',
    'data+records': 'absence-reporting',
    'data+plain': 'financeiq'
  };
  var IDS = [];
  Object.keys(RECIPES).forEach(function (k) { IDS.push(RECIPES[k]); });
  var TOTAL = IDS.length;

  var stage = lab.querySelector('.lab__stage'), shelf = lab.querySelector('.lab__shelf'),
      vesselHost = document.getElementById('vessel'), stream = lab.querySelector('.lab__stream'),
      say = document.getElementById('say'), countEl = document.getElementById('count'),
      emptyBtn = document.getElementById('empty'), skipBtn = document.getElementById('skip');
  var START_TEXT = 'Pick two flasks and see what you make.';

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function wavePath(y, amp) {
    var d = 'M-60 ' + y, x;
    for (x = -60; x < 190; x += 30) d += ' q7.5 ' + (-amp) + ' 15 0 t15 0';
    return d + ' L190 300 L-60 300 Z';
  }
  function toRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var x = toRgb(a), y = toRgb(b), o = [], i;
    for (i = 0; i < 3; i++) o.push(Math.round(x[i] + (y[i] - x[i]) * t));
    return 'rgb(' + o.join(',') + ')';
  }
  function toHex(rgb) {
    var m = rgb.match(/\d+/g);
    return '#' + m.map(function (n) { var s = (+n).toString(16); return s.length < 2 ? '0' + s : s; }).join('');
  }

  /* one piece of glassware: returns the svg plus a way to set how full it is and what colour */
  function glass(kind, color, uid, p) {
    var K = KINDS[kind];
    var svg = el('svg', { viewBox: '0 0 120 204', 'aria-hidden': 'true', focusable: 'false' });
    var defs = el('defs', {}, svg);
    var cp = el('clipPath', { id: uid }, defs); el('path', { d: K.d }, cp);

    el('path', { d: K.d, fill: 'rgba(255,255,255,0.45)' }, svg);

    var clip = el('g', { 'clip-path': 'url(#' + uid + ')' }, svg);
    var lq = el('g', { 'class': 'lq' }, clip);
    var fills = [];
    var w1 = el('path', { d: wavePath(K.top, 3), opacity: '0.55', 'class': 'wave wave--a' }, lq);
    var w2 = el('path', { d: wavePath(K.top + 1.5, 2.5), 'class': 'wave wave--b' }, lq);
    fills.push(w1, w2);
    for (var b = 0; b < 4; b++) {
      var rise = Math.max(14, K.bottom - K.top - 14);
      var bub = el('circle', { cx: 40 + ((b * 23) % 44), cy: K.bottom - 10, r: 2 + (b % 3), fill: '#fff', opacity: '0', 'class': 'bubble' }, lq);
      bub.style.setProperty('--rise', '-' + rise + 'px');
      bub.style.animationDelay = (-b * 0.9) + 's';
      bub.style.animationDuration = (2.6 + b * 0.5) + 's';
    }

    el('path', { d: K.d, fill: 'none', stroke: '#5d7a86', 'stroke-width': '3', 'stroke-linejoin': 'round' }, svg);
    el('path', { d: 'M' + (kind === 'tall' ? 46 : kind === 'beaker' ? 24 : 52) + ' ' + (K.top + 14) + ' L' + (kind === 'tall' ? 46 : kind === 'beaker' ? 24 : 40) + ' ' + (K.bottom - 30),
      stroke: '#fff', 'stroke-width': '3', 'stroke-linecap': 'round', opacity: '0.7', fill: 'none' }, svg);
    el('rect', { x: String(kind === 'beaker' ? 12 : kind === 'tall' ? 34 : kind === 'round' ? 46 : 44), y: '4',
      width: String(kind === 'beaker' ? 96 : kind === 'tall' ? 52 : kind === 'round' ? 28 : 32), height: '6', rx: '3',
      fill: 'none', stroke: '#5d7a86', 'stroke-width': '3' }, svg);
    el('rect', { x: '0', y: '192', width: '120', height: '7', rx: '2', fill: '#a9bcc6', 'class': 'plate' }, svg);
    el('rect', { x: '0', y: '199', width: '120', height: '3', fill: '#8ba1ad', 'class': 'plate' }, svg);

    var api = {
      svg: svg, kind: kind,
      setColor: function (c) { fills.forEach(function (f) { f.style.fill = c; }); },
      setLevel: function (v) {
        var t = (K.bottom - K.top) * (1 - v) + (v <= 0 ? 12 : 0);
        lq.style.transform = 'translateY(' + t + 'px)';
      }
    };
    api.setColor(color);
    api.setLevel(p);
    return api;
  }

  /* ---- build the shelf and the empty flask ---- */
  var FULL = 0.72;
  INGS.forEach(function (g, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ing'; b.setAttribute('aria-label', g.name + ', pour it in');
    var wrap = document.createElement('span'); wrap.className = 'ing__glass';
    g.glass = glass(g.kind, g.c, 'ing' + i, FULL);
    wrap.appendChild(g.glass.svg);
    var nm = document.createElement('span'); nm.className = 'ing__name'; nm.textContent = g.name;
    b.appendChild(wrap); b.appendChild(nm); shelf.appendChild(b);
    g.btn = b; g.wrap = wrap;
    b.addEventListener('click', function () { pour(i); });
  });

  var vessel = glass('round', '#9fb3bd', 'clip-mixer', 0);
  vessel.svg.setAttribute('class', 'lab__vsvg');
  var burst = el('circle', { cx: '60', cy: '120', r: '40', 'class': 'burst' }, vessel.svg);
  vesselHost.appendChild(vessel.svg);

  /* ---- state ---- */
  var first = -1, poured = 0, busy = false, found = [];
  try { found = JSON.parse(store(STORE_KEY) || '[]').filter(function (id) { return IDS.indexOf(id) > -1; }); } catch (e) { found = []; }

  function card(id) { return document.querySelector('[data-find="' + id + '"]'); }
  function syncSections() {
    ['bench-sec', 'ts-sec'].forEach(function (sid) {
      var s = document.getElementById(sid);
      if (s) s.hidden = !s.querySelector('[data-find]:not([hidden])');
    });
  }
  function reveal(id, fresh) {
    var c = card(id); if (!c) return;
    c.hidden = false;
    var bar = c.querySelector('.bar > i'), val = c.getAttribute('data-progress');
    if (bar && val) {
      bar.style.setProperty('--p', 0);
      requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.setProperty('--p', val); }); });
    }
    if (fresh) { c.classList.remove('is-new'); void c.offsetWidth; c.classList.add('is-new'); }
    syncSections();
  }
  function updateCount() {
    countEl.textContent = found.length >= TOTAL ? 'All ' + TOTAL + ' found' : found.length + ' of ' + TOTAL + ' found';
  }
  function setSay(parts) {
    say.textContent = '';
    parts.forEach(function (p) { say.appendChild(p); });
    var over = say.getBoundingClientRect().bottom - (window.innerHeight - 12);
    if (over > 0) window.scrollBy({ top: over, behavior: reduce ? 'auto' : 'smooth' });
  }
  function textNode(t) { var s = document.createElement('span'); s.textContent = t; return s; }

  found.forEach(function (id) { reveal(id, false); });
  updateCount();

  /* ---- the pour ---- */
  function clearStream() { while (stream.firstChild) stream.removeChild(stream.firstChild); }

  function drawStream(g, dir) {
    var sr = stage.getBoundingClientRect(), br = g.btn.getBoundingClientRect(), vr = vessel.svg.getBoundingClientRect();
    var w = g.wrap.offsetWidth, h = g.wrap.offsetHeight;
    var bx = br.left - sr.left + g.wrap.offsetLeft + w / 2;
    var by = br.top - sr.top + g.wrap.offsetTop + h * 0.94;
    var gh = h * 0.9, th = 52 * Math.PI / 180;
    var sx = bx + dir * gh * Math.sin(th), sy = by - gh * Math.cos(th);
    var ex = vr.left - sr.left + vr.width / 2, ey = vr.top - sr.top + vr.height * 0.2;
    stream.setAttribute('viewBox', '0 0 ' + sr.width + ' ' + sr.height);
    clearStream();
    var d = 'M' + sx + ' ' + sy + ' C' + sx + ' ' + (sy + (ey - sy) * 0.5) + ' ' + ex + ' ' + (ey - (ey - sy) * 0.4) + ' ' + ex + ' ' + ey;
    el('path', { d: d, fill: 'none', stroke: g.c, 'stroke-width': '6', 'stroke-linecap': 'round', pathLength: '100' }, stream);
  }

  function pour(i) {
    if (busy) return;
    if (poured === 2) {
      reset();
      busy = true;
      setTimeout(function () { busy = false; pour(i); }, reduce ? 0 : 550);
      return;
    }
    if (first === i) {
      setSay([textNode(INGS[i].name + ' is already in. Pick a different flask.')]);
      return;
    }
    busy = true;
    var g = INGS[i], second = poured === 1, firstG = INGS[first];
    var vr = vessel.svg.getBoundingClientRect(), br = g.btn.getBoundingClientRect();
    var dir = (vr.left + vr.width / 2) < (br.left + br.width / 2) ? -1 : 1;
    poured++;

    if (!reduce) g.btn.classList.add(dir < 0 ? 'is-tilt-l' : 'is-tilt-r');
    setTimeout(function () {
      if (!reduce) { drawStream(g, dir); }
      g.glass.setLevel(0.3);
      g.btn.classList.add('is-used');
      if (second) {
        vessel.setColor(mix(firstG.c, g.c, 0.5)); /* even blend of the two */
        vessel.setLevel(0.8);
        vesselHost.style.setProperty('--mix', mix(firstG.c, g.c, 0.5));
      } else {
        vessel.setColor(g.c);
        vessel.setLevel(0.42);
      }
      emptyBtn.hidden = false;
    }, reduce ? 0 : 450);

    setTimeout(function () {
      g.btn.classList.remove('is-tilt-l', 'is-tilt-r');
      clearStream();
      if (!second) {
        first = i; busy = false;
        setSay([textNode(g.name + ' is in. Add one more.')]);
      } else {
        react(first, i);
      }
    }, reduce ? 150 : 1750);
  }

  function react(a, b) {
    var key = [INGS[a].id, INGS[b].id].sort().join('+'), id = RECIPES[key];
    vesselHost.classList.add(id ? 'is-hit' : 'is-miss');
    if (!id) vessel.setColor(mix(toHex(mix(INGS[a].c, INGS[b].c, 0.5)), '#8d9186', 0.65));
    setTimeout(function () { showResult(a, b, id); busy = false; }, reduce ? 150 : 1100);
  }

  function showResult(a, b, id) {
    if (!id) {
      var lines = [
        INGS[a].name + ' and ' + INGS[b].name + ' just go cloudy. Try another pair.',
        INGS[a].name + ' meets ' + INGS[b].name + ' and not much happens. Try another pair.',
        'A flat fizz. ' + INGS[a].name + ' and ' + INGS[b].name + ' do not make anything yet.'
      ];
      setSay([textNode(lines[(a + b) % 3])]);
      return;
    }
    var c = card(id), title = c.querySelector('.h3').textContent, tag = c.querySelector('.tag').textContent;
    var isNew = found.indexOf(id) < 0;
    if (isNew) { found.push(id); store(STORE_KEY, JSON.stringify(found)); reveal(id, true); updateCount(); }
    var strong = document.createElement('strong'); strong.textContent = title;
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn--small'; btn.textContent = 'See it';
    btn.addEventListener('click', function () { goTo(c); });
    var lead = textNode(isNew ? 'You made ' : 'You have made this one already: ');
    var tg = textNode(tag); tg.className = 'tag';
    setSay([lead, strong, tg, btn]);
    if (found.length >= TOTAL && isNew) {
      var all = textNode(' That is everything on the bench.'); say.appendChild(all);
    }
  }

  function goTo(c) {
    c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    try { c.focus({ preventScroll: true }); } catch (e) { c.focus(); }
    c.classList.remove('is-new'); void c.offsetWidth; c.classList.add('is-new');
  }

  function reset() {
    first = -1; poured = 0;
    vesselHost.classList.remove('is-hit', 'is-miss');
    vessel.setLevel(0);
    INGS.forEach(function (g) {
      g.glass.setLevel(FULL);
      g.btn.classList.remove('is-used', 'is-tilt-l', 'is-tilt-r');
    });
    clearStream();
    emptyBtn.hidden = true;
    setSay([textNode(START_TEXT)]);
  }

  emptyBtn.addEventListener('click', function () { if (!busy) reset(); });

  skipBtn.addEventListener('click', function () {
    IDS.forEach(function (id) { reveal(id, false); });
    skipBtn.hidden = true;
    countEl.textContent = 'Everything is showing below';
  });
  window.addEventListener('resize', clearStream);
})();
