import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// Registro de uso do Braço: uma linha JSON por chamada em ~/.vrx-relay/braco-usage.jsonl.
// Só data, modelo, números e tipo de erro. Nunca o pedido, os arquivos ou a resposta.

export interface UsageEntry {
  at: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ok: boolean;
  error?: string; // tipo do erro (ErrorKind ou "conferencia")
}

export function usagePath(home: string = homedir()): string {
  return join(home, '.vrx-relay', 'braco-usage.jsonl');
}

export function estimateCost(input: number, output: number, price: { input: number; output: number }): number {
  return Math.round(((input / 1e6) * price.input + (output / 1e6) * price.output) * 1e6) / 1e6;
}

export function appendUsage(entry: UsageEntry, file: string = usagePath()): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // sem registro não é motivo para falhar a tarefa
  }
}

export interface DayTotal {
  day: string;
  model: string;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function summarize(text: string, days: number, now: Date = new Date()): DayTotal[] {
  const since = now.getTime() - days * 86_400_000;
  const map = new Map<string, DayTotal>();
  for (const line of text.split('\n')) {
    let e: UsageEntry;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const t = Date.parse(e?.at);
    if (!Number.isFinite(t) || t < since) continue;
    const day = e.at.slice(0, 10);
    const k = `${day}|${e.model}`;
    const d = map.get(k) ?? { day, model: e.model, calls: 0, errors: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    d.calls++;
    if (!e.ok) d.errors++;
    d.inputTokens += e.inputTokens || 0;
    d.outputTokens += e.outputTokens || 0;
    d.costUsd = Math.round((d.costUsd + (e.costUsd || 0)) * 1e6) / 1e6;
    map.set(k, d);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day) || a.model.localeCompare(b.model));
}

export function readUsage(days: number, file: string = usagePath()): DayTotal[] {
  try {
    return summarize(readFileSync(file, 'utf8'), days);
  } catch {
    return [];
  }
}
