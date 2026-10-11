#!/usr/bin/env bash
# fresh database + server on port 3015, then the Playwright suite
cd "$(dirname "$0")/.."
T=/tmp/claude-0/bptest
for pid in $(pgrep -x node); do if tr "\0" "\n" < /proc/$pid/environ 2>/dev/null | grep -qx "PORT=3015"; then kill $pid; fi; done
sleep 0.8
rm -rf $T/data; mkdir -p $T/pf/catalogues/test; python3 -c "open('$T/pf/catalogues/test/a.bin','wb').write(bytes(range(256)))"
DATA_DIR=$T/data node --no-warnings admin.mjs add-admin sam@bikepharma.com "Sam" --password Test@1234 >/dev/null
DATA_DIR=$T/data node --no-warnings tools/test_shop.mjs >/dev/null
DATA_DIR=$T/data FILES_DIR=$T/pf PORT=3015 node --no-warnings server.mjs > $T/server.log 2>&1 &
sleep 1.2
node tools/test.mjs; r=$?
node tools/test_back.mjs || r=1
# a brand-new shop (only the admin login): Admin's Inventory page, Add product, Stock in with a new supplier
T2=/tmp/claude-0/bptest2
for pid in $(pgrep -x node); do if tr "\0" "\n" < /proc/$pid/environ 2>/dev/null | grep -qx "PORT=3016"; then kill $pid; fi; done
sleep 0.5; rm -rf $T2/data; mkdir -p $T2/pf
DATA_DIR=$T2/data node --no-warnings admin.mjs add-admin sam@bikepharma.com "Sam" --password Test@1234 >/dev/null
DATA_DIR=$T2/data FILES_DIR=$T2/pf PORT=3016 node --no-warnings server.mjs > $T2/server.log 2>&1 &
sleep 1.2
BASE2=http://127.0.0.1:3016 node tools/test_inv.mjs || r=1
exit $r
