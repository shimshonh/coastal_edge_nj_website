// Checks a lead for spam, then sends it to the sales inbox through Resend (https://resend.com).
// Environment: RESEND_API_KEY (required), LEAD_TO, LEAD_FROM (optional).
const dns = require('dns').promises;

const TO = process.env.LEAD_TO || 'info@coastaledgenj.com';
const FROM = process.env.LEAD_FROM || 'Coastal Edge Website <leads@coastaledgenj.com>';

const KIND = { tour: 'Tour request', pricing: 'Pricing request', plan: 'Floor plan download', brochure: 'Brochure download', retail: 'Retail inquiry', chat: 'Chat lead', contact: 'Website inquiry' };
const clean = (v, max = 500) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- spam and bot checks ----------
   Three outcomes:
   1. drop    Clearly a bot. The sender is told "OK" and nothing is emailed.
   2. reject  The contact details cannot work. The visitor sees a message and can fix it.
   3. flag    Looks doubtful. It is still emailed, with "[Possible spam]" in the subject,
              so a real buyer is never lost. A mail filter can sort on that subject. */

// Addresses on these domains are made up or thrown away after a few minutes.
const THROWAWAY = new Set(['example.com', 'example.org', 'example.net', 'test.com', 'mailinator.com', 'guerrillamail.com',
  'sharklasers.com', 'yopmail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'trashmail.com', 'getnada.com',
  'dispostable.com', 'maildrop.cc', 'fakeinbox.com', 'throwawaymail.com', 'mailnesia.com', 'emailondeck.com', 'moakt.com', 'mintemail.com']);
const SPAM_WORDS = /\b(seo|backlinks?|guest post|link building|casino|crypto|bitcoin|forex|viagra|cialis|porn|escorts?|payday loan|web ?design services|website redesign|rank(ing)? (on|in|higher)|first page of google|lead generation|digital marketing|virtual assistant|outsourc\w+|telegram|unsubscribe)\b/i;
const LINK = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(ru|cn|xyz|top|click|info|biz|online|site)\b/gi;

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);
const domainCache = new Map();
// True when the email domain can receive mail. If the lookup itself fails, give the benefit of the doubt.
async function domainTakesMail(domain) {
  if (domainCache.has(domain)) return domainCache.get(domain);
  const gone = (e) => e && (e.code === 'ENOTFOUND' || e.code === 'ENODATA');
  let ok = true;
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 1500);
    ok = mx.some((r) => r.exchange && r.exchange !== '.');
  } catch (e) {
    if (e.code === 'ENOTFOUND') ok = false;
    else if (e.code === 'ENODATA') { try { await withTimeout(dns.resolve4(domain), 1500); } catch (e2) { ok = !gone(e2); } }
  }
  if (domainCache.size > 2000) domainCache.clear();
  domainCache.set(domain, ok);
  return ok;
}

// '' when no phone was given, 'ok' when it could be a real number, 'bad' when it cannot.
function phoneCheck(phone) {
  let n = phone.replace(/\D/g, '');
  if (!n) return '';
  if (phone.trim().startsWith('+') && !n.startsWith('1')) return n.length >= 9 && n.length <= 15 ? 'ok' : 'bad';
  if (n.length === 11 && n[0] === '1') n = n.slice(1);
  if (n.length !== 10 || /^[01]/.test(n) || /^...[01]/.test(n)) return 'bad';
  if (/^(\d)\1{9}$/.test(n) || /^...555/.test(n) || /^(\d)\1{6}$/.test(n.slice(3))) return 'bad';
  return 'ok';
}

// The request came from a page on this same website (browsers always say where a form was sent from).
function sameSite(req) {
  const from = req.headers.origin || req.headers.referer || '';
  if (!from) return false;
  let host;
  try { host = new URL(from).host.toLowerCase(); } catch (e) { return false; }
  return [req.headers.host, req.headers['x-forwarded-host']].some((h) => String(h || '').split(',')[0].trim().toLowerCase() === host);
}

// Looks at one submission. Returns { drop: 'reason' } or { flags: ['reason', ...] }.
function screen(raw, req) {
  // Hidden field that people never see. Bots fill in every field they find.
  if (clean(raw.website) || clean(raw.company)) return { drop: 'hidden field was filled in' };
  // The site's own script adds this. Bots that post straight to the address do not run it.
  if (Number(raw.js) !== 1) return { drop: 'not sent by the website form' };
  const flags = [];
  if (!sameSite(req)) flags.push('sent from outside the website');
  const secs = Number(raw.elapsed) / 1000;
  if (!(secs >= 3)) flags.push('sent within 3 seconds of opening the page');
  return { flags: flags.concat(contentFlags(raw)) };
}

