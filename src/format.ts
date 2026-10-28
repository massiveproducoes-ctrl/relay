import type { LastExit, RelayState } from './state.ts';

export interface Liveness {
  window: boolean;
  keepAwake: boolean;
  watcher: boolean;
}

export function formatDuration(ms: number): string {
  if (!(ms >= 60_000)) return 'menos de 1 min';
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  if (m && !d) parts.push(`${m} min`);
  return parts.join(' ');
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const RED = '\x1b[1;31m';
const RESET = '\x1b[0m';

// Texto do "relay status". code: 0 tudo certo, 1 algo parado, 2 relay não está ligado.
export function formatStatus(
  state: RelayState | null,
  live: Liveness,
  now: Date,
  lastExit: LastExit | null = null,
  color = false,
): { text: string; code: number } {
  const alarm = (s: string) => (color ? `${RED}${s}${RESET}` : s);

  if (!state) return { code: 2, text: 'Relay não iniciado.\nUse: relay start <pasta>' };

  const lines = ['VRX Relay', `  Pasta:       ${state.folder}`];

  if (state.stoppedAt) {
    lines.push(`  Situação:    parado pelo "relay stop" em ${formatWhen(state.stoppedAt)}`);
    return { code: 2, text: lines.join('\n') };
  }

  let ok = true;
  const since = formatDuration(now.getTime() - new Date(state.startedAt).getTime());

  if (live.window) {
    lines.push(`  Claude:      ✅ rodando há ${since} (janela PID ${state.windowPid})`);
  } else {
    ok = false;
    lines.push('  Claude:      ' + alarm('❌ CAIU — a janela do claude não existe mais'));
    if (lastExit && new Date(lastExit.at).getTime() >= new Date(state.startedAt).getTime()) {
      const code = lastExit.exitCode === null ? 'desconhecido' : String(lastExit.exitCode);
      lines.push(`               saiu em ${formatWhen(lastExit.at)} (código ${code})`);
    } else {
      lines.push('               janela fechada ou processo encerrado à força');
    }
  }

  if (live.keepAwake) {
    lines.push('  Keep-awake:  ✅ ligado');
  } else {
    ok = false;
    lines.push('  Keep-awake:  ' + alarm('⚠️ DESLIGADO — o PC pode suspender'));
  }

  if (live.watcher) {
    lines.push('  Vigia:       ✅ rodando');
  } else {
    ok = false;
    lines.push('  Vigia:       ' + alarm('‼️ VIGIA PARADO — se o claude cair, ninguém reinicia nem avisa'));
    lines.push('               rode "relay start" para ligar de novo');
  }

  lines.push(`  Conversa:    ${state.continued ? 'retomou a anterior (--continue)' : 'nova'}`);
  return { code: ok ? 0 : 1, text: lines.join('\n') };
}
