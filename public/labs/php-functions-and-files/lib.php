<?php
function format_size(int $bytes): string
{
    if ($bytes < 1024) {
        return $bytes . ' B';
    }
    return round($bytes / 1024, 1) . ' KB';
}

function greet(string $name, string $greeting = 'Hello'): string
{
    return "$greeting, $name!";
}
