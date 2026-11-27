// npm run dev: freezes the clock at the sample day (Thu 29 Oct 2026, 11:30 am) and allows reloading the sample.
process.env.DEMO_CLOCK ||= '2026-10-29T11:30';
process.env.DEMO ||= '1';
process.env.ALLOW_RESET ||= '1';
require('./index').start();
