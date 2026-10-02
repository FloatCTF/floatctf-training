<?php
session_start();
$_SESSION = [];
session_destroy();
header('Content-Type: text/plain; charset=utf-8');
echo "Logged out.\n";
