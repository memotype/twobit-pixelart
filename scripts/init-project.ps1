param(
  [string]$Name,
  [string]$Branch = 'main',
  [string]$RemoteUrl,
  [string]$TargetPath,
  [string]$TemplateRef = 'main',
  [string]$TemplateRemote =
    'git@github.com:memotype/twobit-app-template.git'
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
  param([string[]]$git_args)
  & git @git_args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($git_args -join ' ') failed."
  }
}

$target_path = if ($TargetPath) { $TargetPath } else { Get-Location }
if (-not (Test-Path $target_path)) {
  New-Item -ItemType Directory -Path $target_path | Out-Null
}
$repo_root = Resolve-Path $target_path
$package_path = Join-Path $repo_root 'package.json'
$app_json_path = Join-Path $repo_root 'app.json'
$git_dir = Join-Path $repo_root '.git'
$repo_name = Split-Path $repo_root -Leaf
function Ensure-EmptyTarget {
  param([string]$target_dir)
  $entries = Get-ChildItem -Force -Path $target_dir
  if ($entries.Count -gt 0) {
    throw 'Target directory must be empty (no files).'
  }
}

function Seed-Template {
  param(
    [string]$target_dir,
    [string]$template_remote,
    [string]$template_ref
  )
  Ensure-EmptyTarget $target_dir
  Write-Host 'Seeding template files from temp clone...'
  $temp_dir = Join-Path $env:TEMP (
    "template-seed-$([guid]::NewGuid().ToString('N'))"
  )
  try {
    $temp_parent = Split-Path $temp_dir -Parent
    if (-not (Test-Path $temp_parent)) {
      New-Item -ItemType Directory -Path $temp_parent | Out-Null
    }
    $clone_args = @(
      'clone',
      '--depth',
      '1',
      '--branch',
      $template_ref,
      $template_remote,
      $temp_dir
    )
    Invoke-Git $clone_args

    $entries = Get-ChildItem -Force -Path $temp_dir |
      Where-Object { $_.Name -ne '.git' }
    foreach ($entry in $entries) {
      Copy-Item -Recurse -Force -Path $entry.FullName `
        -Destination $target_dir
    }
  } finally {
    if (Test-Path $temp_dir) {
      Remove-Item -Recurse -Force $temp_dir
    }
  }
}

Seed-Template $repo_root $TemplateRemote $TemplateRef

if (-not (Test-Path $package_path)) {
  throw 'package.json not found. Run from the repo root.'
}

if (-not (Test-Path (Join-Path $repo_root 'APP.md'))) {
  throw 'APP.md not found. Run this from the template repo.'
}

Set-Location $repo_root

Invoke-Git @('init')
Invoke-Git @('checkout', '-b', $Branch)

if ($RemoteUrl) {
  Invoke-Git @('remote', 'add', 'origin', $RemoteUrl)
}

if (-not $Name) {
  $Name = Read-Host 'Project name (npm package name)'
}

if (-not $Name -or $Name.Trim().Length -eq 0) {
  throw 'Project name is required.'
}

$package_json = Get-Content $package_path -Raw | ConvertFrom-Json
$package_json.name = $Name.Trim()
$package_json |
  ConvertTo-Json -Depth 10 |
  Set-Content -Encoding ascii $package_path

Write-Host "Updated package.json name to '$($package_json.name)'."

if (Test-Path $app_json_path) {
  $app_json = Get-Content $app_json_path -Raw | ConvertFrom-Json
  if ($app_json.expo) {
    $safe_name = $Name.Trim()
    $slug = $safe_name -replace '^@.*/', ''
    $slug = $slug.ToLower() -replace '[^a-z0-9-]', '-'
    $slug = $slug -replace '-{2,}', '-'
    $slug = $slug.Trim('-')

    $app_json.expo.name = $safe_name
    $app_json.expo.slug = $slug
    $app_json |
      ConvertTo-Json -Depth 10 |
      Set-Content -Encoding ascii $app_json_path

    Write-Host "Updated app.json name to '$safe_name'."
    Write-Host "Updated app.json slug to '$slug'."
  }
}

Write-Host 'Template detached.'
Write-Host 'Review README.md before first commit.'
Write-Host 'Run npm install to refresh package-lock.json.'
