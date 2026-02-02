param(
  [string]$TemplateRemote =
    'git@github.com:memotype/twobit-app-template.git',
  [string]$TemplateRef = 'main',
  [string]$TemplatePath,
  [string]$TargetPath,
  [switch]$Force,
  [switch]$SkipInstall,
  [switch]$SyncPackageManager,
  [switch]$SyncEngines
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

function Write-AsciiLf {
  param(
    [string]$path,
    [string]$content
  )
  $normalized = $content -replace "`r`n", "`n"
  [IO.File]::WriteAllText($path, $normalized, [Text.Encoding]::ASCII)
}

function Ensure-CleanRepo {
  param([string]$repo_root)
  if ($Force) {
    return
  }
  $status = & git -C $repo_root status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw 'git status failed. Use -Force to skip this check.'
  }
  if ($status) {
    throw 'Working tree is dirty. Commit or stash, or use -Force.'
  }
}

function Merge-Section {
  param(
    [pscustomobject]$target,
    [pscustomobject]$template,
    [string]$section,
    [ref]$added,
    [ref]$updated
  )

  $template_section = $template.$section
  if (-not $template_section) {
    return
  }

  if (-not $target.PSObject.Properties.Match($section)) {
    $target | Add-Member -MemberType NoteProperty -Name $section `
      -Value ([pscustomobject]@{})
  }

  $target_section = $target.$section
  foreach ($prop in $template_section.PSObject.Properties) {
    $name = $prop.Name
    $template_value = $prop.Value
    $exists = $target_section.PSObject.Properties.Match($name)
    if ($exists.Count -gt 0) {
      $current_value = $target_section.$name
      if ($current_value -ne $template_value) {
        $updated.Value += "${section}:${name} $current_value -> $template_value"
      }
      $target_section.$name = $template_value
    } else {
      $added.Value += "${section}:${name} $template_value"
      $target_section | Add-Member -MemberType NoteProperty -Name $name `
        -Value $template_value
    }
  }
}

$target_root = if ($TargetPath) { $TargetPath } else { Get-Location }
$target_root = Resolve-Path $target_root
$target_pkg = Join-Path $target_root 'package.json'

if (-not (Test-Path $target_pkg)) {
  throw 'package.json not found. Run from the repo root.'
}

Ensure-CleanRepo $target_root

$temp_dir = $null
try {
  if ($TemplatePath) {
    $template_root = Resolve-Path $TemplatePath
  } else {
    $local_template = Join-Path $target_root '..\app-template'
    if (Test-Path $local_template) {
      $template_root = Resolve-Path $local_template
    } else {
      $template_ref = $TemplateRef
      if (-not $template_ref -or $template_ref.Trim().Length -eq 0) {
        $template_ref = 'main'
      }
      $temp_dir = Join-Path $env:TEMP (
        "template-sync-deps-$([guid]::NewGuid().ToString('N'))"
      )
      Invoke-Git @(
        'clone',
        '--depth',
        '1',
        '--branch',
        $template_ref,
        $TemplateRemote,
        $temp_dir
      ) $target_root
      $template_root = $temp_dir
    }
  }

  $template_pkg = Join-Path $template_root 'package.json'
  if (-not (Test-Path $template_pkg)) {
    throw 'Template package.json not found.'
  }

  $target_json = Get-Content $target_pkg -Raw | ConvertFrom-Json
  $template_json = Get-Content $template_pkg -Raw | ConvertFrom-Json

  $added = @()
  $updated = @()
  Merge-Section $target_json $template_json 'dependencies' `
    ([ref]$added) ([ref]$updated)
  Merge-Section $target_json $template_json 'devDependencies' `
    ([ref]$added) ([ref]$updated)
  Merge-Section $target_json $template_json 'peerDependencies' `
    ([ref]$added) ([ref]$updated)
  Merge-Section $target_json $template_json 'optionalDependencies' `
    ([ref]$added) ([ref]$updated)

  if ($SyncPackageManager -and $template_json.packageManager) {
    $target_json.packageManager = $template_json.packageManager
  }
  if ($SyncEngines -and $template_json.engines) {
    $target_json.engines = $template_json.engines
  }

  $target_content = $target_json | ConvertTo-Json -Depth 10
  Write-AsciiLf $target_pkg $target_content

  Write-Host 'Dependency sync complete.'
  Write-Host "Added: $($added.Count), updated: $($updated.Count)."
  if ($added.Count -gt 0) {
    Write-Host 'Added:'
    $added | Sort-Object | ForEach-Object { Write-Host "  $_" }
  }
  if ($updated.Count -gt 0) {
    Write-Host 'Updated:'
    $updated | Sort-Object | ForEach-Object { Write-Host "  $_" }
  }

  if (-not $SkipInstall) {
    Write-Host 'Running npm install...'
    & npm install
    if ($LASTEXITCODE -ne 0) {
      throw 'npm install failed.'
    }
  } else {
    Write-Host 'Skipped npm install. Run it manually to refresh the lockfile.'
  }
} finally {
  if ($temp_dir -and (Test-Path $temp_dir)) {
    Remove-Item -Recurse -Force $temp_dir
  }
}
