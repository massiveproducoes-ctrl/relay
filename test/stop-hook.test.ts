import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clip, decide, lastUserKind, lastUserOrigin, summarize } from '../src/stop-hook.ts';

const now = new Date('2026-10-20T10:00:00Z');

test('stop hook: marca proximo=true quando a mensagem tem o bloco', () => {
  const raw = JSON.stringify({ last_assistant_message: 'x\n➡️ Próximo: 1) a', permission_mode: 'default', stop_hook_active: false });
  const s = summarize(raw, now);
  assert.match(s, /proximo=true/);
  assert.match(s, /ativo=false/);
  assert.match(s, /modo=default/);
});

test('stop hook: marca proximo=false e não vaza o texto da mensagem', () => {
  const raw = JSON.stringify({ last_assistant_message: 'segredo-123', stop_hook_active: true });
  const s = summarize(raw, now);
  assert.match(s, /proximo=false/);
  assert.match(s, /ativo=true/);
  assert.ok(!s.includes('segredo-123'));
});

test('stop hook: aguenta entrada quebrada', () => {
  assert.match(summarize('{nao-json', now), /entrada ilegivel/);
});

const user = (content: unknown) => JSON.stringify({ type: 'user', message: { content } });

test('stop hook: origem = último pedido, ignorando resultado de ferramenta', () => {
  const tg = user('<channel source="plugin:telegram:telegram" chat_id="1">oi</channel>');
  const res = user([{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }]);
  const asst = JSON.stringify({ type: 'assistant', message: { content: [] } });
  assert.equal(lastUserOrigin([tg, asst, res].join('\n')), 'telegram');
  assert.equal(lastUserOrigin([tg, user('faça isso'), res].join('\n')), 'other');
  assert.equal(lastUserOrigin(''), 'unknown');
  assert.equal(lastUserOrigin('lixo\n{nao-json'), 'unknown');
});

test('stop hook: diagnóstico informa só o tipo do último pedido, sem texto', () => {
  const tg = user('<channel source="plugin:telegram:telegram" chat_id="1">segredo-123</channel>');
  const outro = user('<channel source="plugin:outro" chat_id="1">oi</channel>');
  const res = user([{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }]);
  assert.equal(lastUserKind([tg, res].join('\n')), 'canal-telegram');
  assert.equal(lastUserKind([tg, outro].join('\n')), 'canal-outro');
  assert.equal(lastUserKind([tg, user('faça isso')].join('\n')), 'texto');
  assert.equal(lastUserKind(''), 'nenhum');
  assert.ok(!lastUserKind(tg).includes('segredo-123'));
});

test('stop hook: decide enviar, bloquear uma vez ou ignorar', () => {
  assert.equal(decide('telegram', 'x ➡️ Próximo: 1) a', false), 'send');
  assert.equal(decide('telegram', 'sem bloco', false), 'block');
  assert.equal(decide('telegram', 'sem bloco', true), 'skip');
  assert.equal(decide('other', 'x ➡️ Próximo: 1) a', false), 'skip');
  assert.equal(decide('unknown', 'sem bloco', false), 'skip');
});

test('stop hook: corta mensagem acima do limite do Telegram', () => {
  assert.equal(clip('curta'), 'curta');
  const c = clip('a'.repeat(5000));
  assert.ok(c.length <= 4096);
  assert.match(c, /cortado/);
});

test('stop hook: o resumo mostra origem e ação sem vazar o texto', () => {
  const raw = JSON.stringify({ last_assistant_message: 'segredo ➡️ Próximo: 1) a' });
  const s = summarize(raw, now, 'telegram');
  assert.match(s, /origem=telegram/);
  assert.match(s, /acao=send/);
  assert.ok(!s.includes('segredo'));
});

test('stop hook: o aviso do próprio hook não conta como pedido', () => {
  const tg = user('<channel source="plugin:telegram:telegram" chat_id="1">oi</channel>');
  const fb = user('Stop hook feedback:\nFeche com o bloco');
  assert.equal(lastUserOrigin([tg, fb].join('\n')), 'telegram');
});
