[CmdletBinding()]
param(
    [string]$ProjectRoot,
    [int]$Port = 3333,
    [switch]$RemoveData
)

$ErrorActionPreference = 'Stop'
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$sourceSkill = Join-Path $ProjectRoot 'skills\agent-treasury\SKILL.md'
$targetSkillDir = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex\skills\agent-treasury'
$targetSkill = Join-Path $targetSkillDir 'SKILL.md'

& (Join-Path $PSScriptRoot 'service-control.ps1') -Action stop -ProjectRoot $ProjectRoot -Port $Port

$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) {
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try { & $codex.Source mcp get agent-treasury *> $null; $mcpExists = $LASTEXITCODE -eq 0 }
    finally { $ErrorActionPreference = $savedPreference }
    if ($mcpExists) { & $codex.Source mcp remove agent-treasury | Out-Null }
}

if ((Test-Path -LiteralPath $sourceSkill) -and (Test-Path -LiteralPath $targetSkill)) {
    $sourceHash = (Get-FileHash -LiteralPath $sourceSkill -Algorithm SHA256).Hash
    $targetHash = (Get-FileHash -LiteralPath $targetSkill -Algorithm SHA256).Hash
    if ($sourceHash -eq $targetHash) {
        Remove-Item -LiteralPath $targetSkillDir -Recurse -Force
    } else {
        Write-Warning "Installed Skill differs from this release and was preserved at $targetSkillDir"
    }
}

if ($RemoveData) {
    $dataDir = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot 'data'))
    if (-not $dataDir.StartsWith($ProjectRoot + [System.IO.Path]::DirectorySeparatorChar)) {
        throw 'Refusing to remove data outside the project root.'
    }
    if (Test-Path -LiteralPath $dataDir) { Remove-Item -LiteralPath $dataDir -Recurse -Force }
}

Write-Host 'Agent Treasury integration removed. Project files and data were preserved unless -RemoveData was explicitly supplied.'
