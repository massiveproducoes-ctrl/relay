import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatDuration, formatStatus } from '../src/format.ts';
import { parseTasklist } from '../src/proc.ts';
import { lastSessionTime, projectSlug, shouldContinue } from '../src/session.ts';
import { readState, writeState, type RelayState } from '../src/state.ts';
import { normalizeFolder, trustFromConfig } from '../src/trust.ts';

const base: RelayState = {
  version: 1,
  folder: 'C:\\dev\\vrx-relay',
  windowPid: 1234,
  windowImage: 'powershell.exe',
  keepAwakePid: 5678,
  watcherPid: null,
  startedAt: '2026-10-19T22:00:00.000Z',
  continued: true,
  stoppedAt: null,
};

test('estado: grava e lê de volta; arquivo quebrado vira "não iniciado"', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relay-'));
  const file = join(dir, 'sub', 'state.json');
  writeState(base, file);
  assert.deepEqual(readState(file), base);
  writeFileSync(file, '{ quebrado');
  assert.equal(readState(file), null);
  writeFileSync(file, JSON.stringify({ ...base, windowPid: 'x' }));
  assert.equal(readState(file), null);
  assert.equal(readState(join(dir, 'nao-existe.json')), null);
});

test('confiança: pasta exata, pasta-mãe, barras e maiúsculas', () => {
  const cfg = { projects: { 'C:/dev/vrx-relay': { hasTrustDialogAccepted: true }, 'C:/outra': { hasTrustDialogAccepted: false } } };
  assert.deepEqual(trustFromConfig(cfg, 'c:\\DEV\\vrx-relay\\'), { status: 'trusted', via: 'pasta' });
  assert.deepEqual(trustFromConfig(cfg, 'C:\\dev\\vrx-relay\\sub'), { status: 'trusted', via: 'pasta-mae' });
  assert.deepEqual(trustFromConfig(cfg, 'C:\\outra'), { status: 'untrusted' });
  assert.deepEqual(trustFromConfig({}, 'C:\\dev'), { status: 'untrusted' });
  assert.deepEqual(trustFromConfig(null, 'C:\\dev'), { status: 'untrusted' });
  assert.equal(normalizeFolder('C:\\'), 'c:/');
});

test('confiança: a raiz do disco confiada vale para as subpastas', () => {
  const cfg = { projects: { 'C:/': { hasTrustDialogAccepted: true } } };
  assert.deepEqual(trustFromConfig(cfg, 'C:\\dev\\vrx-relay'), { status: 'trusted', via: 'pasta-mae' });
});

test('sessão: nome da pasta de conversas e regra das 4 horas', () => {
  assert.equal(projectSlug('C:\\dev\\vrx-relay'), 'C--dev-vrx-relay');
  const now = new Date('2026-10-19T22:00:00Z');
  assert.equal(shouldContinue(new Date('2026-10-19T19:00:00Z'), now), true);
  assert.equal(shouldContinue(new Date('2026-10-19T17:59:00Z'), now), false);
  assert.equal(shouldContinue(null, now), false);
  assert.equal(shouldContinue(new Date('2026-10-19T23:00:00Z'), now), false);
});

test('sessão: acha a conversa mais recente ignorando maiúsculas do disco', () => {
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const dir = join(home, '.claude', 'projects', 'c--dev-vrx-relay');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'a.jsonl'), '');
  writeFileSync(join(dir, 'b.jsonl'), '');
  writeFileSync(join(dir, 'c.txt'), '');
  const old = new Date('2026-10-18T10:00:00Z');
  const recent = new Date('2026-10-19T21:00:00Z');
  utimesSync(join(dir, 'a.jsonl'), old, old);
  utimesSync(join(dir, 'b.jsonl'), recent, recent);
  assert.equal(lastSessionTime('C:\\dev\\vrx-relay', home)?.getTime(), recent.getTime());
  assert.equal(lastSessionTime('C:\\outra', home), null);
});

test('tasklist: lê o executável; aviso de "nenhum processo" vira null', () => {
  assert.equal(parseTasklist('"powershell.exe","1234","Console","1","80.000 K"\r\n', 1234), 'powershell.exe');
  assert.equal(parseTasklist('INFORMAÇÕES: Não há tarefas em execução que correspondam aos critérios.', 1234), null);
  assert.equal(parseTasklist('"cmd.exe","12345","Console","1","1 K"', 1234), null);
});

test('duração em português', () => {
  assert.equal(formatDuration(30_000), 'menos de 1 min');
  assert.equal(formatDuration(45 * 60_000), '45 min');
  assert.equal(formatDuration(125 * 60_000), '2 h 5 min');
  assert.equal(formatDuration(26 * 3_600_000), '1 d 2 h');
});

test('status: sem estado, tudo vivo, e claude caído com vigia parado em destaque', () => {
  const now = new Date('2026-10-19T23:05:00Z');
  assert.equal(formatStatus(null, { window: false, keepAwake: false, watcher: false }, now).code, 2);

  const allOk = formatStatus({ ...base, watcherPid: 999 }, { window: true, keepAwake: true, watcher: true }, now);
  assert.equal(allOk.code, 0);
  assert.match(allOk.text, /rodando há 1 h 5 min/);

  const down = formatStatus(base, { window: false, keepAwake: false, watcher: false }, now,
    { exitCode: 1, at: '2026-10-19T23:00:00Z' }, true);
  assert.equal(down.code, 1);
  assert.match(down.text, /CAIU/);
  assert.match(down.text, /código 1/);
  assert.match(down.text, /\x1b\[1;31m‼️ VIGIA PARADO/);
  assert.match(down.text, /relay start/);

  const stopped = formatStatus({ ...base, stoppedAt: '2026-10-19T23:00:00Z' }, { window: false, keepAwake: false, watcher: false }, now);
  assert.equal(stopped.code, 2);
  assert.match(stopped.text, /relay stop/);
});

test('status: saída antiga (de antes deste start) não é mostrada como motivo', () => {
  const now = new Date('2026-10-19T23:05:00Z');
  const r = formatStatus(base, { window: false, keepAwake: true, watcher: false }, now, { exitCode: 0, at: '2026-10-18T10:00:00Z' });
  assert.doesNotMatch(r.text, /código 0/);
  assert.match(r.text, /fechada ou processo encerrado/);
});
