// Wear Check outfit logic: Open-Meteo forecast -> one sentence and an hourly strip.
// Temperatures are °C and wind is km/h, which is what the app stores after fetch.
// Classic <script> in the page and require() in Node. No dependencies, no network.
(function (root) {
  function finite(v) {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  function timeMs(t) {
    if (typeof t === 'number' && Number.isFinite(t)) return t;
    if (typeof t === 'string' && t.trim()) return new Date(t).getTime();
    return NaN;
  }
  function at(arr, i) {
    return Array.isArray(arr) ? arr[i] : undefined;
  }
  function layer(h, body) {
    let shift = 0;
    if (body === 'warm') shift = -3;
    else if (body === 'cold') shift = 3;
    const f = h.feels + shift - ((h.rh >= 85 && h.temp < 10) ? 1.5 : 0);
    const top = f >= 24 ? 'T-shirt' : f >= 18 ? 'Light long sleeve' : f >= 12 ? 'Hoodie' : f >= 5 ? 'Jacket' : f >= -2 ? 'Warm coat' : 'Heavy coat, hat and gloves';
    const lvl = f >= 24 ? 0 : f >= 18 ? 1 : f >= 12 ? 2 : f >= 5 ? 3 : f >= -2 ? 4 : 5;
    return { top: top, lvl: lvl, wet: h.pp >= 50 || h.precip >= 0.5, windy: h.wind >= 30, sun: h.uv >= 6, f: f };
  }
  function rainWord(h) {
    return h.temp <= 1 ? 'snow gear' : 'rain jacket';
  }
  function tdisp(c, units) {
    if (!Number.isFinite(c)) return units === 'F' ? '—°F' : '—°C';
    return units === 'F' ? Math.round(c * 9 / 5 + 32) + '°F' : Math.round(c) + '°C';
  }
  function hourLabel(t) {
    return new Date(t).toLocaleTimeString([], { hour: 'numeric' });
  }
  // A missing feels-like or temperature used to become 0°C (32°F) via null coercion,
  // and a missing humidity printed the word "null". Fall back to the other temperature
  // and drop an hour only when both are missing.
  function readHour(t, temp, feels, pp, precip, wind, rh, uv) {
    const tempN = finite(temp), feelsN = finite(feels);
    const tUse = tempN != null ? tempN : feelsN;
    const fUse = feelsN != null ? feelsN : tempN;
    const ms = timeMs(t);
    if (tUse == null || fUse == null || !Number.isFinite(ms)) return null;
    return {
      t: ms, temp: tUse, feels: fUse,
      pp: finite(pp) ?? 0, precip: finite(precip) ?? 0, wind: finite(wind) ?? 0,
      rh: finite(rh), uv: finite(uv) ?? 0
    };
  }
  function missing() {
    return { ok: false, stale: false, advice: 'The forecast is missing data. Connect to the internet to refresh it.', detail: '', hours: [] };
  }
  function staleResult() {
    return { ok: false, stale: true, advice: 'The saved forecast is out of date. Connect to the internet to refresh it.', detail: '', hours: [] };
  }
  function humidityPhrase(h) {
    return h.rh == null ? 'humidity unknown' : 'humidity ' + h.rh + '%';
  }
  function advise(data, opts) {
    opts = opts || {};
    const body = opts.body === 'warm' || opts.body === 'cold' ? opts.body : 'normal';
    const units = opts.units === 'C' ? 'C' : 'F';
    const now = typeof opts.now === 'number' && Number.isFinite(opts.now) ? opts.now : Date.now();
    const H = data && data.hourly;
    if (!H || !Array.isArray(H.time) || !H.time.length) return missing();
    const times = H.time.map(timeMs);
    const last = times[times.length - 1];
    if (!Number.isFinite(last)) return missing();
    // Same window the page used: still fresh when the last hour is exactly one hour old.
    if (last < now - 3600e3) return staleResult();
    let i0 = times.findIndex(t => t > now - 3600e3);
    if (i0 < 0) i0 = 0;
    // This hour plus the next 12 (13 slots), matching "now and over the next 12 hours".
    const hrs = [];
    for (let i = i0; i < i0 + 13 && i < times.length; i++) {
      const h = readHour(times[i], at(H.temperature_2m, i), at(H.apparent_temperature, i), at(H.precipitation_probability, i), at(H.precipitation, i), at(H.wind_speed_10m, i), at(H.relative_humidity_2m, i), at(H.uv_index, i));
      if (h) hrs.push(h);
    }
    let cur = null;
    if (data.current && typeof data.current === 'object') {
      const base = hrs[0];
      cur = readHour(data.current.time, data.current.temperature_2m, data.current.apparent_temperature, base ? base.pp : 0, data.current.precipitation, data.current.wind_speed_10m, data.current.relative_humidity_2m, base ? base.uv : 0);
    }
    if (!cur) cur = hrs[0] || null;
    if (!cur) return missing();
    const n = layer(cur, body);
    const parts = [];
    let s = n.top + ' now';
    if (n.wet) s += ' and a ' + rainWord(cur);
    parts.push(s);
    const later = hrs.slice(1).map(h => ({ h: h, l: layer(h, body) }));
    if (!n.wet) {
      const w = later.find(x => x.l.wet);
      if (w) parts.push(`${rainWord(w.h)} by ${hourLabel(w.h.t)}`);
    }
    const holds = (i, f) => f(later[i]) && (!later[i + 1] || f(later[i + 1]));
    const colder = later.find((x, i) => holds(i, y => y.l.lvl > n.lvl));
    if (colder) parts.push(`${colder.l.top.toLowerCase()} by ${hourLabel(colder.h.t)}`);
    else {
      const warmer = later.find((x, i) => holds(i, y => y.l.lvl < n.lvl));
      if (warmer && n.lvl > 0) parts.push(`${warmer.l.top.toLowerCase()} by ${hourLabel(warmer.h.t)}`);
    }
    let adv = parts.join(', ') + '.';
    adv = adv[0].toUpperCase() + adv.slice(1);
    const extra = [];
    if ([cur, ...hrs].some(h => h.rh >= 70 && h.temp >= 24)) extra.push('Humid and sticky: go breathable, light colors.');
    else if (cur.rh >= 85 && cur.temp < 10) extra.push('Damp cold feels colder than the number.');
    if (n.windy || later.some(x => x.l.windy)) extra.push('It gets windy, so pick something windproof.');
    const uvh = [cur, ...hrs].find(h => h.uv >= 6);
    if (uvh) extra.push(`UV hits ${Math.round(uvh.uv)} around ${hourLabel(uvh.t)}: sunscreen and sunglasses.`);
    const windN = Math.round(units === 'F' ? cur.wind * 0.621 : cur.wind);
    const detail = `Now ${tdisp(cur.temp, units)}, feels like ${tdisp(cur.feels, units)}, ${humidityPhrase(cur)}, wind ${Number.isFinite(windN) ? windN : 0} ${units === 'F' ? 'mph' : 'km/h'}, ${cur.pp}% rain chance. ` + extra.join(' ');
    const hours = hrs.map(h => {
      const l = layer(h, body);
      return { t: h.t, label: hourLabel(h.t), feelsText: tdisp(h.feels, units), pp: h.pp, top: l.top, topWord: l.top.split(/[ ,]/)[0], wet: l.wet, lvl: l.lvl };
    });
    return { ok: true, stale: false, advice: adv, detail: detail, hours: hours };
  }
  const API = { advise: advise, layer: layer, rainWord: rainWord, tdisp: tdisp, hourLabel: hourLabel };
  if (typeof module !== 'undefined') module.exports = API;
  else root.WearCheck = API;
})(this);
