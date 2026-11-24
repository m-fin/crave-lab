// BTC Board formatting, fallbacks, and TV-mode query. Nothing is fetched.
const B = require('./logic.js');
const fs = require('fs');
let fail = 0;
function ok(name, c) { if (!c) fail++; console.log((c ? 'PASS ' : 'FAIL ') + name); }
function eq(name, got, exp) {
  const c = got === exp;
  if (!c) fail++;
  console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' got ' + JSON.stringify(got) + ' expected ' + JSON.stringify(exp)));
}
function throws(name, fn) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  ok(name, threw);
}

global.fetch = function () { throw new Error('network'); };

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);
const DEF = 'https://mempool.space/api';
const MEMPOOL_PRICE = DEF + '/v1/prices';
const COINBASE = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
const COINGECKO = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
function dateLabel(ms) {
  return new Date(ms).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}
function clock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function res(status, body, type) {
  const json = typeof body === 'string' ? null : body;
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status: status,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? type : null) },
    json: async () => { if (json == null) throw new SyntaxError('not json'); return json; },
    text: async () => text
  };
}
function jsonRes(body, type) { return res(200, body, type || 'application/json'); }
function textRes(body, type) { return res(200, body, type == null ? 'text/plain' : type); }
function mock(routes) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url: url, opts: opts });
    if (Object.prototype.hasOwnProperty.call(routes, url)) {
      const hit = routes[url];
      return typeof hit === 'function' ? hit() : hit;
    }
    throw new Error('no route ' + url);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}
function board(routes, over) {
  return B.load(Object.assign({ now: NOW, fetch: mock(routes) }, over || {}));
}

eq('default api', B.apiBase(''), DEF);
eq('blank api', B.apiBase('   '), DEF);
eq('null api', B.apiBase(null), DEF);
eq('undefined api', B.apiBase(undefined), DEF);
eq('strip trailing slash', B.apiBase('https://node.local/api/'), 'https://node.local/api');
eq('strip many slashes', B.apiBase('https://node.local/api///'), 'https://node.local/api');
eq('trim then strip', B.apiBase('  https://node.local/api/  '), 'https://node.local/api');
eq('custom api unchanged', B.apiBase('https://node.local/api'), 'https://node.local/api');

eq('$100,000.49 rounds down', B.formatUsd(100000.49), '$100,000');
eq('$100,000.50 rounds half up', B.formatUsd(100000.5), '$100,001');
eq('whole dollar', B.formatUsd(97543), '$97,543');
eq('sats at $100,000', B.formatSats(100000), '1,000');
eq('sats uses the unrounded price', B.formatSats(100000.5), '1,000');
eq('sats at $97,543.49', B.formatSats(97543.49), '1,025');
eq('one dollar is 100,000,000 sats', B.formatSats(1), '100,000,000');
eq('updated clock', B.updatedLabel(NOW), clock(NOW));
eq('quiet status', B.statusText([]), '');
eq('one failure', B.statusText(['height']), "Couldn't load: height. Retrying in 60s.");
eq('stable failure list', B.statusText(['price', 'height', 'fees']), "Couldn't load: price, height, fees. Retrying in 60s.");

[[0, 210000, 210000, 1458],
 [1, 210000, 209999, 1458],
 [209999, 210000, 1, 0],
 [210000, 420000, 210000, 1458],
 [210001, 420000, 209999, 1458],
 [839999, 840000, 1, 0],
 [840000, 1050000, 210000, 1458],
 [1049999, 1050000, 1, 0],
 [1050000, 1260000, 210000, 1458]
].forEach(([h, next, left, days]) => {
  const hv = B.halving(h, NOW);
  eq('height ' + h, hv.heightText, h.toLocaleString('en-US'));
  eq('blocks left at ' + h, hv.left, left);
  eq('next halving at ' + h, hv.next, next);
  eq('days at ' + h, hv.days, days);
  eq('blocks line at ' + h, hv.blocksText, left.toLocaleString('en-US') + ' blocks');
  eq('detail at ' + h, hv.detail, 'at block ' + next.toLocaleString('en-US') + ' · est. ' + dateLabel(NOW + left * 600000) + ' (~' + days + ' days)');
});
eq('one block stays plural, matching the page', B.halving(839999, NOW).blocksText, '1 blocks');
eq('half a day of blocks rounds up', B.halving(210000 - 72, NOW).days, 1);
eq('just under half a day rounds down', B.halving(210000 - 71, NOW).days, 0);

eq('numeric height', B.parseHeight(840000), 840000);
eq('text height', B.parseHeight('840000\n'), 840000);
eq('padded height', B.parseHeight('  840000  '), 840000);
eq('genesis height is real zero', B.parseHeight(0), 0);
eq('text zero is real zero', B.parseHeight('0'), 0);
['', '   ', 'nope', '-1', '840000 blocks', null, undefined, NaN, Infinity, -5].forEach((v) => {
  const label = typeof v === 'number' && !Number.isFinite(v) ? String(v) : JSON.stringify(v);
  throws('reject height ' + label, () => B.parseHeight(v));
});

