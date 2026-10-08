<?php
$log = [
    "192.0.2.10", "198.51.100.7", "192.0.2.10", "203.0.113.5",
    "192.0.2.10", "198.51.100.7",
];

$counts = [];
foreach ($log as $ip) {
    $counts[$ip] = ($counts[$ip] ?? 0) + 1;
}
arsort($counts);
foreach ($counts as $ip => $n) {
    echo "$n $ip\n";
}
