// Makes the preview screenshots and a PDF from the local preview server (python3 tools/serve.py 8080).
// Run: node tools/preview.js <output folder>
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
const B = 'http://127.0.0.1:8080';
fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
const shots = [];

async function settle(p) {
  await p.evaluate(() => Promise.race([
    Promise.all([...document.images].filter((i) => i.currentSrc && i.getBoundingClientRect().top < innerHeight * 2).map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))),
    new Promise((r) => setTimeout(r, 3000)),
  ]));
  await p.waitForTimeout(350);
}

(async () => {
  const b = await chromium.launch();
  const mk = async (opts) => { const c = await b.newContext({ ...opts, reducedMotion: 'reduce' }); return [c, await c.newPage()]; };
  const snap = async (p, kind, name, caption) => {
    await settle(p);
    const file = `screens/${kind}-${String(shots.length + 1).padStart(2, '0')}-${name}.jpg`;
    await p.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 84 });
    shots.push({ kind, file, caption });
  };
  const to = async (p, sel, offset = 70) => { await p.evaluate(([s, o]) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, [sel, offset]); };

  // phone
  let [c, p] = await mk({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  await p.goto(B + '/'); await snap(p, 'phone', 'home', 'Home page. Real drone photo, headline, and two clear buttons.');
  await to(p, '.intro'); await snap(p, 'phone', 'welcome', 'Welcome section with a real kitchen photo.');
  await to(p, '.feature-grid', 150); await snap(p, 'phone', 'featured', 'Listed homes show their price. These three are the ones on the MLS.');
  await to(p, '.rail', 150); await snap(p, 'phone', 'plans-rail', 'Floor plans swipe sideways. Each card shows size and how many are left.');
  await to(p, '.band', 64); await snap(p, 'phone', 'location', 'Location section with the beach aerial.');
  await to(p, '.amenity-grid', 150); await snap(p, 'phone', 'amenities', 'Amenities. Renderings are labeled as renderings.');
  await p.goto(B + '/availability/'); await to(p, '.avail-stats', 90); await snap(p, 'phone', 'availability', 'Availability page. The whole building at a glance: green is available, orange is under contract, gray is sold.');
  await to(p, '#unit-301', 90); await snap(p, 'phone', 'list', 'The list under it. Unlisted homes say "Request pricing" so buyers have to ask.');
  await p.click('#unit-503 .u-num strong'); await p.waitForTimeout(300); await snap(p, 'phone', 'unit', 'Tap a home to see its plan and details. Price shows "On request" unless it is listed.');
  await p.click('#unit-modal [data-u-primary]'); await p.waitForTimeout(300);
  await p.fill('#lead-modal [name=name]', 'Jamie Buyer'); await p.fill('#lead-modal [name=phone]', '732-555-0100'); await p.fill('#lead-modal [name=email]', 'jamie@example.com');
  await snap(p, 'phone', 'pricing-form', 'The pricing request form. It emails info@coastaledgenj.com with the unit number.');
  await p.goto(B + '/floor-plans/plan-3/'); await snap(p, 'phone', 'plan', 'A floor plan page, with the 3D views under the drawing.');
  await to(p, '.plan-side .btn-col', 260); await snap(p, 'phone', 'plan-details', 'Sizes, the PDF download and which homes have this plan.');
  await c.close(); [c, p] = await mk({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  await p.goto(B + '/brochure/'); await to(p, '.brochure-preview', 80); await snap(p, 'phone', 'brochure', 'Brochure page. Buyers give their name and email first.');
  await to(p, '.form-card', 80); await p.fill('.inline-form [name=name]', 'Jamie Buyer'); await p.fill('.inline-form [name=email]', 'jamie@example.com');
  await p.click('.inline-form [data-submit]'); await p.waitForTimeout(400); await to(p, '.form-card', 120); await snap(p, 'phone', 'brochure-done', 'Then the download button appears and you get the lead.');
  await p.goto(B + '/gallery/'); await to(p, '.filters', 90); await snap(p, 'phone', 'gallery', 'Gallery with real photos first. Staged photos and renderings are labeled.');
  await p.goto(B + '/neighborhood/'); await to(p, '.near', 80); await snap(p, 'phone', 'neighborhood', 'Neighborhood page: what is nearby and a map.');
  await p.goto(B + '/faq/'); await snap(p, 'phone', 'faq', 'Questions and answers. This also helps Google show your answers in search.');
  await p.goto(B + '/contact/'); await to(p, '.form-card', 80); await snap(p, 'phone', 'tour', 'Schedule a tour form.');
  await p.goto(B + '/?chat=1'); await p.waitForTimeout(400); await snap(p, 'phone', 'chat', 'The AI assistant. It answers from your facts and collects name and contact for the sales team.');
  await p.goto(B + '/'); await p.click('[data-menu-toggle]'); await p.waitForTimeout(300); await snap(p, 'phone', 'menu', 'Phone menu. Call and Schedule a tour stay at the bottom of every page.');
  await c.close();

  // desktop
  [c, p] = await mk({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  await p.goto(B + '/'); await snap(p, 'desktop', 'home', 'Home page on a computer.');
  await to(p, '.feature-grid', 260); await snap(p, 'desktop', 'featured', 'Listed homes with prices.');
  await p.goto(B + '/availability/'); await to(p, '.avail-stats', 110); await snap(p, 'desktop', 'availability', 'Availability page on a computer.');
  await p.goto(B + '/floor-plans/'); await to(p, '.filters', 110); await snap(p, 'desktop', 'plans', 'All floor plans with a bedroom filter.');
  await p.goto(B + '/floor-plans/plan-3/'); await snap(p, 'desktop', 'plan', 'One floor plan page.');
  await p.goto(B + '/gallery/'); await to(p, '.filters', 110); await snap(p, 'desktop', 'gallery', 'Gallery.');
  await p.goto(B + '/amenities/'); await to(p, '.split.alt', 120); await snap(p, 'desktop', 'amenities', 'Amenities page.');
  await c.close();

  // PDF: one screenshot per page, sized for reading on a phone
  const img = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(out, f)).toString('base64');
  const html = `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: B; src: url(${B}/fonts/belleza-latin-400-normal.woff2); } @font-face { font-family: F; src: url(${B}/fonts/figtree-latin-wght-normal.woff2); font-weight: 300 900; }
    @page { size: 420px 790px; margin: 0; } @page wide { size: 900px 660px; }
    * { box-sizing: border-box; } body { margin: 0; font-family: F, sans-serif; color: #22323b; background: #fbf9f6; }
    .pg { width: 420px; height: 790px; padding: 16px 20px; page-break-after: always; display: flex; flex-direction: column; overflow: hidden; }
    .pg.wide { page: wide; width: 900px; height: 660px; }
    .cap { font-size: 14px; line-height: 1.4; margin: 0 0 10px; min-height: 40px; } .cap b { color: #a8644f; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; display: block; }
    .pg img { flex: 1; min-height: 0; object-fit: contain; object-position: top center; width: 100%; }
    .cover { justify-content: center; background: #22323b; color: #fff; } .cover h1 { font-family: B; font-weight: 400; font-size: 40px; line-height: 1.1; margin: 0 0 14px; }
    .cover p { font-size: 15px; line-height: 1.5; color: #d5dde1; margin: 0 0 10px; } .cover .e { color: #f3d9c9; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; }
    .cover img { flex: none; width: 200px; margin-bottom: 40px; }
  </style>
  <div class="pg cover"><img src="${B}/img/brand/logo-white.png"><p class="e">Website preview</p><h1>The new coastaledgenj.com</h1>
  <p>${shots.length} screens from the working site, phone first and then computer.</p><p>Nothing here is live yet. Your current site has not been touched.</p></div>
  ${shots.map((s, i) => `<div class="pg ${s.kind === 'desktop' ? 'wide' : ''}"><p class="cap"><b>${s.kind === 'desktop' ? 'Computer' : 'Phone'} ${i + 1} of ${shots.length}</b>${s.caption}</p><img src="${img(s.file)}"></div>`).join('')}`;
  const pp = await b.newPage(); await pp.setContent(html, { waitUntil: 'load' }); await pp.evaluate(() => document.fonts.ready);
  await pp.pdf({ path: path.join(out, 'Coastal Edge website preview.pdf'), preferCSSPageSize: true, printBackground: true });
  await b.close();
  console.log(shots.length, 'screens');
})();
