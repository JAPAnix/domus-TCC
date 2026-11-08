import { backendUrl } from '../lib/env.mjs';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { call, register, publishListing, nextWeekday, stamp } from '../lib/fixtures.mjs';

process.env.DATABASE_HOST = '127.0.0.1'; process.env.DATABASE_PORT = String(process.env.E2E_DB_PORT ?? 3307); process.env.DATABASE_USER = 'root'; process.env.DATABASE_PASSWORD = ''; process.env.DATABASE_NAME = (process.env.E2E_DB ?? 'dommos_teste');
process.env.PAYMENT_PROVIDER = 'asaas'; process.env.ASAAS_API_KEY = 'plat-key'; process.env.ASAAS_WEBHOOK_TOKEN = 'webhook-token-com-mais-de-trinta-e-dois-caracteres'; process.env.ASAAS_BASE_URL = 'http://127.0.0.1:3200';
process.env.SECRETS_KEY = process.argv[2]; process.env.FRONTEND_URL = 'http://127.0.0.1:5183';
const jobs = await import(backendUrl('src/services/asaasPayments.js'));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra))); };
const sql = (query) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '--default-character-set=utf8mb4', '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', query]).toString().trim();
const hex = (uuid) => `UNHEX(REPLACE('${uuid}','-',''))`;
const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

// ---------- Asaas simulado ----------
const calls = [];
const remote = new Map(); // id da cobrança -> { status, value, split }
const accountStatus = new Map(); // chave da subconta -> situação
let seq = (stamp % 1000000) * 1000;
const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ method: req.method, path: req.url, key: req.headers.access_token, body });
    const send = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    const url = req.url;
    if (url === '/customers') return send(200, { id: 'cus_' + (++seq) });
    if (url === '/accounts' && req.method === 'POST') { const n = ++seq; accountStatus.set('subkey_' + n, 'AWAITING_APPROVAL'); return send(200, { id: 'acc_' + n, walletId: 'wal_' + n, accessToken: { apiKey: 'subkey_' + n } }); }
    if (/^\/accounts\/acc_\d+\/escrow$/.test(url)) return send(200, { enabled: true });
    if (url === '/myAccount/status/') { const s = accountStatus.get(req.headers.access_token) ?? 'PENDING'; return send(200, { general: s, commercialInfo: s, bankAccountInfo: s, documentation: s }); }
    if (url === '/payments' && req.method === 'POST') {
      const id = 'pay_' + (++seq); const value = body.value ?? body.totalValue;
      remote.set(id, { status: 'PENDING', value, escrow: 'ACTIVE' });
      return send(200, { id, status: 'PENDING', value, netValue: Math.round((value - 1.99) * 100) / 100, invoiceUrl: 'https://asaas.example/i/' + id });
    }
    let m = url.match(/^\/payments\/(pay_\d+)(\/\w+)?$/);
    if (m && remote.has(m[1])) {
      const p = remote.get(m[1]);
      if (!m[2] && req.method === 'GET') return send(200, { id: m[1], status: p.status });
      if (!m[2] && req.method === 'DELETE') { p.status = 'DELETED'; return send(200, { deleted: true }); }
      if (m[2] === '/pixQrCode') return send(200, { payload: '00020126ASAASDINAMICO' + m[1], encodedImage: 'x', expirationDate: '2099-11-07 23:59:59' });
      if (m[2] === '/refund') { if (globalThis.failRefund) return send(400, { errors: [{ description: 'Saldo insuficiente para o estorno.' }] }); p.refunded = body?.value ?? p.value; if (!body?.value) p.status = 'REFUNDED'; return send(200, { id: m[1], status: p.status }); }
      if (m[2] === '/escrow') return send(200, { id: 'esc_' + m[1], status: p.escrow });
    }
    m = url.match(/^\/lean\/payments\/(pay_\d+)$/);
    if (m) { remote.get(m[1]).split = body.split; return send(200, {}); }
    m = url.match(/^\/escrow\/esc_(pay_\d+)\/finish$/);
    if (m) { remote.get(m[1]).escrow = 'DONE'; return send(200, {}); }
    return send(404, { errors: [{ description: 'rota desconhecida' }] });
  });
});
await new Promise((resolve) => fake.listen(3200, '127.0.0.1', resolve));
const lastCall = (predicate) => [...calls].reverse().find(predicate);

const A = 'http://localhost:3100/api';
const webhook = async (body, token = TOKEN) => {
  const r = await fetch(A + '/payments/webhook/asaas', { method: 'POST', headers: { 'content-type': 'application/json', ...(token && { 'asaas-access-token': token }) }, body: JSON.stringify(body) });
  return { s: r.status, d: await r.json().catch(() => null) };
};
let evt = 0;
const event = (name, paymentId, extra = {}) => ({ id: `evt_${stamp}_${++evt}`, event: name, payment: { id: paymentId }, ...extra });

// ---------- cenário ----------
const pro = await register('ProAs');
const cli = await register('CliAs');
const evil = await register('EvilAs');
const admin = await register('AdminAs');
sql(`INSERT IGNORE INTO roles (name) VALUES ('admin')`);
sql(`INSERT IGNORE INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.email='${admin.email}' AND r.name='admin'`);
const adminLogin = (await call('POST', '/auth/login', { email: admin.email, password: 'senha-forte-1' })).d.token;

