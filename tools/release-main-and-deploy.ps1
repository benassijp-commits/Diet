param(
  [string]$Message = "release: publish main",
  [switch]$NoDeploy,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Resolve-Git {
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($git) { return $git.Source }

  $desktopRoot = Join-Path $env:LOCALAPPDATA "GitHubDesktop"
  $desktopGit = Get-ChildItem $desktopRoot -Filter git.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like "*\resources\app\git\cmd\git.exe" } |
    Sort-Object FullName -Descending |
    Select-Object -First 1

  if ($desktopGit) { return $desktopGit.FullName }
  throw "git.exe not found. Install Git or GitHub Desktop."
}

function Run-Git {
  & $script:Git @args
  if ($LASTEXITCODE -ne 0) { throw "git failed: $($args -join ' ')" }
}

function Current-Branch {
  $branch = & $script:Git branch --show-current
  if ($LASTEXITCODE -ne 0) { throw "Could not read current branch." }
  return $branch.Trim()
}

function Has-StagedChanges {
  & $script:Git diff --cached --quiet
  return $LASTEXITCODE -ne 0
}

function Build-App {
  $env:Path = "C:\Program Files\nodejs;" + $env:Path
  & "C:\Program Files\nodejs\npm.cmd" run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed." }
}

function Deploy-Hosting {
  $env:Path = "C:\Program Files\nodejs;C:\Users\Scion\AppData\Roaming\npm;" + $env:Path
  $env:XDG_CONFIG_HOME = "C:\Users\Scion\Documents\Diet\.firebase-cli-config"
  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\Scion\Documents\Diet\.secrets\firebase-service-account.json"
  $env:NODE_OPTIONS = "--require C:\Users\Scion\Documents\Diet\tools\firebase-gaxios-token-patch.cjs"

  & "C:\Users\Scion\AppData\Roaming\npm\firebase.cmd" deploy --only hosting --project dieta-e6bee --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "Firebase deploy failed." }
}

$script:Git = Resolve-Git
$startBranch = Current-Branch

Write-Host "Using git: $script:Git"
Write-Host "Starting branch: $startBranch"

Run-Git fetch origin
Build-App

Run-Git add -A
if (Has-StagedChanges) {
  Run-Git commit -m $Message
} else {
  Write-Host "No staged changes to commit."
}

$releaseCommit = (& $script:Git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "Could not resolve release commit." }

Run-Git switch main
Run-Git merge --ff-only $releaseCommit

Run-Git switch dev
Run-Git merge --ff-only main

if (-not $NoPush) {
  Run-Git push origin main dev
}

if (-not $NoDeploy) {
  Deploy-Hosting
}

Run-Git status --short --branch
Write-Host "Release complete: $releaseCommit"
