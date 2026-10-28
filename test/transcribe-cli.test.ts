import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAudioPath } from '../src/transcribe-cli.ts';

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'cli-'));
  const inbox = join(base, 'inbox');
  mkdirSync(inbox);
  writeFileSync(join(inbox, 'voz.oga'), 'x');
  writeFileSync(join(inbox, 'nota.txt'), 'x');
  writeFileSync(join(base, 'fora.oga'), 'x');
  return { base, inbox };
}

test('cli de voz: aceita áudio dentro da inbox', () => {
  const { inbox } = setup();
  const r = checkAudioPath(join(inbox, 'voz.oga'), inbox);
  assert.equal(r.ok, true);
});

test('cli de voz: recusa sem argumento, extensão errada e arquivo inexistente', () => {
  const { inbox } = setup();
  assert.equal(checkAudioPath(undefined, inbox).ok, false);
  assert.equal(checkAudioPath(join(inbox, 'nota.txt'), inbox).ok, false);
  assert.equal(checkAudioPath(join(inbox, 'nao-existe.oga'), inbox).ok, false);
});

test('cli de voz: recusa áudio fora da inbox, inclusive com ".."', () => {
  const { base, inbox } = setup();
  assert.equal(checkAudioPath(join(base, 'fora.oga'), inbox).ok, false);
  assert.equal(checkAudioPath(join(inbox, '..', 'fora.oga'), inbox).ok, false);
});

test('cli de voz: recusa link na inbox que aponta para fora', (t) => {
  const { base, inbox } = setup();
  try {
    symlinkSync(join(base, 'fora.oga'), join(inbox, 'link.oga'));
  } catch {
    t.skip('sem permissão para criar link neste sistema');
    return;
  }
  assert.equal(checkAudioPath(join(inbox, 'link.oga'), inbox).ok, false);
});
