// Wear Check outfit logic. Forecasts are synthetic; nothing is fetched.
const W = require('./logic.js');
const fs = require('fs');
let fail = 0;
function ok(name, c) { if (!c) fail++; console.log((c ? 'PASS ' : 'FAIL ') + name); }
function eq(name, got, exp) {
  const c = got === exp;
  if (!c) fail++;
  console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' got ' + JSON.stringify(got) + ' expected ' + JSON.stringify(exp)));
}
function hourLabel(t) { return new Date(t).toLocaleTimeString([], { hour: 'numeric' }); }
const NOW = Date.UTC(2026, 10, 17, 15, 0, 0);

function slot(i, over, start) {
  const s = Object.assign({
    t: (start == null ? NOW : start) + i * 3600e3,
    temp: 20, pp: 0, precip: 0, wind: 5, rh: 40, uv: 1
  }, over || {});
  if (!over || !Object.prototype.hasOwnProperty.call(over, 'feels')) s.feels = s.temp;
  return s;
}
function same(n, over) {
  const slots = [];
  for (let i = 0; i < n; i++) slots.push(slot(i, over));
  return slots;
}
function forecast(slots, current) {
  const hourly = {
    time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [],
    precipitation: [], wind_speed_10m: [], relative_humidity_2m: [], uv_index: []
  };
  slots.forEach(s => {
    hourly.time.push(s.t);
    hourly.temperature_2m.push(s.temp);
    hourly.apparent_temperature.push(s.feels);
    hourly.precipitation_probability.push(s.pp);
    hourly.precipitation.push(s.precip);
    hourly.wind_speed_10m.push(s.wind);
    hourly.relative_humidity_2m.push(s.rh);
    hourly.uv_index.push(s.uv);
  });
  const data = { hourly: hourly };
  if (current === false) return data;
  const c = current || slots[0];
  data.current = {
    time: c.t, temperature_2m: c.temp, apparent_temperature: c.feels,
    precipitation: c.precip, wind_speed_10m: c.wind, relative_humidity_2m: c.rh
  };
  return data;
}
function advise(slots, opt, current) {
  return W.advise(forecast(slots, current), Object.assign({ now: NOW, units: 'C', body: 'normal' }, opt || {}));
}
function H(over, body) {
  return W.layer(Object.assign({ feels: 20, temp: 20, rh: 40, pp: 0, precip: 0, wind: 0, uv: 0 }, over), body || 'normal');
}

[[24, 'T-shirt', 0], [23.999, 'Light long sleeve', 1], [18, 'Light long sleeve', 1], [17.999, 'Hoodie', 2],
 [12, 'Hoodie', 2], [11.999, 'Jacket', 3], [5, 'Jacket', 3], [4.999, 'Warm coat', 4],
 [-2, 'Warm coat', 4], [-2.001, 'Heavy coat, hat and gloves', 5], [-40, 'Heavy coat, hat and gloves', 5]
].forEach(([feels, top, lvl]) => {
  const L = H({ feels: feels, temp: feels });
  eq(feels + '°C top', L.top, top);
  eq(feels + '°C level', L.lvl, lvl);
});
eq('warm body wears less', H({ feels: 24, temp: 24 }, 'warm').top, 'Light long sleeve');
eq('cold body wears more', H({ feels: 22, temp: 22 }, 'cold').top, 'T-shirt');
eq('damp cold adds a layer', H({ feels: 12, temp: 9, rh: 85 }).top, 'Jacket');
eq('damp nudge amount', H({ feels: 12, temp: 9, rh: 85 }).f, 10.5);
eq('rh 84 is not damp', H({ feels: 12, temp: 9, rh: 84 }).top, 'Hoodie');
eq('temp 10°C is not damp', H({ feels: 12, temp: 10, rh: 85 }).top, 'Hoodie');
eq('warm and damp stack', H({ feels: 12, temp: 9, rh: 85 }, 'warm').f, 7.5);
ok('rain chance 50 is wet', H({ pp: 50 }).wet);
ok('rain chance 49.999 is dry', !H({ pp: 49.999 }).wet);
ok('precip 0.5 mm is wet', H({ precip: 0.5 }).wet);
ok('precip 0.499 mm is dry', !H({ precip: 0.499 }).wet);
ok('wind 30 km/h is windy', H({ wind: 30 }).windy);
ok('wind 29.999 is not', !H({ wind: 29.999 }).windy);
ok('UV 6 needs sun protection', H({ uv: 6 }).sun);
ok('UV 5.999 does not', !H({ uv: 5.999 }).sun);
eq('snow at 1°C', W.rainWord({ temp: 1 }), 'snow gear');
eq('rain above 1°C', W.rainWord({ temp: 1.1 }), 'rain jacket');
eq('0°C to °F', W.tdisp(0, 'F'), '32°F');
eq('100°C to °F', W.tdisp(100, 'F'), '212°F');
eq('-10°C to °F', W.tdisp(-10, 'F'), '14°F');
eq('24°C stays °C', W.tdisp(24, 'C'), '24°C');
eq('missing temp does not become NaN°', W.tdisp(NaN, 'F'), '—°F');

