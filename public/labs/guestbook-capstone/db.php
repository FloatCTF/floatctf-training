<?php
// 打开数据库，第一次运行时建表。数据库文件放在项目的 data 目录里。
function db(): PDO
{
    $pdo = new PDO('sqlite:' . __DIR__ . '/data/guestbook.db');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec("CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )");
    return $pdo;
}

// 任何来自用户的文字，输出到 HTML 之前都经过这个函数
function e(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}
