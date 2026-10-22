// A small MySQL / MariaDB client with no packages to install (update 10m): the server copies the shop data into a MySQL database
// so Sam can see and edit it in phpMyAdmin. Text protocol only (COM_QUERY), one query at a time per connection.
// Logins: mysql_native_password and caching_sha2_password (fast path, and the full path with the server's RSA key).
import net from 'node:net';
import crypto from 'node:crypto';

const CAP = { LONG_PASSWORD: 1, FOUND_ROWS: 2, LONG_FLAG: 4, CONNECT_WITH_DB: 8, PROTOCOL_41: 512, TRANSACTIONS: 8192,
  SECURE_CONNECTION: 32768, MULTI_RESULTS: 1 << 17, PLUGIN_AUTH: 1 << 19, PLUGIN_AUTH_LENENC: 1 << 21 };
const sha1 = b => crypto.createHash('sha1').update(b).digest();
const sha256 = b => crypto.createHash('sha256').update(b).digest();
const xor = (a, b) => { const o = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] ^ b[i % b.length]; return o; };

function scramble(plugin, pw, nonce) {
  if (!pw) return Buffer.alloc(0);
  const p = Buffer.from(pw, 'utf8');
  if (plugin === 'caching_sha2_password') { const a = sha256(p); return xor(a, sha256(Buffer.concat([sha256(a), nonce]))); }
  const a = sha1(p); return xor(a, sha1(Buffer.concat([nonce, sha1(a)])));   // mysql_native_password
}

// ---------- reading packets ----------
class Reader {
  constructor(b) { this.b = b; this.i = 0; }
  u8() { return this.b[this.i++]; }
  u16() { const v = this.b.readUInt16LE(this.i); this.i += 2; return v; }
  u32() { const v = this.b.readUInt32LE(this.i); this.i += 4; return v; }
  lenenc() { const f = this.u8(); if (f < 0xfb) return f; if (f === 0xfb) return null; if (f === 0xfc) return this.u16();
    if (f === 0xfd) { const v = this.b.readUIntLE(this.i, 3); this.i += 3; return v; } const v = Number(this.b.readBigUInt64LE(this.i)); this.i += 8; return v; }
  str(n) { const s = this.b.subarray(this.i, this.i + n); this.i += n; return s; }
  lstr() { const n = this.lenenc(); return n === null ? null : this.str(n).toString('utf8'); }
  zstr() { let e = this.b.indexOf(0, this.i); if (e < 0) e = this.b.length; const s = this.b.subarray(this.i, e); this.i = e + 1; return s; }
  rest() { return this.b.subarray(this.i); }
}
const lenenc = n => n < 251 ? Buffer.from([n]) : n < 65536 ? Buffer.from([0xfc, n & 255, n >> 8]) : n < 16777216 ? Buffer.from([0xfd, n & 255, (n >> 8) & 255, n >> 16]) : (() => { const b = Buffer.alloc(9); b[0] = 0xfe; b.writeBigUInt64LE(BigInt(n), 1); return b; })();

export class MySQLError extends Error { constructor(code, state, msg) { super(msg); this.code = code; this.sqlState = state; } }

