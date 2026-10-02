<?php
$name = $_GET['name'] ?? '';
echo "<p>raw:     " . $name . "</p>\n";
echo "<p>escaped: " . htmlspecialchars($name) . "</p>\n";
