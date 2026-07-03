$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nodeProcesses = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -match "^node(\.exe)?$" -and
    $_.CommandLine -like "*AI-Interview-Platform*" -and
    ($_.CommandLine -like "*next dev*" -or $_.CommandLine -like "*src/workers/local.ts*")
  }

foreach ($process in $nodeProcesses) {
  Write-Host "Stopping Aptly local process $($process.ProcessId)"
  Stop-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
}

if ($nodeProcesses.Count -eq 0) {
  Write-Host "No Aptly local web or worker processes were found for $root."
}