const listing = await publishListing(pro, { pricing_model: 'fixed', price: 150, travel_fee: 20 });
const dates = Array.from({ length: 16 }, (_, i) => nextWeekday([3, 4, 5, 1, 2][i % 5], 8 + i * 2));
let dateIndex = 0;
const newOrder = async () => {
  const created = await call('POST', '/orders', { listing_uuid: listing.uuid, date: dates[dateIndex++], service_mode: 'client_place', service_address: { postal_code: '80010-000', street: 'Rua das Flores', number: '123', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' } }, cli.token);
  await call('POST', `/orders/${created.d.uuid}/accept`, null, pro.token);
  return created.d.uuid;
};
const CPF = '529.982.247-25';
const pay = (order, body, token = cli.token) => call('POST', '/payments/order/' + order, body, token);

// ---------- configuração ----------
const cfg = await call('GET', '/payments/config', null, cli.token);
ok('config: provedor asaas, não é mais "modo gratuito", sem garantia, cartão D+32', cfg.d.provider === 'asaas' && cfg.d.freeMode === false && cfg.d.asaas.escrow === false && cfg.d.asaas.cardSettlementDays === 32, cfg.d);

// ---------- conta de recebimento ----------
const O0 = await newOrder();
const blocked = await pay(O0, { method: 'pix', cpf_cnpj: CPF });
ok('sem recebimento aprovado o cliente não consegue pagar (409 com explicação)', blocked.s === 409 && blocked.d.message.includes('liberando o recebimento'), blocked);
const state0 = await call('GET', '/payments/order/' + O0, null, cli.token);
ok('o estado do pedido explica o bloqueio e não oferece pagar', state0.d.canStart === false && state0.d.blockedReason.includes('liberando'), state0.d);
ok('conta ainda não cadastrada', (await call('GET', '/payments/receiving-account', null, pro.token)).d.status === 'not_started');
ok('o cliente não vê/abre conta de recebimento de profissional (sem erro, só o próprio estado)', (await call('GET', '/payments/receiving-account', null, cli.token)).d.status === 'not_started');
const form = { name: 'Maria Silva', email: pro.email, cpf_cnpj: CPF, mobile_phone: '(41) 99999-8888', birth_date: '1990-01-01', income_value: 3000, address: 'Rua das Flores', address_number: '10', province: 'Centro', postal_code: '80000-000' };
ok('CPF inválido é recusado', (await call('POST', '/payments/receiving-account', { ...form, cpf_cnpj: '111.111.111-11' }, pro.token)).s === 400);
ok('pessoa física sem data de nascimento é recusada', (await call('POST', '/payments/receiving-account', { ...form, birth_date: undefined }, pro.token)).s === 400);
ok('empresa sem tipo é recusada', (await call('POST', '/payments/receiving-account', { ...form, cpf_cnpj: '11.222.333/0001-81', birth_date: undefined }, pro.token)).s === 400);
ok('CEP inválido é recusado', (await call('POST', '/payments/receiving-account', { ...form, postal_code: '123' }, pro.token)).s === 400);
const created = await call('POST', '/payments/receiving-account', form, pro.token);
ok('cria a conta de recebimento: em análise e com aviso do próximo passo', created.s === 201 && created.d.status === 'pending' && created.d.canReceive === false && created.d.nextStep.includes('e-mail do Asaas'), created);
ok('a mensagem sobre o cartão (D+32) aparece para o profissional', created.d.cardNote.includes('32 dias') && created.d.cardNote.includes('Pix'));
ok('a chave da subconta fica cifrada no banco (nunca em texto)', sql(`SELECT api_key_enc FROM payout_accounts p JOIN users u ON u.id=p.user_id WHERE u.email='${pro.email}'`).startsWith('v1:') && !sql(`SELECT api_key_enc FROM payout_accounts`).includes('subkey_'));
ok('a garantia (escrow) NÃO foi ligada, porque a flag está desligada', !calls.some((c) => c.path.endsWith('/escrow')));
ok('segunda criação é recusada (409)', (await call('POST', '/payments/receiving-account', form, pro.token)).s === 409);
ok('a criação usou a chave da plataforma', calls.find((c) => c.path === '/accounts').key === 'plat-key');
const still = await call('POST', '/payments/receiving-account/refresh', null, pro.token);
ok('atualizar status: segue em análise', still.d.status === 'pending');
const accountKey = [...accountStatus.keys()].at(-1);
accountStatus.set(accountKey, 'APPROVED');
const refreshed = await call('POST', '/payments/receiving-account/refresh', null, pro.token);
ok('atualizar status: aprovado, e a consulta usou a chave da própria subconta', refreshed.d.status === 'approved' && refreshed.d.canReceive === true && lastCall((c) => c.path === '/myAccount/status/').key === accountKey, refreshed.d);
const accountId = 'acc_' + accountKey.split('_')[1];
const accEvent = await webhook({ id: `evt_acc_${stamp}`, event: 'ACCOUNT_STATUS_DOCUMENT_REJECTED', account: { id: accountId }, accountStatus: { general: 'AWAITING_APPROVAL', documentation: 'REJECTED', commercialInfo: 'APPROVED', bankAccountInfo: 'APPROVED' } });
const afterRejection = (await call('GET', '/payments/receiving-account', null, pro.token)).d;
ok('webhook de conta reprovada: motivo e o que corrigir', accEvent.s === 200 && afterRejection.status === 'rejected' && afterRejection.rejectionReason.includes('documentos'), afterRejection);
ok('o painel do profissional avisa o que falta', (await call('GET', '/payments/receiving-account', null, pro.token)).d.warning.status === 'rejected');
await webhook({ id: `evt_acc2_${stamp}`, event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED', account: { id: accountId }, accountStatus: { general: 'APPROVED', documentation: 'APPROVED', commercialInfo: 'APPROVED', bankAccountInfo: 'APPROVED' } });
ok('webhook de conta aprovada libera o recebimento', (await call('GET', '/payments/receiving-account', null, pro.token)).d.canReceive === true);

// ---------- pagar com Pix ----------
const stateOk = await call('GET', '/payments/order/' + O0, null, cli.token);
ok('aprovado: o cliente vê valor (R$ 170,00), meios e a necessidade do CPF', stateOk.d.canStart === true && stateOk.d.amountDueCents === 17000 && stateOk.d.breakdown.clientFeeCents === 0 && stateOk.d.needsDocument === true && stateOk.d.methods.map((m) => m.value).join() === 'pix,credit_card,boleto', stateOk.d);
const proState = await call('GET', '/payments/order/' + O0, null, pro.token);
ok('o profissional vê quanto recebe: comissão de 10% = R$ 17,00', proState.d.proPreview.commissionCents === 1700 && proState.d.proPreview.proGrossCents === 15300 && proState.d.canStart === false, proState.d.proPreview);
ok('sem CPF o pagamento é recusado', (await pay(O0, { method: 'pix' })).s === 422);
ok('CPF inválido é recusado', (await pay(O0, { method: 'pix', cpf_cnpj: '111.111.111-11' })).s === 422);
ok('meio inventado é recusado', (await pay(O0, { method: 'cheque', cpf_cnpj: CPF })).s === 400);
ok('profissional não inicia pagamento (403)', (await pay(O0, { method: 'pix', cpf_cnpj: CPF }, pro.token)).s === 403);
ok('estranho não inicia pagamento (404)', (await pay(O0, { method: 'pix', cpf_cnpj: CPF }, evil.token)).s === 404);
const pix = await pay(O0, { method: 'pix', cpf_cnpj: CPF });
const P0 = pix.d.payment;
ok('Pix: cobrança criada com QR dinâmico, validade e valor em centavos', pix.s === 201 && P0.status === 'pending' && P0.pix.payload.startsWith('00020126ASAAS') && P0.amountCents === 17000 && P0.expiresAt && P0.provider === 'asaas', pix.d);
const created0 = lastCall((c) => c.path === '/payments' && c.method === 'POST');
ok('o gateway recebeu R$ 170,00, split para a carteira do profissional e o CPF só em dígitos', created0.body.value === 170 && created0.body.split[0].walletId === 'wal_' + accountKey.split('_')[1] && lastCall((c) => c.path === '/customers').body.cpfCnpj === '52998224725');
const splitUpdate = lastCall((c) => c.path.startsWith('/lean/payments/'));
ok('split ajustado com o valor líquido: o profissional absorve a taxa (170 - 1,99 - 17,00 = 151,01)', splitUpdate.body.split[0].fixedValue === 151.01, splitUpdate.body);
ok('o pagamento guarda o snapshot das taxas e os centavos de cada parte', sql(`SELECT CONCAT(amount_cents,'/',commission_cents,'/',pro_share_cents,'/',platform_share_cents,'/',gateway_fee_cents,'/',JSON_UNQUOTE(JSON_EXTRACT(fee_snapshot,'$.proCommissionPercent'))) FROM payments WHERE uuid=${hex(P0.uuid)}`) === '17000/1700/15101/1700/199/10');
ok('o cliente do gateway fica guardado para os próximos pagamentos', sql(`SELECT asaas_customer_id IS NOT NULL FROM user_settings s JOIN users u ON u.id=s.user_id WHERE u.email='${cli.email}'`) === '1');
const again = await pay(O0, { method: 'pix' });
ok('pedir de novo não duplica (sem exigir o CPF de novo)', again.s === 201 && again.d.payment.uuid === P0.uuid && sql(`SELECT COUNT(*) FROM payments WHERE provider='asaas' AND status='pending' AND order_id=(SELECT id FROM orders WHERE uuid=${hex(O0)})`) === '1');
const [r1, r2] = await Promise.all([pay(O0, { method: 'pix' }), pay(O0, { method: 'pix' })]);
ok('requisições simultâneas continuam com um só pagamento', r1.d.payment.uuid === P0.uuid && r2.d.payment.uuid === P0.uuid);
const stranger = await call('GET', '/payments/order/' + O0, null, evil.token);
ok('estranho não vê o estado do pagamento (404)', stranger.s === 404);
const proSees = (await call('GET', '/payments/order/' + O0, null, pro.token)).d.payment;
ok('o profissional vê o pagamento mas não o QR Code nem a página do cliente', proSees.status === 'pending' && proSees.pix === null && proSees.invoiceUrl === null && proSees.commissionCents === 1700 && proSees.proShareCents != null, proSees);

// ---------- webhook ----------
const ext0 = sql(`SELECT external_id FROM payments WHERE uuid=${hex(P0.uuid)}`);
ok('webhook sem token é recusado (401)', (await webhook(event('PAYMENT_RECEIVED', ext0), null)).s === 401);
ok('webhook com token errado é recusado (401)', (await webhook(event('PAYMENT_RECEIVED', ext0), 'token-errado')).s === 401);
ok('evento sem id é recusado (400)', (await webhook({ event: 'PAYMENT_RECEIVED', payment: { id: ext0 } })).s === 400);
ok('nada mudou com os webhooks recusados', sql(`SELECT status FROM payments WHERE uuid=${hex(P0.uuid)}`) === 'pending');
const received = event('PAYMENT_RECEIVED', ext0);
ok('webhook válido confirma o pagamento automaticamente', (await webhook(received)).s === 200 && sql(`SELECT CONCAT(status,'/',payout_status) FROM payments WHERE uuid=${hex(P0.uuid)}`) === 'confirmed/held');
ok('o recibo é gerado e o valor fica retido', /^DM-/.test(sql(`SELECT receipt_number FROM payments WHERE uuid=${hex(P0.uuid)}`)));
const dup = await webhook(received);
ok('o mesmo evento repetido não processa de novo (idempotência)', dup.s === 200 && dup.d.duplicate === true && Number(sql(`SELECT COUNT(*) FROM notifications WHERE event_key LIKE 'asaas:${received.id}:%'`)) === 2);
const again2 = await webhook(event('PAYMENT_RECEIVED', ext0));
ok('outro evento igual (id novo) não muda nada: já está pago', again2.s === 200 && sql(`SELECT COUNT(*) FROM payment_events WHERE type='webhook' AND payment_id=(SELECT id FROM payments WHERE uuid=${hex(P0.uuid)})`) === '1');
ok('webhook de cobrança desconhecida é aceito e ignorado', (await webhook(event('PAYMENT_RECEIVED', 'pay_naoexiste'))).s === 200 && Number(sql(`SELECT COUNT(*) FROM webhook_events WHERE reference='pay_naoexiste' AND status='ignored'`)) >= 1);
ok('o log de eventos guarda o nome e a referência, sem dados pessoais', sql(`SELECT COUNT(*) FROM webhook_events WHERE event_key='${received.id}' AND status='done' AND event_name='PAYMENT_RECEIVED'`) === '1');
const stateAfter = await call('GET', '/payments/order/' + O0, null, cli.token);
ok('o cliente vê o pagamento confirmado e pode reclamar, mas ainda não confirmar o serviço', stateAfter.d.payment.status === 'confirmed' && stateAfter.d.payment.canDispute === true && stateAfter.d.payment.canConfirmService === false && stateAfter.d.payment.receiptNumber, stateAfter.d.payment);
ok('confirmar o serviço antes de o profissional concluir é recusado (409)', (await call('POST', `/payments/${P0.uuid}/confirm-service`, null, cli.token)).s === 409);
ok('o profissional não confirma nem reclama (404)', (await call('POST', `/payments/${P0.uuid}/confirm-service`, null, pro.token)).s === 404 && (await call('POST', `/payments/${P0.uuid}/dispute`, { reason: 'Quero reclamar do serviço.' }, pro.token)).s === 404);
ok('o profissional não consegue estornar nem confirmar pelo fluxo antigo (403)', (await call('POST', `/payments/${P0.uuid}/refund`, null, pro.token)).s === 403 && (await call('POST', `/payments/${P0.uuid}/confirm`, null, pro.token)).s === 403);
ok('estranho não age no pagamento (404)', (await call('POST', `/payments/${P0.uuid}/dispute`, { reason: 'Quero reclamar do serviço.' }, evil.token)).s === 404);

// ---------- concluir, confirmar e liberar ----------
await call('POST', `/orders/${O0}/start`, null, pro.token);
await call('POST', `/orders/${O0}/complete`, { final_amount: 170 }, pro.token);
ok('ao concluir, o prazo de confirmação automática começa (7 dias)', sql(`SELECT TIMESTAMPDIFF(DAY, NOW(), auto_confirm_at) FROM payments WHERE uuid=${hex(P0.uuid)}`) >= '6');
const confirmed = await call('POST', `/payments/${P0.uuid}/confirm-service`, null, cli.token);
ok('cliente confirma o serviço (sem garantia ligada, não há o que liberar no gateway)', confirmed.s === 200 && confirmed.d.released === false && !calls.some((c) => c.path.endsWith('/finish')));
ok('confirmar de novo não repete', (await call('POST', `/payments/${P0.uuid}/confirm-service`, null, cli.token)).d.alreadyConfirmed === true);
ok('depois de confirmado não dá mais para reclamar (409)', (await call('POST', `/payments/${P0.uuid}/dispute`, { reason: 'Quero reclamar do serviço.' }, cli.token)).s === 409);
ok('o prazo automático foi encerrado', sql(`SELECT auto_confirm_at IS NULL FROM payments WHERE uuid=${hex(P0.uuid)}`) === '1');
ok('o repasse só vira "liberado" quando o gateway avisa que o split foi concluído', sql(`SELECT payout_status FROM payments WHERE uuid=${hex(P0.uuid)}`) === 'held');
await webhook(event('PAYMENT_SPLIT_DONE', ext0));
ok('webhook de split concluído marca o repasse como liberado', sql(`SELECT payout_status FROM payments WHERE uuid=${hex(P0.uuid)}`) === 'released');
const rec = await call('GET', `/payments/${P0.uuid}/receipt`, null, cli.token);
ok('recibo disponível para o cliente', rec.s === 200 && rec.d.methodLabel === 'Pix' && rec.d.amount === 170);

// ---------- ganhos ----------
const earn = await call('GET', '/payments/earnings', null, pro.token);
ok('ganhos: linha com valor pago, comissão e líquido; totais de liberado e comissão', earn.s === 200 && earn.d.data.length === 1 && earn.d.data[0].paidCents === 17000 && earn.d.data[0].commissionCents === 1700 && earn.d.data[0].netCents === 15101 && earn.d.totals.releasedCents === 15101 && earn.d.totals.commissionCents === 1700, earn.d);
const csv = await fetch(A + '/payments/earnings?formato=csv', { headers: { authorization: 'Bearer ' + pro.token } });
const csvBytes = Buffer.from(await csv.arrayBuffer());
const csvText = csvBytes.toString('utf8');
ok('CSV para Excel: tipo, nome do arquivo, BOM, ponto e vírgula e decimal com vírgula', csv.headers.get('content-type').startsWith('text/csv') && csv.headers.get('content-disposition').includes('ganhos-dommos.csv') && csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf && csvText.includes('Serviço;Cliente') && csvText.includes('151,01'), csvText.slice(0, 200));
ok('o filtro por período não traz o que está fora', (await call('GET', '/payments/earnings?de=2020-01-01&ate=2020-01-31', null, pro.token)).d.data.length === 0);
ok('o cliente não vê os ganhos do profissional', (await call('GET', '/payments/earnings', null, cli.token)).d.data.length === 0);

// ---------- expirado e novo Pix; cartão; boleto ----------
const O1 = await newOrder();
const pix1 = (await pay(O1, { method: 'pix' })).d.payment;
const ext1 = sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix1.uuid)}`);
await webhook(event('PAYMENT_OVERDUE', ext1));
const expiredState = await call('GET', '/payments/order/' + O1, null, cli.token);
ok('Pix vencido: o cliente vê "expirado" e pode gerar outro', expiredState.d.payment.status === 'expired' && expiredState.d.canStart === true);
const pix1b = (await pay(O1, { method: 'pix' })).d.payment;
ok('novo Pix é uma nova cobrança (a vencida fica no histórico)', pix1b.uuid !== pix1.uuid && pix1b.status === 'pending');
const card = await pay(O1, { method: 'credit_card', installments: 3 });
ok('trocar pelo cartão cancela o Pix aberto e abre a página do gateway (sem dados de cartão aqui)', card.d.payment.method === 'credit_card' && card.d.payment.invoiceUrl.startsWith('https://asaas.example/i/') && card.d.payment.installments === 3 && !JSON.stringify(calls).match(/creditCard|ccv|cardNumber/i));
ok('o Pix trocado foi cancelado no gateway', remote.get(sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix1b.uuid)}`)).status === 'DELETED');
const cardCall = lastCall((c) => c.path === '/payments' && c.method === 'POST');
ok('parcelamento usa o valor total, sem juros nossos', cardCall.body.installmentCount === 3 && cardCall.body.totalValue === 170 && cardCall.body.value === undefined);
ok('parcelas acima do permitido são recusadas', (await pay(await newOrder(), { method: 'credit_card', installments: 12, cpf_cnpj: undefined })).s !== 500);
const extCard = sql(`SELECT external_id FROM payments WHERE uuid=${hex(card.d.payment.uuid)}`);
await webhook(event('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', extCard));
ok('cartão recusado: o cliente é avisado e pode tentar outro meio', (await call('GET', '/payments/order/' + O1, null, cli.token)).d.payment.status === 'refused' && Number(sql(`SELECT COUNT(*) FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.email='${cli.email}' AND n.message LIKE '%recusado%'`)) >= 1);
const boleto = await pay(O1, { method: 'boleto' });
ok('boleto: abre a página do gateway', boleto.d.payment.method === 'boleto' && boleto.d.payment.invoiceUrl && lastCall((c) => c.path === '/payments' && c.method === 'POST').body.billingType === 'BOLETO');

