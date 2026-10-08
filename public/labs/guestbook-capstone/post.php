<?php
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit("只接受 POST\n");
}

$name = trim($_POST['name'] ?? '');
$body = trim($_POST['body'] ?? '');
// 浏览器表单里的 required、maxlength 可以被绕过，服务器必须自己再查一遍
// iconv_strlen 按字符数计算长度，一个汉字算一个
if ($name === '' || $body === '' || iconv_strlen($name, 'UTF-8') > 20 || iconv_strlen($body, 'UTF-8') > 200) {
    http_response_code(400);
    exit("名字和留言都不能为空，名字最多 20 个字，留言最多 200 个字\n");
}

// 预处理语句：SQL 的结构和用户的数据分开交给数据库
$stmt = db()->prepare('INSERT INTO messages (name, body) VALUES (?, ?)');
$stmt->execute([$name, $body]);

// 提交成功后跳回首页（303：用 GET 去访问新地址），刷新页面不会重复提交
header('Location: index.php', true, 303);
