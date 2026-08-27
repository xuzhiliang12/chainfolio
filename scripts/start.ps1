$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker was not found. Install and start Docker Desktop: https://www.docker.com/products/docker-desktop/'
}

docker info | Out-Null
New-Item -ItemType Directory -Force -Path '.\data' | Out-Null
docker compose up -d

$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $result = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/healthz' -TimeoutSec 2
    if ($result.ok) { $healthy = $true; break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $healthy) { throw 'Chainfolio started but did not pass its health check. Run: docker compose logs' }

Write-Host 'Chainfolio is ready: http://127.0.0.1:4173' -ForegroundColor Green
Start-Process 'http://127.0.0.1:4173'
