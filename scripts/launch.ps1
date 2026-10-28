# Abre a janela do claude e o keep-awake. Imprime um JSON com os dois PIDs.
# Chamado pelo "relay start" (src/relay.ts). O ambiente ja chega limpo do Node.
param(
  [Parameter(Mandatory = $true)][string]$WorkDir,
  [Parameter(Mandatory = $true)][string]$Title,
  [Parameter(Mandatory = $true)][string]$SessionName,
  [switch]$Continue
)
$ErrorActionPreference = 'Stop'

# O PowerShell 5.1 junta os argumentos com espaco sem aspas: aspas manuais para caminhos com espaco.
function Q([string]$s) { '"' + $s + '"' }

$winArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Q (Join-Path $PSScriptRoot 'claude-window.ps1')),
  '-Title', (Q $Title), '-SessionName', (Q $SessionName))
if ($Continue) { $winArgs += '-Continue' }
$win = Start-Process -FilePath 'powershell.exe' -ArgumentList $winArgs -WorkingDirectory $WorkDir -PassThru

# O keep-awake vigia o PID da janela e se desliga sozinho quando ela fecha.
$awakeArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
  '-File', (Q (Join-Path $PSScriptRoot 'keepawake.ps1')), '-ParentPid', $win.Id)
$awake = Start-Process -FilePath 'powershell.exe' -ArgumentList $awakeArgs -WindowStyle Hidden -PassThru

[pscustomobject]@{ windowPid = $win.Id; keepAwakePid = $awake.Id } | ConvertTo-Json -Compress
