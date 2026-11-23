import { execFile } from "node:child_process";

/**
 * The workshop's old billing database (MySQL, e.g. bikesurgeonoff), read through the `mysql` command line program
 * that is installed with MySQL on the server. No npm package is needed, and the password travels in the MYSQL_PWD
 * environment variable, never on the command line. The same OLD_DB_* settings as the admin panel's live link.
 *
 * Every read is `SELECT JSON_OBJECT(...) FROM table WHERE ...`, one JSON object per line (--raw keeps it as is),
 * so values with tabs or new lines come through untouched.
 */
export type OldDbSettings = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  publicKey: boolean;
  bin: string;
  /** A second login allowed to INSERT/UPDATE a_service_bookings only (optional; the read login is used when empty). */
  writeUser?: string;
  writePassword?: string;
};

export type OldRow = Record<string, unknown>;

export type OldDb = {
  select(table: string, cols: Record<string, string>, where?: string): Promise<OldRow[]>;
  write(sql: string): Promise<string>;
};

function run(settings: OldDbSettings, user: string, password: string, sql: string, timeoutMs: number) {
  const args = [
    "-h", settings.host, "-P", settings.port, "-u", user, "--batch", "--raw", "--skip-column-names", "--default-character-set=utf8mb4",
    // MySQL 8 logins (caching_sha2_password) without TLS need the server's key; OLD_DB_PUBKEY=0 for a MariaDB client.
    ...(settings.publicKey ? ["--get-server-public-key"] : []),
    settings.database, "-e", sql,
  ];
  return new Promise<string>((resolve, reject) => {
    execFile(settings.bin, args, { env: { ...process.env, MYSQL_PWD: password }, maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs }, (error, out, errOut) => {
      if (error) return reject(new Error(String(errOut || error.message).replace(/\s+/g, " ").trim().slice(0, 300)));
      resolve(out);
    });
  });
}

export function createOldDb(settings: OldDbSettings): OldDb {
  return {
    async select(table, cols, where = "") {
      if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error(`Bad table name ${table}`);
      const fields = Object.entries(cols).map(([key, expr]) => `'${key}', ${expr}`).join(", ");
      const out = await run(settings, settings.user, settings.password,
        `SELECT JSON_OBJECT(${fields}) FROM \`${table}\`${where ? ` WHERE ${where}` : ""}`, 60_000);
      const rows: OldRow[] = [];
      for (const line of out.split("\n")) {
        if (!line.trim()) continue;
        try {
          rows.push(JSON.parse(line) as OldRow);
        } catch {
          // a broken row is skipped, never guessed
        }
      }
      return rows;
    },
    write(sql) {
      return run(settings, settings.writeUser || settings.user, settings.writeUser ? settings.writePassword ?? "" : settings.password, sql, 30_000);
    },
  };
}

// ---------------------------------------------------------------------------
// Small helpers for building safe SQL and reading the old tables' loose values
// ---------------------------------------------------------------------------

/** A MySQL string literal. Backslashes and quotes are escaped; control characters are dropped. */
export function sqlText(value: string | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  // eslint-disable-next-line no-control-regex
  const clean = String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  return `'${clean.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Whole numbers only, for IN (...) lists of ids. */
export function sqlIds(values: Iterable<number>) {
  const ids = [...new Set([...values].filter((n) => Number.isInteger(n) && n > 0))];
  return ids.length ? ids.join(", ") : "0";
}

/** The last ten digits of a phone number column, the way the old tables store numbers in many forms. */
export const PHONE10 = (column: string) => `RIGHT(REPLACE(REPLACE(REPLACE(${column}, ' ', ''), '-', ''), '+', ''), 10)`;

export const str = (value: unknown, max = 200) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const num = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const int = (value: unknown) => {
  const n = Math.round(num(value));
  return Number.isSafeInteger(n) ? n : 0;
};

export const phone10 = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  const ten = digits.length >= 10 ? digits.slice(-10) : "";
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
};

/** A plate the app accepts (A-Z and digits, 4 to 12 long), or null. */
export const plateOf = (value: unknown) => {
  const plate = String(value ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(plate) && /\d/.test(plate) ? plate : null;
};

/**
 * The old site writes times in India time in several shapes: "2026-10-28 16:50:19", "28-10-2026 06:42:26 pm",
 * "2026-10-28T18:55", "28-10-2026". Returns an ISO time (UTC) or null.
 */
export function istTime(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || /^0000/.test(text)) return null;
  let y: number, mo: number, d: number, h = 0, mi = 0, s = 0;
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4]) [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  } else {
    m = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?)?/i);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4]) {
      [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
      const half = m[7]?.toLowerCase();
      if (half === "pm" && h < 12) h += 12;
      if (half === "am" && h === 12) h = 0;
    }
  }
  if (!(y > 2000 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h < 24 && mi < 60 && s < 60)) return null;
  const utc = Date.UTC(y, mo - 1, d, h, mi, s) - 330 * 60_000;
  return Number.isFinite(utc) ? new Date(utc).toISOString() : null;
}

/** Day + "HH:MM:SS" in India time → ISO. */
export function istAt(day: { y: number; m: number; d: number }, clock: unknown): string | null {
  const m = String(clock ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!m || !(day.y > 2000)) return null;
  return istTime(`${day.y}-${day.m}-${day.d} ${m[1]}:${m[2]}:00`);
}

/** Now in India time as the old tables write it: "2026-11-23 09:41:07". */
export function istNowText(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return ist.toISOString().replace("T", " ").slice(0, 19);
}
