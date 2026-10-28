import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// A confirmação "confia nesta pasta?" só aparece no terminal do PC, não no celular.
// Se a pasta não estiver confiada, o claude trava esperando alguém em casa.
// Por isso o relay confere antes de abrir.

export function normalizeFolder(p: string): string {
  let s = p.replace(/\\/g, '/');
  while (s.length > 3 && s.endsWith('/')) s = s.slice(0, -1);
  return s.toLowerCase();
}

function ancestors(folder: string): string[] {
  const out: string[] = [];
  let cur = normalizeFolder(folder);
  for (;;) {
    out.push(cur);
    const i = cur.lastIndexOf('/');
    if (i <= 0) break;
    const parent = i === 2 && cur[1] === ':' ? cur.slice(0, 3) : cur.slice(0, i);
    if (parent === cur) break;
    cur = parent;
  }
  return out;
}

export type TrustResult =
  | { status: 'trusted'; via: 'pasta' | 'pasta-mae' }
  | { status: 'untrusted' }
  | { status: 'unknown'; reason: string };

// Lê só o campo "projects[...].hasTrustDialogAccepted". Nada mais do arquivo é usado ou exibido.
export function trustFromConfig(config: unknown, folder: string): TrustResult {
  const projects = (config as { projects?: unknown } | null)?.projects;
  if (typeof projects !== 'object' || projects === null) return { status: 'untrusted' };
  const trusted = new Set<string>();
  for (const [key, val] of Object.entries(projects as Record<string, unknown>)) {
    if ((val as { hasTrustDialogAccepted?: unknown } | null)?.hasTrustDialogAccepted === true) {
      trusted.add(normalizeFolder(key));
    }
  }
  const chain = ancestors(folder);
  if (trusted.has(chain[0])) return { status: 'trusted', via: 'pasta' };
  if (chain.slice(1).some((p) => trusted.has(p))) return { status: 'trusted', via: 'pasta-mae' };
  return { status: 'untrusted' };
}

export function checkTrust(folder: string, file: string = join(homedir(), '.claude.json')): TrustResult {
  if (!existsSync(file)) return { status: 'unknown', reason: 'arquivo de configuração do claude não encontrado' };
  try {
    return trustFromConfig(JSON.parse(readFileSync(file, 'utf8')), folder);
  } catch {
    // Mensagem fixa: nunca repassar trechos do arquivo.
    return { status: 'unknown', reason: 'não consegui ler a configuração do claude' };
  }
}
