import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { transcribe, VENV_PYTHON } from '../src/transcribe.ts';

test('rejeita áudio inexistente', async () => {
  await assert.rejects(transcribe(join(import.meta.dirname, 'nao-existe.oga')), /não encontrado|venv ausente/);
});

// test/audio/ não vai para o git; o teste de ponta a ponta só roda onde o áudio e o venv existem.
const sample = join(import.meta.dirname, '..', 'test', 'audio', 'teste.oga');
test('transcreve um .oga em português', { skip: !existsSync(sample) || !existsSync(VENV_PYTHON), timeout: 300_000 }, async () => {
  const text = await transcribe(sample);
  assert.match(text.toLowerCase(), /testes do projeto/);
});
