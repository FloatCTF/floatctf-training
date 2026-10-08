<?php
echo "start\n";
include __DIR__ . '/nosuch.php';
echo "after include\n";
require __DIR__ . '/nosuch.php';
echo "after require\n";
