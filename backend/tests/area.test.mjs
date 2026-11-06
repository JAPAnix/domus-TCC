import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCpf, isValidCnpj, maskDocument, maskPayoutKey } from '../src/utils/taxDocument.js';
import { NOTIFICATION_CATALOG, defaultPreferences, resolvePreferences, applyPreferencePatch } from '../src/utils/notificationPrefs.js';
import { taxSchema, profileSchema, notificationsSchema, localeSchema, deleteConfirmSchema } from '../src/validators/areaValidator.js';
import { deviceLabel, maskIp } from '../src/services/sessionService.js';

test('valida CPF e CNPJ pelos dígitos verificadores', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('52998224725'), true);
  for (const bad of ['529.982.247-24', '111.111.111-11', '123', '', 'abc']) assert.equal(isValidCpf(bad), false, bad);
  assert.equal(isValidCnpj('11.222.333/0001-81'), true);
  for (const bad of ['11.222.333/0001-82', '00.000.000/0000-00', '123', '']) assert.equal(isValidCnpj(bad), false, bad);
});

test('mascara documentos e chaves Pix sem mostrar o valor inteiro', () => {
  assert.equal(maskDocument('cpf', '52998224725'), '•••.•••.•••-25');
  assert.equal(maskDocument('cnpj', '11222333000181'), '••.•••.•••/••••-81');
  assert.equal(maskPayoutKey('email', 'maria@exemplo.com'), 'm•••@exemplo.com');
  assert.ok(!maskPayoutKey('phone', '+5511999998888').includes('99999'));
  assert.equal(maskDocument('cpf', null), null);
});

test('preferências: contas ligadas, ofertas desligadas e só canais que existem', () => {
  const defaults = defaultPreferences();
  for (const item of NOTIFICATION_CATALOG.account) for (const channel of item.channels) assert.equal(defaults[item.key][channel], true);
  for (const item of NOTIFICATION_CATALOG.offers) for (const channel of item.channels) assert.equal(defaults[item.key][channel], false);
  const channels = new Set([...NOTIFICATION_CATALOG.account, ...NOTIFICATION_CATALOG.offers].flatMap((item) => item.channels));
  assert.deepEqual([...channels].sort(), ['app', 'email']);
  const merged = resolvePreferences({ proposal_received: { email: false }, lixo: { app: true } });
  assert.equal(merged.proposal_received.email, false);
  assert.equal(merged.proposal_received.app, true);
  assert.equal('lixo' in merged, false);
  assert.equal(resolvePreferences(null).review_received.app, true);
});

test('alteração de preferências recusa tipos e canais desconhecidos', () => {
  const next = applyPreferencePatch(null, { pro_tips: { email: true } });
  assert.equal(next.pro_tips.email, true);
  assert.equal(next.proposal_received.app, true);
  assert.throws(() => applyPreferencePatch(null, { inexistente: { app: true } }), (e) => e.status === 400);
  assert.throws(() => applyPreferencePatch(null, { pro_tips: { app: true } }), (e) => e.status === 400);
  assert.equal(notificationsSchema.safeParse({ proposal_received: { app: 'sim' } }).success, false);
});

test('impostos: documento e chave Pix são validados', () => {
  const base = { document_type: 'cpf', document: '529.982.247-25', holder_name: 'Maria da Silva' };
  assert.equal(taxSchema.safeParse(base).success, true);
  assert.equal(taxSchema.safeParse({ ...base, document: '111.111.111-11' }).success, false);
  assert.equal(taxSchema.safeParse({ ...base, document_type: 'cnpj' }).success, false);
  assert.equal(taxSchema.safeParse({ ...base, payout_key_type: 'email', payout_key: 'nao-e-email' }).success, false);
  assert.equal(taxSchema.safeParse({ ...base, payout_key_type: 'email', payout_key: 'maria@exemplo.com' }).success, true);
  assert.equal(taxSchema.safeParse({ ...base, payout_key_type: 'phone', payout_key: '(11) 99999-8888' }).success, true);
  assert.equal(taxSchema.safeParse({ ...base, payout_key_type: 'cpf' }).success, false);
});

test('perfil: limites de tamanho e de quantidade', () => {
  assert.equal(profileSchema.safeParse({ about: 'Eletricista há 10 anos.', languages: ['Português', 'Inglês'], years_experience: 10 }).success, true);
  assert.equal(profileSchema.safeParse({ about: 'a'.repeat(1001) }).success, false);
  assert.equal(profileSchema.safeParse({ languages: Array(11).fill('x') }).success, false);
  assert.equal(profileSchema.safeParse({ years_experience: 61 }).success, false);
  assert.equal(profileSchema.safeParse({ years_experience: 1.5 }).success, false);
  assert.equal(profileSchema.safeParse({ profile_picture_url: 'javascript:alert(1)' }).success, false);
  assert.equal(profileSchema.safeParse({ state: 'SPP' }).success, false);
});

test('idioma e moeda aceitam só o que existe; exclusão exige a palavra EXCLUIR', () => {
  assert.equal(localeSchema.safeParse({ language: 'pt-BR', currency: 'BRL' }).success, true);
  assert.equal(localeSchema.safeParse({ language: 'en-US', currency: 'BRL' }).success, false);
  assert.equal(localeSchema.safeParse({ language: 'pt-BR', currency: 'USD' }).success, false);
  assert.equal(deleteConfirmSchema.safeParse({ token: 'x'.repeat(30), confirmation: 'excluir' }).success, false);
  assert.equal(deleteConfirmSchema.safeParse({ token: 'x'.repeat(30), confirmation: 'EXCLUIR' }).success, true);
});

test('sessões mostram dispositivo legível e IP parcial', () => {
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537'), 'Chrome em Windows');
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Edg/120'), 'Edge em Windows');
  assert.equal(deviceLabel(''), 'Navegador em sistema desconhecido');
  assert.equal(maskIp('::ffff:192.168.10.20'), '192.168.•.•');
  assert.ok(!maskIp('2001:db8:abcd:1::1').includes('abcd'));
});
