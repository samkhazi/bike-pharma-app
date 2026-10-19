#!/usr/bin/env bash
# fresh database + server on port 3015, then the Playwright suite
cd "$(dirname "$0")/.."
T=/tmp/claude-0/bptest
for pid in $(pgrep -x node); do if tr "\0" "\n" < /proc/$pid/environ 2>/dev/null | grep -qx "PORT=3015"; then kill $pid; fi; done
sleep 0.8
rm -rf $T/data; mkdir -p $T/pf/catalogues/test; python3 -c "open('$T/pf/catalogues/test/a.bin','wb').write(bytes(range(256)))"
DATA_DIR=$T/data node --no-warnings admin.mjs add-admin sam@bikepharma.com "Sam" --password Test@1234 >/dev/null
DATA_DIR=$T/data node --no-warnings tools/test_shop.mjs >/dev/null
PHOTO_AI=off DATA_DIR=$T/data FILES_DIR=$T/pf PORT=3015 node --no-warnings server.mjs > $T/server.log 2>&1 &
sleep 1.2
node tools/test.mjs; r=$?
# update 9c: server checks for customers, prices, audit, limits and rates
node tools/test_9c.mjs || r=1
node tools/test_back.mjs || r=1
# update 8o: the Billing profile (no bill discount, warranty claims, cancel / change through Manager, split, estimate to bill)
node tools/test_bill.mjs || r=1
# update 9i: MRP lots (two MRPs of one part: add product, bill split, change lot, stock in, labels, server price)
BASE=http://127.0.0.1:3015 node tools/test_lots.mjs || r=1
# update 9j: typing on a phone keeps the same box (keyboard stays open)
BASE=http://127.0.0.1:3015 node tools/test_kb.mjs || r=1
# update 9k: Find Part > Check parts with chassis number
BASE=http://127.0.0.1:3015 node tools/test_vin.mjs || r=1
# update 9l: Hero update (2 new editions with SVG diagrams, MRP list, price-list parts, kits, old numbers); needs Sam's update zip staged here
HZ="${HERO_UPDATE_ZIP:-/mnt/user-data/uploads/Downloads/Updated Hero Catalogue/Hero_Update_19Oct.zip}"
if [ -f "$HZ" ]; then mkdir -p $T/pf/catalogues/hero; ln -sf "$HZ" $T/pf/catalogues/hero/; BASE4=http://127.0.0.1:3015 node tools/test_hero9l.mjs || r=1; else echo "SKIP test_hero9l (no Hero_Update_19Oct.zip)"; fi
# a brand-new shop (only the admin login): Admin's Inventory page, Add product, Stock in with a new supplier
T2=/tmp/claude-0/bptest2
for pid in $(pgrep -x node); do if tr "\0" "\n" < /proc/$pid/environ 2>/dev/null | grep -qx "PORT=3016"; then kill $pid; fi; done
sleep 0.5; rm -rf $T2/data; mkdir -p $T2/pf
DATA_DIR=$T2/data node --no-warnings admin.mjs add-admin sam@bikepharma.com "Sam" --password Test@1234 >/dev/null
PHOTO_AI=off DATA_DIR=$T2/data FILES_DIR=$T2/pf PORT=3016 node --no-warnings server.mjs > $T2/server.log 2>&1 &
sleep 1.2
BASE2=http://127.0.0.1:3016 node tools/test_inv.mjs || r=1
# update 8: inventory from the catalogues and the photo AI, on a phone and a computer (the AI model file is linked in when this
# computer has it, else the photo AI checks are skipped: the test never downloads it)
T3=/tmp/claude-0/bptest3; MODEL=${PHOTO_AI_MODEL_FILE:-/tmp/claude-0/ai/isnet-general-use.onnx}
for pid in $(pgrep -x node); do if tr "\0" "\n" < /proc/$pid/environ 2>/dev/null | grep -qx "PORT=3017"; then kill $pid; fi; done
sleep 0.5; rm -rf $T3/data; mkdir -p $T3/pf $T3/data/models
AI=off; if [ -f "$MODEL" ] && [ -d ai/node_modules/onnxruntime-node ]; then ln -s "$MODEL" $T3/data/models/isnet-general-use.onnx; AI=on; fi
# the bill reader (Apna AI): its models linked in when this computer has them, else the phone reads the bill (never downloaded here)
PP=${BILL_AI_MODELS:-/tmp/claude-0/ai/ppocr}; BAI=off; if [ -f "$PP/ch_PP-OCRv4_rec_infer.onnx" ] && [ -d ai/node_modules/onnxruntime-node ]; then ln -s "$PP" $T3/data/models/ppocr; BAI=on; fi
python3 tools/test_photos.py $T3/ph >/dev/null
DATA_DIR=$T3/data node --no-warnings admin.mjs add-admin sam@bikepharma.com "Sam" --password Test@1234 >/dev/null
BILL_AI=$BAI PHOTO_AI=$AI DATA_DIR=$T3/data FILES_DIR=$T3/pf PORT=3017 node --no-warnings server.mjs > $T3/server.log 2>&1 &
sleep 1.2
BASE3=http://127.0.0.1:3017 PH=$T3/ph node tools/test_inv8.mjs || r=1
# update 8b: on a phone the page never zooms; a full-screen diagram / photo zooms with two fingers and a tap
BASE3=http://127.0.0.1:3017 node tools/test_zoom.mjs || r=1
# update 8m: the Manager profile (no rates or margin, purchase order limit, Admin enters the rates later)
BASE3=http://127.0.0.1:3017 node tools/test_mgr.mjs || r=1
# update 8p: the Accountant profile
BASE3=http://127.0.0.1:3017 node tools/test_acc.mjs || r=1
exit $r