eq('fees', JSON.stringify(B.parseFees({ fastestFee: 12, halfHourFee: 8, hourFee: 5 })), JSON.stringify({ fast: '12', half: '8', hour: '5' }));
eq('zero fee is a real fee', B.parseFees({ fastestFee: 1, halfHourFee: 0, hourFee: 3 }).half, '0');
[null, undefined, {}, { fastestFee: 5 }, { fastestFee: 5, halfHourFee: 4, hourFee: -1 },
 { fastestFee: 5, halfHourFee: NaN, hourFee: 1 }, { fastestFee: '5', halfHourFee: 4, hourFee: 1 }
].forEach((v) => throws('reject fees ' + JSON.stringify(v), () => B.parseFees(v)));

ok('tv off when absent', !B.tvOn('') && !B.tvOn(null) && !B.tvOn('?foo=1'));
ok('tv=1 on', B.tvOn('?tv=1') && B.tvOn('?foo=1&tv=1'));
ok('only the exact value 1', !B.tvOn('?tv=0') && !B.tvOn('?tv=true') && !B.tvOn('?TV=1') && !B.tvOn('?tv='));
eq('turn tv on', B.tvSearch('', true), '?tv=1');
eq('turn tv on keeps other params', B.tvSearch('?foo=1', true), '?foo=1&tv=1');
eq('turn tv off', B.tvSearch('?tv=1', false), '');
eq('turn tv off keeps other params', B.tvSearch('?foo=1&tv=1', false), '?foo=1');
eq('turn tv on replaces another value', B.tvSearch('?tv=0', true), '?tv=1');

async function main() {
const healthy = {
  [MEMPOOL_PRICE]: jsonRes({ USD: 97543.49 }),
  [DEF + '/blocks/tip/height']: textRes('839999\n'),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 12, halfHourFee: 8, hourFee: 5, economyFee: 3 })
};
let view = await board(healthy);
eq('price line', view.price, '$97,543');
eq('sats line', view.sats, '1,025');
eq('mempool source', view.source, 'via mempool');
eq('height line', view.height, '839,999');
eq('halving line', view.halving, '1 blocks');
eq('halving detail', view.halvingDetail, 'at block 840,000 · est. ' + dateLabel(NOW + 600000) + ' (~0 days)');
eq('fast fee', view.fees.fast, '12');
eq('half fee', view.fees.half, '8');
eq('hour fee', view.fees.hour, '5');
eq('clear status', view.status, '');
eq('updated stamp', view.updated, clock(NOW));
ok('healthy load does not say NaN', !/NaN|Infinity|undefined/.test(JSON.stringify(view)));

const f1 = mock(healthy);
await B.load({ now: NOW, fetch: f1 });
eq('only the three mempool calls', f1.calls.map((c) => c.url).join('|'), [MEMPOOL_PRICE, DEF + '/blocks/tip/height', DEF + '/v1/fees/recommended'].join('|'));
ok('fetches are not stored', f1.calls.every((c) => c.opts && c.opts.cache === 'no-store'));

view = await board({
  [MEMPOOL_PRICE]: jsonRes({ USD: 100000.5 }, 'application/json; charset=utf-8'),
  [DEF + '/blocks/tip/height']: jsonRes(840000),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 1, halfHourFee: 0, hourFee: 2 })
});
eq('charset json still parses', view.price, '$100,001');
eq('sats stay on the unrounded price', view.sats, '1,000');
eq('json height', view.height, '840,000');
eq('at a halving block the next one is a full era away', view.halving, '210,000 blocks');
eq('halving detail at the boundary', view.halvingDetail, 'at block 1,050,000 · est. ' + dateLabel(NOW + 210000 * 600000) + ' (~1458 days)');
eq('zero fee is shown', view.fees.half, '0');

const fallback = mock({
  [MEMPOOL_PRICE]: res(503, '', 'text/plain'),
  [COINBASE]: jsonRes({ data: { amount: '97000.00' } }),
  [COINGECKO]: jsonRes({ bitcoin: { usd: 1 } }),
  [DEF + '/blocks/tip/height']: textRes('100'),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 2, halfHourFee: 2, hourFee: 2 })
});
view = await B.load({ now: NOW, fetch: fallback });
eq('coinbase when mempool fails', view.source, 'via Coinbase');
eq('coinbase amount', view.price, '$97,000');
ok('coingecko not asked after coinbase works', !fallback.calls.some((c) => c.url === COINGECKO));

const gecko = mock({
  [MEMPOOL_PRICE]: () => { throw new Error('offline'); },
  [COINBASE]: res(404, { data: { amount: '1' } }),
  [COINGECKO]: jsonRes({ bitcoin: { usd: 42000.4 } }),
  [DEF + '/blocks/tip/height']: textRes('100'),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 1, halfHourFee: 1, hourFee: 1 })
});
view = await B.load({ now: NOW, fetch: gecko });
eq('coingecko is the last price source', view.source, 'via CoinGecko');
eq('coingecko price rounds', view.price, '$42,000');
eq('coingecko sats', view.sats, Math.round(1e8 / 42000.4).toLocaleString('en-US'));

