<?php
// The staff list of the attendance app (billing.bikesurgeon.online/attendance), for tools/name-logins.js: id, name,
// mobile number and on/off of every staff member, and of the admin users (the owners). Only reads; prints JSON.
//   php tools/att-people.php /home/bikesurgeon-billing/attendance-private/config.php > people.json
// Works on PHP 7.4 and 8. The database password stays inside config.php (never printed).
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$f = $argv[1] ?? '';
if ($f === '' || !is_file($f)) { fwrite(STDERR, "Give the attendance config.php\n"); exit(1); }
$c = include $f;
$d = is_array($c) && isset($c['db']) ? $c['db'] : null;
if (!$d || empty($d['dsn'])) { fwrite(STDERR, "No database settings in config.php\n"); exit(1); }
try {
    $pdo = new PDO($d['dsn'], $d['user'] ?? null, $d['pass'] ?? null,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $users = $pdo->query('SELECT id, name, mobile, status FROM users ORDER BY id')->fetchAll();
    $admins = $pdo->query('SELECT id, name, phone, is_active FROM admin_users ORDER BY id')->fetchAll();
} catch (Throwable $e) {
    fwrite(STDERR, 'Attendance database could not be read: ' . get_class($e) . "\n");
    exit(1);
}
echo json_encode(['users' => $users, 'admins' => $admins], JSON_UNESCAPED_UNICODE);
