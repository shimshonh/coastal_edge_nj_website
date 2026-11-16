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

const chat = require(path.join(root, 'api/chat.js'));
const lead = require(path.join(root, 'api/lead.js'));
const call = (fn, body, ip) => new Promise((resolve) => {
  const res = { statusCode: 200, setHeader() {}, end(s) { resolve({ status: this.statusCode, body: s && JSON.parse(s) }); } };
  fn({ method: 'POST', headers: { 'x-forwarded-for': ip || '1.2.3.4' }, body }, res);
});
const check = (ok, label, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + label + (extra ? '  ' + extra : ''));

(async () => {
  script = [{ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'There are 21 homes available. See /availability/.' }] }];
  let r = await call(chat, { messages: [{ role: 'user', content: 'What is available?' }] });
  check(r.status === 200 && r.body.reply.includes('21 homes'), 'plain answer comes back');
  const p = calls[0];
  check(p.model === 'claude-opus-5-5' && p.output_config.effort === 'low' && p.fallbacks === 'default', 'request settings', p.model + ' ' + p.betas);
  const sys = p.system[0].text;
  const stripped = sys.split('$789,000').join('').split('$899,000').join('').split('$874,900').join('');
  check(!/\$\d{3},\d{3}|\$1,\d{3},\d{3}/.test(stripped), 'only the three listed prices are in the assistant facts', 'prompt is ' + sys.length + ' characters');

  script = [
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'save_lead', input: { name: 'Dana Lee', email: 'dana@example.com', request: 'pricing', unit: '503', notes: 'Wants price for 503' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Thanks Dana, the sales team will send pricing for 503.' }] },
  ];
  r = await call(chat, { page: '/availability/', messages: [
    { role: 'user', content: 'Price of 503?' }, { role: 'assistant', content: 'Pricing is on request. Name and email?' }, { role: 'user', content: 'Dana Lee dana@example.com' }] });
  check(r.body.lead_saved === true && mails.length === 1, 'chat lead is emailed', mails[0] && (mails[0].body.to + ' | ' + mails[0].body.subject + ' | reply to ' + mails[0].body.reply_to));
  const last = calls[2].messages[calls[2].messages.length - 1];
  check(last.role === 'user' && last.content[0].type === 'tool_result' && last.content[0].tool_use_id === 't1', 'tool result goes back to the model');

  script = [{ stop_reason: 'refusal', content: [] }];
  r = await call(chat, { messages: [{ role: 'user', content: 'x' }] });
  check(r.body.reply.includes('732-392-6688'), 'a declined request gets the phone number fallback');
  r = await call(chat, { messages: [] });
  check(r.status === 400, 'empty chat request is rejected');

  r = await call(lead, { kind: 'tour', name: 'Sam', email: 'sam@example.com', date: '2026-11-20', unit: '207' }, '5.5.5.5');
  check(r.status === 200 && r.body.ok, 'form lead is emailed', mails[mails.length - 1].body.subject);
  const n = mails.length;
  r = await call(lead, { name: 'Bot', email: 'b@b.com', company: 'x' }, '5.5.5.6');
  check(r.body.ok && mails.length === n, 'hidden field stops bots without sending');
  r = await call(lead, { name: '', email: 'nope' }, '5.5.5.7');
  check(r.status === 400, 'missing name or contact is rejected');
})();
