import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { BracoConfig } from './config.ts';
import type { ContextFile } from './files.ts';

// Uma chamada só ao modelo barato, num endpoint compatível com OpenAI (/chat/completions).
// A chave é lida aqui, na hora, de ~/.vrx-relay/braco.env. Ela nunca vai para log,
// resposta ou mensagem de erro.

export type Output = 'diff' | 'text' | 'json';
export type Message = { role: 'system' | 'user'; content: string };
export type ErrorKind = 'sem-chave' | 'host-bloqueado' | 'limite' | 'rede' | 'provedor' | 'resposta-invalida';

export type CallResult =
  | { ok: true; text: string; inputTokens: number; outputTokens: number }
  | { ok: false; kind: ErrorKind; reason: string };

export function keyPath(home: string = homedir()): string {
  return join(home, '.vrx-relay', 'braco.env');
}

export function readKey(file: string = keyPath()): string | null {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^BRACO_API_KEY=(.*)$/.exec(line.replace(/\r$/, ''));
      if (m) return m[1].trim().replace(/^(["'])(.*)\1$/, '$2') || null;
    }
  } catch {
    // sem arquivo = sem chave
  }
  return null;
}

const OUTPUT_RULES: Record<Output, (paths: string[]) => string> = {
  diff: (paths) =>
    'Responda SOMENTE com um diff unificado no formato do git (linhas ---, +++ e @@), sem explicação. ' +
    `Altere apenas estes arquivos: ${paths.join(', ')}. Não crie nem apague arquivos.`,
  text: () => 'Responda em texto simples, direto, sem repetir o pedido.',
  json: () => 'Responda SOMENTE com um JSON válido, sem texto antes ou depois.',
};

export function buildMessages(task: string, files: ContextFile[], output: Output): Message[] {
  const system =
    'Você é um assistente de programação que faz tarefas pequenas e bem delimitadas. ' +
    'Use só os arquivos fornecidos; não invente conteúdo de arquivos que não viu. ' +
    OUTPUT_RULES[output](files.map((f) => f.path));
  const body = files.map((f) => `=== ${f.path} ===\n${f.content}`).join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: files.length ? `${task}\n\nArquivos:\n\n${body}` : task },
  ];
}

export async function callModel(config: BracoConfig, key: string | null, messages: Message[]): Promise<CallResult> {
  if (!key) return { ok: false, kind: 'sem-chave', reason: 'sem chave do Braço (~/.vrx-relay/braco.env)' };
  const url = new URL(`${config.baseUrl}/chat/completions`);
  if (!config.allowedHosts.includes(url.hostname.toLowerCase())) {
    return { ok: false, kind: 'host-bloqueado', reason: `host fora da lista permitida: ${url.hostname}` };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: config.model, messages, temperature: 0, stream: false }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    return { ok: false, kind: 'rede', reason: 'sem rede, tempo esgotado ou provedor fora do ar' };
  }
  if (res.status === 429) return { ok: false, kind: 'limite', reason: 'limite de uso do provedor (HTTP 429)' };
  if (res.status === 401 || res.status === 403) {
    return { ok: false, kind: 'sem-chave', reason: `chave recusada pelo provedor (HTTP ${res.status})` };
  }
  if (!res.ok) return { ok: false, kind: 'provedor', reason: `provedor respondeu HTTP ${res.status}` };

  let data: any;
  try {
    data = await res.json();
  } catch {
    return { ok: false, kind: 'resposta-invalida', reason: 'resposta não é JSON' };
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, kind: 'resposta-invalida', reason: 'resposta sem texto' };
  }
  const n = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : 0);
  return { ok: true, text, inputTokens: n(data.usage?.prompt_tokens), outputTokens: n(data.usage?.completion_tokens) };
}
