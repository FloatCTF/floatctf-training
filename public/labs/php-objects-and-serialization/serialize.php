<?php
require __DIR__ . '/User.php';

$data = ['port' => 80, 'tools' => ['curl', 'nc'], 'open' => true];
$text = serialize($data);
echo $text, "\n";
var_dump(unserialize($text) === $data);

$user = new User('alice', 2);
$saved = serialize($user);
echo strlen($saved), " bytes\n";
echo str_replace("\0", '\0', $saved), "\n";

$back = unserialize($saved);
echo $back, "\n";
var_dump($back === $user, $back == $user);
