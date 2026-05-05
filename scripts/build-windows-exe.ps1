param(
  [string]$RepoPath = "",
  [string]$ReleaseDir = "",
  [int]$UpdatePort = 18800,
  [string]$SigningKeyPath = (Join-Path $env:USERPROFILE ".tauri\modern-audio-enhancer.key"),
  [switch]$PreflightOnly
)

$ErrorActionPreference = "Stop"

function Resolve-NativePath {
  param([string]$Path)
  return [System.IO.Path]::GetFullPath((Resolve-Path $Path).ProviderPath)
}

function Find-CommandPath {
  param([string]$Name)
  $found = Get-Command $Name -ErrorAction SilentlyContinue
  if ($found) { return $found.Source }
  return $null
}

function Require-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )
  $path = Find-CommandPath $Name
  if ($path) {
    Write-Host "OK $Name -> $path"
    return $path
  }
  throw "Missing $Name. $InstallHint"
}

function Get-WslSigningKey {
  try {
    $key = & wsl.exe -e bash -lc "cat ~/.tauri/modern-audio-enhancer.key 2>/dev/null"
    if ($LASTEXITCODE -eq 0 -and $key) {
      return ($key -join "`n").Trim()
    }
  } catch {
    return $null
  }
  return $null
}

function Get-SigningKey {
  if ($env:TAURI_SIGNING_PRIVATE_KEY) {
    return $env:TAURI_SIGNING_PRIVATE_KEY
  }

  if ($env:TAURI_SIGNING_PRIVATE_KEY_PATH -and (Test-Path $env:TAURI_SIGNING_PRIVATE_KEY_PATH)) {
    return (Get-Content -Raw $env:TAURI_SIGNING_PRIVATE_KEY_PATH).Trim()
  }

  if (Test-Path $SigningKeyPath) {
    return (Get-Content -Raw $SigningKeyPath).Trim()
  }

  $wslKey = Get-WslSigningKey
  if ($wslKey) {
    return $wslKey
  }

  throw "Missing Tauri updater signing key. Generate it with: cd frontend; npx tauri signer generate --ci -w `"$SigningKeyPath`""
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Script
  )
  Write-Host ""
  Write-Host "== $Name =="
  & $Script
}

if (-not $RepoPath) {
  $RepoPath = Join-Path $PSScriptRoot ".."
}

$RepoPath = Resolve-NativePath $RepoPath
if (-not $ReleaseDir) {
  $ReleaseDir = Join-Path $RepoPath "release\windows"
}

$FrontendPath = Join-Path $RepoPath "frontend"
$BundlePath = Join-Path $FrontendPath "src-tauri\target\release\bundle\nsis"
$OverlayConfig = "src-tauri/tauri.local-updater.conf.json"

Write-Host "Modern Audio Enhancer Windows EXE preflight"
Write-Host "Repo: $RepoPath"

$node = Require-Command "node.exe" "Install Node.js LTS for Windows."
$npm = Require-Command "npm.cmd" "Install Node.js LTS for Windows."
$cargo = Require-Command "cargo.exe" "Install Rust MSVC with rustup."
$rustc = Require-Command "rustc.exe" "Install Rust MSVC with rustup."
$makensis = Require-Command "makensis.exe" "Install NSIS and add it to PATH."

Write-Host "OK cargo -> $cargo"
Write-Host "OK rustc -> $rustc"
Write-Host "OK makensis -> $makensis"

if ($PreflightOnly) {
  Write-Host "Preflight OK."
  exit 0
}

$signingKey = Get-SigningKey
$env:TAURI_SIGNING_PRIVATE_KEY = $signingKey
if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
}

Invoke-Step "Sync version" {
  Push-Location $RepoPath
  try {
    & $node "scripts\sync-version.mjs"
  } finally {
    Pop-Location
  }
}

$package = Get-Content -Raw (Join-Path $FrontendPath "package.json") | ConvertFrom-Json
$version = $package.version

Invoke-Step "Build NSIS setup EXE" {
  Push-Location $FrontendPath
  try {
    & $npm run tauri:build -- --bundles nsis --config $OverlayConfig
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $BundlePath)) {
  throw "NSIS bundle folder not found: $BundlePath"
}

$exe = Get-ChildItem -Path $BundlePath -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $exe) {
  throw "No NSIS .exe artifact found in $BundlePath"
}

$sig = Get-Item "$($exe.FullName).sig" -ErrorAction SilentlyContinue
if (-not $sig) {
  $sig = Get-ChildItem -Path $BundlePath -Filter "*.sig" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $sig) {
  throw "No updater signature .sig found for $($exe.Name). Check bundle.createUpdaterArtifacts and signing key."
}

New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
$releaseExe = Join-Path $ReleaseDir $exe.Name
$releaseSig = Join-Path $ReleaseDir $sig.Name
Copy-Item -Force $exe.FullName $releaseExe
Copy-Item -Force $sig.FullName $releaseSig

$signature = (Get-Content -Raw $releaseSig).Trim()
$escapedName = [System.Uri]::EscapeDataString((Split-Path $releaseExe -Leaf))
$latest = [ordered]@{
  version = $version
  notes = "Modern Audio Enhancer $version internal update"
  pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url = "http://127.0.0.1:$UpdatePort/$escapedName"
    }
  }
}

$latestPath = Join-Path $ReleaseDir "latest.json"
$latest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $latestPath

Write-Host ""
Write-Host "Windows release ready:"
Write-Host "  EXE:    $releaseExe"
Write-Host "  SIG:    $releaseSig"
Write-Host "  UPDATE: $latestPath"
Write-Host "Serve with: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serve-updates.ps1"
