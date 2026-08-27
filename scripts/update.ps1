$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')

if (Test-Path -LiteralPath '.\data\state.json') { & "$PSScriptRoot\backup.ps1" }
docker compose pull
docker compose up -d

$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $result = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/healthz' -TimeoutSec 2
    if ($result.ok) { $healthy = $true; break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $healthy) { throw 'The updated service did not pass its health check. Your backup is in the backups directory.' }
Write-Host 'Chainfolio is updated to the latest stable version.' -ForegroundColor Green
