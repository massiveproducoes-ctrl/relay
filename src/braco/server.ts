import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { loadConfig, type BracoConfig } from './config.ts';
import { readContextFiles } from './files.ts';
import { buildMessages, callModel, keyPath, readKey, type Output } from './llm.ts';
import { checkDiff, checkJson } from './diff.ts';
import { appendUsage, estimateCost, readUsage, usagePath } from './usage.ts';

// Servidor MCP do Braço, por stdio, sem dependências: JSON-RPC, uma mensagem por linha.
// Só o necessário: initialize, ping, tools/list e tools/call. Roda com:
//   node src/braco/server.ts
// O Braço nunca grava arquivo nem roda comando: devolve a resposta para o Claude revisar.

const SUPPORTED = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const OUTPUTS: Output[] = ['diff', 'text', 'json'];

export interface Deps {
  config: () => ReturnType<typeof loadConfig>;
  key: () => string | null;
  home: string;
  usageFile: string;
  now: () => Date;
}

export const defaultDeps = (): Deps => ({
  config: () => loadConfig(),
  key: () => readKey(keyPath()),
  home: homedir(),
  usageFile: usagePath(),
  now: () => new Date(),
});

const TOOLS = [
  {
    name: 'delegate',
    description:
      'Manda uma tarefa pequena e bem delimitada a um modelo barato e devolve a resposta para você revisar. ' +
      'Nunca grava arquivo nem roda comando. Com output="diff", a resposta é um diff unificado conferido ' +
      '(só mexe nos context_files). Arquivos só da workdir; senhas e chaves são barradas.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'O que fazer, com critério de pronto.' },
        workdir: { type: 'string', description: 'Pasta do projeto da tarefa (caminho absoluto).' },
        context_files: { type: 'array', items: { type: 'string' }, description: 'Arquivos relativos à workdir.' },
        output: { type: 'string', enum: OUTPUTS },
      },
      required: ['task', 'workdir', 'context_files', 'output'],
    },
  },
  {
    name: 'braco_usage',
    description: 'Chamadas, tokens e custo estimado do Braço por dia e modelo.',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 90 } } },
  },
  {
    name: 'braco_models',
    description: 'Modelo configurado, endereço e se a chave existe. Não gasta tokens.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
const done = (data: unknown): ToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (reason: string): ToolResult => ({ content: [{ type: 'text', text: `Erro do Braço: ${reason}` }], isError: true });

async function delegate(args: any, deps: Deps): Promise<ToolResult> {
  const { task, workdir, context_files: files, output } = args ?? {};
  if (typeof task !== 'string' || !task.trim()) return fail('task vazia');
  if (typeof workdir !== 'string') return fail('workdir ausente');
  if (!Array.isArray(files) || !files.every((f) => typeof f === 'string')) return fail('context_files precisa ser lista de textos');
  if (!OUTPUTS.includes(output)) return fail(`output precisa ser ${OUTPUTS.join(', ')}`);

  const cfg = deps.config();
  if (!cfg.ok) return fail(cfg.reason);
  const config: BracoConfig = cfg.config;
  const read = readContextFiles(workdir, files, config.limits, deps.home);
  if (!read.ok) return fail(read.reason);

  const call = await callModel(config, deps.key(), buildMessages(task, read.files, output));
  const at = deps.now().toISOString();
  if (!call.ok) {
    // sem chave e host bloqueado não chegam ao provedor: não entram no registro de uso
    if (call.kind !== 'sem-chave' && call.kind !== 'host-bloqueado') {
      appendUsage({ at, model: config.model, inputTokens: 0, outputTokens: 0, costUsd: 0, ok: false, error: call.kind }, deps.usageFile);
    }
    return fail(`${call.kind}: ${call.reason}`);
  }

  const costUsd = estimateCost(call.inputTokens, call.outputTokens, config.priceUsdPerM);
  const checked =
    output === 'diff' ? checkDiff(call.text, read.files.map((f) => f.path))
    : output === 'json' ? checkJson(call.text)
    : { ok: true as const, value: call.text.trim() };
  appendUsage(
    { at, model: config.model, inputTokens: call.inputTokens, outputTokens: call.outputTokens, costUsd, ok: checked.ok, ...(checked.ok ? {} : { error: 'conferencia' }) },
    deps.usageFile,
  );
  const meta = { model: config.model, inputTokens: call.inputTokens, outputTokens: call.outputTokens, costUsd };
  if (!checked.ok) return fail(`a resposta não passou na conferência (${checked.reason}); custo ${costUsd} USD`);
  return done({ ...meta, output, result: checked.value, note: 'Proposta do Braço: revise e rode os testes antes de aplicar.' });
}

export async function handle(msg: any, deps: Deps): Promise<object | null> {
  const id = msg?.id;
  const isRequest = id !== undefined && id !== null;
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id: isRequest ? id : null, error: { code, message } });

  if (msg?.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(-32600, 'pedido inválido');
  if (!isRequest) return null; // notificações (ex.: notifications/initialized) não têm resposta

  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params?.protocolVersion;
      return ok({
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'braco', version: '0.1.0' },
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS });
    case 'tools/call': {
      const name = msg.params?.name;
      const args = msg.params?.arguments ?? {};
      if (name === 'delegate') return ok(await delegate(args, deps));
      if (name === 'braco_usage') {
        const days = Number.isInteger(args.days) && args.days >= 1 && args.days <= 90 ? args.days : 7;
        return ok(done({ days, totals: readUsage(days, deps.usageFile) }));
      }
      if (name === 'braco_models') {
        const cfg = deps.config();
        if (!cfg.ok) return ok(fail(cfg.reason));
        return ok(done({ model: cfg.config.model, baseUrl: cfg.config.baseUrl, key: deps.key() ? 'presente' : 'ausente' }));
      }
      return err(-32602, `ferramenta desconhecida: ${name}`);
    }
    default:
      return err(-32601, `método não suportado: ${msg.method}`);
  }
}

if (import.meta.main) {
  const deps = defaultDeps();
  const rl = createInterface({ input: process.stdin });
  // Fila: responde na ordem em que as mensagens chegaram.
  let queue = Promise.resolve();
  rl.on('line', (line) => {
    if (!line.trim()) return;
    queue = queue.then(async () => {
      let msg: unknown;
      try {
        msg = JSON.parse(line);
      } catch {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }) + '\n');
        return;
      }
      const res = await handle(msg, deps).catch(() => ({ jsonrpc: '2.0', id: (msg as any)?.id ?? null, error: { code: -32603, message: 'erro interno do Braço' } }));
      if (res) process.stdout.write(JSON.stringify(res) + '\n');
    });
  });
}
