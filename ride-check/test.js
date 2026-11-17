// Ride Check decision logic. Expected money strings are the same formatting the page shows.
const R = require('./logic.js');
const fs = require('fs');
let fail = 0;
function ok(name, c) { if (!c) fail++; console.log((c ? 'PASS ' : 'FAIL ') + name); }
function eq(name, got, exp) {
  const c = got === exp;
  if (!c) fail++;
  console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' got ' + JSON.stringify(got) + ' expected ' + JSON.stringify(exp)));
}
function near(name, got, exp, tol) {
  tol = tol || 1e-9;
  const c = typeof got === 'number' && Math.abs(got - exp) <= tol;
  if (!c) fail++;
  console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' got ' + got + ' expected ' + exp));
}
const parsed = [['', 0], ['   ', 0], ['0', 0], ['abc', 0], ['-', 0], ['12.50', 12.5], ['$12.50', 12.5], ['.5', .5], ['1,000', 1000], ['1,000.50', 1000.5], ['12,50', 12.5], ['1,5', 1.5], ['-3', -3], ['1e2', 12], ['1.2.3', 1.2], ['  8 ', 8], ['$1,250.50', 1250.5]];
parsed.forEach(([s, n]) => eq('parse ' + JSON.stringify(s), R.parseNum(s), n));
eq('optional blank', R.parseOptional('  '), null);
eq('optional text', R.parseOptional('n/a'), null);
eq('optional zero', R.parseOptional('0'), 0);
eq('optional rating', R.parseOptional('4.70'), 4.7);
eq('money 1.318', R.money(14.5 / 11), '$1.32');
eq('money negative', R.money(-2), '-$2.00');
eq('money zero', R.money(0), '$0.00');
ok('money hides non-finite', R.money(Infinity) === '—' && R.money(NaN) === '—' && !/Infinity|NaN/.test(R.money(Infinity) + R.money(NaN)));

const BASE = { cpm: '0.30', minMile: '1.00', tgtMile: '1.50', minHr: '20', tgtHr: '30', minRating: '4.70' };
function ride(over) {
  return R.evaluate(Object.assign({ fare: '', pmiles: '', tmiles: '', rmiles: '', mins: '', rating: '' }, BASE, over));
}

let r = ride({ fare: '14.50', pmiles: '2', tmiles: '9', mins: '22' });
eq('14.50 over 11 mi and 22 min is MAYBE', r.verdict, 'MAYBE');
eq('MAYBE class', r.className, 'M');
eq('11 miles total', r.miles, 11);
near('gross $/mi', r.perMile, 14.5 / 11);
near('profit $/hr', r.netHr, (14.5 - 11 * 0.3) / 22 * 60);
eq('MAYBE line', r.line, '$1.32/mi · $39.55/hr gross · $30.55/hr profit after $3.30 car cost');
eq('MAYBE why', r.why, '$/mi between minimum and target · profit/hr at or above target');
ok('no return clause when return is blank', r.why.indexOf('return') < 0);

r = ride({ fare: '15', tmiles: '10', mins: '24' });
eq('both metrics at target is ACCEPT', r.verdict, 'ACCEPT');
eq('ACCEPT class', r.className, 'A');
eq('ACCEPT line', r.line, '$1.50/mi · $37.50/hr gross · $30.00/hr profit after $3.00 car cost');
eq('ACCEPT why', r.why, '$/mi at or above target · profit/hr at or above target');
near('car cost', r.cost, 3);

r = ride({ fare: '15', tmiles: '10', mins: '30', cpm: '0' });
eq('zero car cost keeps gross and profit in the line', r.line, '$1.50/mi · $30/hr gross · $30.00/hr profit after $0.00 car cost');
eq('zero car cost still ACCEPT', r.verdict, 'ACCEPT');

r = ride({ fare: '10', tmiles: '10', mins: '21' });
eq('exactly minimum $/mi and $/hr is MAYBE', r.verdict, 'MAYBE');
eq('between why', r.why, '$/mi between minimum and target · profit/hr between minimum and target');
near('net hourly at the floor', r.netHr, 20);

