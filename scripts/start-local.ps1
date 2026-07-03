$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found on PATH."
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Require-Command node
Require-Command npm

if (-not (Test-Path ".env.local")) {
  throw ".env.local is missing. Copy .env.local.example to .env.local and fill local secrets first."
}

$mysqlAdmin = "C:\xampp\mysql\bin\mysqladmin.exe"
if (Test-Path $mysqlAdmin) {
  & $mysqlAdmin ping -h 127.0.0.1 -P 3306 | Out-Null
} else {
  Write-Warning "XAMPP mysqladmin was not found at $mysqlAdmin. Skipping MySQL ping."
}

npm run prisma:generate
npm run db:local:migrate

Start-Process powershell -WindowStyle Normal -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$root'; npm run dev"
)

Start-Process powershell -WindowStyle Normal -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$root'; npm run worker:local"
)

Write-Host ""
Write-Host "Aptly local app:      http://localhost:3000"
Write-Host "phpMyAdmin:          http://localhost/phpmyadmin"
Write-Host "Seed demo data:      npm run db:local:seed"
Write-Host "Storage smoke:       npm run local:storage-smoke"
Write-Host "SMTP smoke:          npm run local:smtp-smoke"
Write-Host "OpenAI smoke:        npm run local:openai-smoke"
Write-Host ""
