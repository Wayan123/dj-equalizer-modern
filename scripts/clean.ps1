param(
  [string]$RepoPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $RepoPath) {
  $RepoPath = Join-Path $PSScriptRoot ".."
}

$RepoPath = [System.IO.Path]::GetFullPath((Resolve-Path $RepoPath).ProviderPath)

Write-Host "Cleaning generated artifacts..."

$paths = @(
  (Join-Path $RepoPath "frontend\src-tauri\target"),
  (Join-Path $RepoPath "frontend\dist"),
  (Join-Path $RepoPath "frontend\.vite"),
  (Join-Path $RepoPath ".pytest_cache")
)

foreach ($path in $paths) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

Get-ChildItem -Path $RepoPath -Recurse -Directory -Filter "__pycache__" |
  ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
  }

Get-ChildItem -Path $RepoPath -Recurse -File |
  Where-Object { $_.Extension -in ".pyc", ".pyo", ".pyd" } |
  Remove-Item -Force

Write-Host "Clean complete."
