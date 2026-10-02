<?php
// 每访问一次，往数据库里记一行，再报告一共访问了多少次。
// 数据库文件放在 /data 目录：compose.yaml 会在这里挂一个卷。
$db = new PDO('sqlite:/data/visits.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, at TEXT)');
$db->exec("INSERT INTO visits (at) VALUES (datetime('now'))");
$count = $db->query('SELECT COUNT(*) FROM visits')->fetchColumn();
echo "visit #$count\n";
