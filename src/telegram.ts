import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Aviso do vigia pelo Telegram. SÓ envia (sendMessage): nunca getUpdates nem webhook,
// senão brigaria com o plugin do relay, que é quem recebe as mensagens.
// Token e destinatário são lidos aqui, na hora de enviar. O token nunca vai para log,
// mensagem de erro ou estado, e as mensagens de falha daqui não carregam a URL.

export function telegramDir(home: string = homedir()): string {
  return join(process.env.CLAUDE_CONFIG_DIR ?? join(home, '.claude'), 'channels', 'telegram');
}

// Mesmo formato que o plugin lê: linhas CHAVE=valor.
export function parseEnvToken(text: string): string | null {
  for (const line of text.split('\n')) {
    const m = /^TELEGRAM_BOT_TOKEN=(.*)$/.exec(line.replace(/\r$/, ''));
    if (m) {
      const v = m[1].trim().replace(/^(["'])(.*)\1$/, '$2');
      return v || null;
    }
  }
  return null;
}

// access.json do plugin: { allowFrom: ["<id>", ...] }. Em DM, chat_id == user_id.
export function parseRecipients(json: unknown): string[] {
  if (typeof json !== 'object' || json === null) return [];
  const list = (json as Record<string, unknown>).allowFrom;
  if (!Array.isArray(list)) return [];
  return list.filter((v): v is string => typeof v === 'string' && /^\d+$/.test(v)).slice(0, 3);
}

export type SendResult = { ok: true } | { ok: false; reason: string };

export async function sendNotice(text: string, dir: string = telegramDir()): Promise<SendResult> {
  let token: string | null;
  let recipients: string[];
  try {
    token = parseEnvToken(readFileSync(join(dir, '.env'), 'utf8'));
    recipients = parseRecipients(JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8')));
  } catch {
    return { ok: false, reason: 'não consegui ler as credenciais do Telegram' };
  }
  if (!token) return { ok: false, reason: 'sem token do bot' };
  if (recipients.length === 0) return { ok: false, reason: 'sem destinatário em access.json' };

  let failed = 0;
  let lastReason = '';
  for (const chat_id of recipients) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        failed++;
        lastReason = `Telegram respondeu HTTP ${res.status}`;
      }
    } catch {
      failed++;
      lastReason = 'sem rede ou Telegram fora do ar';
    }
  }
  return failed === recipients.length ? { ok: false, reason: lastReason } : { ok: true };
}