export class Connection {
  constructor(o) { this.o = o; this.buf = Buffer.alloc(0); this.waiters = []; this.seq = 0; this.chain = Promise.resolve(); this.closed = false; }
  connect() {
    return new Promise((ok, no) => {
      const s = this.sock = net.connect({ host: this.o.host || '127.0.0.1', port: +this.o.port || 3306 });
      s.setNoDelay(true);
      const fail = e => { this.closed = true; for (const w of this.waiters.splice(0)) w.no(e); no(e); };
      s.on('error', fail); s.on('close', () => fail(new Error('MySQL connection closed')));
      s.on('data', d => { this.buf = Buffer.concat([this.buf, d]); this.pump(); });
      s.setTimeout(this.o.timeout || 20000, () => s.destroy(new Error('MySQL timed out')));
      this.handshake().then(() => { s.setTimeout(0); ok(this); }, e => { s.destroy(); fail(e); });
    });
  }
  pump() {   // whole packets (a 16 MB part is joined with the next one)
    while (this.waiters.length && this.buf.length >= 4) {
      let off = 0, parts = [], len;
      do { if (this.buf.length < off + 4) return; len = this.buf.readUIntLE(off, 3); if (this.buf.length < off + 4 + len) return;
        this.seq = (this.buf[off + 3] + 1) & 255; parts.push(this.buf.subarray(off + 4, off + 4 + len)); off += 4 + len; } while (len === 0xffffff);
      this.buf = this.buf.subarray(off); this.waiters.shift().ok(Buffer.concat(parts));
    }
  }
  read() { return new Promise((ok, no) => { if (this.closed) return no(new Error('MySQL connection closed')); this.waiters.push({ ok, no }); this.pump(); }); }
  send(payload) {
    let off = 0; const out = [];
    do { const n = Math.min(0xffffff, payload.length - off); const h = Buffer.alloc(4); h.writeUIntLE(n, 0, 3); h[3] = this.seq; this.seq = (this.seq + 1) & 255;
      out.push(h, payload.subarray(off, off + n)); off += n; if (n < 0xffffff) break; } while (true);
    this.sock.write(Buffer.concat(out));
  }
  err(p) { const r = new Reader(p); r.u8(); const code = r.u16(); let st = ''; if (p[3] === 0x23) { r.u8(); st = r.str(5).toString(); } return new MySQLError(code, st, r.rest().toString('utf8')); }
  async handshake() {
    const p = await this.read(); if (p[0] === 0xff) throw this.err(p);
    const r = new Reader(p); r.u8(); r.zstr(); r.u32(); const n1 = r.str(8); r.u8();
    let caps = r.u16(); r.u8(); r.u16(); caps |= r.u16() << 16; const alen = r.u8(); r.str(10);
    const n2 = r.str(Math.max(13, alen - 8)); let plugin = r.zstr().toString() || 'mysql_native_password';
    let nonce = Buffer.concat([n1, n2.subarray(0, n2.length - 1)]).subarray(0, 20);
    if (!(caps & CAP.PROTOCOL_41)) throw new Error('MySQL server is too old');
    const mine = CAP.LONG_PASSWORD | CAP.FOUND_ROWS | CAP.LONG_FLAG | CAP.PROTOCOL_41 | CAP.TRANSACTIONS | CAP.SECURE_CONNECTION | CAP.MULTI_RESULTS | CAP.PLUGIN_AUTH | CAP.PLUGIN_AUTH_LENENC | (this.o.database ? CAP.CONNECT_WITH_DB : 0);
    const auth = scramble(plugin, this.o.password, nonce);
    const head = Buffer.alloc(32); head.writeUInt32LE(mine, 0); head.writeUInt32LE(16777216, 4); head[8] = 45;   // utf8mb4_general_ci
    this.send(Buffer.concat([head, Buffer.from(this.o.user || '', 'utf8'), Buffer.from([0]), lenenc(auth.length), auth,
      this.o.database ? Buffer.concat([Buffer.from(this.o.database, 'utf8'), Buffer.from([0])]) : Buffer.alloc(0), Buffer.from(plugin + '\0')]));
    for (let step = 0; step < 6; step++) {
      const a = await this.read();
      if (a[0] === 0x00) return;
      if (a[0] === 0xff) throw this.err(a);
      if (a[0] === 0xfe) {   // the server wants another login method
        const rr = new Reader(a); rr.u8(); plugin = rr.zstr().toString(); nonce = rr.rest(); if (nonce[nonce.length - 1] === 0) nonce = nonce.subarray(0, nonce.length - 1);
        this.send(scramble(plugin, this.o.password, nonce)); continue;
      }
      if (a[0] === 0x01 && plugin === 'caching_sha2_password') {
        if (a[1] === 0x03) continue;   // fast login worked, OK follows
        if (a[1] === 0x04) {   // full login: the password goes encrypted with the server's public key
          this.send(Buffer.from([0x02])); const k = await this.read(); if (k[0] === 0xff) throw this.err(k);
          const pem = k.subarray(1).toString();
          const enc = crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, xor(Buffer.from((this.o.password || '') + '\0', 'utf8'), nonce));
          this.send(enc); continue;
        }
      }
      throw new Error('MySQL login step not understood (' + a[0] + ')');
    }
    throw new Error('MySQL login did not finish');
  }
  // one query; SELECT gives an array of row objects (values are strings or null), others {affectedRows, insertId}
  query(sql, params) {
    const run = async () => {
      this.seq = 0; this.send(Buffer.concat([Buffer.from([0x03]), Buffer.from(params ? format(sql, params) : sql, 'utf8')]));
      let res = null;
      for (;;) {   // MULTI_RESULTS: keep reading while the server says more results follow
        const p = await this.read();
        if (p[0] === 0xff) throw this.err(p);
        let more = false;
        if (p[0] === 0x00) { const r = new Reader(p); r.u8(); const affectedRows = r.lenenc(), insertId = r.lenenc(); const st = r.u16(); more = !!(st & 8); if (res === null) res = { affectedRows, insertId }; }
        else {
          const n = new Reader(p).lenenc(); const cols = [];
          for (let i = 0; i < n; i++) { const c = new Reader(await this.read()); c.lstr(); c.lstr(); c.lstr(); c.lstr(); cols.push(c.lstr()); }
          let e = await this.read(); if (e[0] !== 0xfe) throw new Error('MySQL: unexpected column end');
          const rows = [];
          for (;;) { const rp = await this.read(); if (rp[0] === 0xfe && rp.length < 9) { more = !!(rp.readUInt16LE(3) & 8); break; } if (rp[0] === 0xff) throw this.err(rp);
            const r = new Reader(rp), o = {}; for (const c of cols) o[c] = r.lstr(); rows.push(o); }
          if (res === null) res = rows;
        }
        if (!more) return res;
      }
    };
    const pr = this.chain.then(run, run); this.chain = pr.catch(() => {}); return pr;
  }
  close() { try { this.seq = 0; this.send(Buffer.from([0x01])); } catch (e) {} try { this.sock.end(); } catch (e) {} this.closed = true; }
}

export function escape(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return "'" + String(v).replace(/[\0\n\r\b\t\\'"\x1a]/g, c => ({ '\0': '\\0', '\n': '\\n', '\r': '\\r', '\b': '\\b', '\t': '\\t', '\\': '\\\\', "'": "\\'", '"': '\\"', '\x1a': '\\Z' })[c]) + "'";
}
export const ident = s => '`' + String(s).replace(/`/g, '``') + '`';
export function format(sql, params) { let i = 0; return sql.replace(/\?\?|\?/g, m => m === '??' ? ident(params[i++]) : escape(params[i++])); }
export async function connect(o) { return new Connection(o).connect(); }