// Checks on the words themselves. Used for the forms and for leads the chat assistant saves.
function contentFlags(raw) {
  const flags = [];
  const name = clean(raw.name, 120), text = clean(raw.message, 2000);
  if (/https?:|www\.|\.(com|net|ru|org)\b|[<>{}\[\]]/i.test(name) || /\d{3,}/.test(name)) flags.push('name does not look like a name');
  const links = (text.match(LINK) || []).length;
  if (links) flags.push(links > 1 ? 'message has several links' : 'message has a link');
  if (SPAM_WORDS.test(text)) flags.push('message reads like a sales pitch');
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length > 20 && letters.replace(/[\p{Script=Latin}]/gu, '').length / letters.length > 0.4) flags.push('message is not in English');
  return flags;
}

async function normalize(raw) {
  const lead = {
    kind: KIND[raw.kind] ? raw.kind : 'contact',
    name: clean(raw.name, 120), email: clean(raw.email, 160).toLowerCase(), phone: clean(raw.phone, 40),
    unit: clean(raw.unit, 10), plan: clean(raw.plan, 20), interest: clean(raw.interest, 60),
    date: clean(raw.date, 20), time: clean(raw.time, 30), timing: clean(raw.timing, 40),
    agent: raw.agent ? 'Yes' : '', message: clean(raw.message, 2000),
    page: clean(raw.page, 200), url: clean(raw.url, 300), referrer: clean(raw.referrer, 300),
  };
  const notes = [];
  const phone = phoneCheck(lead.phone);
  if (!/\p{L}.*\p{L}/u.test(lead.name)) return { error: 'Please add your name.' };

  let emailOk = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)+[a-z]{2,}$/.test(lead.email) && !lead.email.includes('..');
  let emailProblem = emailOk || !lead.email ? '' : 'That email address does not look right. Please check it.';
  if (emailOk) {
    const domain = lead.email.split('@')[1];
    if (THROWAWAY.has(domain)) { emailOk = false; emailProblem = 'Please use your regular email address.'; }
    else if (!(await domainTakesMail(domain))) { emailOk = false; emailProblem = 'That email address does not look right. Please check it.'; }
  }
  if (!emailOk && phone !== 'ok') return { error: emailProblem || 'Please add a valid email address or phone number.' };
  if (!emailOk && lead.email) { notes.push('email address does not work, phone only'); lead.email += ' (does not work)'; }
  if (phone === 'bad') { notes.push('phone number is not a real number'); lead.phone += ' (not a real number)'; }
  return { lead, notes, replyTo: emailOk ? lead.email : '' };
}

// opts.flags: reasons from screen() or contentFlags(). Any flag marks the email as possible spam.
async function sendLead(raw, opts = {}) {
  const { lead, notes, replyTo, error } = await normalize(raw);
  if (error) return { ok: false, status: 400, error };
  const flags = (opts.flags || []).concat(notes);
  const rows = [
    ['Type', KIND[lead.kind]], ['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone],
    ['Residence', lead.unit], ['Floor plan', lead.plan], ['Interested in', lead.interest],
    ['Preferred day', lead.date], ['Time of day', lead.time], ['Buying timeline', lead.timing],
    ['Has an agent', lead.agent], ['Message', lead.message], ['Page', lead.url || lead.page], ['Came from', lead.referrer],
    ['Spam check', flags.join('; ')],
  ].filter((r) => r[1]);
  const subject = (flags.length ? '[Possible spam] ' : '') + `${KIND[lead.kind]}: ${lead.name}` + (lead.unit ? ` (residence ${lead.unit})` : lead.plan ? ` (${lead.plan})` : '');
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
    body: JSON.stringify({ from: FROM, to: TO.split(',').map((s) => s.trim()), subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    return { ok: false, status: 502, error: 'Could not send the email.' };
  }
  return { ok: true, flagged: flags.length > 0 };
}

// Small best effort limiter (per server instance) to slow down abuse.
const hits = new Map();
function limited(req, max, windowMs, bucket = '') {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'unknown';
  const key = bucket + ip, now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(key, list);
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

module.exports = { sendLead, screen, contentFlags, sameSite, limited, readJson };
