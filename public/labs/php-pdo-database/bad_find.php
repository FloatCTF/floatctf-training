<?php
require __DIR__ . '/db.php';

// Wrong on purpose: the input is pasted into the SQL text.
$name = $argv[1] ?? '';
$pdo = db();
$sql = "SELECT name, role FROM users WHERE name = '" . $name . "'";
echo "SQL: ", $sql, "\n";
$user = $pdo->query($sql)->fetch();
echo $user === false ? "no such user\n" : $user['name'] . " is " . $user['role'] . "\n";
