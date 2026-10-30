/* Shared behaviour: the mobile menu, the vote, the situation form, the email copy buttons and the
   game previews. Each part only runs on the pages that have it. */
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

  /* ---- Netlify Forms (the "Describe your situation" form) ----
     Netlify strips data-netlify from the deployed HTML, so match on the form names too. */
  [].slice.call(document.querySelectorAll('form[data-netlify], form[name="situation"]')).forEach(function (form) {
    var fnote = form.querySelector('.form-note');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      fnote.removeAttribute('data-state'); fnote.textContent = 'Sending';
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch('/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body })
        .then(function (r) { if (!r.ok) throw new Error('bad'); form.reset(); fnote.setAttribute('data-state', 'ok'); fnote.textContent = 'Sent. Thank you, I will read it.'; })
        .catch(function () { fnote.setAttribute('data-state', 'error'); fnote.textContent = 'That did not send. You can email ' + (PJ.email || 'me') + ' instead.'; });
    });
  });

  /* ---- Email: copy the address instead of opening a mail app (mailto: jumps straight into Outlook) ---- */
  [].slice.call(document.querySelectorAll('[data-copy-email]')).forEach(function (b) {
    var label = b.textContent;
    b.addEventListener('click', function () {
      var done = function (t) { b.textContent = t; setTimeout(function () { b.textContent = label; }, 2000); };
      var addr = PJ.email || '';
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(function () { done('Copied'); }, function () { done(addr); });
      else done(addr);
    });
  });

  /* ---- Gameplay previews: a play button appears only where a clip exists ---- */
  var previews = [].slice.call(document.querySelectorAll('[data-preview]'));
  if (previews.length) {
    previews.forEach(function (art) {
      var slug = art.getAttribute('data-preview');
      if (!slug) return;
      var src = slug + '.mp4';
      var tile = art.closest('.tile');
      var h3 = tile && tile.querySelector('.h3');
      var name = h3 ? h3.textContent.trim() : 'the game';

      var vid = document.createElement('video');
      vid.className = 'tile__vid';
      vid.muted = true; vid.loop = true; vid.preload = 'none';
      vid.playsInline = true; vid.setAttribute('playsinline', '');
      vid.poster = slug + '.jpg';
      vid.src = src;

      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'tile__play'; btn.hidden = true;
      btn.setAttribute('aria-label', 'Play ' + name + ' gameplay');
      btn.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 13l18 11-18 11z"/></svg>';

      art.appendChild(vid);
      art.appendChild(btn);

      /* Only reveal the control once we know a clip is actually there. */
      fetch(src, { method: 'HEAD' }).then(function (r) {
        if (r && r.ok) btn.hidden = false;
      }).catch(function () {});

      btn.addEventListener('click', function () {
        if (art.classList.contains('is-playing') && !vid.paused) {
          vid.pause();
          art.classList.remove('is-playing');
          btn.setAttribute('aria-label', 'Play ' + name + ' gameplay');
          return;
        }
        art.classList.add('is-playing');
        btn.setAttribute('aria-label', 'Pause ' + name + ' gameplay');
        var p = vid.play();
        if (p && p.catch) p.catch(function () { art.classList.remove('is-playing'); });
      });

      /* Pause and reset when the tile scrolls out of view. */
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting && !vid.paused) {
              vid.pause();
              art.classList.remove('is-playing');
              btn.setAttribute('aria-label', 'Play ' + name + ' gameplay');
            }
          });
        }, { threshold: 0.25 }).observe(art);
      }
    });
  }
})();
