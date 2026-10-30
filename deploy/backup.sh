#!/bin/sh
set -eu
cd /opt/magic-jump
mkdir -p backups
image=$(cat current-image)
docker run --rm --user 0 --entrypoint sqlite3 -v "$PWD/data:/data" -v "$PWD/backups:/backups" "$image" /data/jump.sqlite ".backup '/backups/daily-$(date -u +%Y%m%dT%H%M%S).sqlite'"
find backups -name 'daily-*.sqlite' -mtime +14 -delete
