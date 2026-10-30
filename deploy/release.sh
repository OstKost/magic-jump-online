#!/bin/sh
# Run on M0 inside /opt/magic-jump; the image must already exist locally.
set -eu
cd /opt/magic-jump
image=${1:?image tag required}
mkdir -p data backups
chown 10001:10001 data
previous=$(cat current-image 2>/dev/null || true)
if [ -f data/jump.sqlite ]; then
  docker run --rm --user 0 --entrypoint sqlite3 -v "$PWD/data:/data" -v "$PWD/backups:/backups" "$image" /data/jump.sqlite ".backup '/backups/pre-release-$(date -u +%Y%m%dT%H%M%S).sqlite'"
fi
if ! JUMP_IMAGE="$image" docker compose -f compose.yaml up -d --wait --wait-timeout 90; then
  if [ -n "$previous" ]; then JUMP_IMAGE="$previous" docker compose -f compose.yaml up -d --wait; fi
  exit 1
fi
if ! curl --fail --silent --retry 6 --retry-delay 2 http://127.0.0.1:18083/api/health >/dev/null; then
  if [ -n "$previous" ]; then JUMP_IMAGE="$previous" docker compose -f compose.yaml up -d --wait; fi
  exit 1
fi
printf '%s\n' "$image" > current-image
if [ -n "$previous" ]; then printf '%s\n' "$previous" > previous-image; fi
