<?php
$name = $_GET['name'] ?? 'stranger';
$letters = strlen($name);
?>
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Greet</title></head>
<body>
<p>Hello, <?= htmlspecialchars($name) ?>!</p>
<p>Your name has <?= $letters ?> letters.</p>
</body>
</html>
