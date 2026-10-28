import { existsSync, realpathSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { telegramDir } from './telegram.ts';
import { transcribe } from './transcribe.ts';

// Comando de terminal para transcrever um áudio que chegou pelo Telegram:
//   node src/transcribe-cli.ts <arquivo>
// É este comando exato que a regra de permissão libera. Por isso ele só aceita UM argumento,
// e só um arquivo de áudio que esteja dentro da pasta inbox do Telegram. Qualquer outro
// caminho é recusado aqui, no código, e não só pela regra.

const AUDIO_EXT = new Set(['.oga', '.ogg', '.opus', '.mp3', '.m4a', '.wav', '.flac', '.webm', '.aac']);

export type PathCheck = { ok: true; path: string } | { ok: false; reason: string };

export function checkAudioPath(arg: string | undefined, inboxDir: string): PathCheck {
  if (!arg) return { ok: false, reason: 'faltou o caminho do áudio' };
  if (!AUDIO_EXT.has(extname(arg).toLowerCase())) return { ok: false, reason: 'só aceito arquivo de áudio (.oga, .ogg, .mp3, .m4a, .wav...)' };
  const full = resolve(arg);
  if (!existsSync(full)) return { ok: false, reason: 'arquivo não encontrado' };
  let real: string;
  let inbox: string;
  try {
    // realpath derruba "..", links e atalhos que apontem para fora da inbox.
    real = realpathSync(full);
    inbox = realpathSync(inboxDir);
  } catch {
    return { ok: false, reason: 'não consegui conferir a pasta inbox' };
  }
  const rel = relative(inbox, real);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return { ok: false, reason: 'o arquivo precisa estar na pasta inbox do Telegram' };
  return { ok: true, path: real };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Uso: node src/transcribe-cli.ts <arquivo de áudio da inbox>');
    process.exitCode = 1;
    return;
  }
  const check = checkAudioPath(args[0], resolve(telegramDir(), 'inbox'));
  if (!check.ok) {
    console.error(`❌ ${check.reason}`);
    process.exitCode = 1;
    return;
  }
  try {
    console.log(await transcribe(check.path));
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
