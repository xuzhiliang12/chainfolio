#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
command -v docker >/dev/null 2>&1 || { echo '请先安装 Docker。' >&2; exit 1; }
docker info >/dev/null
mkdir -p data
docker compose up -d
echo 'Chainfolio 已启动：http://127.0.0.1:4173'
