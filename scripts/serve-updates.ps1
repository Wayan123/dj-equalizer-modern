param(
  [string]$ReleaseDir = "",
  [int]$Port = 18800
)

$ErrorActionPreference = "Stop"

function Resolve-NativePath {
  param([string]$Path)
  return [System.IO.Path]::GetFullPath((Resolve-Path $Path).ProviderPath)
}

if (-not $ReleaseDir) {
  $ReleaseDir = Join-Path $PSScriptRoot "..\release\windows"
}

if (-not (Test-Path $ReleaseDir)) {
  throw "Release directory not found: $ReleaseDir"
}

$root = Resolve-NativePath $ReleaseDir
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

function Get-ContentType {
  param([string]$Path)
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".json" { return "application/json" }
    ".exe" { return "application/octet-stream" }
    ".sig" { return "text/plain" }
    default { return "application/octet-stream" }
  }
}

try {
  $listener.Start()
  Write-Host "Serving updater files from $root"
  Write-Host "Endpoint: http://127.0.0.1:$Port/latest.json"
  Write-Host "Press Ctrl+C to stop."

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($relative)) {
      $relative = "latest.json"
    }

    $candidate = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $candidate.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $candidate)) {
      $context.Response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $context.Response.Close()
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($candidate)
    $context.Response.ContentType = Get-ContentType $candidate
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
