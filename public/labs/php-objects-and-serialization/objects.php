<?php
require __DIR__ . '/User.php';

$alice = new User('alice');
$bob = new User('bob', 3);

$alice->promote();
echo $alice->name, " is at level ", $alice->level(), "\n";
echo $bob, "\n";
var_dump($alice instanceof User);
echo $alice->level, "\n";
