<#
PowerShell backup script for repository.
Usage: run from repository root in PowerShell (not an elevated shell required):
  PS> .\scripts\backup_repo.ps1

What it does:
- Creates a timestamped destination folder next to the repo (sibling to repo)
- Mirrors the working tree into the destination using robocopy
- Excludes large build dirs (node_modules, .next, dist) to speed things up
- Keeps .git in the backup so git metadata is preserved
#>

# Determine working directory and timestamp
$repoRoot = Resolve-Path -Path "." | Select-Object -ExpandProperty Path
$t = Get-Date -Format "yyyyMMdd-HHmmss"
$parent = Split-Path -Parent $repoRoot
$repoName = Split-Path -Leaf $repoRoot
$dest = Join-Path $parent "$($repoName)-backup-$t"

Write-Host "Creating backup of repo: $repoRoot" -ForegroundColor Cyan
Write-Host "Destination: $dest" -ForegroundColor Cyan

# Create destination
if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest | Out-Null
}

# Exclude common heavy folders
$excludes = @('node_modules', '.next', 'dist', 'venv', '__pycache__')
$excludeArgs = $excludes | ForEach-Object { "/XD `"$_`"" } | Out-String
$excludeArgs = $excludeArgs -replace "\r?\n"," "

# Build robocopy command
$robocopyArgs = "`"$repoRoot`" `"$dest`" /MIR /COPYALL /R:3 /W:5 /NFL /NDL /NJH /NJS $excludeArgs"
Write-Host "Running robocopy..." -ForegroundColor Yellow

# Execute
$rc = & robocopy $repoRoot $dest /MIR /COPYALL /R:3 /W:5 /NFL /NDL /NJH /NJS /XD $excludes

# robocopy returns exit codes where 0 and 1 are success-ish; test for >=8 as failure
$exitCode = $LASTEXITCODE
if ($exitCode -ge 8) {
    Write-Host "Robocopy failed with exit code $exitCode" -ForegroundColor Red
    exit $exitCode
}

# Show summary of created files (top 20)
Write-Host "Backup complete. Sample files in backup:" -ForegroundColor Green
Get-ChildItem -Path $dest -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName, Length -First 20 | Format-Table -AutoSize
Write-Host "To inspect the backup directory: `n    explorer `"$dest`"`n" -ForegroundColor Cyan
Write-Host "When ready, run the git inspection commands I suggested (git status, git reflog, etc.)." -ForegroundColor Cyan

exit 0
