// A panel inside the one screen lost its sign-in: the whole screen goes to the sign-in page.
'use strict';
try { window.top.location.href = '/__gate/login'; } catch { location.href = '/__gate/login'; }
