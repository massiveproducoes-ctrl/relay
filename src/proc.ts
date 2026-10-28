import { execFileSync } from 'node:child_process';

// Funções de processo do Windows (tasklist e taskkill vêm com o sistema).

// Lê a saída CSV do tasklist. Linha esperada: "powershell.exe","1234","Console","1","80.000 K"
// Sem processo, o tasklist imprime um aviso traduzido que não casa com o padrão.
export function parseTasklist(out: string, pid: number): string | null {
  for (const line of out.split(/\r?\n/)) {
    const m = /^"([^"]+)","(\d+)"/.exec(line.trim());
    if (m && Number(m[2]) === pid) return m[1];
  }
  return null;
}

export function processImage(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return parseTasklist(out, pid);
  } catch {
    return null;
  }
}

// Vivo = o PID existe e, se informado, é o mesmo executável que abrimos.
export function isAlive(pid: number | null, image?: string): boolean {
  if (pid === null) return false;
  const found = processImage(pid);
  if (found === null) return false;
  return !image || found.toLowerCase() === image.toLowerCase();
}

// Encerra o processo e tudo que ele abriu (o claude dentro da janela, por exemplo).
export function killTree(pid: number): boolean {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export function commandExists(name: string): boolean {
  try {
    execFileSync('where', [name], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}
