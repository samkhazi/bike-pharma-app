// The panels behind the front door (Sam, 29 Oct: one link, one email login, the login decides the panel).
// Each panel still runs as its own app on an inside port; the front door signs in to it with the person's phone + PIN
// of that panel and passes every request through. Ports: PORT_<KEY> in .env, else these.
'use strict';

const LIST = [
  // key, name, inside port, sign-in path, people of the sample data [name, phone]
  ['admin', 'Admin panel', 3040, '/api/login', [['Saddam (owner)', '9820000111'], ['Accountant', '9820000222'], ['Ganesh', '9876543210'], ['Sultan', '9876543212'], ['Misba', '9811120456'], ['Syed Shahid', '9819033872']]],
  ['cashier', 'Cashier', 3023, '/api/login', [['Misba', '9811120456'], ['Saddam (owner)', '9820000111'], ['Accountant', '9820000222'], ['Ganesh', '9876543210'], ['Sultan', '9876543212'], ['Sharath', '9819033871'], ['Syed Shahid', '9819033872'], ['Yaseen Raza', '9819033873']]],
  ['floor', 'Service floor (Floor Manager)', 3026, '/api/auth/login', [['Sultan', '9876543212'], ['Sharath', '9819033871'], ['Syed Shahid', '9819033872'], ['Yaseen Raza', '9819033873'], ['Owner', '9820000111']]],
  ['maintainer', 'Service spares (Maintainer)', 3027, '/api/login', [['Prasad', '9845012233'], ['Sultan', '9876543212'], ['Saniya', '9741100222'], ['Radhika', '9741100225'], ['Manjula', '9741100226'], ['Shoukat', '9741100227'], ['Taslim', '9741100228'], ['Yaseen Khatib', '9741100229']]],
  ['desk', 'Workshop desk', 3025, '/api/login', [['Saniya', '9741100222'], ['Shoukat (backup)', '9741100227'], ['Ganesh', '9876543210'], ['Sultan (view)', '9876543212']]],
  ['accounts', 'Accountant', 3030, '/api/login', [['Accountant', '9820000222'], ['Saddam (owner)', '9820000111'], ['Ganesh', '9876543210'], ['Mehek Taj', '9845000333'], ['Misba', '9811120456']]],
  ['counter', 'Counter staff (C1 to C4)', 3024, '/api/login', [['Counter 1', '9741100231'], ['Counter 2', '9741100232'], ['Counter 3', '9741100233'], ['Counter 4', '9741100234'], ['Workshop desk', '9741100235'], ['Saddam (owner)', '9820000111'], ['Ganesh', '9876543210'], ['Nagaraj', '9876543211']]],
  ['spares', 'Spares manager', 3028, '/api/login', [['Ganesh', '9876543210'], ['Saddam (owner)', '9820000111'], ['Nagaraj', '9876543211']]],
  ['supervisor', 'Supervisor', 3029, '/api/login', [['Nagaraj', '9876543211'], ['Saddam (owner)', '9820000111'], ['Ganesh', '9876543210']]],
  ['motolab', 'The Moto Lab', 3031, '/api/login', [['Mehek Taj', '9845000333'], ['Saddam (owner)', '9820000111'], ['Accountant', '9820000222']]],
  ['inventory', 'Inventory', 3021, '/api/login', [['Saddam (owner)', '9820000111'], ['Inventory manager', '9820000444'], ['Prasad', '9845012233'], ['Mehek Taj', '9845000333'], ['Accountant', '9820000222'],
    ['Misba', '9811120456'], ['Nagaraj', '9876543211'], ['Ganesh', '9876543210'], ['Counter 1', '9741100231'], ['Counter 2', '9741100232'], ['Counter 3', '9741100233'], ['Counter 4', '9741100234']]],
];

// The owner's login gets every panel, signed in as this person of that panel
const OWNER_AS = { admin: '9820000111', cashier: '9820000111', floor: '9820000111', maintainer: '9876543212', desk: '9876543210', accounts: '9820000111',
  counter: '9820000111', spares: '9820000111', supervisor: '9820000111', motolab: '9820000111', inventory: '9820000111' };

// Sam 6 Nov: only the new process is used. The demo panels (sample data only) are taken out of every menu.
// The Cashier stays: it shows the real bills of the billing site (03-cashier/server/oldlink.js).
// They are not deleted: their apps keep running. PANELS_OFF in .env changes the list (PANELS_OFF= with nothing shows all again).
const OFF = new Set(String(process.env.PANELS_OFF ?? 'floor,maintainer,desk,accounts,counter,spares,supervisor,motolab').split(',').map(x => x.trim()).filter(Boolean));
const ON = LIST.filter(x => !OFF.has(x[0]));
const panel = ([key, name, port, login, people]) => [key, { key, name, login, people, hidden: OFF.has(key),
  get port() { return Number(process.env['PORT_' + key.toUpperCase()]) || port; } }];
const PORTALS = Object.fromEntries(ON.map(panel));
// every panel, also the ones out of the menu (their apps keep running): for tools that check or set up logins
const ALL = Object.fromEntries(LIST.map(panel));

module.exports = { PORTALS, ALL, OWNER_AS, KEYS: ON.map(x => x[0]) };
