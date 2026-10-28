import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvToken, parseRecipients, sendNotice } from '../src/telegram.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_NOTICES_PER_HOUR, MAX_RESTARTS, RESTART_WINDOW_MS, canNotify, decideRestart, emptyMemory,
  giveUpMessage, restartMessage,
} from '../src/watch-logic.ts';

test('vigia: religa até 5 vezes em 30 min e na 6ª desiste', () => {
  const mem = emptyMemory();
  const t0 = 1_000_000;
  for (let i = 1; i <= MAX_RESTARTS; i++) {
    assert.deepEqual(decideRestart(mem, t0 + i * 1000), { action: 'restart', attempt: i });
    mem.restarts.push(t0 + i * 1000);
  }
  assert.deepEqual(decideRestart(mem, t0 + 10_000), { action: 'giveup' });
});

test('vigia: quedas antigas (fora dos 30 min) não contam', () => {
  const mem = emptyMemory();
  mem.restarts.push(0, 1, 2, 3, 4);
  assert.deepEqual(decideRestart(mem, RESTART_WINDOW_MS + 10), { action: 'restart', attempt: 1 });
});

test('vigia: no máximo 4 avisos por hora', () => {
  const mem = emptyMemory();
  for (let i = 0; i < MAX_NOTICES_PER_HOUR; i++) {
    assert.equal(canNotify(mem, 1000 + i), true);
    mem.notices.push(1000 + i);
  }
  assert.equal(canNotify(mem, 5000), false);
  assert.equal(canNotify(mem, 3_700_000), true);
});

test('vigia: aviso crítico (desistiu) passa mesmo com o limite por hora esgotado', () => {
  const mem = emptyMemory();
  for (let i = 0; i < MAX_NOTICES_PER_HOUR; i++) mem.notices.push(1000 + i);
  assert.equal(canNotify(mem, 5000), false);
  assert.equal(canNotify(mem, 5000, true), true);
});

test('vigia: mensagens neutras, sem pasta nem ID', () => {
  assert.match(restartMessage(new Date(), 2), /tentativa 2 de 5/);
  assert.match(giveUpMessage(), /relay start/);
  assert.doesNotMatch(restartMessage(new Date(), 1), /C:\\|\d{6,}/);
});

test('telegram: lê o token do formato CHAVE=valor e ignora o resto', () => {
  assert.equal(parseEnvToken('OUTRA=1\r\nTELEGRAM_BOT_TOKEN=abc:def\r\n'), 'abc:def');
  assert.equal(parseEnvToken('TELEGRAM_BOT_TOKEN="abc:def"'), 'abc:def');
  assert.equal(parseEnvToken('TELEGRAM_BOT_TOKEN='), null);
  assert.equal(parseEnvToken(''), null);
});

test('telegram: destinatários só numéricos, no máximo 3', () => {
  assert.deepEqual(parseRecipients({ allowFrom: ['1', '2', 'x', 3, '4', '5'] }), ['1', '2', '4']);
  assert.deepEqual(parseRecipients({}), []);
  assert.deepEqual(parseRecipients(null), []);
});

test('telegram: sem credenciais, falha sem rede e sem vazar nada', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tg-'));
  const semArquivos = await sendNotice('x', dir);
  assert.equal(semArquivos.ok, false);
  writeFileSync(join(dir, '.env'), 'TELEGRAM_BOT_TOKEN=SEGREDO-123\n');
  writeFileSync(join(dir, 'access.json'), JSON.stringify({ allowFrom: [] }));
  const semDestino = await sendNotice('x', dir);
  assert.deepEqual(semDestino, { ok: false, reason: 'sem destinatário em access.json' });
  assert.doesNotMatch(JSON.stringify(semDestino), /SEGREDO/);
});
