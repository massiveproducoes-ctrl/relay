import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// Estado do relay, gravado em ~/.vrx-relay/state.json.
// Guarda só PIDs, horários e a pasta. Nada de token, ID do Telegram ou conteúdo de conversa.
export interface RelayState {
  version: 1;
  folder: string;
  // Processo da janela "VRX RELAY — NÃO FECHAR". Ele vive enquanto o claude vive.
  windowPid: number;
  // Nome do executável, para não confundir com um PID reaproveitado pelo Windows.
  windowImage: string;
  keepAwakePid: number | null;
  // Vigia (próxima fase). null enquanto não existir.
  watcherPid: number | null;
  startedAt: string;
  continued: boolean;
  stoppedAt: string | null;
}

export function stateDir(home: string = homedir()): string {
  return join(home, '.vrx-relay');
}

export function statePath(home: string = homedir()): string {
  return join(stateDir(home), 'state.json');
}

function isPid(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

export function isState(v: unknown): v is RelayState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    s.version === 1 &&
    typeof s.folder === 'string' &&
    isPid(s.windowPid) &&
    typeof s.windowImage === 'string' &&
    (s.keepAwakePid === null || isPid(s.keepAwakePid)) &&
    (s.watcherPid === null || isPid(s.watcherPid)) &&
    typeof s.startedAt === 'string' &&
    typeof s.continued === 'boolean' &&
    (s.stoppedAt === null || typeof s.stoppedAt === 'string')
  );
}

// Arquivo ausente, quebrado ou de outro formato: trata como "relay não iniciado".
export function readState(file: string = statePath()): RelayState | null {
  if (!existsSync(file)) return null;
  try {
    const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return isState(data) ? data : null;
  } catch {
    return null;
  }
}

// Grava num arquivo temporário e troca de uma vez, para nunca deixar um JSON pela metade.
export function writeState(state: RelayState, file: string = statePath()): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  renameSync(tmp, file);
}

export interface LastExit {
  exitCode: number | null;
  at: string;
}

// Escrito pela janela do claude quando ele sai (scripts/claude-window.ps1).
export function readLastExit(home: string = homedir()): LastExit | null {
  const file = join(stateDir(home), 'last-exit.json');
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.at !== 'string') return null;
    return { exitCode: typeof data.exitCode === 'number' ? data.exitCode : null, at: data.at };
  } catch {
    return null;
  }
}
