# Roda o claude nesta janela. Quando o claude sai, a janela fecha e o relay percebe.
param(
  [Parameter(Mandatory = $true)][string]$Title,
  [Parameter(Mandatory = $true)][string]$SessionName,
  [switch]$Continue
)

$Host.UI.RawUI.WindowTitle = $Title
# Sem isto o claude troca o titulo da janela pelo assunto da conversa.
$env:CLAUDE_CODE_DISABLE_TERMINAL_TITLE = '1'

$claudeArgs = @('--remote-control', $SessionName, '--channels', 'plugin:telegram@claude-plugins-official', '--permission-mode', 'manual')
if ($Continue) { $claudeArgs += '--continue' }

& claude @claudeArgs
$code = $LASTEXITCODE

# Registro minimo da saida (codigo e hora), para o "relay status" e o vigia. Sem conteudo da conversa.
$dir = Join-Path $HOME '.vrx-relay'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
[pscustomobject]@{ exitCode = $code; at = (Get-Date).ToString('o') } |
  ConvertTo-Json -Compress | Set-Content -Encoding ASCII -Path (Join-Path $dir 'last-exit.json')
