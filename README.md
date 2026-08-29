# CWDGE

This repository includes a PHP 8.3, SQLite-backed digital-card admin portal and an Alloy-compatible Docker Compose setup.

## Run locally

```sh
docker compose -f docker-compose.alloy.yaml up -d
```

The frontend listens on `http://localhost:3000`, and its health endpoint is available at `http://localhost:3000/health`.

Use the local demonstration account to enter the admin portal:

```text
Email: admin@admin.com
Password: 123456789
```

Card, customer, and payment data are stored persistently in `data/cwdge.db` and seeded on first startup.

The Compose service uses host networking and does not publish Docker ports. Alloy connects to the PHP service on port `3000`.
