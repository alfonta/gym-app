// Renders the app icons with the pre-installed Chromium.
const { chromium } = require('playwright');
(async () => {
const svg = (s) => `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100">
<rect width="100" height="100" fill="#0e1116"/>
<g fill="#4ade80"><rect x="22" y="46" width="56" height="8" rx="2"/>
<rect x="14" y="36" width="8" height="28" rx="3"/><rect x="24" y="30" width="9" height="40" rx="3"/>
<rect x="78" y="36" width="8" height="28" rx="3"/><rect x="67" y="30" width="9" height="40" rx="3"/></g></svg></body></html>`;
const b = await chromium.launch();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(svg(size));
  await p.screenshot({ path: `public/${name}` });
  await p.close();
}
await b.close();
})();
