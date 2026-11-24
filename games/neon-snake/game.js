// Neon Snake 2084 — pure, deterministic, seedable game logic. Works in browser (window.NS) and Node (require).
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.NSGame = f(); })(this, function () {
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 up,1 right,2 down,3 left
  function rng(s) { // mulberry32 step: returns [value, nextState]
    let t = (s + 0x6D2B79F5) >>> 0; let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
  }
  function occupied(st) { const o = new Set(); for (const s of st.snakes) if (s.alive) for (const c of s.body) o.add(c[0] + ',' + c[1]); return o; }
  function spawnFood(st) {
    const occ = occupied(st); for (const f of st.food) occ.add(f[0] + ',' + f[1]);
    for (let tries = 0; tries < 2000; tries++) {
      let a, b; [a, st.rng] = rng(st.rng); [b, st.rng] = rng(st.rng);
      const x = Math.floor(a * st.w), y = Math.floor(b * st.h);
      if (!occ.has(x + ',' + y)) { st.food.push([x, y]); return; }
    }
  }
  // players: [{name,color}] ; opts {w,h,food,maxTicks}
  function init(seed, players, opts = {}) {
    const w = opts.w || 30, h = opts.h || 30;
    const starts = [[[4, 4], 1], [[w - 5, h - 5], 3], [[w - 5, 4], 2], [[4, h - 5], 0]];
    const st = { w, h, tick: 0, seed, rng: seed >>> 0, food: [], foodCount: opts.food || 4, maxTicks: opts.maxTicks || 1500, over: false, events: [], snakes: [] };
    players.forEach((p, i) => {
      const [[x, y], d] = starts[i % 4]; const [dx, dy] = DIRS[d];
      st.snakes.push({ id: i, name: p.name, color: p.color, dir: d, body: [[x, y], [x - dx, y - dy], [x - 2 * dx, y - 2 * dy]], grow: 0, alive: true, score: 0, diedAt: null, cause: null });
    });
    for (let i = 0; i < st.foodCount; i++) spawnFood(st);
    return st;
  }
  const clone = (st) => JSON.parse(JSON.stringify(st));
  // actions: array of dirs (or null = keep going), one per snake. Returns NEW state.
  function step(prev, actions) {
    const st = clone(prev); if (st.over) return st; st.tick++; st.events = [];
    const live = st.snakes.filter(s => s.alive);
    for (const s of live) { const a = actions[s.id]; if (a != null && (a + 2) % 4 !== s.dir) s.dir = a; }
    const heads = new Map();
    for (const s of live) { const [dx, dy] = DIRS[s.dir]; heads.set(s.id, [s.body[0][0] + dx, s.body[0][1] + dy]); }
    // tails move away this tick unless growing
    const blocked = new Set();
    for (const s of live) s.body.forEach((c, i) => { if (i === s.body.length - 1 && s.grow === 0) return; blocked.add(c[0] + ',' + c[1]); });
    const dead = [];
    for (const s of live) {
      const [x, y] = heads.get(s.id); let cause = null;
      if (x < 0 || y < 0 || x >= st.w || y >= st.h) cause = 'wall';
      else if (blocked.has(x + ',' + y)) cause = 'body';
      else for (const o of live) if (o !== s) { const h = heads.get(o.id); if (h[0] === x && h[1] === y) cause = 'head-on'; }
      if (cause) dead.push([s, cause]);
    }
    for (const [s, cause] of dead) { s.alive = false; s.diedAt = st.tick; s.cause = cause; st.events.push({ type: 'death', id: s.id, cause }); }
    for (const s of live) if (s.alive) {
      const h = heads.get(s.id); s.body.unshift(h);
      if (s.grow > 0) s.grow--; else s.body.pop();
      const fi = st.food.findIndex(f => f[0] === h[0] && f[1] === h[1]);
      if (fi >= 0) { st.food.splice(fi, 1); s.score++; s.grow += 1; st.events.push({ type: 'eat', id: s.id, at: h }); }
    }
    while (st.food.length < st.foodCount) spawnFood(st);
    const alive = st.snakes.filter(s => s.alive);
    const best = Math.max(...st.snakes.map(s => s.score));
    // ends: nobody left, tick limit, or lone survivor already strictly leading
    if (alive.length === 0 || st.tick >= st.maxTicks || (st.snakes.length > 1 && alive.length === 1 && alive[0].score > Math.max(-1, ...st.snakes.filter(s => s !== alive[0]).map(s => s.score)) && alive[0].score >= best)) st.over = true;
    if (st.snakes.length === 1 && alive.length === 0) st.over = true;
    if (st.over) st.winner = ranking(st)[0].id;
    return st;
  }
  // rank: score desc, then survival (alive > later death)
  function ranking(st) { return [...st.snakes].sort((a, b) => b.score - a.score || (b.diedAt ?? 1e9) - (a.diedAt ?? 1e9)); }
  return { DIRS, init, step, ranking, clone, rng };
});