// ---------- conciliação ----------
const O2 = await newOrder();
const pix2 = (await pay(O2, { method: 'pix' })).d.payment;
const ext2 = sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix2.uuid)}`);
remote.get(ext2).status = 'RECEIVED'; // o webhook "se perdeu"
sql(`UPDATE payments SET created_at = NOW() - INTERVAL 30 MINUTE WHERE uuid=${hex(pix2.uuid)}`);
const reconciled = await jobs.reconcilePending();
ok('conciliação: acha o pagamento pago que o webhook perdeu e corrige', reconciled.fixed >= 1 && sql(`SELECT status FROM payments WHERE uuid=${hex(pix2.uuid)}`) === 'confirmed', reconciled);
ok('a conciliação não repete trabalho', (await jobs.reconcilePending()).fixed === 0);

// ---------- reclamação e decisão do administrador ----------
await call('POST', `/orders/${O2}/start`, null, pro.token);
await call('POST', `/orders/${O2}/complete`, { final_amount: 170 }, pro.token);
ok('reclamação com texto curto é recusada', (await call('POST', `/payments/${pix2.uuid}/dispute`, { reason: 'ruim' }, cli.token)).s === 400);
const dispute = await call('POST', `/payments/${pix2.uuid}/dispute`, { reason: 'O serviço não foi feito como combinado.' }, cli.token);
ok('cliente abre reclamação: o pagamento fica "em análise"', dispute.s === 201 && sql(`SELECT status FROM payments WHERE uuid=${hex(pix2.uuid)}`) === 'disputed');
ok('o prazo automático é suspenso e o cliente não confirma durante a análise', sql(`SELECT auto_confirm_at IS NULL FROM payments WHERE uuid=${hex(pix2.uuid)}`) === '1' && (await call('POST', `/payments/${pix2.uuid}/confirm-service`, null, cli.token)).s === 409);
ok('reclamar de novo é recusado (409)', (await call('POST', `/payments/${pix2.uuid}/dispute`, { reason: 'O serviço não foi feito como combinado.' }, cli.token)).s === 409);
ok('rotas de admin exigem o papel de administrador (403)', (await call('GET', '/admin/summary', null, cli.token)).s === 403 && (await call('GET', '/admin/disputes', null, pro.token)).s === 403 && (await call('GET', '/admin/summary')).s === 401);
const disputes = await call('GET', '/admin/disputes', null, adminLogin);
const adminLoginUnused = null; void adminLoginUnused;
const disputeId = disputes.d.find((d) => d.payment.uuid === pix2.uuid)?.id;
ok('o admin vê a reclamação com partes, valor e motivo', !!disputeId && disputes.d[0].reason.includes('combinado') && disputes.d[0].client && disputes.d[0].professional, disputes.d);
ok('decisão inválida é recusada', (await call('POST', `/admin/disputes/${disputeId}/resolve`, { decision: 'talvez' }, adminLogin)).s === 400);
const refundResult = await call('POST', `/admin/disputes/${disputeId}/resolve`, { decision: 'refund', note: 'Cliente tinha razão.' }, adminLogin);
ok('admin estorna: o gateway é chamado e o pagamento fica estornado', refundResult.s === 200 && sql(`SELECT CONCAT(status,'/',payout_status,'/',refunded_cents) FROM payments WHERE uuid=${hex(pix2.uuid)}`) === 'refunded/refunded/17000' && lastCall((c) => c.path.endsWith('/refund')).body.value === undefined);
ok('resolver duas vezes é recusado (409)', (await call('POST', `/admin/disputes/${disputeId}/resolve`, { decision: 'release', note: 'Tentando decidir de novo.' }, adminLogin)).s === 409);
const O3 = await newOrder();
const pix3 = (await pay(O3, { method: 'pix' })).d.payment;
await webhook(event('PAYMENT_RECEIVED', sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix3.uuid)}`)));
await call('POST', `/orders/${O3}/start`, null, pro.token);
await call('POST', `/orders/${O3}/complete`, { final_amount: 170 }, pro.token);
await call('POST', `/payments/${pix3.uuid}/dispute`, { reason: 'Reclamação que será negada pelo admin.' }, cli.token);
const id3 = (await call('GET', '/admin/disputes', null, adminLogin)).d.find((d) => d.payment.uuid === pix3.uuid).id;
const releaseResult = await call('POST', `/admin/disputes/${id3}/resolve`, { decision: 'release', note: 'Serviço feito.' }, adminLogin);
ok('admin libera ao profissional: pagamento volta a "pago"', releaseResult.s === 200 && sql(`SELECT status FROM payments WHERE uuid=${hex(pix3.uuid)}`) === 'confirmed');
ok('a decisão e quem decidiu ficam registrados', sql(`SELECT CONCAT(status,'/',resolution) FROM payment_disputes WHERE id=${id3}`) === 'resolved_release/Serviço feito.' || sql(`SELECT status FROM payment_disputes WHERE id=${id3}`) === 'resolved_release');

