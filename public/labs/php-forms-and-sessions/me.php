<?php
session_start();
header('Content-Type: text/plain; charset=utf-8');
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo "Please log in first.\n";
    exit;
}
echo "Welcome back, ", $_SESSION['user'], ".\n";
