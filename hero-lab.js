/* Lab hero: a shelf of glassware. Each flask is one project from the "On the bench" list on this
   page. Fill level is how far along it is, steam means it is being worked on, and frost means it
   is on ice for now. The data comes from the list itself, so the picture is always the real state. */
(function () {
  'use strict';
  var host = document.getElementById('bench');
  if (!host) return;
  var NS = 'http://www.w3.org/2000/svg';

  /* glass outlines in a 120 x 200 box, plus where the liquid can sit (top of the body, bottom of the glass) */
  var KINDS = {
    conical: { d: 'M48 8 L48 66 L14 166 Q9 186 28 186 L92 186 Q111 186 106 166 L72 66 L72 8 Z', top: 38, bottom: 186 },
    round:   { d: 'M50 8 L50 79 A50 50 0 1 0 70 79 L70 8 Z', top: 46, bottom: 178 },
    beaker:  { d: 'M16 22 L16 178 Q16 187 25 187 L95 187 Q104 187 104 178 L104 22 Z', top: 26, bottom: 187 },
    tall:    { d: 'M38 8 L38 168 Q38 188 60 188 Q82 188 82 168 L82 8 Z', top: 14, bottom: 188 }
  };
  var COLORS = ['#2bb5a0', '#e8a33d', '#7a5ce0', '#3f86e0', '#e0657a'];

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

  var items = [].slice.call(document.querySelectorAll('[data-bench]')).map(function (e, i) {
    return { name: e.getAttribute('data-name'), kind: e.getAttribute('data-kind') || 'conical',
             p: Math.max(0, Math.min(100, +e.getAttribute('data-progress') || 0)), state: e.getAttribute('data-state') || 'active', c: COLORS[i % COLORS.length] };
  });

  items.forEach(function (it, i) {
    var K = KINDS[it.kind] || KINDS.conical, iced = it.state === 'parked', id = 'fl' + i;
    var fig = document.createElement('figure'); fig.className = 'flask';
    var svg = el('svg', { viewBox: '0 0 120 232', role: 'img', 'aria-label': it.name + ', ' + it.p + ' percent, ' + (iced ? 'on ice' : 'in progress') });
    var defs = el('defs', {}, svg);
    var cp = el('clipPath', { id: id }, defs); el('path', { d: K.d }, cp);
    var blur = el('filter', { id: id + 'b', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs); el('feGaussianBlur', { stdDeviation: '4' }, blur);

    var level = K.bottom - (K.bottom - K.top) * (it.p / 100);

    /* back of the glass */
    el('path', { d: K.d, fill: 'rgba(255,255,255,0.45)' }, svg);

    /* liquid */
    var liq = el('g', { 'clip-path': 'url(#' + id + ')' }, svg);
    var fill = iced ? '#bfe7f3' : it.c;
    if (!iced) {
      var w1 = el('path', { d: wavePath(level, 3), fill: fill, opacity: '0.55', class: 'wave wave--a' }, liq);
      w1.style.animationDelay = (-i * 0.7) + 's';
      var w2 = el('path', { d: wavePath(level + 1.5, 2.5), fill: fill, class: 'wave wave--b' }, liq);
      w2.style.animationDelay = (-i * 0.4) + 's';
      for (var b = 0; b < 4; b++) {
        var rise = Math.max(14, K.bottom - level - 14);
        var bub = el('circle', { cx: 40 + ((b * 23 + i * 11) % 44), cy: K.bottom - 10, r: 2 + (b % 3), fill: '#fff', opacity: '0', class: 'bubble' }, liq);
        bub.style.setProperty('--rise', '-' + rise + 'px'); bub.style.animationDelay = (-b * 0.9 - i * 0.3) + 's'; bub.style.animationDuration = (2.6 + b * 0.5) + 's';
      }
    } else {
      el('path', { d: wavePath(level, 0), fill: fill, opacity: '0.9' }, liq);
      var pid = id + 'h', pat = el('pattern', { id: pid, width: '9', height: '9', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' }, defs);
      el('path', { d: 'M0 0 L0 9', stroke: '#fff', 'stroke-width': '1.6', opacity: '0.8' }, pat);
      el('rect', { x: '0', y: String(level), width: '120', height: '200', fill: 'url(#' + pid + ')' }, liq);
      el('rect', { x: '0', y: String(level), width: '120', height: '5', fill: '#fff', opacity: '0.85' }, liq);
    }

    /* highlight and outline */
    el('path', { d: K.d, fill: 'none', stroke: iced ? '#8fcfe2' : '#5d7a86', 'stroke-width': iced ? '4' : '3', 'stroke-linejoin': 'round' }, svg);
    el('path', { d: 'M' + (it.kind === 'tall' ? 46 : it.kind === 'beaker' ? 24 : 52) + ' ' + (K.top + 14) + ' L' + (it.kind === 'tall' ? 46 : it.kind === 'beaker' ? 24 : 40) + ' ' + (K.bottom - 30),
      stroke: '#fff', 'stroke-width': '3', 'stroke-linecap': 'round', opacity: '0.7', fill: 'none' }, svg);
    el('rect', { x: String((it.kind === 'beaker' ? 12 : it.kind === 'tall' ? 34 : it.kind === 'round' ? 46 : 44)), y: '4', width: String((it.kind === 'beaker' ? 96 : it.kind === 'tall' ? 52 : it.kind === 'round' ? 28 : 32)), height: '6', rx: '3', fill: 'none', stroke: iced ? '#8fcfe2' : '#5d7a86', 'stroke-width': '3' }, svg);

    if (iced) {
      [[28, 120], [92, 150], [60, 170], [76, 100]].forEach(function (c, n) {
        var g = el('g', { transform: 'translate(' + c[0] + ' ' + c[1] + ')', class: 'glint' }, svg); g.style.animationDelay = (-n * 0.8) + 's';
        el('path', { d: 'M0 -6 L0 6 M-6 0 L6 0 M-4 -4 L4 4 M-4 4 L4 -4', stroke: '#fff', 'stroke-width': '1.6', 'stroke-linecap': 'round' }, g);
      });
      var rimY = it.kind === 'beaker' ? 24 : 10, ix = it.kind === 'beaker' ? [28, 44, 76, 92] : it.kind === 'tall' ? [44, 54, 66, 76] : [50, 57, 64, 70];
      ix.forEach(function (x, n2) { el('path', { d: 'M' + x + ' ' + rimY + ' l3 ' + (10 + (n2 % 2) * 7) + ' l3 -' + (10 + (n2 % 2) * 7) + ' z', fill: '#d9f2fa', stroke: '#8fcfe2', 'stroke-width': '1' }, svg); });
    } else {
      for (var s = 0; s < 3; s++) {
        var st = el('circle', { cx: 52 + s * 8, cy: 0, r: 9 - s, fill: '#fff', opacity: '0', filter: 'url(#' + id + 'b)', class: 'steam' }, svg);
        st.style.animationDelay = (-s * 1.1 - i * 0.5) + 's';
      }
    }

    /* shelf */
    el('rect', { x: '0', y: '192', width: '120', height: '7', rx: '2', fill: '#a9bcc6' }, svg);
    el('rect', { x: '0', y: '199', width: '120', height: '3', fill: '#8ba1ad' }, svg);

    var cap = document.createElement('figcaption');
    var nm = document.createElement('strong'); nm.textContent = it.name;
    var st2 = document.createElement('span'); st2.textContent = (iced ? 'On ice' : 'Active') + ', ' + it.p + '%';
    cap.appendChild(nm); cap.appendChild(st2);
    fig.appendChild(svg); fig.appendChild(cap); host.appendChild(fig);
  });
})();
