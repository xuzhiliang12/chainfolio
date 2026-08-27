$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')

$dataPath = Join-Path (Get-Location) 'data'
if (-not (Test-Path -LiteralPath $dataPath)) { throw 'The data directory was not found.' }
if (-not (Get-ChildItem -LiteralPath $dataPath -Force -ErrorAction SilentlyContinue)) { throw 'The data directory is empty.' }

$backupPath = Join-Path (Get-Location) 'backups'
New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $backupPath "chainfolio-data-$stamp.zip"
Compress-Archive -LiteralPath $dataPath -DestinationPath $archive -CompressionLevel Optimal
Write-Host "Backup created: $archive" -ForegroundColor Green
