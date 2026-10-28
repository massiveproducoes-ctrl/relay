import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { cleanEnv } from './env.ts';

const ROOT = join(import.meta.dirname, '..');
export const LAUNCHER = join(ROOT, 'scripts', 'launch.ps1');
export const WINDOW_TITLE = 'VRX RELAY — NÃO FECHAR';
export const SESSION_NAME = 'relay-vrx';

export interface OpenedWindow {
  windowPid: number;
  keepAwakePid: number | null;
  // Só os NOMES das variáveis tiradas do ambiente do processo filho.
  removed: string[];
}

// Abre a janela do claude + keep-awake. Usado pelo "relay start" e pelo vigia.
// Lança Error com mensagem curta se não conseguir.
export function openWindow(folder: string, useContinue: boolean): OpenedWindow {
  // As variáveis que desviariam o claude para outro provedor saem só do processo filho.
  const { env, removed } = cleanEnv();
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', LAUNCHER,
    '-WorkDir', folder, '-Title', WINDOW_TITLE, '-SessionName', SESSION_NAME];
  if (useContinue) args.push('-Continue');

  let out: string;
  try {
    out = execFileSync('powershell.exe', args, { env, encoding: 'utf8', windowsHide: true });
  } catch (err) {
    throw new Error(`Não consegui abrir a janela do claude: ${(err as Error).message.split('\n')[0]}`);
  }
  const lastLine = out.trim().split(/\r?\n/).pop() ?? '';
  let pids: { windowPid?: unknown; keepAwakePid?: unknown };
  try {
    pids = JSON.parse(lastLine);
  } catch {
    throw new Error('O script de abertura não devolveu os PIDs esperados.');
  }
  if (typeof pids.windowPid !== 'number') throw new Error('O script de abertura não devolveu o PID da janela.');
  return {
    windowPid: pids.windowPid,
    keepAwakePid: typeof pids.keepAwakePid === 'number' ? pids.keepAwakePid : null,
    removed,
  };
}
