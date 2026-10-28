import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cleanEnv } from './env.ts';
import { formatStatus } from './format.ts';
import { LAUNCHER, WINDOW_TITLE, openWindow } from './launcher.ts';
import { commandExists, isAlive, killTree } from './proc.ts';
import { lastSessionTime, shouldContinue } from './session.ts';
import { readLastExit, readState, writeState, type RelayState } from './state.ts';
import { checkTrust } from './trust.ts';

const ROOT = join(import.meta.dirname, '..');
const WATCHER = join(ROOT, 'src', 'watcher.ts');
const CONTINUE_MAX_HOURS = 4;

const HELP = `Uso:
  relay start [pasta]   abre o claude (Remote Control + Telegram) numa janela própria
                        e liga o keep-awake. Sem pasta, usa a pasta atual.
  relay status          mostra se o claude, o keep-awake e o vigia estão vivos
  relay stop            encerra tudo que o relay abriu`;

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function cmdStart(folderArg: string | undefined): void {
  if (process.platform !== 'win32') fail('O relay só roda no Windows.');

  const folder = resolve(folderArg ?? process.cwd());
  if (!existsSync(folder) || !statSync(folder).isDirectory()) fail(`Pasta não encontrada: ${folder}`);

  const current = readState();
  if (current && !current.stoppedAt && isAlive(current.windowPid, current.windowImage)) {
    fail(`Já está rodando (janela PID ${current.windowPid}, pasta ${current.folder}). Use "relay stop" antes.`);
  }

  const trust = checkTrust(folder);
  if (trust.status === 'untrusted') {
    fail(
      `A pasta ainda não foi marcada como confiável no claude.\n` +
        `   Essa pergunta só aparece no terminal do PC, então o claude travaria esperando você.\n` +
        `   Resolva assim: abra um terminal em ${folder}, rode "claude", aceite a confiança e saia com /exit.`,
    );
  }
  if (trust.status === 'unknown') fail(`Não consegui conferir a confiança da pasta: ${trust.reason}.`);

  if (!commandExists('claude')) fail('Não achei o comando "claude". Ele está instalado e no PATH?');
  if (!existsSync(LAUNCHER)) fail(`Script ausente: ${LAUNCHER}`);

  const useContinue = shouldContinue(lastSessionTime(folder), new Date(), CONTINUE_MAX_HOURS);
  let opened;
  try {
    opened = openWindow(folder, useContinue);
  } catch (err) {
    fail((err as Error).message);
  }

  // Um vigia antigo (de um start anterior) sai antes, para não haver dois religando.
  if (current?.watcherPid && isAlive(current.watcherPid)) killTree(current.watcherPid);

  const state: RelayState = {
    version: 1,
    folder,
    windowPid: opened.windowPid,
    windowImage: 'powershell.exe',
    keepAwakePid: opened.keepAwakePid,
    watcherPid: null,
    startedAt: new Date().toISOString(),
    continued: useContinue,
    stoppedAt: null,
  };
  writeState(state);

  // O vigia fica escondido e solto desta janela de terminal. Sobe depois do estado gravado, que ele lê.
  const watcher = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', WATCHER], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: cleanEnv().env,
  });
  watcher.unref();
  if (watcher.pid) writeState({ ...state, watcherPid: watcher.pid });

  console.log(`✅ Relay ligado em ${folder}`);
  console.log(`   Janela "${WINDOW_TITLE}" (PID ${state.windowPid}). Não feche essa janela.`);
  console.log(`   Conversa: ${useContinue ? 'retomando a anterior (--continue)' : 'nova'}`);
  console.log(`   Keep-awake: ${state.keepAwakePid ? 'ligado' : 'NÃO ligou, confira com "relay status"'}`);
  console.log(`   Vigia: ${watcher.pid ? 'ligado (religa o claude se a janela cair)' : 'NÃO ligou, confira com "relay status"'}`);
  if (trust.status === 'trusted' && trust.via === 'pasta-mae') {
    console.log('   Obs.: a confiança veio de uma pasta-mãe. Se a janela pedir confirmação, aceite lá.');
  }
  if (opened.removed.length) console.log(`   Removidas só deste processo: ${opened.removed.join(', ')}`);
  console.log('   Confira em ~1 min no app do Claude (aba Code) se a sessão "relay-vrx" apareceu.');
}

function cmdStatus(): void {
  const state = readState();
  const live = {
    window: state ? isAlive(state.windowPid, state.windowImage) : false,
    keepAwake: state ? isAlive(state.keepAwakePid) : false,
    watcher: state ? isAlive(state.watcherPid) : false,
  };
  const { text, code } = formatStatus(state, live, new Date(), readLastExit(), Boolean(process.stdout.isTTY));
  console.log(text);
  process.exitCode = code;
}

function cmdStop(): void {
  const state = readState();
  if (!state || state.stoppedAt) {
    console.log('Nada rodando.');
    return;
  }
  // O vigia sai primeiro, senão ele relançaria o claude.
  const steps: Array<[string, number | null, string | undefined]> = [
    ['vigia', state.watcherPid, undefined],
    ['claude', state.windowPid, state.windowImage],
    ['keep-awake', state.keepAwakePid, undefined],
  ];
  for (const [name, pid, image] of steps) {
    if (pid === null || !isAlive(pid, image)) continue;
    console.log(killTree(pid) ? `   ${name}: encerrado` : `   ${name}: NÃO consegui encerrar (PID ${pid})`);
  }
  writeState({ ...state, stoppedAt: new Date().toISOString() });
  console.log('✅ Relay parado. A conversa fica salva; o próximo "relay start" retoma se for de menos de 4 h.');
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case 'start':
    cmdStart(arg);
    break;
  case 'status':
    cmdStatus();
    break;
  case 'stop':
    cmdStop();
    break;
  default:
    console.log(HELP);
    if (cmd && cmd !== 'help') process.exitCode = 1;
}
