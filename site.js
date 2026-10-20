/* Shared behaviour: the mobile menu, bar fills, the vote, the "this would help" buttons,
   the Lab form and the Patreon line. Each part only runs on the pages that have it. */
(function () {
  'use strict';
  var PJ = window.PJ || {};

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function api(method, ns, id) {
    var url = PJ.voteApi || '/api/votes';
    if (method === 'GET') return fetch(url + '?ns=' + encodeURIComponent(ns)).then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); });
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ns: ns, id: id }) })
      .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); });
  }

  /* ---- Menu on small screens ---- */
  var nav = document.querySelector('.site-nav'), toggle = document.querySelector('.nav-toggle');
  if (nav && toggle) {
    var set = function (open) { nav.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    toggle.addEventListener('click', function (e) { e.stopPropagation(); set(!nav.classList.contains('is-open')); });
    document.addEventListener('click', function (e) { if (nav.classList.contains('is-open') && !nav.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }

  /* ---- Progress bars read their value from the entry they sit in ---- */
  document.querySelectorAll('[data-progress]').forEach(function (el) {
    var bar = el.querySelector('.bar > i'), val = el.getAttribute('data-progress');
    if (bar) requestAnimationFrame(function () { bar.style.setProperty('--p', val); });
    var label = el.querySelector('[data-progress-label]');
    if (label) label.textContent = val + '% there';
  });

  /* ---- Patreon line ---- */
  var thanks = document.querySelector('[data-thanks]');
  if (thanks && PJ.patreon) {
    var a = thanks.querySelector('a'); if (a) a.href = PJ.patreon;
    thanks.hidden = false;
  }

  /* ---- Pick the next game ---- */
  var vote = document.querySelector('[data-vote]');
  if (vote) {
    var round = vote.getAttribute('data-round'), closes = vote.getAttribute('data-closes');
    var cards = [].slice.call(vote.querySelectorAll('[data-id]')), note = vote.querySelector('.vote-note');
    var closed = closes && new Date(closes + 'T23:59:59') < new Date();
    var key = 'pj_vote_' + round, chosen = store(key), counts = null;
    var say = function (t) { if (note) note.textContent = t || ''; };

    var render = function () {
      var total = 0, id;
      if (counts) for (id in counts) total += counts[id] || 0;
      var showing = !!counts && (chosen || closed);
      cards.forEach(function (c) {
        var cid = c.getAttribute('data-id'), n = counts && counts[cid] || 0;
        var pct = total ? Math.round(n / total * 100) : 0;
        var res = c.querySelector('.result'), btn = c.querySelector('.btn');
        c.classList.toggle('is-chosen', chosen === cid);
        if (res) {
          res.hidden = !showing;
          res.querySelector('.result__who').textContent = chosen === cid ? 'Your vote' : '';
          res.querySelector('.result__pct').textContent = pct + '% (' + n + (n === 1 ? ' vote)' : ' votes)');
          res.querySelector('.bar > i').style.setProperty('--p', pct);
        }
        if (btn) {
          btn.disabled = !!(chosen || closed);
          btn.textContent = chosen === cid ? 'You voted for this' : closed ? 'Voting closed' : 'Vote for this';
          if (chosen && chosen !== cid) btn.textContent = 'Vote for this';
        }
      });
      if (closed) say('This round is closed. A new set of ideas goes up with the next game.');
      else if (chosen) say('Thanks, your vote is in. ' + total + (total === 1 ? ' vote' : ' votes') + ' so far.');
    };

    api('GET', round).then(function (d) { counts = d.counts || {}; render(); })
      .catch(function () { render(); });

    cards.forEach(function (c) {
      var btn = c.querySelector('.btn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (chosen || closed) return;
        var id = c.getAttribute('data-id'); btn.disabled = true; say('Sending your vote');
        api('POST', round, id).then(function (d) {
          counts = d.counts || {}; chosen = d.choice || id; store(key, chosen); render();
        }).catch(function () { btn.disabled = false; say('The vote could not be reached just now. Try again in a minute.'); });
      });
    });
  }

  /* ---- "This would help my team" ---- */
  var helps = [].slice.call(document.querySelectorAll('[data-helpful]'));
  if (helps.length) {
    var hc = null;
    var paint = function (el) {
      var id = el.getAttribute('data-helpful'), n = hc && hc[id] || 0, c = el.querySelector('.helpful__count'), b = el.querySelector('.btn');
      var done = store('pj_help_' + id);
      if (b) { b.disabled = !!done; b.textContent = done ? 'Noted, thank you' : 'This would help my team'; }
      if (c) c.textContent = hc ? (n ? n + (n === 1 ? ' person says' : ' people say') + ' it would help' : 'Nobody has said yet') : '';
    };
    helps.forEach(paint);
    api('GET', 'lab').then(function (d) { hc = d.counts || {}; helps.forEach(paint); }).catch(function () {});
    helps.forEach(function (el) {
      var b = el.querySelector('.btn'), id = el.getAttribute('data-helpful');
      if (!b) return;
      b.addEventListener('click', function () {
        b.disabled = true;
        api('POST', 'lab', id).then(function (d) { hc = d.counts || {}; store('pj_help_' + id, '1'); paint(el); })
          .catch(function () { b.disabled = false; });
      });
    });
  }

  /* ---- Lab form (Netlify Forms) ---- */
  var form = document.querySelector('form[data-netlify]');
  if (form) {
    var fnote = form.querySelector('.form-note');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      fnote.removeAttribute('data-state'); fnote.textContent = 'Sending';
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch('/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body })
        .then(function (r) { if (!r.ok) throw new Error('bad'); form.reset(); fnote.setAttribute('data-state', 'ok'); fnote.textContent = 'Sent. Thank you, I will read it.'; })
        .catch(function () { fnote.setAttribute('data-state', 'error'); fnote.textContent = 'That did not send. You can email ' + (PJ.email || 'me') + ' instead.'; });
    });
  }

  /* ---- The Socratic demo: a question, then a question back ---- */
  var demo = document.querySelector('[data-demo]');
  if (demo) {
    var reply = demo.querySelector('.demo__reply'), opts = [].slice.call(demo.querySelectorAll('.opt'));
    opts.forEach(function (o) {
      o.addEventListener('click', function () {
        opts.forEach(function (x) { x.setAttribute('aria-pressed', x === o ? 'true' : 'false'); });
        var right = o.hasAttribute('data-right');
        reply.setAttribute('data-state', right ? 'right' : 'ask');
        reply.innerHTML = '';
        var s = document.createElement('strong'), t = document.createElement('span');
        s.textContent = right ? 'That works. Here is why. ' : 'Not quite, but look at this: ';
        t.textContent = o.getAttribute('data-reply');
        reply.appendChild(s); reply.appendChild(t);
      });
    });
  }
})();
