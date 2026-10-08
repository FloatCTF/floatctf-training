<?php
if (isset($_GET['theme'])) {
    setcookie('theme', $_GET['theme']);
    echo "theme saved\n";
} else {
    echo "theme: ", $_COOKIE['theme'] ?? 'light', "\n";
}
