import { startServer, launch, waitModel } from '../tests/e2e/helpers.mjs';
const { server, url } = await startServer(5203);
const b = await launch(); const page = await (await b.newContext({ viewport: { width: 440, height: 900 } })).newPage();
await page.goto(url + '?model=gemv'); await waitModel(page);
const r = await page.evaluate(async () => {
  const a = __rc.app, ex = a.exploder, w = async () => { await new Promise((r) => setTimeout(r, 200)); for (let i = 0; i < 100 && ex.tweens.size; i++) await new Promise((r) => setTimeout(r, 200)); };
  const pos = () => a.pieces.map((p) => p.mesh.position.toArray().map((n) => +n.toFixed(3)).join(','));
  const p0 = pos(); window.__d = [ex.explodable.length, ex.offsets.size];
  ex.setAll(true); await w(1600); const pe = pos();
  const body = a.zones.find((z) => z.role === 'body');
  a.setHidden(body.pieceIds, true); await w(300);
  ex.setAll(false); await w(1600); const pa = pos(); window.__am = [[...ex.amount.entries()], [...ex.target.entries()], ex.tweens.size, ex.explodable];
  a.setHidden(body.pieceIds, false); await w(300); const pb = pos();
  ex.setAll(true); await w(1600); const pe2 = pos(); ex.setAll(false); await w(1600);
  const diff = p0.map((x,i)=>x!==pb[i]?[i,x,pb[i],pa[i]]:null).filter(Boolean); return { am: window.__am, diff: diff.length, d: window.__d, amt: [...ex.amount.values()], sameAfter: JSON.stringify(pb) === JSON.stringify(p0), explodedChanged: JSON.stringify(pe) !== JSON.stringify(p0), reExplodeSame: JSON.stringify(pe2) === JSON.stringify(pe), backAgain: JSON.stringify(pos()) === JSON.stringify(p0), };
});
console.log(JSON.stringify(r).slice(0, 600));
await b.close(); server.close?.(); process.exit(0);