let r = advise(same(4, { temp: 20, feels: 20, wind: 10, rh: 40 }));
eq('mild hour sentence', r.advice, 'Light long sleeve now.');
eq('mild detail', r.detail, 'Now 20°C, feels like 20°C, humidity 40%, wind 10 km/h, 0% rain chance. ');
eq('strip label uses locale hour', r.hours[0].label, hourLabel(NOW));
eq('strip length is the hours we passed', r.hours.length, 4);

r = advise(same(20, { temp: 20, feels: 20 }));
eq('strip is this hour plus the next 12', r.hours.length, 13);
eq('first strip slot is now', r.hours[0].t, NOW);
eq('last strip slot is 12 hours out', r.hours[12].t, NOW + 12 * 3600e3);

let slots = same(20, { temp: 20, feels: 20 });
slots[12] = slot(12, { pp: 80 });
slots[13] = slot(13, { pp: 90 });
r = advise(slots);
eq('rain 12 hours out is mentioned', r.advice, 'Light long sleeve now, rain jacket by ' + hourLabel(slots[12].t) + '.');
slots = same(20, { temp: 20, feels: 20 });
slots[13] = slot(13, { pp: 90 });
eq('rain past the 12-hour window is ignored', advise(slots).advice, 'Light long sleeve now.');

r = advise(same(3, { temp: 0, feels: 0, rh: 0, wind: 0, pp: 0, precip: 0, uv: 0 }));
eq('real zero is freezing, not missing data', r.advice, 'Warm coat now.');
eq('zero detail', r.detail, 'Now 0°C, feels like 0°C, humidity 0%, wind 0 km/h, 0% rain chance. ');
ok('zero forecast is usable', r.ok && !r.stale);

r = advise(same(2, { temp: 0, feels: 0, wind: 10, rh: 50 }), { units: 'F' });
eq('fahrenheit detail and mph', r.detail, 'Now 32°F, feels like 32°F, humidity 50%, wind 6 mph, 0% rain chance. ');

eq('run cold', advise(same(4, { temp: 15, feels: 15 }), { body: 'cold' }).advice, 'Light long sleeve now.');
eq('normal at 15°C', advise(same(4, { temp: 15, feels: 15 }), { body: 'normal' }).advice, 'Hoodie now.');
eq('run hot at 15°C is a hoodie', advise(same(4, { temp: 15, feels: 15 }), { body: 'warm' }).advice, 'Hoodie now.');

r = advise(same(3, { temp: 9, feels: 12, rh: 85 }));
eq('damp cold sentence', r.advice, 'Jacket now.');
ok('damp note', r.detail.indexOf('Damp cold feels colder than the number.') >= 0);
r = advise(same(2, { temp: 10, feels: 12, rh: 85 }));
eq('10°C is not the damp note', r.advice, 'Hoodie now.');
ok('no damp note at 10°C', r.detail.indexOf('Damp cold') < 0);

