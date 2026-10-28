import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// O claude guarda as conversas de cada pasta em ~/.claude/projects/<pasta com símbolos trocados por "-">.
// Ex.: C:\dev\vrx-relay -> C--dev-vrx-relay
export function projectSlug(folder: string): string {
  return folder.replace(/[^a-zA-Z0-9]/g, '-');
}

// Horário da conversa mais recente desta pasta (pelo arquivo modificado por último).
// Só olha datas de arquivo; não abre o conteúdo das conversas.
export function lastSessionTime(folder: string, home: string = homedir()): Date | null {
  const root = join(home, '.claude', 'projects');
  if (!existsSync(root)) return null;
  const slug = projectSlug(folder).toLowerCase();
  const dir = readdirSync(root).find((name) => name.toLowerCase() === slug);
  if (!dir) return null;
  let newest: number | null = null;
  for (const name of readdirSync(join(root, dir))) {
    if (!name.endsWith('.jsonl')) continue;
    const t = statSync(join(root, dir, name)).mtimeMs;
    if (newest === null || t > newest) newest = t;
  }
  return newest === null ? null : new Date(newest);
}

// Retoma a conversa (--continue) se ela tiver mexido há menos de maxHours.
export function shouldContinue(last: Date | null, now: Date, maxHours = 4): boolean {
  if (!last) return false;
  const age = now.getTime() - last.getTime();
  return age >= 0 && age < maxHours * 3_600_000;
}
