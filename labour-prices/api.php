<?php
require __DIR__ . '/lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$a = isset($_GET['a']) ? (string)$_GET['a'] : '';
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$in = array();
if ($post) {
    if (!isset($_SERVER['HTTP_X_VL'])) vl_fail(400, 'Bad request');
    $in = json_decode(file_get_contents('php://input'), true);
    if (!is_array($in)) $in = array();
}
$d = vl_db();
function out($x) { $x['ok'] = true; echo json_encode($x, JSON_UNESCAPED_UNICODE); exit; }

if ($a === 'login' && $post) {
    $pin = isset($in['pin']) ? trim((string)$in['pin']) : '';
    $name = isset($in['name']) ? trim(preg_replace('/\s+/', ' ', (string)$in['name'])) : '';
    $hash = vl_get('pin');
    if (!$hash) vl_fail(403, 'The PIN is not set yet. Ask the owner to set it.');
    if ($name === '' || strlen($name) > 40) vl_fail(400, 'Type your name.');
    $fk = 'fail:' . vl_ip(); $f = explode('|', (string)vl_get($fk)); $cnt = (int)$f[0]; $ts = isset($f[1]) ? (int)$f[1] : 0;
    if (time() - $ts > 900) $cnt = 0;
    if ($cnt >= 8) vl_fail(429, 'Too many wrong tries. Wait 15 minutes.');
    if (!password_verify($pin, $hash)) { vl_set($fk, ($cnt + 1) . '|' . time()); usleep(600000); vl_fail(403, 'Wrong PIN.'); }
    if ($cnt) vl_set($fk, '0|0');
    $exp = time() + 43200;
    $b = base64_encode(json_encode(array('n' => $name, 'e' => $exp, 'h' => substr(sha1($hash), 0, 12))));
    vl_cookie($b . '.' . hash_hmac('sha256', $b, vl_secret()), $exp);
    out(array());
}
if ($a === 'logout' && $post) { vl_cookie('x', time() - 3600); out(array()); }

$me = vl_me();
if (!$me) vl_fail(401, 'Login needed');

function jobs($d) {
    $o = array();
    foreach ($d->rows("SELECT id, category, job_description, price_110cc, price_125cc, price_150cc, price_200cc, price_300cc, price_650cc FROM labour_charges WHERE is_active=1 ORDER BY id") as $r)
        $o[] = array((int)$r['id'], (string)$r['category'], (string)$r['job_description'], array((float)$r['price_110cc'], (float)$r['price_125cc'], (float)$r['price_150cc'], (float)$r['price_200cc'], (float)$r['price_300cc'], (float)$r['price_650cc']));
    return $o;
}
function clean_prices($d, $p) {
    if (!is_array($p)) vl_fail(400, 'No prices');
    $ids = array(); foreach ($d->rows("SELECT id FROM labour_charges") as $r) $ids[(int)$r['id']] = 1;
    $o = array();
    foreach ($p as $k => $v) { $k = (int)$k; if (!isset($ids[$k]) || !is_numeric($v)) continue; $v = round((float)$v, 2); if ($v < 0 || $v > 999999) continue; $o[$k] = $v; }
    if (!$o) vl_fail(400, 'No prices');
    return $o;
}
function write_prices($d, $vid, $p, $who) {
    $vid = (int)$vid;
    if (!$d->rows("SELECT id FROM vehicles WHERE id=$vid")) return false;
    $v = array(); foreach ($p as $k => $x) $v[] = "($vid," . (int)$k . "," . number_format($x, 2, '.', '') . ",1)";
    $d->q("DELETE FROM vehicle_labour_charges WHERE vehicle_id=$vid AND labour_id IN (" . implode(',', array_map('intval', array_keys($p))) . ")");
    if ($d->q("INSERT INTO vehicle_labour_charges (vehicle_id,labour_id,price,is_active) VALUES " . implode(',', $v)) === false) return false;
    $d->q("UPDATE vehicles SET prices_done=1, updated_by='" . $d->esc($who) . "', updated_at='" . date('Y-m-d H:i:s') . "' WHERE id=$vid");
    return true;
}

function clean_names($d, $nm) {
    $def = array(); foreach ($d->rows("SELECT id, job_description FROM labour_charges") as $r) $def[(int)$r['id']] = trim((string)$r['job_description']);
    $o = array();
    foreach ($nm as $k => $v) {
        $k = (int)$k; if (!isset($def[$k]) || !is_string($v)) continue;
        $v = trim(preg_replace('/\s+/u', ' ', preg_replace('/[\x00-\x1F\x7F]/', ' ', $v)));
        if ($v === '' || $v === $def[$k]) continue;
        if (strlen($v) > 200) vl_fail(400, 'A job name is too long.');
        $o[$k] = $v;
    }
    return $o;
}
function write_names($d, $vid, $nm) {
    $vid = (int)$vid;
    $d->q("DELETE FROM vehicle_labour_names WHERE vehicle_id=$vid");
    if (!$nm) return true;
    $v = array(); foreach ($nm as $k => $x) $v[] = "($vid," . (int)$k . ",'" . $d->esc($x) . "')";
    return $d->q("INSERT INTO vehicle_labour_names (vehicle_id,labour_id,name) VALUES " . implode(',', $v)) !== false;
}