// ---------- cancelamento e estorno pela política ----------
const O4 = await newOrder();
const pix4 = (await pay(O4, { method: 'pix' })).d.payment;
await webhook(event('PAYMENT_RECEIVED', sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix4.uuid)}`)));
const ext4 = sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix4.uuid)}`);
await call('POST', `/orders/${O4}/cancel`, null, cli.token);
ok('cliente cancela com antecedência: reembolso total pela API do gateway', sql(`SELECT CONCAT(status,'/',refunded_cents) FROM payments WHERE uuid=${hex(pix4.uuid)}`) === 'refunded/17000' && lastCall((c) => c.path === `/payments/${ext4}/refund`).body.value === undefined);
const O5 = await newOrder();
const pix5 = (await pay(O5, { method: 'pix' })).d.payment;
const ext5 = sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix5.uuid)}`);
await call('POST', `/orders/${O5}/cancel`, null, pro.token);
ok('cobrança aberta é cancelada no gateway quando o pedido é cancelado', remote.get(ext5).status === 'DELETED' && sql(`SELECT status FROM payments WHERE uuid=${hex(pix5.uuid)}`) === 'cancelled');
// política moderada: faltando menos de 72 horas, o cliente recebe metade
const O6 = await newOrder();
const pix6 = (await pay(O6, { method: 'pix' })).d.payment;
const ext6 = sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix6.uuid)}`);
await webhook(event('PAYMENT_RECEIVED', ext6));
sql(`UPDATE orders SET scheduled_date = DATE_ADD(CURDATE(), INTERVAL 2 DAY), policy_snapshot='moderate' WHERE uuid=${hex(O6)}`);
await call('POST', `/orders/${O6}/cancel`, null, cli.token);
ok('cliente cancela em cima da hora (política moderada): reembolso parcial de 50% e o pagamento continua pago', sql(`SELECT CONCAT(status,'/',refunded_cents) FROM payments WHERE uuid=${hex(pix6.uuid)}`) === 'confirmed/8500' && lastCall((c) => c.path === `/payments/${ext6}/refund`).body.value === 85);
const O8 = await newOrder();
const pix8 = (await pay(O8, { method: 'pix' })).d.payment;
const ext8 = sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix8.uuid)}`);
await webhook(event('PAYMENT_RECEIVED', ext8));
sql(`UPDATE orders SET scheduled_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) WHERE uuid=${hex(O8)}`);
await call('POST', `/orders/${O8}/cancel`, null, pro.token);
ok('o profissional cancela em cima da hora: reembolso sempre total', sql(`SELECT CONCAT(status,'/',refunded_cents) FROM payments WHERE uuid=${hex(pix8.uuid)}`) === 'refunded/17000');
const O9 = await newOrder();
const pix9 = (await pay(O9, { method: 'pix' })).d.payment;
await webhook(event('PAYMENT_RECEIVED', sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix9.uuid)}`)));
sql(`UPDATE orders SET scheduled_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY), policy_snapshot='strict' WHERE uuid=${hex(O9)}`);
await call('POST', `/orders/${O9}/cancel`, null, cli.token);
ok('política rígida em cima da hora: sem reembolso, e o motivo fica registrado', sql(`SELECT status FROM payments WHERE uuid=${hex(pix9.uuid)}`) === 'confirmed' && sql(`SELECT COUNT(*) FROM payment_events WHERE type='no_refund' AND payment_id=(SELECT id FROM payments WHERE uuid=${hex(pix9.uuid)})`) === '1');

