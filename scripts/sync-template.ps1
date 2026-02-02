param(
  [string]$TemplateRemote,
  [string]$TemplateRef
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

function Get-GitOutput {
  param(
    [string[]]$git_args,
    [string]$workdir
  )
  $output = & git -C $workdir @git_args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($git_args -join ' ') failed."
  }
  return $output
}

function Get-LatestTag {
  param([string]$repo_root)
  $tags = Get-GitOutput @(
    'tag',
    '--list',
    'v*',
    '--sort=-v:refname'
  ) $repo_root
  if (-not $tags -or $tags.Count -eq 0) {
    throw 'No version tags found.'
  }
  return $tags[0]
}

function Get-HeadTag {
  param([string]$repo_root)
  return (Get-GitOutput @('describe', '--tags', '--exact-match') $repo_root)
}

function Read-TemplateConfig {
  param([string]$config_path)

  if (-not (Test-Path $config_path)) {
    return [pscustomobject]@{}
  }

  $values = [pscustomobject]@{}
  foreach ($line in (Get-Content -LiteralPath $config_path)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }
    if ($trimmed -match '^(?<key>[A-Za-z0-9_]+)\s*:\s*(?<value>.+)$') {
      $key = $Matches.key
      $value = $Matches.value.Trim()
      if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Trim('"')
      } elseif ($value.StartsWith("'") -and $value.EndsWith("'")) {
        $value = $value.Trim("'")
      }
      $values | Add-Member -MemberType NoteProperty -Name $key -Value $value `
        -Force
    }
  }

  return $values
}

$repo_root = Resolve-Path (Get-Location)
$config_path = Join-Path $repo_root 'template-sync.yaml'
$config = Read-TemplateConfig $config_path
$template_remote = $TemplateRemote
if (-not $template_remote -or $template_remote.Trim().Length -eq 0) {
  if ($config.templateRemote) {
    $template_remote = $config.templateRemote
  } else {
    $template_remote = 'git@github.com:memotype/twobit-app-template.git'
  }
}
$template_ref = $TemplateRef
if (-not $template_ref -or $template_ref.Trim().Length -eq 0) {
  if ($config.templateRef) {
    $template_ref = $config.templateRef
  }
}
if (-not $template_ref -or $template_ref.Trim().Length -eq 0) {
  throw 'templateRef is required. Set template-sync.yaml or pass -TemplateRef.'
}
if ($template_ref.Trim().ToLowerInvariant() -eq 'main') {
  throw 'templateRef must be a tag, not "main".'
}
$local_template = Join-Path $repo_root '..\app-template'
$local_template_root = Resolve-Path -LiteralPath $local_template `
  -ErrorAction SilentlyContinue
$temp_dir = Join-Path $env:TEMP (
  "template-sync-$([guid]::NewGuid().ToString('N'))"
)

$whitelist = @(
  'CODEX.md',
  'REPO.md',
  'scripts/ensure-npm.cjs',
  'scripts/typecheck.cjs',
  'scripts/init-project.ps1',
  'scripts/sync-deps.ps1',
  'scripts/sync-template.ps1',
  'scripts/publish-pages.ps1',
  '.vscode/settings.json',
  '.gitattributes',
  'privacy_template.md',
  'codex-prompts.md',
  'template-sync.yaml'
)

try {
  if ($local_template_root) {
    $latest_tag = Get-LatestTag $local_template_root
    if ($template_ref -ne $latest_tag) {
      throw "templateRef must be latest tag: $latest_tag"
    }
    $head_tag = Get-HeadTag $local_template_root
    if ($head_tag -ne $latest_tag) {
      throw "Local app-template is not on latest tag: $latest_tag"
    }
    $template_root = $local_template_root
  } else {
    Invoke-Git @('clone', $template_remote, $temp_dir) $repo_root
    Invoke-Git @('checkout', $template_ref) $temp_dir
    $template_root = $temp_dir
  }

  $self_src = Join-Path $template_root 'scripts/sync-template.ps1'
  $self_dst = Join-Path $repo_root 'scripts/sync-template.ps1'
  if ((Test-Path $self_src) -and (Test-Path $self_dst)) {
    $src_hash = (Get-FileHash -Algorithm SHA256 $self_src).Hash
    $dst_hash = (Get-FileHash -Algorithm SHA256 $self_dst).Hash
    if ($src_hash -ne $dst_hash -and $env:CODEX_SYNC_RELAUNCH -ne '1') {
      Copy-Item -Force $self_src $self_dst
      $env:CODEX_SYNC_RELAUNCH = '1'
      & $self_dst -TemplateRemote $template_remote -TemplateRef $template_ref
      if ($LASTEXITCODE -ne 0) {
        throw 'Relaunched sync-template.ps1 failed.'
      }
      return
    }
  }

  foreach ($path in $whitelist) {
    $src = Join-Path $template_root $path
    $dst = Join-Path $repo_root $path
    if (-not (Test-Path $src)) {
      throw "Missing template file: $path"
    }
    $dst_dir = Split-Path $dst -Parent
    if (-not (Test-Path $dst_dir)) {
      New-Item -ItemType Directory -Path $dst_dir | Out-Null
    }
    Copy-Item -Force $src $dst
  }

  & powershell -File scripts/sync-deps.ps1 -Force -TemplatePath $template_root
  if ($LASTEXITCODE -ne 0) {
    throw 'sync-deps failed.'
  }

  & npm run doctor
  if ($LASTEXITCODE -ne 0) {
    throw 'npm run doctor failed.'
  }
} finally {
  if (-not $local_template_root -and (Test-Path $temp_dir)) {
    Remove-Item -Recurse -Force $temp_dir
  }
}
