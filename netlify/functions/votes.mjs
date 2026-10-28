// Vote counter for the portfolio: the "Pick the next game" rounds and the Lab's
// "This would help my team" buttons. Counts live in Netlify Blobs.
//
// GET  /api/votes?ns=2026-q4        -> { counts: { "the-next-door": 12, ... } }
// POST /api/votes { ns, id }        -> { counts, choice, already }
//
// A game round ("2026-q4" style) allows one vote per person for the whole round.
// The Lab ("lab") allows one "this would help" per person per idea.
// People are recognised by a salted hash of their IP address, so no IP is stored.

import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

const ROUND = /^\d{4}-q[1-4]$/;
const ID = /^[a-z0-9-]{1,40}$/;
const MAX_IDS = 12; // stops anyone filling a round with made-up options

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

const validNs = (ns) => ns === 'lab' || ROUND.test(ns || '');

export default async (req, context) => {
  // Strong consistency so a just-cast vote shows on the next read and the
  // one-vote-per-person check can't be raced during the propagation window.
  const store = getStore({ name: 'portfolio-votes', consistency: 'strong' });

  if (req.method === 'GET') {
    const ns = new URL(req.url).searchParams.get('ns');
    if (!validNs(ns)) return json({ error: 'Unknown vote' }, 400);
    const counts = (await store.get(`counts/${ns}`, { type: 'json' })) || {};
    return json({ counts });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const ns = String(body.ns || '');
  const id = String(body.id || '');
  if (!validNs(ns) || !ID.test(id)) return json({ error: 'Bad request' }, 400);

  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const salt = process.env.VOTE_SALT || 'agnostic-portfolio';
  const who = createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
  const voterKey = ns === 'lab' ? `voters/lab/${id}/${who}` : `voters/${ns}/${who}`;

  const countsKey = `counts/${ns}`;
  const counts = (await store.get(countsKey, { type: 'json' })) || {};

  const previous = await store.get(voterKey);
  if (previous) return json({ counts, choice: previous, already: true });

  if (!(id in counts) && Object.keys(counts).length >= MAX_IDS) return json({ error: 'Bad request' }, 400);

  counts[id] = (counts[id] || 0) + 1;
  await store.setJSON(countsKey, counts);
  await store.set(voterKey, id);
  return json({ counts, choice: id, already: false });
};

export const config = { path: '/api/votes' };
