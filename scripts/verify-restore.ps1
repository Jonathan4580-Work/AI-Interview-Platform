$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
  throw "DATABASE_URL must point to the isolated restored database before verification."
}

npm.cmd run prisma:validate
npm.cmd run test -- tests/modules/phase11-tenant-isolation.test.ts tests/modules/audit.test.ts

Write-Output "Restore verification checks completed successfully."
