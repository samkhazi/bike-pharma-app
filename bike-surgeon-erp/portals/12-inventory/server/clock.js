// Workshop clock. All times are workshop-local (TZ, default Asia/Kolkata).
// DEMO_CLOCK=2026-10-13T18:20 freezes "now" so the sample data always looks the same.
'use strict';
process.env.TZ ||= 'Asia/Kolkata';

const pad = n => String(n).padStart(2, '0');

function now() {
  const fixed = process.env.DEMO_CLOCK;
  if (fixed) {
    const m = fixed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }
  return new Date();
}

const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = d => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parse = s => {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
};
const minuteOfDay = d => d.getHours() * 60 + d.getMinutes();
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / 86400000);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const atMinute = (d, min) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(min / 60), min % 60);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const clock = d => { const h = d.getHours(), m = d.getMinutes(); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`; };
const short = d => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
const long = d => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const histDate = d => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;

// Working days are Monday to Saturday
function workingDays(d) {
  const y = d.getFullYear(), mo = d.getMonth();
  const last = new Date(y, mo + 1, 0).getDate();
  let total = 0, done = 0;
  for (let i = 1; i <= last; i++) {
    if (new Date(y, mo, i).getDay() === 0) continue;
    total++;
    if (i <= d.getDate()) done++;
  }
  return { total, done, left: total - done };
}

function greeting(d) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const dmy = d => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

module.exports = { dmy, now, ymd, stamp, parse, minuteOfDay, daysBetween, addDays, atMinute, clock, short, long, histDate, workingDays, greeting, MONTHS };
