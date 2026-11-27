// Add a sign-in from the command line:
//   npm run add-user -- "Imran" 9876500000 store 4321
// role: owner | manager | store | accountant
'use strict';
const db = require('./db');
const auth = require('./auth');
const [name, phone, role, pin] = process.argv.slice(2);
if (!pin) { console.log('Usage: npm run add-user -- "Name" PHONE ROLE PIN   (role: owner, manager, store, accountant)'); process.exit(1); }
db.open();
try { const id = auth.addAccount({ name, phone, role, pin }); console.log(`Login ${id} added for ${name}.`); }
catch (e) { console.error(e.message); process.exit(1); }
