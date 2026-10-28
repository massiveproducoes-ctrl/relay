// Regras do vigia, sem efeitos colaterais (a parte que abre janela e envia mensagem fica em watcher.ts).

export const RESTART_WINDOW_MS = 30 * 60_000; // olha as últimas quedas dentro de 30 min
export const MAX_RESTARTS = 5; // a 6ª queda seguida nessa janela: desiste
export const NOTICE_WINDOW_MS = 60 * 60_000;
export const MAX_NOTICES_PER_HOUR = 4;

export interface WatchMemory {
  restarts: number[]; // horários (ms) dos religamentos
  notices: number[]; // horários (ms) dos avisos enviados
  gaveUp: boolean;
}

export const emptyMemory = (): WatchMemory => ({ restarts: [], notices: [], gaveUp: false });

const recent = (times: number[], now: number, span: number) => times.filter((t) => now - t < span);

// Janela caída: religar ou desistir? Desistir evita um laço infinito se o claude morre ao abrir.
export function decideRestart(mem: WatchMemory, now: number): { action: 'restart'; attempt: number } | { action: 'giveup' } {
  const n = recent(mem.restarts, now, RESTART_WINDOW_MS).length;
  if (n >= MAX_RESTARTS) return { action: 'giveup' };
  return { action: 'restart', attempt: n + 1 };
}

// Aviso crítico (desistiu, não conseguiu religar) passa por cima do limite por hora:
// é raro e é o que o Pedro mais precisa ver.
export function canNotify(mem: WatchMemory, now: number, critical = false): boolean {
  return critical || recent(mem.notices, now, NOTICE_WINDOW_MS).length < MAX_NOTICES_PER_HOUR;
}

// Formato neutro, sem piada. Nada de pasta, token ou ID.
export function restartMessage(at: Date, attempt: number): string {
  return `⚠️ Relay: o claude caiu às ${hhmm(at)}. Religado (tentativa ${attempt} de ${MAX_RESTARTS}). A conversa foi retomada.`;
}

export function giveUpMessage(): string {
  return `‼️ Relay: o claude caiu ${MAX_RESTARTS} vezes em 30 min e o vigia parou de religar. Rode "relay start" no PC.`;
}

export function launchFailedMessage(): string {
  return '‼️ Relay: o claude caiu e não consegui religar. Rode "relay start" no PC.';
}

function hhmm(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
