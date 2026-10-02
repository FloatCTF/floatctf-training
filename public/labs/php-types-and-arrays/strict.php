<?php
$allowed = ["1", "2", "3"];
var_dump(in_array(1, $allowed));
var_dump(in_array(1, $allowed, true));

$codes = explode(",", "200,404,500");
var_dump($codes);
var_dump(in_array(404, $codes, true));
var_dump(in_array("404", $codes, true));
