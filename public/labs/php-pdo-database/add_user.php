<?php
require __DIR__ . '/db.php';

$pdo = db();
$stmt = $pdo->prepare('INSERT INTO users (name, role, city) VALUES (:name, :role, :city)');
$stmt->execute([':name' => $argv[1], ':role' => 'member', ':city' => $argv[2] ?? null]);
echo "new user id: ", $pdo->lastInsertId(), "\n";
