<?php
session_start();
$users = require 'users.php';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = $_POST['user'] ?? '';
    $password = $_POST['password'] ?? '';
    $hash = $users[$user] ?? null;
    if ($hash !== null && password_verify($password, $hash)) {
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        header('Location: me.php');
        exit;
    }
    $error = 'Wrong user or password.';
}
?>
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Log in</title></head>
<body>
<form method="post" action="login.php">
  <input name="user" placeholder="user">
  <input name="password" type="password" placeholder="password">
  <button>Log in</button>
</form>
<?php if ($error !== ''): ?>
<p><?= htmlspecialchars($error) ?></p>
<?php endif; ?>
</body>
</html>
