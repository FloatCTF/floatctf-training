<?php
$pages = [
    'about' => 'about.txt',
    'rules' => 'rules.txt',
];
$name = $_GET['name'] ?? 'about';

header('Content-Type: text/plain; charset=utf-8');
if (!isset($pages[$name])) {
    http_response_code(404);
    echo "No such page.\n";
    exit;
}
echo file_get_contents(__DIR__ . '/' . $pages[$name]);