eq('snow gear at 1°C', advise(same(3, { temp: 1, feels: 1, pp: 50 })).advice, 'Warm coat now and a snow gear.');
eq('rain jacket just above freezing', advise(same(3, { temp: 1.1, feels: 1, pp: 50 })).advice, 'Warm coat now and a rain jacket.');
eq('dry deep freeze', advise(same(3, { temp: -8, feels: -8 })).advice, 'Heavy coat, hat and gloves now.');
r = advise(same(2, { temp: -10, feels: -10 }));
eq('heavy coat word on the strip', r.hours[0].topWord, 'Heavy');
eq('heavy coat full name', r.hours[0].top, 'Heavy coat, hat and gloves');
ok('dry freeze has no umbrella', !r.hours[0].wet);

slots = same(4, { temp: 31, feels: 33, rh: 72, wind: 31, uv: 0 });
slots[2] = slot(2, { temp: 31, feels: 33, rh: 72, wind: 31, uv: 8.4 });
r = advise(slots, { units: 'F' });
eq('hot sentence', r.advice, 'T-shirt now.');
ok('sticky note', r.detail.indexOf('Humid and sticky: go breathable, light colors.') >= 0);
ok('wind note', r.detail.indexOf('It gets windy, so pick something windproof.') >= 0);
ok('UV note rounds and names the hour', r.detail.indexOf('UV hits 8 around ' + hourLabel(slots[2].t)) >= 0);
ok('hot fahrenheit now', r.detail.indexOf('Now 88°F, feels like 91°F') === 0);
ok('wind km/h to mph', r.detail.indexOf('wind 19 mph') >= 0);
ok('sticky wins over the damp sentence', r.detail.indexOf('Damp cold') < 0);
eq('humidity is not rounded', advise(same(1, { rh: 40.5 })).detail.indexOf('humidity 40.5%') >= 0, true);

r = advise(same(2, { wind: 29.9 }));
ok('29.9 km/h is not called windy', r.detail.indexOf('windy') < 0);
ok('wind 30 is called windy', advise(same(2, { wind: 30 })).detail.indexOf('It gets windy, so pick something windproof.') >= 0);

slots = same(6, { temp: 26, feels: 26 });
slots[3] = slot(3, { temp: 16, feels: 16, pp: 70 });
slots[4] = slot(4, { temp: 16, feels: 16, pp: 70 });
slots[5] = slot(5, { temp: 16, feels: 16, pp: 70 });
r = advise(slots);
eq('later rain and a lasting cooldown', r.advice, 'T-shirt now, rain jacket by ' + hourLabel(slots[3].t) + ', hoodie by ' + hourLabel(slots[3].t) + '.');

slots = same(6, { temp: 26, feels: 26 });
slots[1] = slot(1, { temp: 5, feels: 5 });
eq('one-hour blip does not change the outfit', advise(slots).advice, 'T-shirt now.');
slots[2] = slot(2, { temp: 5, feels: 5 });
eq('two colder hours do', advise(slots).advice, 'T-shirt now, jacket by ' + hourLabel(slots[1].t) + '.');

slots = same(4, { temp: 5, feels: 5 });
slots[1] = slot(1, { temp: 26, feels: 26 });
slots[2] = slot(2, { temp: 26, feels: 26 });
slots[3] = slot(3, { temp: 26, feels: 26 });
eq('warming up suggests the lighter layer', advise(slots).advice, 'Jacket now, t-shirt by ' + hourLabel(slots[1].t) + '.');
eq('a change on the last hour still counts', advise([slot(0, { temp: 5, feels: 5 }), slot(1, { temp: 26, feels: 26 })]).advice, 'Jacket now, t-shirt by ' + hourLabel(NOW + 3600e3) + '.');

slots = [slot(0, { t: NOW - 2 * 3600e3, temp: 0, feels: 0 })];
for (let i = 0; i < 14; i++) slots.push(slot(0, { t: NOW + i * 3600e3, temp: 26, feels: 26 }));
r = advise(slots, {}, false);
eq('hours older than an hour drop off the strip', r.hours.length, 13);
eq('strip starts at the current hour', r.hours[0].t, NOW);
eq('old cold hour is not the advice', r.advice, 'T-shirt now.');
eq('no current block uses the hourly observation', advise(same(2, { temp: 26, feels: 26 }), {}, false).advice, 'T-shirt now.');