r = ride({ fare: '20', tmiles: '10', mins: '34' });
eq('profit $/hr exactly at target is ACCEPT', r.verdict, 'ACCEPT');
near('net hourly at target', r.netHr, 30);

r = ride({ fare: '20', tmiles: '10', mins: '51' });
eq('profit $/hr exactly at minimum is MAYBE', r.verdict, 'MAYBE');
eq('hour floor why', r.why, '$/mi at or above target · profit/hr between minimum and target');

r = ride({ fare: '20', tmiles: '10', mins: '52' });
eq('profit $/hr just under minimum is PASS', r.verdict, 'PASS');
eq('PASS class', r.className, 'P');
eq('hour loses to the mile', r.why, '$/mi at or above target · profit/hr under minimum');
ok('just under 20', r.netHr < 20 && r.netHr > 19);

r = ride({ fare: '9.90', tmiles: '10', mins: '15' });
eq('$/mi just under minimum is PASS even if the hour is fine', r.verdict, 'PASS');
eq('mile floor why', r.why, '$/mi under minimum · profit/hr between minimum and target');
near('just under $1/mi', r.perMile, 0.99);

r = ride({ fare: '14.90', tmiles: '10', mins: '20' });
eq('$/mi just under target stays MAYBE', r.verdict, 'MAYBE');
ok('line shows $1.49 not a rounded-up target', r.line.indexOf('$1.49/mi') === 0);
ok('hour itself would accept', r.netHr >= 30);

r = ride({ fare: '15', tmiles: '10', mins: '24', minMile: '1.50', tgtMile: '1.50' });
eq('equal min and target: the target value is ACCEPT', r.verdict, 'ACCEPT');
r = ride({ fare: '14', tmiles: '10', mins: '24', minMile: '1.50', tgtMile: '1.50' });
eq('equal min and target: below it is PASS', r.verdict, 'PASS');

r = ride({ fare: '5', tmiles: '20', mins: '30' });
eq('fare below car cost is PASS', r.verdict, 'PASS');
eq('negative profit is formatted', r.line, '$0.25/mi · $10/hr gross · -$2.00/hr profit after $6.00 car cost');
ok('net is negative', r.net < 0 && r.netHr < 0);

r = ride({ fare: '20', pmiles: '1', tmiles: '8', rmiles: '2', mins: '30' });
eq('return miles count toward the total', r.miles, 11);
eq('return trip is ACCEPT', r.verdict, 'ACCEPT');
eq('return line', r.line, '$1.82/mi · $40/hr gross · $33.40/hr profit after $3.30 car cost');
ok('why names the return', r.why.indexOf('includes 2 mi return') >= 0);

r = ride({ fare: '$15', tmiles: '10', mins: '24' });
eq('dollar sign and digits still rate', r.verdict, 'ACCEPT');
eq('comma fare parses', ride({ fare: '$1,250.50', tmiles: '100', mins: '60' }).fare, 1250.5);

r = ride({ fare: '8', tmiles: '0.1', mins: '2' });
eq('very short trip is finite', r.verdict, 'ACCEPT');
eq('short trip $/mi', r.perMile, 80);
ok('short trip line has no NaN', r.line.indexOf('$240/hr gross') >= 0 && !/NaN|Infinity/.test(r.line));

r = ride({ fare: '1000000', tmiles: '10', mins: '60' });
eq('large fare still rates', r.verdict, 'ACCEPT');
ok('large fare line stays finite', r.line.indexOf('$1000000/hr gross') >= 0 && !/NaN|Infinity/.test(r.line + r.verdict));

r = ride({ fare: '9'.repeat(308), tmiles: '1', mins: '0.' + '0'.repeat(20) + '1' });
eq('overflowing $/hr is not shown', r.verdict, '-');
eq('overflow why', r.why, 'Those numbers are too big to rate.');
ok('overflow has no Infinity or NaN', !/Infinity|NaN/.test(JSON.stringify(r)) && r.line === '');

