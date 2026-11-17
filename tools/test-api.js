// Exercises api/chat.js and api/lead.js with stand-ins for the Anthropic client and the email service.
// Run: node tools/test-api.js   (nothing is sent anywhere)
const path = require('path');
const root = path.join(__dirname, '..');
const calls = [];
let script = [];
class Fake {
  constructor() { this.beta = { messages: { create: async (p) => { calls.push(p); return script.shift(); } } }; }
}
require.cache[require.resolve(path.join(root, 'node_modules/@anthropic-ai/sdk'))] = { id: 'x', filename: 'x', loaded: true, exports: Fake };
const mails = [];
global.fetch = async (url, o) => { mails.push({ url, body: JSON.parse(o.body) }); return { ok: true, text: async () => '' }; };
process.env.RESEND_API_KEY = 'test';
// Stand-in for the mail server lookup: these domains take mail, nomail.test has no mail server, anything else does not exist.
const dns = require('dns').promises;
dns.resolveMx = async (d) => { if (d === 'gmail.com' || d === 'aol.com') return [{ exchange: 'mx.' + d, priority: 5 }]; if (d === 'nomail.test') return [{ exchange: '', priority: 0 }]; throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' }); };

const chat = require(path.join(root, 'api/chat.js'));
const lead = require(path.join(root, 'api/lead.js'));
const call = (fn, body, ip) => new Promise((resolve) => {
  const res = { statusCode: 200, setHeader() {}, end(s) { resolve({ status: this.statusCode, body: s && JSON.parse(s) }); } };
  fn({ method: 'POST', headers: { 'x-forwarded-for': ip || '1.2.3.4', host: 'coastaledgenj.com', origin: 'https://coastaledgenj.com', ...(body && body._headers) }, body }, res);
});
const human = { js: 1, elapsed: 42000 };
const check = (ok, label, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + label + (extra ? '  ' + extra : ''));

(async () => {
  script = [{ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'There are 21 homes available. See /availability/.' }] }];
  let r = await call(chat, { ...human, messages: [{ role: 'user', content: 'What is available?' }] });
  check(r.status === 200 && r.body.reply.includes('21 homes'), 'plain answer comes back');
  const p = calls[0];
  check(p.model === 'claude-opus-5-5' && p.output_config.effort === 'low' && p.fallbacks === 'default', 'request settings', p.model + ' ' + p.betas);
  const sys = p.system[0].text;
  const stripped = sys.split('$789,000').join('').split('$899,000').join('').split('$874,900').join('');
  check(!/\$\d{3},\d{3}|\$1,\d{3},\d{3}/.test(stripped), 'only the three listed prices are in the assistant facts', 'prompt is ' + sys.length + ' characters');

  script = [
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'save_lead', input: { name: 'Dana Lee', email: 'dana@gmail.com', request: 'pricing', unit: '503', notes: 'Wants price for 503' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Thanks Dana, the sales team will send pricing for 503.' }] },
  ];
  r = await call(chat, { ...human, page: '/availability/', messages: [
    { role: 'user', content: 'Price of 503?' }, { role: 'assistant', content: 'Pricing is on request. Name and email?' }, { role: 'user', content: 'Dana Lee dana@gmail.com' }] });
  check(r.body.lead_saved === true && mails.length === 1, 'chat lead is emailed', mails[0] && (mails[0].body.to + ' | ' + mails[0].body.subject + ' | reply to ' + mails[0].body.reply_to));
  const last = calls[2].messages[calls[2].messages.length - 1];
  check(last.role === 'user' && last.content[0].type === 'tool_result' && last.content[0].tool_use_id === 't1', 'tool result goes back to the model');

  script = [{ stop_reason: 'refusal', content: [] }];
  r = await call(chat, { ...human, messages: [{ role: 'user', content: 'x' }] });
  check(r.body.reply.includes('/contact/') && !/\d{3}-\d{3}-\d{4}/.test(r.body.reply), 'a declined request points to the form, with no phone number');
  check(!/\d{3}-\d{3}-\d{4}/.test(sys.split('FACTS')[0]) && !sys.includes('phone_display'), 'the assistant has no sales phone number to give out');
  r = await call(chat, { ...human, messages: [] });
  check(r.status === 400, 'empty chat request is rejected');
  let before = calls.length;
  r = await call(chat, { messages: [{ role: 'user', content: 'hi' }] });
  const r2 = await call(chat, { ...human, messages: [{ role: 'user', content: 'hi' }], _headers: { origin: 'https://evil.example' } });
  check(r.status === 403 && r2.status === 403 && calls.length === before, 'chat requests from scripts or other sites are turned away before any cost');

  const last_ = () => mails[mails.length - 1].body;
  r = await call(lead, { ...human, kind: 'tour', name: 'Sam Rivera', email: 'Sam@Gmail.com', phone: '(732) 830-1234', date: '2026-11-20', unit: '207' }, '5.5.5.5');
  check(r.status === 200 && r.body.ok && !last_().subject.includes('spam') && last_().reply_to === 'sam@gmail.com', 'a real form lead is emailed clean', last_().subject);
  let n = mails.length;
  r = await call(lead, { ...human, name: 'Bot', email: 'b@gmail.com', website: 'http://x.co' }, '5.5.5.6');
  check(r.body.ok && mails.length === n, 'hidden field stops bots without sending');
  r = await call(lead, { name: 'Direct Poster', email: 'd@gmail.com' }, '5.5.5.6');
  check(r.body.ok && mails.length === n, 'a post that did not come from the site script is dropped without sending');
  r = await call(lead, { ...human, name: '', email: 'nope' }, '5.5.5.7');
  check(r.status === 400 && mails.length === n, 'missing name or contact is rejected');
  r = await call(lead, { ...human, name: 'Pat Doe', email: 'pat@mailinator.com' }, '5.5.5.7');
  const r3 = await call(lead, { ...human, name: 'Pat Doe', email: 'pat@gmial-typo.co' }, '5.5.5.7');
  const r4 = await call(lead, { ...human, name: 'Pat Doe', email: 'pat@nomail.test' }, '5.5.5.7');
  check(r.status === 400 && r3.status === 400 && r4.status === 400 && mails.length === n, 'throwaway and dead email addresses are sent back to fix', r.body.error + ' | ' + r3.body.error);
  r = await call(lead, { ...human, name: 'Pat Doe', email: 'pat@gmial-typo.co', phone: '732-830-1234' }, '5.5.5.8');
  check(r.body.ok && mails.length === n + 1 && !last_().reply_to && last_().subject.startsWith('[Possible spam]'), 'bad email with a real phone still gets through, marked', last_().subject);
  r = await call(lead, { js: 1, elapsed: 400, name: 'Fast Fred', email: 'fred@aol.com' }, '5.5.5.9');
  check(r.body.ok && last_().subject.startsWith('[Possible spam]') && last_().text.includes('within 3 seconds'), 'a form sent in under 3 seconds is marked as possible spam');
  r = await call(lead, { ...human, name: 'Mark Agency', email: 'mark@gmail.com', message: 'We offer SEO and backlinks, see https://rank.example and www.more.example' }, '5.5.5.9');
  check(r.body.ok && last_().subject.startsWith('[Possible spam]') && last_().text.includes('sales pitch') && last_().text.includes('several links'), 'sales pitches with links are marked as possible spam');
  r = await call(lead, { ...human, name: 'Jo Lee', email: 'jo@gmail.com', phone: '111-111-1111', message: 'Is 405 still available? We would like to see it Saturday.', _headers: { origin: 'https://other.example' } }, '5.5.5.10');
  check(r.body.ok && last_().text.includes('not a real number') && last_().text.includes('outside the website'), 'fake phone numbers and posts from other sites are marked');
  n = mails.length;
  for (let i = 0; i < 9; i++) r = await call(lead, { ...human, name: 'Flood Er', email: 'f@gmail.com' }, '9.9.9.9');
  check(r.status === 429 && mails.length === n + 8, 'the ninth form from one visitor in ten minutes is refused');
})();
