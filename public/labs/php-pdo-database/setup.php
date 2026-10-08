<?php
require __DIR__ . '/db.php';

$pdo = db();
$pdo->exec(file_get_contents(__DIR__ . '/shop.sql'));
echo "created shop.db\n";