r = advise([slot(0, { t: NOW - 3 * 3600e3 }), slot(1, { t: NOW - 2 * 3600e3 })]);
eq('stale forecast copy', r.advice, 'The saved forecast is out of date. Connect to the internet to refresh it.');
eq('stale detail cleared', r.detail, '');
eq('stale strip cleared', r.hours.length, 0);
ok('stale flag', r.stale === true && r.ok === false);
r = advise([slot(0, { t: NOW - 3600e3, temp: 21, feels: 21 })]);
ok('exactly one hour old is still usable', r.ok && !r.stale);
eq('exactly one hour old still dresses', r.advice, 'Light long sleeve now.');
ok('one millisecond older is stale', advise([slot(0, { t: NOW - 3600e3 - 1 })]).stale);

const broken = {
  hourly: {
    time: [NOW, NOW + 3600e3, NOW + 2 * 3600e3],
    temperature_2m: [null, 20, null],
    apparent_temperature: [18, null, null],
    precipitation_probability: [null, undefined, 10],
    precipitation: [null, NaN, 0],
    wind_speed_10m: [undefined, 10, 0],
    relative_humidity_2m: [null, 40, 40],
    uv_index: [undefined, 0, 0]
  },
  current: {
    time: NOW, temperature_2m: null, apparent_temperature: 18,
    precipitation: null, wind_speed_10m: null, relative_humidity_2m: null
  }
};
r = W.advise(broken, { now: NOW, units: 'C', body: 'normal' });
eq('missing temp falls back to feels-like', r.advice, 'Light long sleeve now.');
ok('no NaN null or undefined in the copy', !/NaN|null|undefined|Infinity/.test(r.advice + ' ' + r.detail + ' ' + JSON.stringify(r.hours)));
ok('fallback temperatures are shown', r.detail.indexOf('Now 18°C, feels like 18°C') === 0);
ok('missing humidity is not the word null', r.detail.indexOf('humidity unknown') >= 0 && r.detail.indexOf('null') < 0);
ok('missing wind is calm, not NaN', r.detail.indexOf('wind 0 km/h') >= 0);
eq('hour with both temperatures missing is dropped', r.hours.length, 2);
eq('feels-like fills a missing apparent temperature', r.hours[1].feelsText, '20°C');
eq('rain chance null becomes 0', r.hours[0].pp, 0);

r = W.advise({
  hourly: { time: [NOW, NOW + 3600e3] },
  current: { time: NOW, temperature_2m: 22, apparent_temperature: 22, precipitation: 0, wind_speed_10m: 3, relative_humidity_2m: 30 }
}, { now: NOW, units: 'C' });
eq('current observation survives missing hourly fields', r.advice, 'Light long sleeve now.');
eq('no hourly columns when those fields are missing', r.hours.length, 0);
ok('that path does not throw or print NaN', r.ok && !/NaN/.test(r.detail));

let threw = false;
try { W.advise(null, { now: NOW }); W.advise(undefined, { now: NOW }); W.advise({}, { now: NOW }); W.advise({ hourly: { time: [] } }, { now: NOW }); }
catch (e) { threw = true; }
ok('empty forecasts do not throw', !threw);
eq('null forecast copy', W.advise(null, { now: NOW }).advice, 'The forecast is missing data. Connect to the internet to refresh it.');
eq('empty hours are not stale', W.advise({ hourly: { time: [] } }, { now: NOW }).stale, false);
ok('missing copy has no NaN', !/NaN|null|undefined/.test(W.advise({ hourly: null }, { now: NOW }).advice));

const sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');
ok('service worker caches logic.js', sw.indexOf('./logic.js') >= 0);
ok('service worker cache version bumped', sw.indexOf('wear-check-v3') >= 0);

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
