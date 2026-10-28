# Mantém o Windows acordado enquanto o processo pai (relay) estiver vivo.
# Pede só "sistema ocupado" (sem flag de tela) e não mexe no plano de energia nem na tampa.
param(
  [Parameter(Mandatory = $true)][int]$ParentPid
)

Add-Type -Namespace Vrx -Name Power -MemberDefinition @'
[DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint esFlags);
'@

$ES_CONTINUOUS = [uint32]2147483648
$ES_SYSTEM_REQUIRED = [uint32]1

try {
  # SetThreadExecutionState vale por thread: esta thread precisa continuar viva.
  while ($true) {
    if (-not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
    [void][Vrx.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
    Start-Sleep -Seconds 15
  }
}
finally {
  # Libera: volta ao comportamento normal do Windows.
  [void][Vrx.Power]::SetThreadExecutionState($ES_CONTINUOUS)
}
