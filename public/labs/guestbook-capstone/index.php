<?php
require __DIR__ . '/db.php';
$messages = db()->query('SELECT name, body FROM messages ORDER BY id DESC')->fetchAll();
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>留言板</title></head>
<body>
<h1>留言板</h1>
<form method="post" action="post.php">
  <p><label>名字 <input name="name" maxlength="20" required></label></p>
  <p><label>留言 <textarea name="body" maxlength="200" required></textarea></label></p>
  <p><button>提交</button></p>
</form>
<p><?= count($messages) ?> 条留言</p>
<?php foreach ($messages as $m): ?>
<div class="msg"><b><?= e($m['name']) ?></b>：<?= e($m['body']) ?></div>
<?php endforeach; ?>
</body>
</html>
