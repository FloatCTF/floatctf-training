<?php
require __DIR__ . '/db.php';

$category = $_GET['category'] ?? 'hardware';
$stmt = db()->prepare('SELECT name, price FROM items WHERE category = ? ORDER BY price');
$stmt->execute([$category]);
$items = $stmt->fetchAll();
?>
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Items</title></head>
<body>
<h1><?= htmlspecialchars($category) ?></h1>
<?php if (count($items) === 0): ?>
<p>Nothing in this category.</p>
<?php endif; ?>
<ul>
<?php foreach ($items as $item): ?>
  <li><?= htmlspecialchars($item['name']) ?>: <?= $item['price'] ?></li>
<?php endforeach; ?>
</ul>
</body>
</html>
