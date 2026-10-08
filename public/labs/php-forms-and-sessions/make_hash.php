<?php
$hash = password_hash('kali123', PASSWORD_DEFAULT);
echo $hash, "\n";
var_dump(password_verify('kali123', $hash));
var_dump(password_verify('kali124', $hash));
