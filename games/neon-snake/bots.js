// Bot brains: pure functions (state, snakeId) -> dir. Deterministic.
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./game.js')); else root.NSBots = f(root.NSGame); })(this, function (G) {
  const { DIRS } = G; const K = (x, y) => x + ',' + y;
  function blockedSet(st) { const b = new Set(); for (const s of st.snakes) if (s.alive) s.body.forEach((c, i) => { if (i === s.body.length - 1 && s.grow === 0) return; b.add(K(c[0], c[1])); }); return b; }
  const inb = (st, x, y) => x >= 0 && y >= 0 && x < st.w && y < st.h;
  function safeMoves(st, s, b) {
    const out = []; for (let d = 0; d < 4; d++) { if ((d + 2) % 4 === s.dir) continue; const x = s.body[0][0] + DIRS[d][0], y = s.body[0][1] + DIRS[d][1]; if (inb(st, x, y) && !b.has(K(x, y))) out.push([d, x, y]); } return out;
  }
  // cells next to other snakes' heads are risky (head-on)
  function riskSet(st, s) { const r = new Set(); for (const o of st.snakes) if (o.alive && o !== s) for (const [dx, dy] of DIRS) r.add(K(o.body[0][0] + dx, o.body[0][1] + dy)); return r; }
  function flood(st, b, x, y, cap) { const seen = new Set([K(x, y)]), q = [[x, y]]; while (q.length && seen.size < cap) { const [cx, cy] = q.shift(); for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy, k = K(nx, ny); if (inb(st, nx, ny) && !b.has(k) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); } } } return seen.size; }
  function bfsTo(st, b, sx, sy, targets) { // returns first dir to nearest target
    const tk = new Set(targets.map(t => K(t[0], t[1]))); const seen = new Map([[K(sx, sy), -1]]); const q = [[sx, sy, -1]];
    while (q.length) { const [x, y, fd] = q.shift(); if (fd >= 0 && tk.has(K(x, y))) return { dir: fd, at: [x, y] };
      for (let d = 0; d < 4; d++) { const nx = x + DIRS[d][0], ny = y + DIRS[d][1], k = K(nx, ny); if (inb(st, nx, ny) && !b.has(k) && !seen.has(k)) { seen.set(k, 1); q.push([nx, ny, fd < 0 ? d : fd]); } } }
    return null;
  }
  const greedy = (st, id) => { // nearest food by Manhattan distance, only avoids instant death
    const s = st.snakes[id], b = blockedSet(st), m = safeMoves(st, s, b); if (!m.length) return s.dir;
    const dist = (x, y) => Math.min(...st.food.map(f => Math.abs(f[0] - x) + Math.abs(f[1] - y)));
    m.sort((a, c) => dist(a[1], a[2]) - dist(c[1], c[2]) || a[0] - c[0]); return m[0][0];
  };
  const pathfinder = (st, id) => { // BFS shortest path to food
    const s = st.snakes[id], b = blockedSet(st); const r = bfsTo(st, b, s.body[0][0], s.body[0][1], st.food);
    if (r) return r.dir; const m = safeMoves(st, s, b); return m.length ? m[0][0] : s.dir;
  };
  const survivor = (st, id) => { // BFS to food, but only if it keeps enough room; else maximize space / chase tail
    const s = st.snakes[id], b = blockedSet(st), risk = riskSet(st, s); const m = safeMoves(st, s, b); if (!m.length) return s.dir;
    const need = s.body.length + 2;
    const scored = m.map(([d, x, y]) => ({ d, x, y, room: flood(st, b, x, y, 400), risky: risk.has(K(x, y)) }));
    const r = bfsTo(st, b, s.body[0][0], s.body[0][1], st.food);
    if (r) { const c = scored.find(o => o.d === r.dir); if (c && c.room >= need && !c.risky) return c.d; }
    const tail = s.body[s.body.length - 1]; const bt = new Set(b); bt.delete(K(tail[0], tail[1]));
    const tr = bfsTo(st, bt, s.body[0][0], s.body[0][1], [tail]);
    scored.sort((a, c) => (a.risky - c.risky) || (c.room - a.room) || ((tr && c.d === tr.dir) - (tr && a.d === tr.dir)));
    return scored[0].d;
  };
  const hunter = (st, id) => { // pathfinder that avoids head-on risk and dead ends, aims at food closest to it vs rivals
    const s = st.snakes[id], b = blockedSet(st), risk = riskSet(st, s); const m = safeMoves(st, s, b); if (!m.length) return s.dir;
    const bb = new Set([...b, ...risk]); const r = bfsTo(st, bb, s.body[0][0], s.body[0][1], st.food);
    if (r && flood(st, b, s.body[0][0] + DIRS[r.dir][0], s.body[0][1] + DIRS[r.dir][1], 200) > s.body.length) return r.dir;
    m.sort((a, c) => flood(st, b, c[1], c[2], 300) - flood(st, b, a[1], a[2], 300)); return m[0][0];
  };
  const ROSTER = [
    { name: 'GREEDY', color: '#ff3df0', brain: greedy, blurb: 'beelines for food' },
    { name: 'PATHFINDER', color: '#36e7ff', brain: pathfinder, blurb: 'BFS shortest path' },
    { name: 'SURVIVOR', color: '#ffd23d', brain: survivor, blurb: 'checks space, chases tail' },
    { name: 'HUNTER', color: '#ff6a2b', brain: hunter, blurb: 'avoids head-ons & dead ends' },
  ];
  return { greedy, pathfinder, survivor, hunter, ROSTER };
});
