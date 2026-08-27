$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
docker compose down
Write-Host 'Chainfolio stopped. Local data was not deleted.' -ForegroundColor Green
