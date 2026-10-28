import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openWindow } from './launcher.ts';
import { isAlive } from './proc.ts';
import { lastSessionTime, shouldContinue } from './session.ts';
import { readState, stateDir, writeState } from './state.ts';
import { sendNotice } from './telegram.ts';
import {
  canNotify, decideRestart, emptyMemory, giveUpMessage, launchFailedMessage, restartMessage,
} from './watch-logic.ts';

// Vigia: processo escondido que o "relay start" liga. Se a janela do claude some sem
// "relay stop", ele reabre o claude (--continue) e avisa no Telegram. Roda com:
//   node src/watcher.ts
const POLL_MS = 10_000;
const CONTINUE_MAX_HOURS = 4;
const LOG = join(stateDir(), 'watcher.log');

// Log com horário e nomes de evento. Nunca token, ID nem conteúdo de conversa.
function log(msg: string): void {
  try {
    mkdirSync(stateDir(), { recursive: true });
    appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`, 'utf8');
  } catch {
    // sem log não é motivo para o vigia parar
  }
}

const mem = emptyMemory();

async function notify(text: string, critical = false): Promise<void> {
  const now = Date.now();
  if (!canNotify(mem, now, critical)) {
    log('aviso não enviado: limite por hora');
    return;
  }
  mem.notices.push(now);
  const res = await sendNotice(text);
  log(res.ok ? 'aviso enviado' : `aviso falhou: ${res.reason}`);
}

async function tick(): Promise<boolean> {
  const state = readState();
  // Parado pelo "relay stop", estado apagado ou outro vigia no comando: sai.
  if (!state || state.stoppedAt) return false;
  if (state.watcherPid !== null && state.watcherPid !== process.pid) return false;

  if (isAlive(state.windowPid, state.windowImage) || mem.gaveUp) return true;

  const now = Date.now();
  const decision = decideRestart(mem, now);
  if (decision.action === 'giveup') {
    mem.gaveUp = true;
    log('desistiu de religar');
    await notify(giveUpMessage(), true);
    return true;
  }

  mem.restarts.push(now);
  try {
    const useContinue = shouldContinue(lastSessionTime(state.folder), new Date(), CONTINUE_MAX_HOURS);
    const opened = openWindow(state.folder, useContinue);
    // Lê de novo: o "relay stop" pode ter rodado enquanto a janela abria.
    const fresh = readState();
    if (!fresh || fresh.stoppedAt) return false;
    writeState({
      ...fresh,
      windowPid: opened.windowPid,
      keepAwakePid: opened.keepAwakePid,
      startedAt: new Date().toISOString(),
      continued: useContinue,
    });
    log(`religou (tentativa ${decision.attempt})`);
    await notify(restartMessage(new Date(now), decision.attempt));
  } catch (err) {
    log(`falha ao religar: ${(err as Error).message.split('\n')[0]}`);
    await notify(launchFailedMessage(), true);
  }
  return true;
}

async function main(): Promise<void> {
  log(`vigia ligado (PID ${process.pid})`);
  for (;;) {
    let keepGoing = false;
    try {
      keepGoing = await tick();
    } catch (err) {
      log(`erro inesperado: ${(err as Error).message.split('\n')[0]}`);
      keepGoing = true;
    }
    if (!keepGoing) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  log('vigia encerrado');
}

await main();
