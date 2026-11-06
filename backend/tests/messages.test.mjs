import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMessageText, previewOf, fillTemplate, suggestReplies, scheduledDueAt, withinSendWindow, MESSAGE_LIMITS } from '../src/utils/messageRules.js';

test('texto da mensagem: remove controles e marcas invisíveis, mantém HTML como texto', () => {
  assert.equal(cleanMessageText('a' + String.fromCharCode(0) + 'b' + String.fromCharCode(0x202e) + 'c'), 'abc');
  assert.equal(cleanMessageText('<b>oi</b> <script>x()</script>'), '<b>oi</b> <script>x()</script>');
  assert.equal(cleanMessageText('a\r\n\r\n\r\n\r\nb  '), 'a\n\nb');
  assert.equal(cleanMessageText(null), '');
});

test('prévia: uma linha, limitada, e "Foto" quando só há imagem', () => {
  assert.equal(previewOf('oi\n\ntudo  bem?'), 'oi tudo bem?');
  assert.equal(previewOf('x'.repeat(500)).length, MESSAGE_LIMITS.preview);
  assert.equal(previewOf('', true), 'Foto');
  assert.equal(previewOf('', false), '');
});

test('variáveis do modelo são trocadas e as desconhecidas ficam como estão', () => {
  const vars = { nome_do_cliente: 'Ana', servico: 'Chuveiro', data: '10/12/2026', nome_do_profissional: 'Beto' };
  assert.equal(fillTemplate('Oi {nome_do_cliente}, sobre {servico} em {data}. {outra}', vars), 'Oi Ana, sobre Chuveiro em 10/12/2026. {outra}');
});

test('sugestões por regra e pelos modelos do usuário', () => {
  assert.deepEqual(suggestReplies('', []), []);
  assert.equal(suggestReplies('Qual o preço?', [])[0].source, 'rule');
  const replies = [{ title: 'Endereço do ateliê', text: 'Fico na Rua das Flores, 10.' }];
  const result = suggestReplies('Qual o endereço de vocês?', replies);
  assert.equal(result[0].source, 'quick_reply');
  assert.equal(result[0].text, 'Fico na Rua das Flores, 10.');
  assert.ok(result.length <= 3);
  assert.equal(new Set(result.map((item) => item.text)).size, result.length);
  assert.deepEqual(suggestReplies('Bom dia', [])[0].text, 'Olá! Como posso ajudar?');
});

test('envio programado: horário de vencimento e janela útil', () => {
  const order = { scheduledDate: new Date('2026-12-10T00:00:00Z'), completedAt: new Date('2026-12-10T20:00:00Z') };
  assert.equal(scheduledDueAt('before_service', order, 24).toISOString(), '2026-12-09T11:00:00.000Z');
  assert.equal(scheduledDueAt('after_service', order, 2).toISOString(), '2026-12-10T22:00:00.000Z');
  assert.equal(scheduledDueAt('review_request', { scheduledDate: order.scheduledDate }, 2), null);
  assert.equal(scheduledDueAt('none', order, 2), null);
  assert.equal(withinSendWindow('before_service', order, new Date('2026-12-09T00:00:00Z')), true);
  assert.equal(withinSendWindow('before_service', order, new Date('2026-12-12T00:00:00Z')), false);
  assert.equal(withinSendWindow('after_service', order, new Date('2026-12-14T00:00:00Z')), true);
  assert.equal(withinSendWindow('after_service', order, new Date('2027-02-01T00:00:00Z')), false);
});
