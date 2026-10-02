<?php
require __DIR__ . '/db.php';

$pdo = db();
$rows = $pdo->query('SELECT name, price FROM items ORDER BY price DESC')->fetchAll();
echo count($rows), " items\n";
foreach ($rows as $row) {
    echo $row['name'], " ", $row['price'], "\n";
}
