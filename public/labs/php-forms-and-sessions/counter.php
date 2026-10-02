<?php
session_start();
$_SESSION['visits'] = ($_SESSION['visits'] ?? 0) + 1;
header('Content-Type: text/plain; charset=utf-8');
echo "visits in this session: ", $_SESSION['visits'], "\n";
echo "session id: ", session_id(), "\n";
