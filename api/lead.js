// POST /api/lead  Receives the website forms, screens out bots and emails the rest to the sales inbox.
const { sendLead, screen, limited, readJson } = require('../lib/lead');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
  res.setHeader('Content-Type', 'application/json');
  try {
    if (limited(req, 8, 10 * 60 * 1000, 'lead')) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: 'Too many requests.' })); }
    const body = await readJson(req);
    const check = screen(body, req);
    // Bots get the same "OK" a person would, so they have no reason to try again another way.
    if (check.drop) { console.log('Lead dropped: ' + check.drop); return res.end(JSON.stringify({ ok: true })); }
    const out = await sendLead(body, { flags: check.flags });
    res.statusCode = out.ok ? 200 : out.status || 500;
    res.end(JSON.stringify(out.ok ? { ok: true } : { ok: false, error: out.error }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: 'Server error.' }));
  }
};
