# CWDGE

This repository includes a minimal static frontend and an Alloy-compatible Docker Compose setup.

## Run locally

```sh
docker compose -f docker-compose.alloy.yaml up -d
```

The frontend listens on `http://localhost:3000`, and its health endpoint is available at `http://localhost:3000/health`.

The Compose service uses host networking and does not publish Docker ports. Alloy proxies its preview at `http://localhost:8080` to port `3000`.
