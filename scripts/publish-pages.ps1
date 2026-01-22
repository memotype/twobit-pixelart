param(
  [string]$AppName,
  [string]$StaticDir = 'static',
  [string]$Remote = 'git@github.com:memotype/gh-pages.git',
  [string]$Branch = 'gh-pages'
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
  param(
    [string[]]$git_args,
    [string]$workdir
  )
  & git -C $workdir @git_args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($git_args -join ' ') failed."
  }
}

function Resolve-AppName {
  param(
    [string]$explicit_name,
    [string]$repo_root
  )
  if ($explicit_name) {
    return $explicit_name
  }

  $app_json_path = Join-Path $repo_root 'app.json'
  if (Test-Path $app_json_path) {
    $app_json = Get-Content -Raw $app_json_path | ConvertFrom-Json
    if ($app_json.expo -and $app_json.expo.name) {
      return $app_json.expo.name
    }
  }

  $package_path = Join-Path $repo_root 'package.json'
  if (Test-Path $package_path) {
    $package_json = Get-Content -Raw $package_path | ConvertFrom-Json
    if ($package_json.name) {
      return $package_json.name
    }
  }

  return (Split-Path $repo_root -Leaf)
}

$repo_root = Resolve-Path (Get-Location)
$static_path = Join-Path $repo_root $StaticDir
if (-not (Test-Path $static_path)) {
  throw "Static directory not found: $static_path"
}

$raw_name = Resolve-AppName $AppName $repo_root
if (-not $raw_name -or $raw_name.Trim().Length -eq 0) {
  throw 'App name is required.'
}

$target_name = $raw_name -replace '^@.*/', ''
$target_name = $target_name -replace '[\\/]', '-'
$target_name = $target_name -replace '\s+', '-'
$target_name = $target_name -replace '-{2,}', '-'
$target_name = $target_name.Trim('-')
if (-not $target_name -or $target_name.Trim().Length -eq 0) {
  throw 'App name resolved to an empty path.'
}

$temp_dir = Join-Path $env:TEMP (
  "gh-pages-publish-$([guid]::NewGuid().ToString('N'))"
)

try {
  Invoke-Git @('clone', $Remote, $temp_dir) $repo_root
  try {
    Invoke-Git @('checkout', $Branch) $temp_dir
  } catch {
    Invoke-Git @('checkout', '-b', $Branch) $temp_dir
  }

  $target_dir = Join-Path $temp_dir $target_name
  if (Test-Path $target_dir) {
    Remove-Item -Recurse -Force $target_dir
  }
  New-Item -ItemType Directory -Path $target_dir | Out-Null

  $entries = Get-ChildItem -Force -Path $static_path
  if ($entries.Count -eq 0) {
    throw "Static directory is empty: $static_path"
  }

  foreach ($entry in $entries) {
    Copy-Item -Recurse -Force -Path $entry.FullName `
      -Destination $target_dir
  }

  Invoke-Git @('add', '-A') $temp_dir

  $status = & git -C $temp_dir status --porcelain
  if ($status.Trim().Length -eq 0) {
    Write-Host 'No changes to publish.'
    return
  }

  $message = "Publish static site for $target_name"
  Invoke-Git @('commit', '-m', $message) $temp_dir
  Invoke-Git @('push', 'origin', $Branch) $temp_dir
  Write-Host "Published to $Remote:$Branch/$target_name"
} finally {
  if (Test-Path $temp_dir) {
    Remove-Item -Recurse -Force $temp_dir
  }
}