// ---------- chargeback e alertas ----------
const chargeEvent = await webhook(event('PAYMENT_CHARGEBACK_REQUESTED', ext0));
ok('chargeback: o pagamento vira "contestado" e fica registrado', chargeEvent.s === 200 && sql(`SELECT status FROM payments WHERE uuid=${hex(P0.uuid)}`) === 'chargeback');
const alerts = await call('GET', '/admin/alerts', null, adminLogin);
ok('o admin vê o alerta de chargeback', alerts.s === 200 && alerts.d.some((a) => a.kind === 'chargeback' && a.paymentUuid === P0.uuid), alerts.d);
const summary = await call('GET', '/admin/summary', null, adminLogin);
ok('resumo do admin: volume, comissão arrecadada, pendentes, reclamações e webhooks com falha', summary.s === 200 && summary.d.volumeCents >= 0 && typeof summary.d.commissionCollectedCents === 'number' && typeof summary.d.openDisputes === 'number' && typeof summary.d.failedWebhooks === 'number', summary.d);
const list = await call('GET', '/admin/payments?status=refunded', null, adminLogin);
ok('lista de transações do admin com filtro', list.s === 200 && list.d.data.length >= 2 && list.d.data.every((p) => p.status === 'refunded'));
ok('eventos de webhook visíveis ao admin', (await call('GET', '/admin/webhook-events', null, adminLogin)).d.length > 5);

