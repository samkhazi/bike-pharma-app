#!/usr/bin/env bash
# fresh database + server on port 3015, then the Playwright suite
cd "$(dirname "$0")/.."
T=/tmp/claude-0/bptest
for pid in $(pgrep -x node); do if tr "\0" "\n" < /proc/$pid/environ 2>/dev/null | grep -qx "PORT=3015"; then kill $pid; fi; done
sleep 0.8
rm -rf $T/data; mkdir -p $T/pf/catalogues/test; python3 -c "open('$T/pf/catalogues/test/a.bin','wb').write(bytes(range(256)))"
DATA_DIR=$T/data node --no-warnings admin.mjs add-admin sam@bikepharma.com "Sam" --password Test@1234 >/dev/null
DATA_DIR=$T/data FILES_DIR=$T/pf PORT=3015 node --no-warnings server.mjs > $T/server.log 2>&1 &
sleep 1.2
node tools/test.mjs
