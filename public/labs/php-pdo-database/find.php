<?php
require __DIR__ . '/db.php';

$name = $argv[1] ?? '';
$pdo = db();
$stmt = $pdo->prepare('SELECT name, role, city FROM users WHERE name = ?');
$stmt->execute([$name]);
$user = $stmt->fetch();

if ($user === false) {
    echo "no such user\n";
} else {
    echo $user['name'], " is ", $user['role'], " in ", $user['city'] ?? 'unknown', "\n";
}
