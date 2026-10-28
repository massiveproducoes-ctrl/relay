import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { BracoConfig } from '../src/braco/config.ts';
import { buildMessages, callModel, readKey } from '../src/braco/llm.ts';
import { checkDiff, checkJson, stripFence } from '../src/braco/diff.ts';
import { appendUsage, estimateCost, summarize } from '../src/braco/usage.ts';

// Servidor falso: imita o /chat/completions do DeepSeek e guarda o último pedido.
async function fake(handler: (req: IncomingMessage, body: any, res: ServerResponse) => void) {
  const seen: { auth?: string; body?: any } = {};
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      seen.auth = req.headers.authorization;
      seen.body = raw ? JSON.parse(raw) : undefined;
      handler(req, seen.body, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const config: BracoConfig = {
    baseUrl: `http://127.0.0.1:${port}`,
    model: 'falso',
    allowedHosts: ['127.0.0.1'],
    priceUsdPerM: { input: 0.3, output: 1.2 },
    timeoutMs: 500,
    limits: { maxFiles: 3, maxTotalBytes: 1000 },
  };
  const close = () =>
    new Promise<void>((r) => {
      server.closeAllConnections();
      server.close(() => r());
    });
  return { config, seen, close };
}

const reply = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const msgs = buildMessages('troque 1 por 2', [{ path: 'src/a.ts', content: 'export const a = 1;\n' }], 'diff');

test('braço llm: chamada certa devolve texto e tokens, com a chave no cabeçalho', async () => {
  const f = await fake((_req, _b, res) =>
    reply(res, 200, { choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
  );
  const r = await callModel(f.config, 'chave-teste', msgs);
  await f.close();
  assert.deepEqual(r, { ok: true, text: 'ok', inputTokens: 10, outputTokens: 5 });
  assert.equal(f.seen.auth, 'Bearer chave-teste');
  assert.equal(f.seen.body.model, 'falso');
  assert.equal(f.seen.body.temperature, 0);
  assert.match(f.seen.body.messages[1].content, /=== src\/a\.ts ===/);
});

test('braço llm: classifica os erros e nunca vaza a chave', async () => {
  const cases: Array<[number | 'lixo' | 'vazio', string]> = [
    [429, 'limite'], [401, 'sem-chave'], [500, 'provedor'], ['lixo', 'resposta-invalida'], ['vazio', 'resposta-invalida'],
  ];
  for (const [kind, expected] of cases) {
    const f = await fake((_req, _b, res) => {
      if (kind === 'lixo') reply(res, 200, 'não é json');
      else if (kind === 'vazio') reply(res, 200, { choices: [{ message: { content: '' } }] });
      else reply(res, kind, { error: 'x' });
    });
    const r = await callModel(f.config, 'segredo-123', msgs);
    await f.close();
    assert.ok(!r.ok, String(kind));
    assert.equal(r.kind, expected, String(kind));
    assert.ok(!JSON.stringify(r).includes('segredo-123'));
  }
});

test('braço llm: sem chave, host bloqueado e tempo esgotado não chegam a gastar', async () => {
  const f = await fake(() => {
    /* nunca responde: força o tempo esgotado */
  });
  const semChave = await callModel(f.config, null, msgs);
  assert.ok(!semChave.ok && semChave.kind === 'sem-chave');
  const bloqueado = await callModel({ ...f.config, allowedHosts: ['api.deepseek.com'] }, 'k', msgs);
  assert.ok(!bloqueado.ok && bloqueado.kind === 'host-bloqueado');
  const lento = await callModel({ ...f.config, timeoutMs: 100 }, 'k', msgs);
  assert.ok(!lento.ok && lento.kind === 'rede');
  await f.close();
});

test('braço llm: lê a chave do formato CHAVE=valor', () => {
  const dir = mkdtempSync(join(tmpdir(), 'braco-key-'));
  const file = join(dir, 'braco.env');
  writeFileSync(file, 'OUTRA=1\r\nBRACO_API_KEY="abc"\r\n');
  assert.equal(readKey(file), 'abc');
  assert.equal(readKey(join(dir, 'nao-existe')), null);
});

const DIFF = '--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-export const a = 1;\n+export const a = 2;\n';

test('braço diff: aceita diff dos arquivos enviados, mesmo embrulhado em ```', () => {
  assert.equal(stripFence('```diff\n' + DIFF + '```'), DIFF.trimEnd());
  const r = checkDiff('```diff\n' + DIFF + '```', ['src/a.ts']);
  assert.ok(r.ok);
  assert.equal(r.value, DIFF);
});

test('braço diff: recusa arquivo não enviado, criar/apagar, renomear e texto solto', () => {
  const outro = checkDiff(DIFF.replaceAll('src/a.ts', 'src/b.ts'), ['src/a.ts']);
  assert.ok(!outro.ok && /não enviado/.test(outro.reason));
  const novo = checkDiff('--- /dev/null\n+++ b/src/a.ts\n@@ -0,0 +1 @@\n+x\n', ['src/a.ts']);
  assert.ok(!novo.ok && /cria ou apaga/.test(novo.reason));
  const ren = checkDiff('--- a/src/a.ts\n+++ b/src/c.ts\n@@ -1 +1 @@\n-x\n+y\n', ['src/a.ts', 'src/c.ts']);
  assert.ok(!ren.ok && /renomeia/.test(ren.reason));
  const prosa = checkDiff('Claro! Troquei o 1 pelo 2.', ['src/a.ts']);
  assert.ok(!prosa.ok && /não é um diff/.test(prosa.reason));
});

test('braço diff: confere JSON', () => {
  assert.ok(checkJson('```json\n{"a":1}\n```').ok);
  assert.ok(!checkJson('{a:1}').ok);
});

test('braço uso: custo estimado e soma por dia e modelo, sem conteúdo', () => {
  assert.equal(estimateCost(1_000_000, 1_000_000, { input: 0.3, output: 1.2 }), 1.5);
  assert.equal(estimateCost(8000, 6000, { input: 0.3, output: 1.2 }), 0.0096);
  const dir = mkdtempSync(join(tmpdir(), 'braco-uso-'));
  const file = join(dir, 'uso.jsonl');
  const now = new Date('2026-10-24T12:00:00Z');
  appendUsage({ at: '2026-10-24T10:00:00Z', model: 'm', inputTokens: 10, outputTokens: 5, costUsd: 0.001, ok: true }, file);
  appendUsage({ at: '2026-10-24T11:00:00Z', model: 'm', inputTokens: 0, outputTokens: 0, costUsd: 0, ok: false, error: 'limite' }, file);
  appendUsage({ at: '2026-10-01T11:00:00Z', model: 'm', inputTokens: 99, outputTokens: 99, costUsd: 9, ok: true }, file);
  const text = readFileSync(file, 'utf8');
  const s = summarize(text + 'linha quebrada\n', 7, now);
  assert.deepEqual(s, [{ day: '2026-10-24', model: 'm', calls: 2, errors: 1, inputTokens: 10, outputTokens: 5, costUsd: 0.001 }]);
});
