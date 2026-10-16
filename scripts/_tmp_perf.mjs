import { chromium } from 'playwright';
const url = process.argv[2], slow = process.argv[3] !== 'fast';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 412, height: 823 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('rc:onboarded', 'true'); localStorage.setItem('rc:seenVersion', JSON.stringify('99.0.0')); window.__lcp = 0; window.__long = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
if (slow) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
const reqs = []; const t0 = Date.now();
page.on('response', async (r) => { try { reqs.push({ t: Date.now() - t0, url: r.url().replace(/^https?:\/\/[^/]+/, ''), kb: Math.round((await r.body()).length / 1024) }); } catch {} });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__rc?.app?.model && !document.querySelector('.progress:not([hidden])'), null, { timeout: 180000 }).catch(() => {});
const tReady = Date.now() - t0;
await page.waitForTimeout(3000);
const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), long: window.__long, fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0) }));
console.log(slow ? 'RÉSEAU 4G lent + CPU x4' : 'rapide', 'prêt après', tReady, 'ms ; FCP', m.fcp, ' LCP', m.lcp, ' tâches longues', m.long.length, ' total', m.long.reduce((a, x) => a + x[1], 0), 'ms');
console.log('longues :', JSON.stringify(m.long.slice(0, 12)));
reqs.sort((a, b) => a.t - b.t); for (const r of reqs.filter((r) => r.kb > 40)) console.log(String(r.t).padStart(6), String(r.kb).padStart(6), r.url.slice(0, 70));
await b.close();
