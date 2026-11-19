<?php
// Bike Surgeon - vehicle-wise labour prices. Works on PHP 7.4+.
// Uses the billing site's own db.php connection; no password is kept in this folder.
error_reporting(E_ALL); ini_set('display_errors', '0');
date_default_timezone_set('Asia/Kolkata');

class VLDb {
    public $my = null; public $lite = null; public $err = '';
    function q($sql) {
        if ($this->lite) { $r = @$this->lite->query($sql); if ($r === false) { $this->err = $this->lite->lastErrorMsg(); return false; } return $r; }
        try { $r = mysqli_query($this->my, $sql); } catch (Throwable $e) { $this->err = $e->getMessage(); return false; }
        if ($r === false) { $this->err = mysqli_error($this->my); return false; } return $r;
    }
    function rows($sql) {
        $r = $this->q($sql); $o = array(); if ($r === false || $r === true) return $o;
        if ($this->lite) { while ($x = $r->fetchArray(SQLITE3_ASSOC)) $o[] = $x; }
        else { while ($x = mysqli_fetch_assoc($r)) $o[] = $x; mysqli_free_result($r); }
        return $o;
    }
    function esc($s) { $s = (string)$s; return $this->lite ? SQLite3::escapeString($s) : mysqli_real_escape_string($this->my, $s); }
    function lastId() { return $this->lite ? $this->lite->lastInsertRowID() : mysqli_insert_id($this->my); }
    function hasTable($t) {
        if ($this->lite) return count($this->rows("SELECT name FROM sqlite_master WHERE type='table' AND name='" . $this->esc($t) . "'")) > 0;
        return count($this->rows("SHOW TABLES LIKE '" . $this->esc($t) . "'")) > 0;
    }
}

function vl_fail($code, $msg) { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); echo json_encode(array('ok' => false, 'error' => $msg)); exit; }

function vl_db() {
    static $d = null; if ($d) return $d;
    $d = new VLDb();
    $t = getenv('VL_SQLITE');
    if ($t && PHP_SAPI === 'cli-server') { $d->lite = new SQLite3($t); $d->lite->busyTimeout(3000); }
    else {
        $root = dirname(__DIR__);
        if (!is_file($root . '/db.php')) vl_fail(500, 'db.php was not found. Put the labour-prices folder inside the billing site folder.');
        $conn = null; $conn2 = null;
        ob_start(); include $root . '/db.php'; ob_end_clean();
        $pick = null;
        if ($conn) { $d->my = $conn; if ($d->hasTable('labour_charges')) $pick = $conn; }
        if (!$pick && is_file($root . '/db2.php')) {
            ob_start(); include $root . '/db2.php'; ob_end_clean();
            if ($conn2) { $d->my = $conn2; if ($d->hasTable('labour_charges')) $pick = $conn2; }
        }
        if (!$pick) vl_fail(500, 'The labour_charges table was not found in the billing database.');
        $d->my = $pick; mysqli_set_charset($pick, 'utf8mb4');
    }
    vl_schema($d);
    return $d;
}

