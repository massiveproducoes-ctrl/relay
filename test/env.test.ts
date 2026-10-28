import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanEnv } from '../src/env.ts';

test('remove as três variáveis e reporta só os nomes', () => {
  const source = {
    ANTHROPIC_BASE_URL: 'https://exemplo.invalido',
    ANTHROPIC_AUTH_TOKEN: 'segredo-1',
    ANTHROPIC_API_KEY: 'segredo-2',
    PATH: 'x',
  };
  const { env, removed } = cleanEnv(source);
  assert.deepEqual(removed.sort(), [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
  ]);
  assert.equal(env.ANTHROPIC_BASE_URL, undefined);
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.PATH, 'x');
  assert.ok(!removed.join(' ').includes('segredo'));
});

test('não altera o ambiente de origem', () => {
  const source = { ANTHROPIC_API_KEY: 'segredo' };
  cleanEnv(source);
  assert.equal(source.ANTHROPIC_API_KEY, 'segredo');
});

test('sem variáveis bloqueadas, nada é removido', () => {
  const { env, removed } = cleanEnv({ PATH: 'x', HOME: 'y' });
  assert.deepEqual(removed, []);
  assert.deepEqual(env, { PATH: 'x', HOME: 'y' });
});
