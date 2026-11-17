// Ride Check offer math: $/mile, $/hour, profit after car costs, accept/maybe/pass.
// Classic <script> in the page and require() in Node. No dependencies, no build.
(function (root) {
  function parseNum(s) {
    let t = String(s).trim();
    t = t.includes('.') ? t.replace(/,/g, '') : /,\d{3}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
    const n = parseFloat(t.replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }
  // Optional fields (rider rating, minimum rating). Blank or text with no digits is
  // "not set", not a fake zero that would knock the verdict down.
  function parseOptional(s) {
    if (s == null) return null;
    const raw = String(s).trim();
    if (!raw || !/[0-9]/.test(raw)) return null;
    return parseNum(raw);
  }
  function money(n) {
    if (!Number.isFinite(n)) return '—';
    return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
  }
  function invalid(why) {
    return { ok: false, verdict: '-', className: '', line: '', why: why };
  }
  function evaluate(input) {
    input = input || {};
    const fare = parseNum(input.fare), pm = parseNum(input.pmiles), tm = parseNum(input.tmiles), rm = parseNum(input.rmiles), mins = parseNum(input.mins);
    const rating = parseOptional(input.rating);
    const cpm = parseNum(input.cpm), minMile = parseNum(input.minMile), tgtMile = parseNum(input.tgtMile), minHr = parseNum(input.minHr), tgtHr = parseNum(input.tgtHr);
    const minR = parseOptional(input.minRating);
    const miles = pm + tm + rm;
    // Negative distance used to lower the car-cost line and inflate profit. A negative
    // duration flips $/hour. Neither is a real offer, and zero would divide by zero.
    if (fare < 0 || pm < 0 || tm < 0 || rm < 0 || mins < 0) return invalid('Fare, miles, and minutes need to be greater than zero.');
    if (!(fare > 0) || !(miles > 0) || !(mins > 0)) return invalid('Type the fare, miles and minutes.');
    const perMile = fare / miles, perHr = fare / mins * 60, cost = miles * cpm, net = fare - cost, netHr = net / mins * 60;
    if (![perMile, perHr, cost, net, netHr].every(Number.isFinite)) return invalid('Those numbers are too big to rate.');
    const lvl = (x, mn, tg) => x < mn ? 0 : x >= tg ? 2 : 1;
    const lm = lvl(perMile, minMile, tgtMile), lh = lvl(netHr, minHr, tgtHr);
    let l = Math.min(lm, lh);
    const why = [], nm = ['under minimum', 'between minimum and target', 'at or above target'];
    why.push(`$/mi ${nm[lm]}`, `profit/hr ${nm[lh]}`);
    if (rm) why.push(`includes ${rm} mi return`);
    if (minR !== null && rating !== null && rating < minR && l > 0) {
      l--;
      why.push(`rider rating ${rating} is under your ${minR} minimum, so knocked down one step`);
    } else if (minR !== null && rating !== null && rating < minR) {
      why.push(`rider rating ${rating} is under your ${minR} minimum`);
    }
    const verdict = ['PASS', 'MAYBE', 'ACCEPT'][l];
    const line = `${money(perMile)}/mi · ${money(perHr).replace('.00', '')}/hr gross · ${money(netHr)}/hr profit after ${money(cost)} car cost`;
    return { ok: true, verdict: verdict, className: 'PMA'[l], line: line, why: why.join(' · '), fare: fare, pm: pm, tm: tm, rm: rm, miles: miles, mins: mins, rating: rating, perMile: perMile, perHr: perHr, net: net, netHr: netHr, cost: cost };
  }
  const API = { parseNum: parseNum, parseOptional: parseOptional, money: money, evaluate: evaluate };
  if (typeof module !== 'undefined') module.exports = API;
  else root.RideCheck = API;
})(this);
