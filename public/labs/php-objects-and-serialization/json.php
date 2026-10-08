<?php
require __DIR__ . '/User.php';

$data = ['port' => 80, 'tools' => ['curl', 'nc'], 'open' => true];
$text = json_encode($data);
echo $text, "\n";
var_dump(json_decode($text, true) === $data);

echo json_encode(new User('alice', 2)), "\n";