[['zero fare', { fare: '0', tmiles: '5', mins: '20' }],
 ['zero miles', { fare: '10', tmiles: '0', mins: '20' }],
 ['zero minutes', { fare: '10', tmiles: '5', mins: '0' }],
 ['blank', {}],
 ['spaces', { fare: '  ', tmiles: ' 5 ', mins: '   ' }],
 ['text fare', { fare: 'abc', tmiles: '5', mins: '20' }]
].forEach(([name, over]) => {
  const x = ride(over);
  eq(name + ' unrated', x.verdict, '-');
  eq(name + ' prompt', x.why, 'Type the fare, miles and minutes.');
  eq(name + ' no class', x.className, '');
  ok(name + ' no NaN', !/NaN|Infinity/.test(JSON.stringify(x)));
});

[{ fare: '-10', tmiles: '5', mins: '20' },
 { fare: '10', pmiles: '-1', tmiles: '5', mins: '20' },
 { fare: '10', tmiles: '-4', mins: '20' },
 { fare: '10', tmiles: '5', rmiles: '-1', mins: '20' },
 { fare: '10', tmiles: '5', mins: '-20' },
 { fare: ' -0.50 ', tmiles: '5', mins: '20' }
].forEach(over => {
  const x = ride(over);
  eq('negative rejected ' + JSON.stringify(over), x.verdict, '-');
  eq('negative why ' + JSON.stringify(over), x.why, 'Fare, miles, and minutes need to be greater than zero.');
  ok('negative has no profit line', x.line === '' && x.ok === false);
});

r = ride({ fare: '15', tmiles: '10', mins: '24', rating: '4.69' });
eq('rating under the minimum knocks ACCEPT down one step', r.verdict, 'MAYBE');
eq('knock why', r.why, '$/mi at or above target · profit/hr at or above target · rider rating 4.69 is under your 4.7 minimum, so knocked down one step');

r = ride({ fare: '15', tmiles: '10', mins: '24', rating: '4.70' });
eq('rating exactly at the minimum does not knock', r.verdict, 'ACCEPT');
ok('exact rating is not mentioned', r.why.indexOf('rider') < 0);

r = ride({ fare: '15', tmiles: '10', mins: '24', rating: '1' });
eq('a very low rating still knocks only one step', r.verdict, 'MAYBE');

r = ride({ fare: '10', tmiles: '10', mins: '21', rating: '4' });
eq('rating knocks MAYBE down to PASS', r.verdict, 'PASS');
ok('maybe knock copy', r.why.indexOf('rider rating 4 is under your 4.7 minimum, so knocked down one step') >= 0);

r = ride({ fare: '5', tmiles: '10', mins: '40', rating: '3' });
eq('already PASS stays PASS', r.verdict, 'PASS');
eq('pass rating note', r.why, '$/mi under minimum · profit/hr under minimum · rider rating 3 is under your 4.7 minimum');

r = ride({ fare: '15', tmiles: '10', mins: '24', rating: '0' });
eq('numeric zero rating still counts', r.verdict, 'MAYBE');

r = ride({ fare: '15', tmiles: '10', mins: '24' });
eq('blank rating is ignored', r.verdict, 'ACCEPT');
eq('blank rating stored as null', r.rating, null);

r = ride({ fare: '15', tmiles: '10', mins: '24', rating: 'n/a' });
eq('non-numeric rating is ignored', r.verdict, 'ACCEPT');
eq('non-numeric rating is null', r.rating, null);

r = ride({ fare: '15', tmiles: '10', mins: '24', rating: '1', minRating: '' });
eq('blank minimum rating ignores the rider rating', r.verdict, 'ACCEPT');

r = ride({ fare: '15', tmiles: '10', mins: '24', rating: '1', minRating: 'nope' });
eq('non-numeric minimum rating is ignored', r.verdict, 'ACCEPT');

const sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');
ok('service worker caches logic.js', sw.indexOf('./logic.js') >= 0);
ok('service worker cache version bumped', sw.indexOf('ride-check-v4') >= 0);

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
