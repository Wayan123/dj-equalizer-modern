param(
  [string]$RepoPath = "",
  [int]$FrontendPort = 5173,
  [int]$BackendPort = 8800,
  [string]$LogDir = "/tmp/modern-audio-enhancer",
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

try {
  if ($env:TEMP) {
    Set-Location -Path $env:TEMP
  } elseif ($env:SystemRoot) {
    Set-Location -Path $env:SystemRoot
  }
} catch {
  # Keep going; this only prevents WSL cwd translation warnings for UNC launches.
}

$LoopbackFrontendUrl = "http://127.0.0.1:$FrontendPort"
$LoopbackBackendHealthUrl = "http://127.0.0.1:$BackendPort/api/health"
$BackendLogPath = "$LogDir/backend.log"
$FrontendLogPath = "$LogDir/frontend.log"

function Test-Endpoint {
  param([string]$Url)

  try {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Get-WslIpAddress {
  try {
    $output = & wsl.exe -e bash -lc "hostname -I | awk '{print `$1}'"
    $ip = ($output | Select-Object -First 1).Trim()
    if ($ip -match "^\d+\.\d+\.\d+\.\d+$") {
      return $ip
    }
  } catch {
    return $null
  }

  return $null
}

function Get-ReadyUrl {
  param([string[]]$Urls)

  foreach ($url in $Urls) {
    if (Test-Endpoint $url) {
      return $url
    }
  }

  return $null
}

function Get-WslLogTail {
  param(
    [string]$Path,
    [int]$Lines = 80
  )

  try {
    $escaped = $Path.Replace("'", "'\''")
    $output = & wsl.exe -e bash -lc "tail -n $Lines '$escaped' 2>/dev/null"
    if ($LASTEXITCODE -eq 0 -and $output) {
      return ($output -join "`n")
    }
  } catch {
    return ""
  }

  return ""
}

function Find-AppBrowser {
  $commands = @("msedge.exe", "chrome.exe")
  foreach ($command in $commands) {
    $found = Get-Command $command -ErrorAction SilentlyContinue
    if ($found) {
      return $found.Source
    }
  }

  $paths = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
  )

  foreach ($path in $paths) {
    if (Test-Path $path) {
      return $path
    }
  }

  return $null
}

$ResolvedRepoPath = $null

function ConvertTo-BashSingleQuoted {
  param([string]$Value)

  return "'" + $Value.Replace("'", "'\''") + "'"
}

function Get-WslRepoPath {
  if ($script:ResolvedRepoPath) {
    return $script:ResolvedRepoPath
  }

  if (-not $RepoPath) {
    $RepoPath = Join-Path $PSScriptRoot ".."
  }

  $nativePath = Resolve-NativePath $RepoPath
  $output = & wsl.exe -e wslpath -a $nativePath
  if ($LASTEXITCODE -ne 0 -or -not $output) {
    throw "Failed to resolve WSL repo path: $RepoPath"
  }

  $script:ResolvedRepoPath = ($output | Select-Object -First 1).Trim()
  return $script:ResolvedRepoPath
}

function Start-WslService {
  param(
    [string]$Name,
    [int]$Port,
    [string]$LogPath
  )

  $repoPath = Get-WslRepoPath
  $serviceScript = "$repoPath/scripts/windows-service.sh"

  Write-Host "Starting $Name in WSL..."
  Write-Host "  Log: $LogPath"
  $process = Start-Process -FilePath "wsl.exe" -ArgumentList @(
    "-e",
    "bash",
    $serviceScript,
    "--run-logged",
    $Name,
    [string]$Port,
    $LogPath
  ) -WindowStyle Hidden -PassThru

  if (-not $process) {
    throw "Failed to launch $Name in WSL."
  }

  Write-Host "  Windows wsl.exe PID: $($process.Id)"
}

function Wait-Endpoint {
  param(
    [string]$Name,
    [string[]]$Urls,
    [int]$TimeoutSeconds = 90,
    [string]$LogPath = ""
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $readyUrl = Get-ReadyUrl -Urls $Urls
    if ($readyUrl) {
      Write-Host "$Name ready: $readyUrl"
      return $readyUrl
    }
    Start-Sleep -Milliseconds 700
  }

  $message = "$Name did not become ready at: $($Urls -join ', ')"
  if ($LogPath) {
    $tail = Get-WslLogTail -Path $LogPath
    if ($tail) {
      $message = "$message`n`nLast $Name log lines ($LogPath):`n$tail"
    } else {
      $message = "$message`n`nNo $Name log output found at $LogPath"
    }
  }
  throw $message
}

$browser = Find-AppBrowser
$wslIp = Get-WslIpAddress
$FrontendUrls = @($LoopbackFrontendUrl)
$BackendHealthUrls = @($LoopbackBackendHealthUrl)

if ($wslIp) {
  $FrontendUrls += "http://${wslIp}:$FrontendPort"
  $BackendHealthUrls += "http://${wslIp}:$BackendPort/api/health"
}

if ($CheckOnly) {
  $browserText = $browser
  if (-not $browserText) {
    $browserText = "default browser fallback"
  }

  Write-Host "Frontend URL:       $(Get-ReadyUrl -Urls $FrontendUrls)"
  Write-Host "Backend health URL: $(Get-ReadyUrl -Urls $BackendHealthUrls)"
  Write-Host "WSL IP fallback:    $wslIp"
  Write-Host "App browser:        $browserText"
  Write-Host "Backend log:        $BackendLogPath"
  Write-Host "Frontend log:       $FrontendLogPath"
  exit 0
}

$frontendReadyUrl = Get-ReadyUrl -Urls $FrontendUrls
$backendReadyUrl = Get-ReadyUrl -Urls $BackendHealthUrls

if (-not $backendReadyUrl) {
  Start-WslService -Name "backend" -Port $BackendPort -LogPath $BackendLogPath
}

if (-not $frontendReadyUrl) {
  Start-WslService -Name "frontend" -Port $FrontendPort -LogPath $FrontendLogPath
}

$backendReadyUrl = Wait-Endpoint -Name "Backend" -Urls $BackendHealthUrls -LogPath $BackendLogPath
$frontendReadyUrl = Wait-Endpoint -Name "Frontend" -Urls $FrontendUrls -LogPath $FrontendLogPath

Write-Host "Opening Modern Audio Enhancer in the Windows audio session..."
if ($frontendReadyUrl -notlike "http://127.0.0.1:*") {
  Write-Host "Warning: using WSL IP fallback. Set Windows default output to the virtual device if browser output selection is unavailable."
}

if ($browser) {
  Start-Process -FilePath $browser -ArgumentList @(
    "--app=$frontendReadyUrl",
    "--new-window",
    "--window-size=1280,800",
    "--no-first-run"
  ) | Out-Null
} else {
  Start-Process $frontendReadyUrl | Out-Null
}

Write-Host "Done. Use Settings > Audio Output inside the app to pick the virtual cable if needed."
