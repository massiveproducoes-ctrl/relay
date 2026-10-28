import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { sendNotice } from './telegram.ts';

// Stop hook: roda quando a Claude termina um turno.
// Etapa b: decide o que faria (enviar o fechamento ao Telegram, pedir o bloco, ou nada) e anota no log.
// Só age de verdade se existir o arquivo "stop-send.on" na pasta ~/.vrx-relay (liga/desliga manual).
// Nunca grava o texto da conversa no log e nunca trava a Claude (sempre sai com código 0).

const DIR = join(homedir(), '.vrx-relay');
const LOG = join(DIR, 'stop-hook.log');
const SWITCH = join(DIR, 'stop-send.on');
const MARK = '➡️ Próximo:';
const TELEGRAM_LIMIT = 4096;
const BLOCK_REASON = 'Feche com o bloco de Fechamento de tarefa (✅ Feito, 🧪 Prova, ⚠️ Preciso de você, ➡️ Próximo).';

export type Origin = 'telegram' | 'other' | 'unknown';
export type Action = 'skip' | 'send' | 'block';

// Origem do último pedido seu no arquivo da conversa (jsonl). Resultado de ferramenta não conta como pedido.
export function lastUserOrigin(jsonl: string): Origin {
  const lines = jsonl.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e?.type !== 'user') continue;
    const c = e.message?.content;
    let text = '';
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c)) {
      if (c.some((p: any) => p?.type === 'tool_result')) continue;
      text = c.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
    }
    if (!text) continue;
    // O aviso do próprio hook ("Stop hook feedback") entra na conversa como mensagem de usuário, mas não é pedido seu.
    if (text.trimStart().startsWith('Stop hook feedback')) continue;
    return text.trimStart().startsWith('<channel source="plugin:telegram:telegram"') ? 'telegram' : 'other';
  }
  return 'unknown';
}

// Diagnóstico: só o tipo do último pedido (nunca o texto), para entender por que a origem saiu "other".
export function lastUserKind(jsonl: string): string {
  const lines = jsonl.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    let e: any;
    try {
      e = JSON.parse(lines[i].trim());
    } catch {
      continue;
    }
    if (e?.type !== 'user') continue;
    const c = e.message?.content;
    let text = '';
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c)) {
      if (c.some((p: any) => p?.type === 'tool_result')) continue;
      text = c.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
    }
    if (!text) continue;
    const t = text.trimStart();
    if (t.startsWith('Stop hook feedback')) continue;
    if (t.startsWith('<channel source="plugin:telegram:telegram"')) return 'canal-telegram';
    if (t.startsWith('<channel')) return 'canal-outro';
    return 'texto';
  }
  return 'nenhum';
}

export function decide(origin: Origin, message: string, hookActive: boolean): Action {
  if (origin !== 'telegram') return 'skip';
  if (message.includes(MARK)) return 'send';
  return hookActive ? 'skip' : 'block';
}

export function clip(text: string): string {
  if (text.length <= TELEGRAM_LIMIT) return text;
  return text.slice(0, TELEGRAM_LIMIT - 40) + '\n… (cortado; veja o resto no PC)';
}

export function summarize(raw: string, now = new Date(), origin: Origin = 'unknown'): string {
  let d: Record<string, unknown> = {};
  try {
    d = JSON.parse(raw);
  } catch {
    return `${now.toISOString()} entrada ilegivel`;
  }
  const msg = typeof d.last_assistant_message === 'string' ? d.last_assistant_message : '';
  const active = d.stop_hook_active === true;
  return [
    now.toISOString(),
    `ativo=${active}`,
    `modo=${String(d.permission_mode ?? '?')}`,
    `proximo=${msg.includes(MARK)}`,
    `tamanho=${msg.length}`,
    `origem=${origin}`,
    `acao=${decide(origin, msg, active)}`,
  ].join(' ');
}

function log(line: string): void {
  mkdirSync(DIR, { recursive: true });
  appendFileSync(LOG, line + '\n');
}

if (import.meta.main) {
  try {
    let raw = '';
    for await (const c of process.stdin) raw += c;
    let d: Record<string, unknown> = {};
    try {
      d = JSON.parse(raw);
    } catch {
      // segue com entrada vazia
    }
    let origin: Origin = 'unknown';
    let diag = '';
    try {
      if (typeof d.transcript_path === 'string') {
        const jsonl = readFileSync(d.transcript_path, 'utf8');
        origin = lastUserOrigin(jsonl);
        diag = ` arquivo=${basename(d.transcript_path)} linhas=${jsonl.split('\n').length} ultimo=${lastUserKind(jsonl)}`;
      } else {
        diag = ' arquivo=sem-caminho';
      }
    } catch {
      diag = ' arquivo=ilegivel';
      // sem acesso ao arquivo da conversa: origem desconhecida, não age
    }
    const msg = typeof d.last_assistant_message === 'string' ? d.last_assistant_message : '';
    const action = decide(origin, msg, d.stop_hook_active === true);
    const on = existsSync(SWITCH);
    let result = '';
    if (on && action === 'send') {
      const r = await sendNotice(clip(msg));
      result = r.ok ? ' envio=ok' : ` envio=falhou(${r.reason})`;
    } else if (on && action === 'block') {
      process.stdout.write(JSON.stringify({ decision: 'block', reason: BLOCK_REASON }));
      result = ' bloqueou=sim';
    }
    log(summarize(raw, new Date(), origin) + ` ligado=${on}` + diag + result);
  } catch {
    // nunca atrapalha a Claude
  }
  process.exit(0);
}
