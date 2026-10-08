<?php
$port = 80;
$ratio = 0.75;
$host = "kali";
$open = true;
$owner = null;

var_dump($port, $ratio, $host, $open, $owner);
echo get_debug_type($port), " ", get_debug_type($host), "\n";
echo "host: $host, port: $port\n";
echo 'single quotes: $host' . "\n";
