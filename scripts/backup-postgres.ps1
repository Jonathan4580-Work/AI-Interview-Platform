param(
  [Parameter(Mandatory = $true)]
  [string] $OutputPath
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
  throw "DATABASE_URL must be set for PostgreSQL backup."
}

$resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

pg_dump `
  --format=custom `
  --no-owner `
  --no-acl `
  --file=$resolvedOutput `
  $env:DATABASE_URL

Write-Output "PostgreSQL backup written to $resolvedOutput"
