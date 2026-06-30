param(
  [Parameter(Mandatory = $true)]
  [string] $BackupPath,

  [switch] $Clean
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:RESTORE_DATABASE_URL)) {
  throw "RESTORE_DATABASE_URL must be set and must point to an isolated restore database."
}

$resolvedBackup = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($BackupPath)
if (-not (Test-Path -LiteralPath $resolvedBackup)) {
  throw "Backup file was not found: $resolvedBackup"
}

$restoreArgs = @(
  "--no-owner",
  "--no-acl",
  "--dbname=$env:RESTORE_DATABASE_URL"
)

if ($Clean) {
  $restoreArgs += "--clean"
  $restoreArgs += "--if-exists"
}

$restoreArgs += $resolvedBackup

pg_restore @restoreArgs

Write-Output "PostgreSQL backup restored from $resolvedBackup"
