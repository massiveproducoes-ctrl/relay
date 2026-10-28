import { readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';

// Leitura dos arquivos que o Braço manda ao modelo barato.
// Lista de PERMITIDAS: só arquivos dentro da pasta da tarefa (workdir). Caminho real
// resolvido, então "../", caminho absoluto fora e atalho (symlink) que escapa são barrados.
// Arquivos de senha e chave são barrados sempre, mesmo dentro da pasta.

export interface FileLimits {
  maxFiles: number;
  maxTotalBytes: number;
}

export interface ContextFile {
  path: string; // relativo à workdir, com "/"
  content: string;
}

export type ReadResult =
  | { ok: true; files: ContextFile[]; totalBytes: number }
  | { ok: false; reason: string };

const BLOCKED_EXT = new Set(['.pem', '.key']);

export function isSecretName(file: string): boolean {
  const name = basename(file).toLowerCase();
  return name === '.env' || name.startsWith('.env.') || BLOCKED_EXT.has(extname(name));
}

// Windows não diferencia maiúsculas em caminhos.
function norm(p: string): string {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

function inside(parent: string, child: string): boolean {
  const rel = relative(norm(parent), norm(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function realOrNull(p: string): string | null {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

export function readContextFiles(
  workdir: string,
  files: string[],
  limits: FileLimits,
  home: string = homedir(),
): ReadResult {
  if (files.length > limits.maxFiles) {
    return { ok: false, reason: `no máximo ${limits.maxFiles} arquivos por tarefa (vieram ${files.length})` };
  }
  const root = realOrNull(workdir);
  if (!root || !statSync(root).isDirectory()) return { ok: false, reason: 'pasta da tarefa não existe' };
  const channels = realOrNull(join(home, '.claude', 'channels'));

  const out: ContextFile[] = [];
  let total = 0;
  for (const f of files) {
    if (isSecretName(f)) return { ok: false, reason: `arquivo de senha ou chave bloqueado: ${f}` };
    const real = realOrNull(resolve(root, f));
    if (!real) return { ok: false, reason: `arquivo não existe: ${f}` };
    if (!inside(root, real)) return { ok: false, reason: `fora da pasta da tarefa: ${f}` };
    if (isSecretName(real)) return { ok: false, reason: `arquivo de senha ou chave bloqueado: ${f}` };
    if (channels && inside(channels, real)) return { ok: false, reason: `pasta de credenciais bloqueada: ${f}` };
    if (!statSync(real).isFile()) return { ok: false, reason: `não é arquivo: ${f}` };

    const buf = readFileSync(real);
    total += buf.length;
    if (total > limits.maxTotalBytes) {
      return { ok: false, reason: `arquivos passam de ${limits.maxTotalBytes} bytes no total` };
    }
    out.push({ path: relative(root, real).split('\\').join('/'), content: buf.toString('utf8') });
  }
  return { ok: true, files: out, totalBytes: total };
}
