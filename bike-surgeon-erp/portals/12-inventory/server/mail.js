// Sends one email through SMTP (no package needed). .env: MAIL_HOST, MAIL_PORT (465 = TLS, 587 = STARTTLS),
// MAIL_USER, MAIL_PASS, MAIL_FROM. Gmail: smtp.gmail.com 465 with an app password.
'use strict';
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');
const env = k => String(process.env[k] || '').trim();
const ready = () => !!(env('MAIL_HOST') && env('MAIL_USER') && env('MAIL_PASS'));

function talk(sock) {
  let buf = '', waiting = null;
  sock.setEncoding('utf8');
  sock.on('data', d => { buf += d; const m = buf.match(/(?:^|\r\n)(\d{3}) [^\r\n]*\r\n$/); if (m && waiting) { const w = waiting; waiting = null; const t = buf; buf = ''; w.res({ code: +m[1], text: t }); } });
  sock.on('error', e => { if (waiting) { const w = waiting; waiting = null; w.rej(e); } });
  return (line, want) => new Promise((res, rej) => {
    waiting = { res: r => (want && !want.includes(r.code) ? rej(new Error(`SMTP ${line ? line.split(' ')[0] : 'hello'}: ${r.text.trim().slice(0, 200)}`)) : res(r)), rej };
    if (line != null) sock.write(line + '\r\n');
  });
}
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const head = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;

async function send({ to, subject, text, html }) {
  if (!ready()) throw new Error('Email is not set up (MAIL_HOST, MAIL_USER, MAIL_PASS).');
  const host = env('MAIL_HOST'), port = Number(env('MAIL_PORT') || 465), from = env('MAIL_FROM') || env('MAIL_USER');
  let sock = port === 465 ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
  sock.setTimeout(30000, () => sock.destroy(new Error('SMTP timeout')));
  let say = talk(sock);
  try {
    await say(null, [220]);
    await say(`EHLO bikesurgeon.online`, [250]);
    if (port !== 465) {
      await say('STARTTLS', [220]);
      sock = tls.connect({ socket: sock, servername: host });
      say = talk(sock);
      await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
      await say(`EHLO bikesurgeon.online`, [250]);
    }
    await say('AUTH LOGIN', [334]); await say(b64(env('MAIL_USER')), [334]); await say(b64(env('MAIL_PASS')), [235]);
    const rcpts = String(to).split(',').map(x => x.trim()).filter(Boolean);
    await say(`MAIL FROM:<${from}>`, [250]);
    for (const r of rcpts) await say(`RCPT TO:<${r}>`, [250, 251]);
    await say('DATA', [354]);
    const bnd = 'b' + crypto.randomBytes(8).toString('hex');
    const body = [`From: Bike Surgeon Inventory <${from}>`, `To: ${rcpts.join(', ')}`, `Subject: ${head(subject)}`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${bnd}"`, '', `--${bnd}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text || '').replace(/.{76}/g, '$&\r\n'),
      `--${bnd}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html || text || '').replace(/.{76}/g, '$&\r\n'), `--${bnd}--`].join('\r\n');
    await say(body + '\r\n.', [250]);
    await say('QUIT', [221]).catch(() => {});
  } finally { sock.destroy(); }
}

module.exports = { send, ready };