function vl_schema($d) {
    if ($d->hasTable('vehicle_labour_settings') && $d->hasTable('vehicles') && $d->hasTable('vehicle_labour_charges')) return;
    if ($d->lite) {
        $d->q("CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT NOT NULL, model TEXT NOT NULL, cc INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, prices_done INTEGER DEFAULT 0, updated_by TEXT, updated_at TEXT, UNIQUE(brand,model))");
        $d->q("CREATE TABLE IF NOT EXISTS vehicle_labour_charges (id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL, labour_id INTEGER NOT NULL, price REAL DEFAULT 0, is_active INTEGER DEFAULT 1, UNIQUE(vehicle_id,labour_id))");
        $d->q("CREATE TABLE IF NOT EXISTS vehicle_labour_settings (k TEXT PRIMARY KEY, v TEXT)");
    } else {
        $ok = $d->q("CREATE TABLE IF NOT EXISTS `vehicles` (`id` int NOT NULL AUTO_INCREMENT, `brand` varchar(60) NOT NULL, `model` varchar(120) NOT NULL, `cc` int DEFAULT 0, `is_active` tinyint(1) DEFAULT 1, `prices_done` tinyint(1) DEFAULT 0, `updated_by` varchar(80) DEFAULT NULL, `updated_at` datetime DEFAULT NULL, PRIMARY KEY (`id`), UNIQUE KEY `brand_model` (`brand`,`model`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $ok = $ok && $d->q("CREATE TABLE IF NOT EXISTS `vehicle_labour_charges` (`id` int NOT NULL AUTO_INCREMENT, `vehicle_id` int NOT NULL, `labour_id` int NOT NULL, `price` decimal(10,2) DEFAULT 0, `is_active` tinyint(1) DEFAULT 1, PRIMARY KEY (`id`), UNIQUE KEY `vehicle_labour` (`vehicle_id`,`labour_id`), KEY `labour_id` (`labour_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $ok = $ok && $d->q("CREATE TABLE IF NOT EXISTS `vehicle_labour_settings` (`k` varchar(80) NOT NULL, `v` text, PRIMARY KEY (`k`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        if (!$ok) vl_fail(500, 'Could not make the tables: ' . $d->err);
    }
    $n = $d->rows("SELECT COUNT(*) AS n FROM vehicles");
    if ((int)$n[0]['n'] === 0) {
        $seed = json_decode(file_get_contents(__DIR__ . '/seed.json'), true);
        $d->q("BEGIN");
        foreach (array_chunk($seed, 100) as $part) {
            $v = array();
            foreach ($part as $s) $v[] = "(" . (int)$s[0] . ",'" . $d->esc($s[1]) . "','" . $d->esc($s[2]) . "'," . (int)$s[3] . ",1,0)";
            $d->q("INSERT INTO vehicles (id,brand,model,cc,is_active,prices_done) VALUES " . implode(',', $v));
        }
        $d->q("COMMIT");
    }
}

function vl_get($k) { $d = vl_db(); $r = $d->rows("SELECT v FROM vehicle_labour_settings WHERE k='" . $d->esc($k) . "'"); return $r ? $r[0]['v'] : null; }
function vl_set($k, $v) { $d = vl_db(); $d->q("DELETE FROM vehicle_labour_settings WHERE k='" . $d->esc($k) . "'"); $d->q("INSERT INTO vehicle_labour_settings (k,v) VALUES ('" . $d->esc($k) . "','" . $d->esc($v) . "')"); }
function vl_secret() { $s = vl_get('secret'); if (!$s) { $s = bin2hex(random_bytes(32)); vl_set('secret', $s); } return $s; }

// Who is using the page: a billing login (session) or the mechanic PIN (signed cookie, 12 hours).
function vl_me() {
    static $me = false; if ($me !== false) return $me;
    $me = null;
    if (session_status() === PHP_SESSION_NONE) { @session_start(); }
    if (isset($_SESSION['login']) && $_SESSION['login'] === true) {
        $role = isset($_SESSION['user_role']) ? (string)$_SESSION['user_role'] : 'staff';
        $name = isset($_SESSION['user_name']) ? (string)$_SESSION['user_name'] : 'Staff';
        $me = array('name' => $name, 'role' => $role, 'admin' => in_array($role, array('owner', 'admin', 'manager'), true), 'pin' => false);
    }
    @session_write_close();
    if (!$me && !empty($_COOKIE['vl_auth'])) {
        $p = explode('.', (string)$_COOKIE['vl_auth']);
        if (count($p) === 2 && hash_equals(hash_hmac('sha256', $p[0], vl_secret()), $p[1])) {
            $x = json_decode(base64_decode($p[0]), true);
            if (is_array($x) && isset($x['e'], $x['n'], $x['h']) && $x['e'] > time() && $x['h'] === substr(sha1((string)vl_get('pin')), 0, 12))
                $me = array('name' => (string)$x['n'], 'role' => 'mechanic', 'admin' => false, 'pin' => true);
        }
    }
    return $me;
}
function vl_cookie($val, $exp) {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
    header('Set-Cookie: vl_auth=' . $val . '; Expires=' . gmdate('D, d M Y H:i:s', $exp) . ' GMT; Path=' . $path . '; HttpOnly; SameSite=Lax' . ($secure ? '; Secure' : ''), false);
}
function vl_ip() { return isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '-'; }
