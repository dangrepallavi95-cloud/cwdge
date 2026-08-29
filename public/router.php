<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$file = __DIR__ . $path;

// Let the built-in server return existing assets directly; all application
// routes are handled by the PHP front controller.
if ($path !== '/' && is_file($file)) {
    return false;
}

require __DIR__ . '/index.php';