if ($a === 'state') {
    $V = array();
    foreach ($d->rows("SELECT id, brand, model, cc, prices_done, updated_by, updated_at FROM vehicles WHERE is_active=1 ORDER BY id") as $r)
        $V[] = array((int)$r['id'], (string)$r['brand'], (string)$r['model'], (int)$r['cc'], (int)$r['prices_done'], (string)$r['updated_by'], (string)$r['updated_at']);
    $P = array();
    foreach ($d->rows("SELECT c.vehicle_id, c.labour_id, c.price FROM vehicle_labour_charges c JOIN vehicles v ON v.id=c.vehicle_id WHERE v.prices_done=1") as $r) {
        $k = (int)$r['vehicle_id']; if (!isset($P[$k])) $P[$k] = array(); $P[$k][(int)$r['labour_id']] = (float)$r['price'];
    }
    $N = array();
    foreach ($d->rows("SELECT n.vehicle_id, n.labour_id, n.name FROM vehicle_labour_names n JOIN vehicles v ON v.id=n.vehicle_id WHERE v.prices_done=1") as $r) {
        $k = (int)$r['vehicle_id']; if (!isset($N[$k])) $N[$k] = array(); $N[$k][(int)$r['labour_id']] = (string)$r['name'];
    }
    out(array('me' => $me, 'V' => $V, 'J' => jobs($d), 'P' => (object)$P, 'N' => (object)$N, 'pinSet' => vl_get('pin') ? true : false));
}
if (!$post) vl_fail(400, 'Bad request');

if ($a === 'save') {
    $p = clean_prices($d, isset($in['p']) ? $in['p'] : null);
    $ids = isset($in['vids']) && is_array($in['vids']) ? array_slice(array_values(array_unique(array_map('intval', $in['vids']))), 0, 500) : array();
    if (!$ids) vl_fail(400, 'No vehicle');
    $nm = isset($in['nm']) && is_array($in['nm']) ? clean_names($d, $in['nm']) : null;
    $d->q("BEGIN"); $n = 0;
    foreach ($ids as $vid) { if (write_prices($d, $vid, $p, $me['name']) && ($nm === null || write_names($d, $vid, $nm))) $n++; else { $d->q("ROLLBACK"); vl_fail(500, 'Could not save' . ($me['admin'] ? ': ' . $d->err : '')); } }
    $d->q("COMMIT");
    out(array('n' => $n));
}
if ($a === 'reset') {
    $vid = isset($in['vid']) ? (int)$in['vid'] : 0;
    $d->q("BEGIN");
    $d->q("DELETE FROM vehicle_labour_charges WHERE vehicle_id=$vid");
    $d->q("DELETE FROM vehicle_labour_names WHERE vehicle_id=$vid");
    $d->q("UPDATE vehicles SET prices_done=0, updated_by='" . $d->esc($me['name']) . "', updated_at='" . date('Y-m-d H:i:s') . "' WHERE id=$vid");
    $d->q("COMMIT");
    out(array());
}
if ($a === 'addveh') {
    $b = isset($in['brand']) ? trim(preg_replace('/\s+/', ' ', (string)$in['brand'])) : '';
    $m = isset($in['model']) ? trim(preg_replace('/\s+/', ' ', (string)$in['model'])) : '';
    $cc = isset($in['cc']) ? max(0, min(3000, (int)$in['cc'])) : 0;
    if ($b === '' || $m === '' || strlen($b) > 60 || strlen($m) > 120) vl_fail(400, 'Fill the brand and the vehicle name.');
    if ($d->rows("SELECT id FROM vehicles WHERE LOWER(brand)=LOWER('" . $d->esc($b) . "') AND LOWER(model)=LOWER('" . $d->esc($m) . "')")) vl_fail(409, 'This vehicle is already in the list.');
    if ($d->q("INSERT INTO vehicles (brand,model,cc,is_active,prices_done,updated_by,updated_at) VALUES ('" . $d->esc($b) . "','" . $d->esc($m) . "',$cc,1,0,'" . $d->esc($me['name']) . "','" . date('Y-m-d H:i:s') . "')") === false) vl_fail(500, 'Could not add the vehicle.');
    out(array('id' => (int)$d->lastId()));
}
if ($a === 'setpin') {
    if (!$me['admin']) vl_fail(403, 'Only the owner can set the PIN.');
    $pin = isset($in['pin']) ? trim((string)$in['pin']) : '';
    if ($pin === '') { $d->q("DELETE FROM vehicle_labour_settings WHERE k='pin'"); out(array()); }
    if (!preg_match('/^\d{4,8}$/', $pin)) vl_fail(400, 'The PIN must be 4 to 8 digits.');
    vl_set('pin', password_hash($pin, PASSWORD_DEFAULT));
    out(array());
}
vl_fail(400, 'Bad request');
