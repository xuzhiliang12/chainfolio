#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ -f data/state.json ]; then
  mkdir -p backups
  stamp="$(date +%Y%m%d-%H%M%S)"
  tar -czf "backups/chainfolio-data-$stamp.tar.gz" data
fi
docker compose pull
docker compose up -d
echo 'Chainfolio 已更新到最新稳定版。'
