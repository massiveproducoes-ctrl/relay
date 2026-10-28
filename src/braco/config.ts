import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FileLimits } from './files.ts';

// Configuração do Braço (braco.config.json na raiz do projeto). Sem segredo:
// a chave fica em ~/.vrx-relay/braco.env e só é lida na hora da chamada.
export interface BracoConfig {
  baseUrl: string;
  model: string;
  allowedHosts: string[];
  // Preço por milhão de tokens, em dólar, para estimar o custo.
  priceUsdPerM: { input: number; output: number };
  timeoutMs: number;
  limits: FileLimits;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export type ConfigResult = { ok: true; config: BracoConfig } | { ok: false; reason: string };

export function parseConfig(data: unknown): ConfigResult {
  if (typeof data !== 'object' || data === null) return { ok: false, reason: 'configuração não é um objeto' };
  const c = data as Record<string, any>;
  let url: URL;
  try {
    url = new URL(c.baseUrl);
  } catch {
    return { ok: false, reason: 'baseUrl inválida' };
  }
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1') {
    return { ok: false, reason: 'baseUrl precisa ser https (http só para 127.0.0.1, nos testes)' };
  }
  if (typeof c.model !== 'string' || !c.model) return { ok: false, reason: 'model ausente' };
  if (!Array.isArray(c.allowedHosts) || !c.allowedHosts.every((h: unknown) => typeof h === 'string')) {
    return { ok: false, reason: 'allowedHosts precisa ser uma lista de textos' };
  }
  const hosts = c.allowedHosts.map((h: string) => h.toLowerCase());
  if (!hosts.includes(url.hostname.toLowerCase())) {
    return { ok: false, reason: `host da baseUrl fora de allowedHosts: ${url.hostname}` };
  }
  if (!isNum(c.priceUsdPerM?.input) || !isNum(c.priceUsdPerM?.output)) {
    return { ok: false, reason: 'priceUsdPerM.input e .output precisam ser números' };
  }
  if (!isNum(c.timeoutMs) || c.timeoutMs === 0) return { ok: false, reason: 'timeoutMs inválido' };
  const l = c.limits ?? {};
  if (!Number.isInteger(l.maxFiles) || l.maxFiles < 1 || !Number.isInteger(l.maxTotalBytes) || l.maxTotalBytes < 1) {
    return { ok: false, reason: 'limits.maxFiles e limits.maxTotalBytes precisam ser inteiros positivos' };
  }
  return {
    ok: true,
    config: {
      baseUrl: url.toString().replace(/\/$/, ''),
      model: c.model,
      allowedHosts: hosts,
      priceUsdPerM: { input: c.priceUsdPerM.input, output: c.priceUsdPerM.output },
      timeoutMs: c.timeoutMs,
      limits: { maxFiles: l.maxFiles, maxTotalBytes: l.maxTotalBytes },
    },
  };
}

export function loadConfig(file: string = join(import.meta.dirname, '..', '..', 'braco.config.json')): ConfigResult {
  try {
    return parseConfig(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return { ok: false, reason: 'não consegui ler braco.config.json' };
  }
}
