# Production: jump.ost.wang

The Go service serves the Vite build and API from one origin. M0 runs Docker Compose in `/opt/magic-jump`, bound only to `127.0.0.1:18083`. OpenResty terminates HTTPS using `/etc/letsencrypt/live/jump.ost.wang/` and `/opt/om/nginx/conf/sites/magic-jump.conf`.

## Local development

Run `npm ci`, then `cd server && go run .` and `npm run dev` in separate terminals. Vite proxies `/api` and WebSocket to port 8080. Without the API, local play works but cannot submit ranked results. Local rules run at fixed 20 ms steps; the server replays the input journal using the same seed. `node --experimental-strip-types scripts/generate-rules-fixture.ts` refreshes the shared rules fixture after intentional rule changes.

## CI/CD

`.github/workflows/ci.yml` checks client tests/build, the cross-language fixture, Go race tests/vet and a four-browser smoke test. Successful main pushes build `jump:<commit SHA>`, upload the image to M0, back up SQLite and deploy. HTTPS and authenticated WebSocket checks follow deployment; failures restore the previous image. Production deploys are serialized.

GitHub repository secrets: `M0_SSH_KEY` (dedicated deployment SSH key) and `M0_KNOWN_HOSTS` (verified M0 host key). The production environment uses these repository secrets. No credentials belong in the source tree. Rotate by replacing the matching public key in `/root/.ssh/authorized_keys` and the GitHub secret. CI requires Docker access on M0.

## Data and recovery

`data/jump.sqlite` and its WAL files persist across container updates. `backup.sh` uses SQLite's online backup command; cron runs it daily at 03:15 server time, retaining daily copies for 14 days. Every deployment also makes a timestamped pre-release backup.

Manual rollback: `cd /opt/magic-jump && sh release.sh "$(cat previous-image)"`. Images must remain on the server. No destructive schema migrations are currently used; future incompatible migrations require explicit recovery instructions before deployment.

Restore a database: stop the app (`docker compose -f compose.yaml stop`), copy a selected backup to `data/jump.sqlite`, remove only the stopped database's old `jump.sqlite-wal` and `jump.sqlite-shm`, restore ownership to `10001:10001`, and start with `JUMP_IMAGE=$(cat current-image) docker compose -f compose.yaml up -d --wait`. Verify `/api/health` and `/api/ranking`. Active rooms and unfinished ranked attempts are held in memory and end on a server restart; completed results persist.

Room sessions have a 30-second reconnect window and a two-hour lifetime. Completed room winners can enter a name for ten minutes. Local ranked journeys must finish within two hours. Names are stored only after a verified winner submits them. Rankings switch weeks at Monday 00:00 Europe/Moscow; old weeks remain in SQLite. Shared device/NAT clients are limited to 120 mutating HTTP requests per minute.
