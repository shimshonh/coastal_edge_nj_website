// Sends a lead to the sales inbox through Resend (https://resend.com).
// Environment: RESEND_API_KEY (required), LEAD_TO, LEAD_FROM (optional).
const TO = process.env.LEAD_TO || 'info@coastaledgenj.com';
const FROM = process.env.LEAD_FROM || 'Coastal Edge Website <leads@coastaledgenj.com>';

const KIND = { tour: 'Tour request', pricing: 'Pricing request', plan: 'Floor plan download', brochure: 'Brochure download', retail: 'Retail inquiry', chat: 'Chat lead', contact: 'Website inquiry' };
const clean = (v, max = 500) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function normalize(raw) {
  const lead = {
    kind: KIND[raw.kind] ? raw.kind : 'contact',
    name: clean(raw.name, 120), email: clean(raw.email, 160), phone: clean(raw.phone, 40),
    unit: clean(raw.unit, 10), plan: clean(raw.plan, 20), interest: clean(raw.interest, 60),
    date: clean(raw.date, 20), time: clean(raw.time, 30), timing: clean(raw.timing, 40),
    agent: raw.agent ? 'Yes' : '', message: clean(raw.message, 2000),
    page: clean(raw.page, 200), url: clean(raw.url, 300), referrer: clean(raw.referrer, 300),
  };
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email);
  const phoneOk = lead.phone.replace(/\D/g, '').length >= 10;
  if (!lead.name || (!emailOk && !phoneOk)) return { error: 'Name and a valid email or phone are required.' };
  if (!emailOk) lead.email = '';
  return { lead };
}

async function sendLead(raw) {
  const { lead, error } = normalize(raw);
  if (error) return { ok: false, status: 400, error };
  const rows = [
    ['Type', KIND[lead.kind]], ['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone],
    ['Residence', lead.unit], ['Floor plan', lead.plan], ['Interested in', lead.interest],
    ['Preferred day', lead.date], ['Time of day', lead.time], ['Buying timeline', lead.timing],
    ['Has an agent', lead.agent], ['Message', lead.message], ['Page', lead.url || lead.page], ['Came from', lead.referrer],
  ].filter((r) => r[1]);
  const subject = `${KIND[lead.kind]}: ${lead.name}` + (lead.unit ? ` (residence ${lead.unit})` : lead.plan ? ` (${lead.plan})` : '');
  const text = rows.map((r) => `${r[0]}: ${r[1]}`).join('\n');
  const html = '<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">' +
    rows.map((r) => `<tr><td style="color:#666;border-bottom:1px solid #eee">${esc(r[0])}</td><td style="border-bottom:1px solid #eee"><b>${esc(r[1])}</b></td></tr>`).join('') + '</table>';

  if (!process.env.RESEND_API_KEY) {
    console.error('Lead not sent: RESEND_API_KEY is not set.\n' + text);
    return { ok: false, status: 503, error: 'Email is not configured.' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO.split(',').map((s) => s.trim()), subject, text, html, ...(lead.email ? { reply_to: lead.email } : {}) }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    return { ok: false, status: 502, error: 'Could not send the email.' };
  }
  return { ok: true };
}

// Small best effort limiter (per server instance) to slow down abuse.
const hits = new Map();
function limited(req, max, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 100000) throw new Error('too large'); }
  return JSON.parse(data || '{}');
}

module.exports = { sendLead, limited, readJson };
