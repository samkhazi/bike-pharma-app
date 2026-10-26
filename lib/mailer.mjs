// Update 11w: a small email sender (SMTP, no packages): Gmail with an App Password, or any SMTP server.
// .env: SMTP_HOST, SMTP_PORT (465 = TLS from the start, 587 = STARTTLS), SMTP_USER, SMTP_PASS, SMTP_FROM (default SMTP_USER),
// SMTP_TLS=off only for the tests' own fake server. The password is only sent to the SMTP server, never logged.
import net from 'node:net';
import tls from 'node:tls';
import os from 'node:os';

// one SMTP answer at a time (a multi-line answer ends with "250 " instead of "250-")
function reader(sock) {
  let buf = '', wait = null, err = null; const lines = [];
  const feed = () => { if (!wait) return; if (err) { const w = wait; wait = null; return w.no(err); }
    const i = lines.findIndex(l => /^\d{3} /.test(l) || /^\d{3}$/.test(l)); if (i < 0) return; const l = lines.splice(0, i + 1).pop(); const w = wait; wait = null; w.ok(l); };
  const on = s => { s.setEncoding('utf8'); s.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(buf.slice(0, i).replace(/\r$/, '')); buf = buf.slice(i + 1); } feed(); }); s.on('error', e => { err = e; feed(); }); s.on('close', () => { err = err || new Error('SMTP closed'); feed(); }); };
  on(sock);
  return { next: () => new Promise((ok, no) => { wait = { ok, no }; feed(); }), on };
}

const wrap = b => b.toString('base64').replace(/.{76}/g, '$&\r\n');
const part = (type, data) => ['Content-Type: ' + type, 'Content-Transfer-Encoding: base64', '', wrap(Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8'))];
const bound = () => '=_bp' + Math.random().toString(36).slice(2) + Date.now().toString(36);
// the mail's Content-Type lines and body: plain text alone, or text + html (alternative) and attachments (mixed)
function body(text, { html, attach = [] } = {}) {
  let main = part('text/plain; charset=utf-8', text);
  if (html) { const b = bound(); main = ['Content-Type: multipart/alternative; boundary="' + b + '"', '', '--' + b, ...part('text/plain; charset=utf-8', text), '--' + b, ...part('text/html; charset=utf-8', html), '--' + b + '--']; }
  if (!attach.length) return main;
  const b = bound(), files = attach.flatMap(a => ['--' + b, ...part((a.type || 'application/octet-stream') + '; name="' + a.name + '"', a.data).slice(0, 2), 'Content-Disposition: attachment; filename="' + a.name + '"', '', wrap(Buffer.from(a.data))]);
  return ['Content-Type: multipart/mixed; boundary="' + b + '"', '', '--' + b, ...main, ...files, '--' + b + '--'];
}

export function mailer(env = process.env) {
  const host = String(env.SMTP_HOST || '').trim(), port = +env.SMTP_PORT || 465, user = String(env.SMTP_USER || '').trim(), pass = String(env.SMTP_PASS || '').replace(/\s+/g, '');
  const from = String(env.SMTP_FROM || user).trim(), plain = String(env.SMTP_TLS || '').toLowerCase() === 'off';
  const ok = !!(host && from);
  // opt (12z): { html, attach: [{ name, type, data (Buffer) }] } makes a multipart mail (text + html, then the files)
  async function send(to, subject, text, opt = {}) {
    if (!ok) throw new Error('SMTP not set in .env');
    to = [].concat(to).map(s => String(s).trim()).filter(s => /^[^\s@<>]+@[^\s@<>]+$/.test(s));
    if (!to.length) throw new Error('no recipient');
    const b64 = s => Buffer.from(String(s), 'utf8').toString('base64');
    const enc = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=';
    const msg = ['From: Bike Pharma <' + from + '>', 'To: ' + to.join(', '), 'Subject: ' + enc(subject), 'Date: ' + new Date().toUTCString(),
      'Message-ID: <' + Date.now() + '.' + Math.random().toString(36).slice(2) + '@bikepharma>', 'MIME-Version: 1.0', ...body(text, opt)].join('\r\n');
    let sock = plain || port !== 465 ? net.connect(port, host) : tls.connect({ host, port, servername: host });
    let R = reader(sock);
    const timer = setTimeout(() => sock.destroy(new Error('SMTP timeout')), 40e3);
    const cmd = async (line, want) => { if (line != null) sock.write(line + '\r\n'); const a = await R.next(); if (!want.includes(+a.slice(0, 3))) throw new Error('SMTP ' + (line && line.startsWith('AUTH') || /^[A-Za-z0-9+/=]+$/.test(line || '') ? 'login' : (line || 'greeting').split(' ')[0]) + ': ' + a.slice(0, 160)); return a; };
    const me = os.hostname() || 'bikepharma';
    try {
      await cmd(null, [220]);
      await cmd('EHLO ' + me, [250]);
      if (!plain && port !== 465) {
        await cmd('STARTTLS', [220]);
        sock = tls.connect({ socket: sock, servername: host }); R = reader(sock);
        await new Promise((ok, no) => { sock.once('secureConnect', ok); sock.once('error', no); });
        await cmd('EHLO ' + me, [250]);
      }
      if (user) { await cmd('AUTH LOGIN', [334]); await cmd(b64(user), [334]); await cmd(b64(pass), [235]); }
      await cmd('MAIL FROM:<' + from + '>', [250]);
      for (const t of to) await cmd('RCPT TO:<' + t + '>', [250, 251]);
      await cmd('DATA', [354]);
      await cmd(msg.replace(/\r\n\./g, '\r\n..') + '\r\n.', [250]);
      sock.write('QUIT\r\n');
      return { ok: true };
    } finally { clearTimeout(timer); setTimeout(() => sock.destroy(), 500).unref(); }
  }
  return { ok, send, from };
}
