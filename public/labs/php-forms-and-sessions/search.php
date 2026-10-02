<?php
$q = $_GET['q'] ?? '';
?>
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Search</title></head>
<body>
<form method="get" action="search.php">
  <input name="q" value="<?= htmlspecialchars($q) ?>">
  <button>Search</button>
</form>
<?php if ($q !== ''): ?>
<p>You searched for: <?= htmlspecialchars($q) ?></p>
<?php endif; ?>
</body>
</html>
