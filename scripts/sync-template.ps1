param(
  [string]$TemplateRemote =
    'git@github.com:memotype/twobit-app-template.git',
  [string]$TemplateRef = 'main'
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

$repo_root = Resolve-Path (Get-Location)
$local_template = Join-Path $repo_root '..\app-template'
$local_template_root = Resolve-Path -LiteralPath $local_template `
  -ErrorAction SilentlyContinue
$template_ref = $TemplateRef
if (-not $template_ref -or $template_ref.Trim().Length -eq 0) {
  $template_ref = 'main'
}
$temp_dir = Join-Path $env:TEMP (
  "template-sync-$([guid]::NewGuid().ToString('N'))"
)

$whitelist = @(
  'CODEX.md',
  'REPO.md',
  'scripts/ensure-npm.cjs',
  'scripts/typecheck.cjs',
  'scripts/init-project.ps1',
  'scripts/sync-template.ps1',
  'scripts/publish-pages.ps1',
  '.vscode/settings.json',
  'privacy_template.md',
  'codex-prompts.md'
)

try {
  if ($local_template_root) {
    $template_root = $local_template_root
  } else {
    Invoke-Git @('clone', $TemplateRemote, $temp_dir) $repo_root
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
      & $self_dst -TemplateRemote $TemplateRemote -TemplateRef $template_ref
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
} finally {
  if (-not $local_template_root -and (Test-Path $temp_dir)) {
    Remove-Item -Recurse -Force $temp_dir
  }
}
