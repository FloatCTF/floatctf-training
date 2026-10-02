<?php
require __DIR__ . '/User.php';

$a = new User('carol');
$b = $a;
$b->promote();
echo $a, "\n";

$c = clone $a;
$c->promote();
echo $a, " / ", $c, "\n";
