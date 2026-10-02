<?php
$tools = ["curl", "nc", "dig"];
$tools[] = "sqlite3";
echo count($tools), " tools, first is ", $tools[0], "\n";

$ports = ["ssh" => 22, "http" => 80, "https" => 443];
$ports["dns"] = 53;
echo "http is on ", $ports["http"], "\n";

foreach ($ports as $name => $number) {
    echo "$name => $number\n";
}

var_dump(isset($ports["ftp"]));
echo implode(", ", array_keys($ports)), "\n";
