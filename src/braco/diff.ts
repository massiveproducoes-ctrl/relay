// Confere a resposta do modelo antes de devolver ao Claude.
// diff: precisa ser um diff unificado que só mexe nos arquivos enviados.
// json: precisa ser JSON válido. O Braço nunca aplica nada; só confere.

export type CheckResult = { ok: true; value: string } | { ok: false; reason: string };

// Modelos costumam embrulhar a resposta em ```diff ... ```.
export function stripFence(text: string): string {
  const m = /^\s*```[\w-]*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(text);
  return m ? m[1] : text.trim();
}

function filePath(header: string): string {
  const p = header.slice(4).split('\t')[0].trim();
  return p.replace(/^[ab]\//, '');
}

export function checkDiff(text: string, allowed: string[]): CheckResult {
  const diff = stripFence(text);
  const lines = diff.split(/\r?\n/);
  const touched = new Set<string>();
  let hunks = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('--- ') && lines[i + 1]?.startsWith('+++ ')) {
      const from = filePath(l);
      const to = filePath(lines[i + 1]);
      if (from === '/dev/null' || to === '/dev/null') return { ok: false, reason: 'diff cria ou apaga arquivo' };
      if (from !== to) return { ok: false, reason: `diff renomeia arquivo: ${from} → ${to}` };
      touched.add(from);
      i++;
    } else if (l.startsWith('@@')) {
      hunks++;
    }
  }
  if (touched.size === 0 || hunks === 0) return { ok: false, reason: 'resposta não é um diff unificado' };
  const extra = [...touched].filter((p) => !allowed.includes(p));
  if (extra.length) return { ok: false, reason: `diff mexe em arquivo não enviado: ${extra.join(', ')}` };
  return { ok: true, value: diff.endsWith('\n') ? diff : diff + '\n' };
}

export function checkJson(text: string): CheckResult {
  const raw = stripFence(text);
  try {
    JSON.parse(raw);
    return { ok: true, value: raw };
  } catch {
    return { ok: false, reason: 'resposta não é JSON válido' };
  }
}
