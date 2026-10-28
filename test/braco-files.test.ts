import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isSecretName, readContextFiles } from '../src/braco/files.ts';
import { loadConfig, parseConfig } from '../src/braco/config.ts';

const limits = { maxFiles: 3, maxTotalBytes: 1000 };

function sandbox() {
  const base = mkdtempSync(join(tmpdir(), 'braco-'));
  const work = join(base, 'projeto');
  const home = join(base, 'home');
  mkdirSync(join(work, 'src'), { recursive: true });
  mkdirSync(join(home, '.claude', 'channels'), { recursive: true });
  writeFileSync(join(work, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(work, '.env'), 'X=1\n');
  writeFileSync(join(base, 'fora.txt'), 'fora\n');
  return { base, work, home };
}

test('braço: lê arquivos dentro da pasta, com caminho relativo e "/"', () => {
  const { work, home } = sandbox();
  const r = readContextFiles(work, ['src/a.ts'], limits, home);
  assert.ok(r.ok);
  assert.equal(r.files[0].path, 'src/a.ts');
  assert.equal(r.files[0].content, 'export const a = 1;\n');
});

test('braço: barra "../", caminho absoluto fora e arquivo inexistente', () => {
  const { base, work, home } = sandbox();
  for (const f of ['../fora.txt', join(base, 'fora.txt')]) {
    const r = readContextFiles(work, [f], limits, home);
    assert.ok(!r.ok && /fora da pasta/.test(r.reason), f);
  }
  const r = readContextFiles(work, ['nao-existe.ts'], limits, home);
  assert.ok(!r.ok && /não existe/.test(r.reason));
});

test('braço: barra arquivos de senha e chave', () => {
  assert.ok(isSecretName('.env'));
  assert.ok(isSecretName('config/.env.local'));
  assert.ok(isSecretName('certs/server.PEM'));
  assert.ok(isSecretName('id.key'));
  assert.ok(!isSecretName('src/env.ts'));
  const { work, home } = sandbox();
  const r = readContextFiles(work, ['.env'], limits, home);
  assert.ok(!r.ok && /senha ou chave/.test(r.reason));
});

test('braço: barra a pasta de credenciais do Telegram mesmo dentro da workdir', () => {
  const { base } = sandbox();
  // home dentro da workdir: o caso em que a pasta da tarefa é a própria home
  const home = join(base, 'h2');
  mkdirSync(join(home, '.claude', 'channels', 'telegram'), { recursive: true });
  writeFileSync(join(home, '.claude', 'channels', 'telegram', 'access.json'), '{}');
  const r = readContextFiles(home, ['.claude/channels/telegram/access.json'], limits, home);
  assert.ok(!r.ok && /credenciais/.test(r.reason));
});

test('braço: barra atalho (symlink) que aponta para fora', (t) => {
  const { base, work, home } = sandbox();
  try {
    symlinkSync(join(base, 'fora.txt'), join(work, 'atalho.txt'));
  } catch {
    t.skip('sem permissão para criar symlink neste Windows');
    return;
  }
  const r = readContextFiles(work, ['atalho.txt'], limits, home);
  assert.ok(!r.ok && /fora da pasta/.test(r.reason));
});

test('braço: barra atalho de pasta (junction) que aponta para fora', () => {
  const { base, work, home } = sandbox();
  mkdirSync(join(base, 'segredo'));
  writeFileSync(join(base, 'segredo', 'x.txt'), 'x');
  symlinkSync(join(base, 'segredo'), join(work, 'link'), 'junction');
  const r = readContextFiles(work, ['link/x.txt'], limits, home);
  assert.ok(!r.ok && /fora da pasta/.test(r.reason));
});

test('braço: respeita limite de arquivos e de tamanho', () => {
  const { work, home } = sandbox();
  const r1 = readContextFiles(work, ['a', 'b', 'c', 'd'], limits, home);
  assert.ok(!r1.ok && /no máximo 3/.test(r1.reason));
  writeFileSync(join(work, 'grande.txt'), 'x'.repeat(1001));
  const r2 = readContextFiles(work, ['grande.txt'], limits, home);
  assert.ok(!r2.ok && /bytes/.test(r2.reason));
});

const good = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  allowedHosts: ['api.deepseek.com'],
  priceUsdPerM: { input: 0.3, output: 1.2 },
  timeoutMs: 1000,
  limits: { maxFiles: 3, maxTotalBytes: 100 },
};

test('braço: configuração do projeto é válida', () => {
  const r = loadConfig();
  assert.ok(r.ok, r.ok ? '' : r.reason);
});

test('braço: configuração recusa host fora da lista, http externo e campos faltando', () => {
  assert.ok(parseConfig(good).ok);
  const host = parseConfig({ ...good, baseUrl: 'https://evil.example.com' });
  assert.ok(!host.ok && /allowedHosts/.test(host.reason));
  const http = parseConfig({ ...good, baseUrl: 'http://api.deepseek.com' });
  assert.ok(!http.ok && /https/.test(http.reason));
  assert.ok(parseConfig({ ...good, baseUrl: 'http://127.0.0.1:9999', allowedHosts: ['127.0.0.1'] }).ok);
  assert.ok(!parseConfig({ ...good, model: '' }).ok);
  assert.ok(!parseConfig({ ...good, limits: { maxFiles: 0, maxTotalBytes: 1 } }).ok);
});
