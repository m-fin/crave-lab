// BTC Board decisions: price formatting, source fallback, halving countdown, fees, TV query.
// Classic <script> in the page and require() in Node. No dependencies, no network of its own.
(function (root) {
  const DEFAULT_API = 'https://mempool.space/api';
  const HALVING_EVERY = 210000;
  const BLOCK_MS = 600000;
  const COINBASE = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
  const COINGECKO = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';

  function apiBase(input) {
    const t = String(input == null ? '' : input).trim().replace(/\/+$/, '');
    return t || DEFAULT_API;
  }
  function formatUsd(usd) {
    return '$' + Math.round(usd).toLocaleString('en-US');
  }
  function formatSats(usd) {
    return Math.round(1e8 / usd).toLocaleString('en-US');
  }
  function updatedLabel(now) {
    return new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function statusText(errs) {
    return errs && errs.length ? "Couldn't load: " + errs.join(', ') + '. Retrying in 60s.' : '';
  }
  // A truthy but unusable price (the string "0", "nope", NaN, a non-positive number) used to
  // win the fallback and render "$NaN" or an infinite sat count. Only a finite price above
  // zero, whose rounded dollar and sat count are both finite, is worth showing.
  function usablePrice(v) {
    const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() ? +v.trim() : NaN);
    if (!Number.isFinite(n) || !(n > 0)) return null;
    if (!Number.isFinite(Math.round(n)) || !Number.isFinite(Math.round(1e8 / n))) return null;
    return n;
  }
  function halving(height, now) {
    const next = Math.ceil((height + 1) / HALVING_EVERY) * HALVING_EVERY;
    const left = next - height;
    const days = Math.round(left * 10 / 60 / 24);
    const when = new Date(now + left * BLOCK_MS);
    const nf = (n) => n.toLocaleString('en-US');
    return {
      heightText: nf(height),
      blocksText: nf(left) + ' blocks',
      detail: 'at block ' + nf(next) + ' · est. ' + when.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) + ' (~' + days + ' days)',
      next: next,
      left: left,
      days: days
    };
  }
  // Unary plus turns "" and whitespace into 0, so an empty 200 response looked like the
  // genesis block. A non-numeric body became the height "NaN". Require a real number.
  function parseHeight(body) {
    if (typeof body === 'number') {
      if (!Number.isFinite(body) || body < 0) throw new Error('height');
      return body;
    }
    if (typeof body !== 'string') throw new Error('height');
    const raw = body.trim();
    if (!raw || !/[0-9]/.test(raw)) throw new Error('height');
    const n = +raw;
    if (!Number.isFinite(n) || n < 0) throw new Error('height');
    return n;
  }
  // A missing fee field used to be assigned straight to textContent, which shows the word
  // "undefined". Zero is a real fee. Anything that isn't a finite number >= 0 fails the row.
  function parseFees(body) {
    if (!body || typeof body !== 'object') throw new Error('fees');
    function fee(v) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('fees');
      return String(v);
    }
    return { fast: fee(body.fastestFee), half: fee(body.halfHourFee), hour: fee(body.hourFee) };
  }
  function prefersJson(ct) {
    return typeof ct === 'string' && ct.includes('json');
  }
  async function readBody(res) {
    if (!res || !res.ok) throw new Error(res && res.status != null ? String(res.status) : 'network');
    const ct = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : null;
    if (prefersJson(ct)) return res.json();
    return res.text();
  }
  async function fetchBody(url, fetchImpl) {
    return readBody(await fetchImpl(url, { cache: 'no-store' }));
  }
  async function getPrice(base, fetchImpl) {
    try {
      const p = await fetchBody(base + '/v1/prices', fetchImpl);
      const usd = p && typeof p === 'object' ? usablePrice(p.USD) : null;
      if (usd != null) return { usd: usd, src: 'mempool' };
    } catch (e) {}
    try {
      const c = await fetchBody(COINBASE, fetchImpl);
      const usd = c && c.data ? usablePrice(c.data.amount) : null;
      if (usd != null) return { usd: usd, src: 'Coinbase' };
    } catch (e) {}
    const g = await fetchBody(COINGECKO, fetchImpl);
    const usd = g && g.bitcoin ? usablePrice(g.bitcoin.usd) : null;
    if (usd == null) throw new Error('price');
    return { usd: usd, src: 'CoinGecko' };
  }
  function tvOn(search) {
    return new URLSearchParams(search == null ? '' : String(search)).get('tv') === '1';
  }
  function tvSearch(search, on) {
    const u = new URLSearchParams(search == null ? '' : String(search));
    if (on) u.set('tv', '1');
    else u.delete('tv');
    const q = u.toString();
    return q ? '?' + q : '';
  }
  async function load(opts) {
    opts = opts || {};
    const fetchImpl = opts.fetch || fetch;
    const now = typeof opts.now === 'number' && Number.isFinite(opts.now) ? opts.now : Date.now();
    const base = apiBase(opts.api);
    const failed = { price: false, height: false, fees: false };
    const view = {
      price: null, sats: null, source: null,
      height: null, halving: null, halvingDetail: null,
      fees: null, updated: updatedLabel(now), status: ''
    };
    await Promise.all([
      (async () => {
        try {
          const p = await getPrice(base, fetchImpl);
          view.price = formatUsd(p.usd);
          view.sats = formatSats(p.usd);
          view.source = 'via ' + p.src;
        } catch (e) { failed.price = true; }
      })(),
      (async () => {
        try {
          const hv = halving(parseHeight(await fetchBody(base + '/blocks/tip/height', fetchImpl)), now);
          view.height = hv.heightText;
          view.halving = hv.blocksText;
          view.halvingDetail = hv.detail;
        } catch (e) { failed.height = true; }
      })(),
      (async () => {
        try { view.fees = parseFees(await fetchBody(base + '/v1/fees/recommended', fetchImpl)); }
        catch (e) { failed.fees = true; }
      })()
    ]);
    // Settle order used to decide the sentence ("height, fees, price" one run, something
    // else the next). Name the sections in the order the board requests them.
    view.status = statusText(['price', 'height', 'fees'].filter((name) => failed[name]));
    return view;
  }

  const API = {
    DEFAULT_API: DEFAULT_API, apiBase: apiBase, formatUsd: formatUsd, formatSats: formatSats,
    updatedLabel: updatedLabel, statusText: statusText, halving: halving, parseHeight: parseHeight,
    parseFees: parseFees, getPrice: getPrice, tvOn: tvOn, tvSearch: tvSearch, load: load
  };
  if (typeof module !== 'undefined') module.exports = API;
  else root.BtcBoard = API;
})(this);
