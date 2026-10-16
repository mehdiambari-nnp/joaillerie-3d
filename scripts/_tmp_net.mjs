import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const reqs = []; const t0 = Date.now();
page.on('response', async (r) => { try { const len = (await r.body()).length; reqs.push({ t: Date.now() - t0, url: r.url().replace(/^https?:\/\/[^/]+/, ''), kb: Math.round(len / 1024), type: r.request().resourceType() }); } catch {} });
await page.goto(process.argv[2], { waitUntil: 'load' }); await page.waitForTimeout(6000);
reqs.sort((a, b) => a.t - b.t);
let tot = 0; for (const r of reqs) { tot += r.kb; console.log(String(r.t).padStart(5), String(r.kb).padStart(6), r.type.padEnd(10), r.url.slice(0, 90)); }
console.log('total Ko', tot);
console.log(await page.evaluate(() => JSON.stringify({ login: !!document.querySelector('.login'), rc: !!window.__rc })));
await b.close();
