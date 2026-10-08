<?php
header('Content-Type: text/plain; charset=utf-8');
echo "method: ", $_SERVER['REQUEST_METHOD'], "\n";
echo "path:   ", $_SERVER['REQUEST_URI'], "\n";
echo "query:  ";
var_dump($_GET);
