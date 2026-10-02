<?php
$file = __DIR__ . '/notes.txt';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $text = trim($_POST['text'] ?? '');
    if ($text !== '') {
        file_put_contents($file, $text . "\n", FILE_APPEND | LOCK_EX);
    }
    header('Location: notes.php');
    exit;
}

$notes = file_exists($file) ? file($file, FILE_IGNORE_NEW_LINES) : [];
$title = 'Notes';
require __DIR__ . '/header.php';
?>
<form method="post" action="notes.php">
  <input name="text">
  <button>Add</button>
</form>
<ul>
<?php foreach ($notes as $note): ?>
  <li><?= htmlspecialchars($note) ?></li>
<?php endforeach; ?>
</ul>
<?php require __DIR__ . '/footer.php'; ?>