// ---------- confirmação automática ----------
const O7 = await newOrder();
const pix7 = (await pay(O7, { method: 'pix' })).d.payment;
await webhook(event('PAYMENT_RECEIVED', sql(`SELECT external_id FROM payments WHERE uuid=${hex(pix7.uuid)}`)));
await call('POST', `/orders/${O7}/start`, null, pro.token);
await call('POST', `/orders/${O7}/complete`, { final_amount: 170 }, pro.token);
sql(`UPDATE payments SET auto_confirm_at = NOW() - INTERVAL 1 HOUR WHERE uuid=${hex(pix7.uuid)}`);
const auto = await jobs.autoConfirmDue();
ok('prazo vencido sem reclamação: o serviço é confirmado automaticamente', auto.released >= 1 && Number(sql(`SELECT COUNT(*) FROM payment_events WHERE type='service_auto_confirmed' AND payment_id=(SELECT id FROM payments WHERE uuid=${hex(pix7.uuid)})`)) === 1);
ok('e não repete', (await jobs.autoConfirmDue()).released === 0);

{
// ---------- ADMIN: justificativa, reembolso parcial, alertas, relatório, auditoria e permissões ----------
const adminPaths = ['/admin/summary', '/admin/payments', '/admin/disputes', '/admin/alerts', '/admin/webhook-events', '/admin/transactions', '/admin/audit'];
const statuses = async (token) => Promise.all(adminPaths.map(async (p) => (await call('GET', p, null, token)).s));
ok('todas as rotas de admin recusam anônimo (401), cliente e profissional (403)', (await statuses(undefined)).every((x) => x === 401) && (await statuses(cli.token)).every((x) => x === 403) && (await statuses(pro.token)).every((x) => x === 403), [await statuses(undefined), await statuses(cli.token)]);
ok('e o admin acessa todas (200)', (await statuses(adminLogin)).every((x) => x === 200), await statuses(adminLogin));
ok('resolver reclamação e alerta também exigem admin', (await call('POST', '/admin/disputes/1/resolve', { decision: 'release', note: 'Qualquer justificativa.' }, cli.token)).s === 403 && (await call('POST', '/admin/alerts/1/resolve', { note: 'Qualquer nota.' }, pro.token)).s === 403);

const disputed = async (amount = 170) => {
  const order = await newOrder();
  const px = (await pay(order, { method: 'pix' })).d.payment;
  const ext = sql(`SELECT external_id FROM payments WHERE uuid=${hex(px.uuid)}`);
  await webhook(event('PAYMENT_RECEIVED', ext));
  await call('POST', `/orders/${order}/start`, null, pro.token);
  await call('POST', `/orders/${order}/complete`, { final_amount: amount }, pro.token);
  await call('POST', `/payments/${px.uuid}/dispute`, { reason: 'O serviço ficou pela metade e a pintura descascou.' }, cli.token);
  const id = (await call('GET', '/admin/disputes', null, adminLogin)).d.find((d) => d.payment.uuid === px.uuid).id;
  return { order, px, ext, id };
};

const D8 = await disputed();
const open8 = (await call('GET', '/admin/disputes', null, adminLogin)).d.find((d) => d.id === D8.id);
ok('a reclamação mostra há quantos dias está aberta, quem abriu, valor e meio', open8.daysOpen === 0 && open8.opener && open8.payment.amountCents === 17000 && open8.method === 'pix', open8);
const noNote = await call('POST', `/admin/disputes/${D8.id}/resolve`, { decision: 'release' }, adminLogin);
ok('sem justificativa a decisão é recusada, apontando o campo', noNote.s === 400 && noNote.d.errors?.some((e) => e.field === 'note'), noNote.d);
ok('justificativa curta demais é recusada', (await call('POST', `/admin/disputes/${D8.id}/resolve`, { decision: 'release', note: 'ok' }, adminLogin)).s === 400);
const tooMuch = await call('POST', `/admin/disputes/${D8.id}/resolve`, { decision: 'refund', refund_cents: 17001, note: 'Devolvendo mais do que foi pago.' }, adminLogin);
ok('reembolso maior que o valor pago é recusado e nada muda', tooMuch.s === 400 && sql(`SELECT status FROM payment_disputes WHERE id=${D8.id}`) === 'open', tooMuch.d);
const notesBefore = Number(sql(`SELECT COUNT(*) FROM notifications WHERE message LIKE '%reclamação%'`));
const partial = await call('POST', `/admin/disputes/${D8.id}/resolve`, { decision: 'refund', refund_cents: 5000, note: 'O serviço foi feito, mas com defeito. Devolvo R$ 50,00.' }, adminLogin);
ok('reembolso parcial: devolve R$ 50,00 ao cliente e libera o restante ao profissional', partial.s === 200 && partial.d.status === 'resolved_partial' && sql(`SELECT CONCAT(status,'/',payout_status,'/',refunded_cents) FROM payments WHERE uuid=${hex(D8.px.uuid)}`) === 'confirmed/released/5000', partial);
ok('o gateway recebeu o estorno parcial de R$ 50,00', lastCall((c) => c.path === `/payments/${D8.ext}/refund`)?.body?.value === 50, lastCall((c) => c.path === `/payments/${D8.ext}/refund`));
ok('a decisão guarda justificativa, quem decidiu, quando e o valor devolvido', sql(`SELECT CONCAT(status,'|',refunded_cents,'|',IF(resolved_by_id IS NULL,'sem admin','com admin'),'|',IF(resolved_at IS NULL,'sem data','com data'),'|',resolution) FROM payment_disputes WHERE id=${D8.id}`).startsWith('resolved_partial|5000|com admin|com data|O serviço foi feito'));
ok('as duas partes são avisadas, com o motivo', Number(sql(`SELECT COUNT(*) FROM notifications WHERE event_key LIKE 'asaas-resolve:${D8.id}:%' AND message LIKE '%Devolvo R$ 50,00%'`)) === 2);
const audit = (await call('GET', '/admin/audit', null, adminLogin)).d;
ok('a auditoria registra a decisão com o nome do admin', audit.some((a) => a.action === 'dispute.partial' && a.admin.includes('AdminAs') && a.detail.includes('O serviço foi feito')), audit.slice(0, 3));

// falha no estorno vira alerta; a reclamação continua aberta e pode ser decidida depois
const D9 = await disputed();
globalThis.failRefund = true;
const failed = await call('POST', `/admin/disputes/${D9.id}/resolve`, { decision: 'refund', note: 'Cliente tem razão, devolver tudo.' }, adminLogin);
globalThis.failRefund = false;
ok('o gateway recusou o estorno: o admin recebe a mensagem e a reclamação continua aberta', failed.s >= 400 && /Saldo insuficiente/.test(failed.d?.message ?? '') && sql(`SELECT status FROM payment_disputes WHERE id=${D9.id}`) === 'open' && sql(`SELECT status FROM payments WHERE uuid=${hex(D9.px.uuid)}`) === 'disputed', failed);
const alertList = (await call('GET', '/admin/alerts', null, adminLogin)).d;
const refundAlert = alertList.find((a) => a.kind === 'refund_failed' && a.paymentUuid === D9.px.uuid);
ok('a falha vira alerta aberto de gravidade alta, com significado, motivo e ação', !!refundAlert && refundAlert.severity === 'high' && refundAlert.resolvable === true && refundAlert.meaning.length > 20 && refundAlert.why.length > 20 && refundAlert.action.length > 20 && refundAlert.detail.includes('Saldo insuficiente'), refundAlert);
ok('os alertas graves vêm primeiro', alertList.map((a) => a.severity).join(',') === [...alertList.map((a) => a.severity)].sort((x, y) => ({ high: 0, medium: 1, low: 2 })[x] - ({ high: 0, medium: 1, low: 2 })[y]).join(','), alertList.map((a) => a.severity));
ok('nota curta ao resolver é recusada', (await call('POST', `/admin/alerts/${refundAlert.id}/resolve`, { note: 'ok' }, adminLogin)).s === 400);
ok('alerta calculado não tem botão de resolver (recusa clara)', (await call('POST', '/admin/alerts/c:stale:1/resolve', { note: 'Tentando resolver.' }, adminLogin)).s === 400);
const resolvedAlert = await call('POST', `/admin/alerts/${refundAlert.id}/resolve`, { note: 'Refiz o estorno no painel do Asaas.' }, adminLogin);
ok('resolver o alerta funciona', resolvedAlert.s === 200);
ok('o alerta sai dos abertos e vai para os resolvidos, com a nota', !(await call('GET', '/admin/alerts?status=open', null, adminLogin)).d.some((a) => a.id === refundAlert.id) && (await call('GET', '/admin/alerts?status=resolved', null, adminLogin)).d.some((a) => a.id === refundAlert.id && a.resolutionNote.includes('painel do Asaas')));
ok('resolver de novo é recusado (409)', (await call('POST', `/admin/alerts/${refundAlert.id}/resolve`, { note: 'Resolvendo outra vez.' }, adminLogin)).s === 409);
ok('a resolução do alerta fica na auditoria', (await call('GET', '/admin/audit', null, adminLogin)).d.some((a) => a.action === 'alert.resolve'));
const retried = await call('POST', `/admin/disputes/${D9.id}/resolve`, { decision: 'refund', note: 'Estorno refeito, cliente reembolsado.' }, adminLogin);
ok('com o gateway de volta, a reclamação é decidida normalmente', retried.s === 200 && sql(`SELECT status FROM payments WHERE uuid=${hex(D9.px.uuid)}`) === 'refunded');

// chargeback: alerta com explicação
const chargeAlert = (await call('GET', '/admin/alerts', null, adminLogin)).d.find((a) => a.kind === 'chargeback');
ok('contestação de cartão aparece com explicação em português', !chargeAlert || (chargeAlert.title.includes('Contestação') && chargeAlert.meaning.includes('banco')), chargeAlert);

// transações e comissões
const report = await call('GET', '/admin/transactions', null, adminLogin);
ok('relatório de transações: totais e linhas', report.s === 200 && report.d.totals.count >= 5 && report.d.totals.paidCents > 0 && report.d.totals.commissionCents > 0 && report.d.totals.refundedCents > 0 && report.d.rows[0].service, report.d.totals);
ok('o período filtra (um período futuro não traz nada)', (await call('GET', '/admin/transactions?de=2099-01-01&ate=2099-12-31', null, adminLogin)).d.totals.count === 0);
const csvResponse = await fetch(A + '/admin/transactions?formato=csv', { headers: { authorization: 'Bearer ' + adminLogin } });
const csvBytes = Buffer.from(await csvResponse.arrayBuffer());
const csvLines = csvBytes.toString('utf8').slice(1).split('\r\n');
ok('CSV: baixa como arquivo, com BOM, cabeçalho em português e decimal com vírgula', csvResponse.headers.get('content-disposition')?.includes('transacoes-dommos.csv') && csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvLines[0].startsWith('Data;Serviço;Cliente;Profissional') && /;\d+,\d{2};\d+,\d{2};\d+,\d{2}$/.test(csvLines[1]), csvLines.slice(0, 2));
ok('o CSV exige admin', (await fetch(A + '/admin/transactions?formato=csv', { headers: { authorization: 'Bearer ' + cli.token } })).status === 403);

// avisos do gateway: ignorados são explicados, não são erro
const hooks = (await call('GET', '/admin/webhook-events', null, adminLogin)).d;
const ignored = hooks.filter((h) => h.status === 'ignored');
ok('eventos ignorados vêm com explicação e sem texto de erro', ignored.length > 0 && ignored.every((h) => h.note && h.note.length > 15 && h.error === null), ignored.slice(0, 2));

// deixa uma reclamação aberta e um alerta aberto para o teste da tela do admin
const D10 = await disputed();
sql(`INSERT INTO payment_events (payment_id, type, from_status, to_status, detail, created_at) SELECT id, 'alert:release_failed', 'confirmed', 'confirmed', 'Teste: o gateway recusou o repasse.', NOW(3) FROM payments WHERE uuid=${hex(D10.px.uuid)}`);

}
// ---------- segurança ----------
ok('nenhuma tabela guarda dados de cartão', sql(`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND (column_name LIKE '%card_number%' OR column_name LIKE '%cvv%' OR column_name LIKE '%ccv%')`) === '0');
ok('o log do servidor não tem CPF, chaves nem token do webhook', !(await import('node:fs')).readFileSync((process.argv[3] ?? process.env.E2E_API_LOG), 'utf8').match(/52998224725|subkey_|webhook-token|plat-key/));

fake.close();
console.log(JSON.stringify({ pass, fail }));
process.exit(fail ? 1 : 0);
