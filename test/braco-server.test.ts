import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { handle, type Deps } from '../src/braco/server.ts';
import type { BracoConfig } from '../src/braco/config.ts';

const DIFF = '--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-export const a = 1;\n+export const a = 2;\n';

async function setup(answer: string, key: string | null = 'k') {
  const server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: answer } }], usage: { prompt_tokens: 8000, completion_tokens: 6000 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const base = mkdtempSync(join(tmpdir(), 'braco-srv-'));
  const work = join(base, 'proj');
  mkdirSync(work);
  writeFileSync(join(work, 'a.ts'), 'export const a = 1;\n');
  const config: BracoConfig = {
    baseUrl: `http://127.0.0.1:${port}`, model: 'falso', allowedHosts: ['127.0.0.1'],
    priceUsdPerM: { input: 0.3, output: 1.2 }, timeoutMs: 1000, limits: { maxFiles: 3, maxTotalBytes: 1000 },
  };
  const deps: Deps = {
    config: () => ({ ok: true, config }), key: () => key, home: join(base, 'home'),
    usageFile: join(base, 'uso.jsonl'), now: () => new Date('2026-10-24T12:00:00Z'),
  };
  return { deps, work, usage: deps.usageFile, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const call = (name: string, args: unknown) => ({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } });

test('braço mcp: initialize, ping, tools/list e notificação sem resposta', async () => {
  const s = await setup('x');
  const init: any = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, s.deps);
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.deepEqual(init.result.capabilities, { tools: {} });
  const velha: any = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, s.deps);
  assert.equal(velha.result.protocolVersion, '2025-11-25');
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, s.deps), null);
  assert.deepEqual(((await handle({ jsonrpc: '2.0', id: 2, method: 'ping' }, s.deps)) as any).result, {});
  const list: any = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' }, s.deps);
  assert.deepEqual(list.result.tools.map((t: any) => t.name), ['delegate', 'braco_usage', 'braco_models']);
  const nada: any = await handle({ jsonrpc: '2.0', id: 4, method: 'resources/list' }, s.deps);
  assert.equal(nada.error.code, -32601);
  await s.close();
});

test('braço mcp: delegate devolve diff conferido, custo e registra uso sem conteúdo', async () => {
  const s = await setup('```diff\n' + DIFF + '```');
  const r: any = await handle(call('delegate', { task: 'troque 1 por 2', workdir: s.work, context_files: ['a.ts'], output: 'diff' }), s.deps);
  await s.close();
  assert.ok(!r.result.isError, r.result.content[0].text);
  const data = JSON.parse(r.result.content[0].text);
  assert.equal(data.result, DIFF);
  assert.equal(data.costUsd, 0.0096);
  const log = readFileSync(s.usage, 'utf8');
  assert.match(log, /"ok":true/);
  assert.ok(!log.includes('troque') && !log.includes('export const'));
});

test('braço mcp: delegate recusa diff de outro arquivo e anota erro de conferência', async () => {
  const s = await setup(DIFF.replaceAll('a.ts', 'b.ts'));
  const r: any = await handle(call('delegate', { task: 't', workdir: s.work, context_files: ['a.ts'], output: 'diff' }), s.deps);
  await s.close();
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /não enviado/);
  assert.match(readFileSync(s.usage, 'utf8'), /"error":"conferencia"/);
});

test('braço mcp: delegate barra arquivo fora da pasta e sem chave, sem registrar uso', async () => {
  const s = await setup('x', null);
  const fora: any = await handle(call('delegate', { task: 't', workdir: s.work, context_files: ['../x'], output: 'text' }), s.deps);
  assert.match(fora.result.content[0].text, /não existe|fora da pasta/);
  const semChave: any = await handle(call('delegate', { task: 't', workdir: s.work, context_files: ['a.ts'], output: 'text' }), s.deps);
  assert.match(semChave.result.content[0].text, /sem-chave/);
  const ruim: any = await handle(call('delegate', { task: 't', workdir: s.work, context_files: ['a.ts'], output: 'html' }), s.deps);
  assert.match(ruim.result.content[0].text, /output precisa/);
  await s.close();
  assert.ok(!existsSync(s.usage));
});

test('braço mcp: braco_models e braco_usage não gastam', async () => {
  const s = await setup('x', null);
  const m: any = await handle(call('braco_models', {}), s.deps);
  assert.deepEqual(JSON.parse(m.result.content[0].text), { model: 'falso', baseUrl: s.deps.config().ok ? (s.deps.config() as any).config.baseUrl : '', key: 'ausente' });
  const u: any = await handle(call('braco_usage', { days: 3 }), s.deps);
  assert.deepEqual(JSON.parse(u.result.content[0].text), { days: 3, totals: [] });
  await s.close();
});

test('braço mcp: processo real responde por stdio, uma linha por mensagem', async () => {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/braco/server.ts'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines: string[] = [];
  let buf = '';
  child.stdout.on('data', (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      lines.push(buf.slice(0, i));
      buf = buf.slice(i + 1);
    }
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }) + '\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  child.stdin.write('{lixo\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
  const t0 = Date.now();
  while (lines.length < 3 && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 20));
  child.kill();
  assert.equal(lines.length, 3);
  const [a, b, c] = lines.map((l) => JSON.parse(l));
  assert.equal(a.result.serverInfo.name, 'braco');
  assert.equal(b.error.code, -32700);
  assert.equal(c.result.tools.length, 3);
});
