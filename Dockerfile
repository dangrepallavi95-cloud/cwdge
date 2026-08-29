FROM php:8.3-cli-bookworm

WORKDIR /workspace
CMD ["php", "-S", "0.0.0.0:3000", "-t", "public", "public/router.php"]