const badFirst = mock({
  [MEMPOOL_PRICE]: jsonRes({ USD: 'nope' }),
  [COINBASE]: jsonRes({ data: { amount: '0' } }),
  [COINGECKO]: jsonRes({ bitcoin: { usd: 50000 } }),
  [DEF + '/blocks/tip/height']: textRes('100'),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 1, halfHourFee: 1, hourFee: 1 })
});
view = await B.load({ now: NOW, fetch: badFirst });
eq('truthy garbage price falls through', view.source, 'via CoinGecko');
eq('zero coinbase price is not shown', view.price, '$50,000');
eq('sats are finite', view.sats, '2,000');
ok('bad price calls every source', [MEMPOOL_PRICE, COINBASE, COINGECKO].every((u) => badFirst.calls.some((c) => c.url === u)));

const zeroString = mock({
  [MEMPOOL_PRICE]: jsonRes({ USD: '0' }),
  [COINBASE]: jsonRes({ data: { amount: 'nope' } }),
  [COINGECKO]: jsonRes({ bitcoin: { usd: NaN } }),
  [DEF + '/blocks/tip/height']: textRes('100'),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 1, halfHourFee: 1, hourFee: 1 })
});
view = await B.load({ now: NOW, fetch: zeroString });
eq('no usable price leaves the tile alone', view.price, null);
eq('no usable price has no source', view.source, null);
ok('no NaN price', view.sats == null && !/NaN|Infinity|undefined/.test(JSON.stringify(view)));

const plain = mock({
  [MEMPOOL_PRICE]: textRes('{"USD":12345}', 'text/plain'),
  [COINBASE]: jsonRes({ data: { amount: '22222' } }),
  [DEF + '/blocks/tip/height']: textRes('10'),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 1, halfHourFee: 1, hourFee: 1 })
});
view = await B.load({ now: NOW, fetch: plain });
eq('non-json price body is not parsed as mempool', view.source, 'via Coinbase');
eq('coinbase used instead', view.price, '$22,222');

const custom = mock({
  'https://node.local/api/v1/prices': jsonRes({ USD: 10 }),
  'https://node.local/api/blocks/tip/height': textRes('210000'),
  'https://node.local/api/v1/fees/recommended': jsonRes({ fastestFee: 4, halfHourFee: 3, hourFee: 2 })
});
view = await B.load({ now: NOW, api: 'https://node.local/api/', fetch: custom });
eq('custom base price', view.price, '$10');
eq('custom base still says mempool', view.source, 'via mempool');
eq('custom base height', view.height, '210,000');
eq('custom base calls the node', custom.calls.map((c) => c.url).filter((u) => u.indexOf('node.local') >= 0).length, 3);
ok('custom base does not call mempool.space', !custom.calls.some((c) => c.url.indexOf('mempool.space') >= 0));

const slowPrice = mock({
  [MEMPOOL_PRICE]: async () => { await new Promise((r) => setTimeout(r, 30)); return res(500, '', 'text/plain'); },
  [COINBASE]: res(500, '', 'text/plain'),
  [COINGECKO]: res(500, '', 'text/plain'),
  [DEF + '/blocks/tip/height']: textRes(''),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 1 })
});
view = await B.load({ now: NOW, fetch: slowPrice });
eq('failures stay in source order', view.status, "Couldn't load: price, height, fees. Retrying in 60s.");
eq('failed sections are left unset', view.price, null);
eq('empty height is not genesis', view.height, null);
eq('partial fees are not applied', view.fees, null);
eq('stamp still updates', view.updated, clock(NOW));
ok('failure copy has no NaN or undefined', !/NaN|undefined|Infinity/.test(view.status) && view.halving == null);

view = await board({
  [MEMPOOL_PRICE]: jsonRes({ USD: 100 }),
  [DEF + '/blocks/tip/height']: res(502, 'bad gateway', 'text/plain'),
  [DEF + '/v1/fees/recommended']: jsonRes({ fastestFee: 9, halfHourFee: 7, hourFee: 6 })
});
eq('only the failed section is named', view.status, "Couldn't load: height. Retrying in 60s.");
eq('price still lands', view.price, '$100');
eq('fees still land', view.fees.fast, '9');
eq('height stays unset', view.height, null);

let rejected = false;
try { await B.load({ now: NOW, fetch: mock({}) }); } catch (e) { rejected = true; }
ok('a dead network does not reject the board', !rejected);
view = await B.load({ now: NOW, fetch: mock({}) });
eq('dead network names every section', view.status, "Couldn't load: price, height, fees. Retrying in 60s.");

const sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');
ok('service worker caches logic.js', sw.indexOf('./logic.js') >= 0);
ok('service worker cache version bumped', sw.indexOf('btc-board-v3') >= 0);
ok('service worker skips other origins', sw.indexOf('origin!==location.origin') >= 0);
ok('precache list has no remote price API', sw.indexOf('mempool.space') < 0 && sw.indexOf('coinbase.com') < 0 && sw.indexOf('coingecko') < 0);

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
