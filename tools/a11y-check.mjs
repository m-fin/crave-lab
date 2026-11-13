// Accessibility check: loads the landing page and every app in headless Chrome and runs axe-core
// (WCAG 2 A/AA + best practices) on each, at phone and desktop widths. Exit 1 on any violation.
//   npm i --no-save puppeteer-core axe-core && node tools/a11y-check.mjs
// CHROME=/path/to/chrome overrides the browser (default /usr/bin/google-chrome).
import puppeteer from 'puppeteer-core';
import { createRequire } from 'module';
import fs from 'fs';
import http from 'http';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const axeSrc = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const PAGES = ['', 'ride-check/', 'wear-check/', 'btc-board/', 'calc/'];
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
let failures = 0;
try {
  for (const pg of PAGES) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport(vp);
      // keep the check offline and deterministic: third-party API calls (prices, weather) are answered with 503
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.respond({ status: 503, body: '' })));
      await page.goto(base + pg, { waitUntil: 'networkidle0' });
      await page.evaluate(axeSrc);
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] })).violations
        .map((x) => `${x.impact} ${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(', ')}`));
      const label = `${pg || '(landing)'} @${vp.width}px`;
      if (v.length) { failures += v.length; console.log(`FAIL ${label}\n  ${v.join('\n  ')}`); }
      else console.log(`PASS ${label}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `${failures} accessibility violation(s)` : 'no accessibility violations');
process.exit(failures ? 1 : 0);
