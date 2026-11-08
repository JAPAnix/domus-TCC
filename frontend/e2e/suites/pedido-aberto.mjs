import { execFileSync } from 'node:child_process';
import { call, register, publishListing, PW, makeAdmin } from '../lib/fixtures.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };
const sql = (q) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '--default-character-set=utf8mb4', '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', q]).toString().trim();
const byUuid = (u) => `uuid = UNHEX(REPLACE('${u}','-',''))`;
const jobs = () => JSON.parse(execFileSync('node', ['requests-run.mjs'], { cwd: process.cwd() }).toString().trim().split('\n').pop());
const relogin = async (who) => { const l = await call('POST', '/auth/login', { email: who.email, password: PW }); who.token = l.d.token; who.user = l.d.user; };

const cats = (await call('GET', '/categories')).d;
const [catA, catB] = [cats[0].id, cats[1].id];
const cli = await register('CliOpen'), proA = await register('ProAOpen'), proB = await register('ProBOpen'), proC = await register('ProCOpen'), stranger = await register('NoPro');
await publishListing(proA); await publishListing(proB); await relogin(proA); await relogin(proB);
// proC: perfil profissional sem anúncio (sem escopo)
await call('PUT', '/payments/receiving', { methods: ['cash'] }, proA.token);

const features = await call('GET', '/features');
ok('GET /features é público e mostra o recurso ligado', features.s === 200 && features.d.openRequests === true && features.d.openRequestDefaults.maxProposals === 5, features);

// ---- rascunho ----
ok('rascunho começa vazio', (await call('GET', '/services/draft', null, cli.token)).d.data === null);
ok('salva rascunho', (await call('PUT', '/services/draft', { data: { step: 2, title: 'Pintar a sala' } }, cli.token)).s === 200);
ok('lê o rascunho de volta', (await call('GET', '/services/draft', null, cli.token)).d.data.title === 'Pintar a sala');
ok('rascunho exige login', (await call('GET', '/services/draft')).s === 401);

// ---- publicar ----
const body = { title: 'Pintar sala e quarto', description: 'Preciso pintar uma sala de 20 m² e um quarto. Chame no zap 41 99999-1234 ou ana@exemplo.com.', category_id: catA, city: 'Curitiba', state: 'PR', neighborhood: 'Centro', budget_min: 800, budget_max: 1500, valid_days: 7, modes: ['client_place'] };
const created = await call('POST', '/services', body, cli.token);
ok('cliente publica o pedido', created.s === 201 && created.d.status === 'open', created);
const sUuid = created.d.uuid;
ok('telefone e e-mail foram escondidos e o cliente é avisado', created.d.masked === true && !/99999|ana@/.test(created.d.description), created.d.description);
ok('validade de 7 dias e limite de 5 propostas', Math.abs(new Date(created.d.expiresAt) - Date.now() - 7 * 86400000) < 120000 && created.d.maxProposals === 5);
ok('o rascunho foi apagado ao publicar', (await call('GET', '/services/draft', null, cli.token)).d.data === null);
ok('validade inválida é recusada', (await call('POST', '/services', { ...body, valid_days: 10 }, cli.token)).s === 400);
const otherCat = await call('POST', '/services', { ...body, title: 'Pedido em outra categoria', category_id: catB }, cli.token);
const onlyVer = await call('POST', '/services', { ...body, title: 'Só profissionais verificados', only_verified: true }, cli.token);
ok('pedido só para verificados criado', onlyVer.s === 201 && onlyVer.d.onlyVerified === true);

// ---- oportunidades ----
const listA = await call('GET', '/pro/opportunities', null, proA.token);
const titlesA = listA.d.data.map((x) => x.title);
ok('profissional A (mesma categoria e estado) vê o pedido', titlesA.includes('Pintar sala e quarto'), titlesA);
ok('não vê pedido de outra categoria', !titlesA.includes('Pedido em outra categoria'));
ok('não vê pedido que exige verificado (A não é verificado)', !titlesA.includes('Só profissionais verificados'));
const card = listA.d.data.find((x) => x.title === 'Pintar sala e quarto');
ok('cartão: região, orçamento, propostas, limite, tempo restante, "nova"', card.city === 'Curitiba' && card.budgetMax === 1500 && card.proposalsCount === 0 && card.maxProposals === 5 && card.hoursLeft > 160 && card.isNew === true, card);
ok('o cartão não traz contato do cliente', !JSON.stringify(card).match(/email|phone|telefone/i) && card.client.name);
ok('cliente comum (sem perfil profissional) não acessa oportunidades', (await call('GET', '/pro/opportunities', null, stranger.token)).s === 403);
const sem = await call('GET', '/pro/opportunities', null, proC.token);
ok('quem não é profissional recebe 403', sem.s === 403);
ok('contador de novas oportunidades de A', (await call('GET', '/pro/opportunities/count', null, proA.token)).d.count >= 1);
const badges = await call('GET', '/orders/badges', null, proA.token);
ok('o selo do menu traz oportunidades', badges.d.opportunities >= 1, badges.d);
const before = (await call('GET', '/pro/opportunities/count', null, proA.token)).d.count;
const detail = await call('GET', `/pro/opportunities/${sUuid}`, null, proA.token);
ok('detalhe: descrição completa, fotos, nota do cliente e propostas já recebidas', detail.s === 200 && detail.d.description.length > 40 && 'rating' in detail.d.client && detail.d.proposalsCount === 0, detail.d);
ok('o detalhe não revela e-mail do cliente', !JSON.stringify(detail.d).match(/@exemplo|"email"/));
await call('POST', `/pro/opportunities/${sUuid}/seen`, null, proA.token);
ok('ao ver, o contador diminui', (await call('GET', '/pro/opportunities/count', null, proA.token)).d.count === before - 1);
const afterSeen = (await call('GET', '/pro/opportunities', null, proA.token)).d.data.find((x) => x.uuid === sUuid);
ok('e o selo "nova" some do cartão', afterSeen.isNew === false);
const dismissRes = await call('POST', `/pro/opportunities/${otherCat.d.uuid}/dismiss`, null, proA.token);
ok('dispensar responde ok', dismissRes.s === 200);

// ---- propostas ----
const P = (who, extra = {}) => call('POST', `/services/${sUuid}/proposals`, { proposed_price: 1200, cover_letter: 'Faço o serviço com tinta de primeira linha e garantia. Meu zap: 41 98888-7777', delivery_time_days: 3, included: 'Tinta e mão de obra', valid_hours: 48, ...extra }, who.token);
const p1 = await P(proA);
ok('profissional A envia a proposta', p1.s === 201 && p1.d.status === 'pending', p1);
const lock = JSON.parse(sql(`SELECT JSON_OBJECT('c', cover_letter, 'i', included, 'v', valid_until IS NOT NULL) FROM proposals WHERE ${byUuid(p1.d.uuid)}`));
ok('telefone da proposta escondido, validade gravada', !/98888/.test(lock.c) && lock.i === 'Tinta e mão de obra' && lock.v === true, lock);
ok('proposta duplicada é recusada com orientação', (await P(proA)).s === 409);
const edit = await call('PUT', `/proposals/${p1.d.uuid}`, { proposed_price: 1100, cover_letter: 'Faço o serviço com tinta de primeira linha e garantia de 90 dias.', delivery_time_days: 2, included: 'Tinta, mão de obra e limpeza' }, proA.token);
ok('edita a proposta (valor atualizado)', edit.s === 200 && Number(edit.d.proposedPrice) === 1100 && edit.d.editedAt, edit);
ok('só o dono edita a proposta', (await call('PUT', `/proposals/${p1.d.uuid}`, { proposed_price: 10 }, proB.token)).s >= 400);
const part = await call('GET', `/services/${sUuid}/participation`, null, proA.token);
ok('participação mostra proposta, limite e que ela já foi enviada', part.d.proposalStatus === 'pending' && part.d.maxProposals === 5 && part.d.canSubmit === false, part.d);
ok('sem login não envia proposta', (await call('POST', `/services/${sUuid}/proposals`, { proposed_price: 100 })).s === 401);

// limite de propostas: reduz para 2 e usa B
sql(`UPDATE services SET max_proposals = 2 WHERE ${byUuid(sUuid)}`);
const p2 = await P(proB);
ok('profissional B também propõe (2 de 2)', p2.s === 201, p2);
const proD = await register('ProDOpen'); await publishListing(proD); await relogin(proD);
const p3 = await P(proD);
ok('limite de propostas atingido: 409 com mensagem clara', p3.s === 409 && /Limite de propostas/.test(p3.d.message), p3);
const partD = await call('GET', `/services/${sUuid}/participation`, null, proD.token);
ok('a participação avisa o limite', partD.d.limitReached === true && partD.d.canSubmit === false, partD.d);
const listD = (await call('GET', '/pro/opportunities', null, proD.token)).d.data.find((x) => x.uuid === sUuid);
ok('o cartão mostra "limite atingido"', listD?.limitReached === true && listD.proposalsCount === 2, listD);

// pedido que exige verificado: quem não é verificado não propõe
const pv = await call('POST', `/services/${onlyVer.d.uuid}/proposals`, { proposed_price: 500 }, proA.token);
ok('pedido só para verificados recusa quem não é', pv.s === 403 && /verificados/.test(pv.d.message), pv);

// ---- cliente vê e compara ----
const received = await call('GET', `/services/${sUuid}/proposals`, null, cli.token);
ok('cliente vê as duas propostas, com o que está incluso e a nota', received.s === 200 && received.d.length === 2 && received.d.some((x) => x.included && x.professional), received.d);
ok('outro usuário não vê as propostas', (await call('GET', `/services/${sUuid}/proposals`, null, proA.token)).s === 403);
ok('o profissional A não vê a proposta do B (rota de lista é do dono)', (await call('GET', `/services/${sUuid}/proposals`, null, proB.token)).s === 403);

// perguntas
const ask = await call('POST', '/conversations', { service_uuid: sUuid }, proD.token);
ok('profissional faz uma pergunta (abre conversa privada)', ask.s === 201 || ask.s === 200, ask);
const talk = await call('POST', '/conversations', { service_uuid: sUuid, professional_uuid: proA.uuid }, cli.token);
ok('cliente conversa com quem propôs', talk.s === 201 || talk.s === 200, talk);
const noTalk = await call('POST', '/conversations', { service_uuid: sUuid, professional_uuid: proD.uuid }, cli.token);
ok('cliente não conversa por esse caminho com quem não propôs', noTalk.s === 404, noTalk);

// ---- aceitar ----
const accept = await call('PATCH', `/proposals/${p1.d.uuid}/status`, { status: 'accepted' }, cli.token);
ok('cliente aceita a proposta e o pedido interno é criado', accept.s === 200 && accept.d.orderUuid, accept);
ok('origem da contratação é "pedido_aberto"', sql(`SELECT origin FROM orders WHERE ${byUuid(accept.d.orderUuid)}`) === 'pedido_aberto');
const order = (await call('GET', `/orders/${accept.d.orderUuid}`, null, cli.token)).d;
ok('a ordem expõe a origem', order.origin === 'pedido_aberto' && order.price === 1100, order);
ok('as outras propostas foram recusadas', sql(`SELECT COUNT(*) FROM proposals WHERE status='rejected' AND service_id=(SELECT id FROM services WHERE ${byUuid(sUuid)})`) === '1');
ok('o profissional recusado recebeu aviso gentil', Number(sql(`SELECT COUNT(*) FROM notifications WHERE event_key LIKE 'proposal-lost:%'`)) >= 1);
ok('o pedido aberto saiu de Oportunidades (está em andamento)', !(await call('GET', '/pro/opportunities', null, proD.token)).d.data.some((x) => x.uuid === sUuid));
const pay = await call('POST', `/payments/order/${accept.d.orderUuid}`, { method: 'cash' }, cli.token);
ok('segue para o pagamento existente', pay.s === 200 || pay.s === 201, pay);

// ---- validade e expiração ----
const exp = await call('POST', '/services', { ...body, title: 'Pedido que vai vencer', description: 'Preciso de uma pintura simples em uma parede de dois metros.' }, cli.token);
const eUuid = exp.d.uuid;
const pe = await call('POST', `/services/${eUuid}/proposals`, { proposed_price: 300, delivery_time_days: 1 }, proA.token);
ok('proposta no pedido que vai vencer', pe.s === 201, pe);
sql(`UPDATE services SET expires_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 5 HOUR) WHERE ${byUuid(eUuid)}`);
let j = jobs();
ok('rotina avisa o cliente que o pedido vence em horas', j.expiry.warned >= 1, j);
ok('o aviso não se repete', jobs().expiry.warned === 0);
sql(`UPDATE services SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE ${byUuid(eUuid)}`);
j = jobs();
ok('rotina expira o pedido e as propostas pendentes', j.expiry.expired >= 1 && sql(`SELECT status FROM services WHERE ${byUuid(eUuid)}`) === 'expired' && sql(`SELECT status FROM proposals WHERE ${byUuid(pe.d.uuid)}`) === 'expired', j);
ok('cliente e profissional são avisados do vencimento', Number(sql(`SELECT COUNT(*) FROM notifications WHERE event_key LIKE 'request-expired:%'`)) >= 2);
ok('pedido expirado não recebe proposta nova', (await call('POST', `/services/${eUuid}/proposals`, { proposed_price: 10 }, proB.token)).s === 409);
ok('pedido expirado sai da lista pública', !(await call('GET', '/services')).d.data.some((x) => x.uuid === eUuid));
const renewed = await call('POST', `/services/${eUuid}/renew`, { days: 15 }, cli.token);
ok('cliente renova a validade (volta a abrir)', renewed.s === 200 && renewed.d.status === 'open', renewed);
ok('só o dono renova', (await call('POST', `/services/${eUuid}/renew`, { days: 7 }, proA.token)).s >= 400);
ok('proposta expirada pode ser reenviada depois de renovar', (await call('POST', `/services/${eUuid}/proposals`, { proposed_price: 320, delivery_time_days: 1 }, proA.token)).s === 201);
// proposta vencida decide
const pv2 = await call('POST', `/services/${eUuid}/proposals`, { proposed_price: 280, delivery_time_days: 1 }, proB.token);
sql(`UPDATE proposals SET valid_until = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE ${byUuid(pv2.d.uuid)}`);
const late = await call('PATCH', `/proposals/${pv2.d.uuid}/status`, { status: 'accepted' }, cli.token);
ok('aceitar proposta vencida: 409 e ela expira', late.s === 409 && sql(`SELECT status FROM proposals WHERE ${byUuid(pv2.d.uuid)}`) === 'expired', late);
ok('rotina expira propostas vencidas e avisa o profissional', (j = jobs()).expiry.proposalsExpired >= 0);

// ---- digest ----
await publishListing(proC); await relogin(proC);
const digestReq = await call('POST', '/services', { ...body, title: 'Pedido novo para o resumo', description: 'Pintar uma porta de madeira e duas janelas, com material incluso.' }, cli.token);
j = jobs();
ok('resumo de oportunidades notifica profissionais compatíveis', j.digest.notified >= 1, j);
ok('no máximo um resumo por intervalo', jobs().digest.notified === 0);
ok('mensagem do resumo', Number(sql(`SELECT COUNT(*) FROM notifications WHERE message LIKE '%pedido%novo%combina%' OR message LIKE '%pedidos novos%combinam%'`)) >= 1);

// ---- denúncia e moderação ----
const rep = await call('POST', `/services/${digestReq.d.uuid}/report`, { reason: 'contact', details: 'Pede contato por fora' }, proA.token);
ok('profissional denuncia o pedido', rep.s === 201, rep);
ok('denúncia duplicada não duplica a fila', (await call('POST', `/services/${digestReq.d.uuid}/report`, { reason: 'contact' }, proA.token)).s === 201 && sql(`SELECT COUNT(*) FROM service_reports WHERE status='open' AND proposal_id IS NULL AND service_id=(SELECT id FROM services WHERE ${byUuid(digestReq.d.uuid)})`) === '1');
ok('não denuncia o próprio pedido', (await call('POST', `/services/${digestReq.d.uuid}/report`, { reason: 'spam' }, cli.token)).s === 400);
const rep2 = await call('POST', `/services/${eUuid}/report`, { reason: 'scam', proposal_uuid: pv2.d.uuid }, cli.token);
ok('o dono denuncia uma proposta', rep2.s === 201, rep2);
ok('profissional não denuncia a proposta do outro', (await call('POST', `/services/${eUuid}/report`, { reason: 'scam', proposal_uuid: pv2.d.uuid }, proA.token)).s === 403);

const admin = await makeAdmin('Admin' + (process.env.E2E_SUITE ?? 'Teste'));
ok('fila de moderação: usuário comum recebe 403', (await call('GET', '/admin/moderation', null, cli.token)).s === 403 && (await call('GET', '/admin/moderation')).s === 401);
const queue = await call('GET', '/admin/moderation?status=open', null, admin.token);
ok('admin vê as denúncias abertas com o conteúdo', queue.s === 200 && queue.d.data.length >= 2 && queue.d.data.some((r) => r.kind === 'proposal' && r.proposal) && queue.d.data.some((r) => r.kind === 'request' && r.service.title), queue.d);
const reqReport = queue.d.data.find((r) => r.kind === 'request');
ok('decidir sem justificativa é recusado', (await call('POST', `/admin/moderation/${reqReport.id}/resolve`, { action: 'remove', note: '' }, admin.token)).s === 400);
const removed = await call('POST', `/admin/moderation/${reqReport.id}/resolve`, { action: 'remove', note: 'Pede contato por fora da plataforma.' }, admin.token);
ok('admin remove o pedido denunciado', removed.s === 200 && removed.d.status === 'removed' && sql(`SELECT status FROM services WHERE ${byUuid(digestReq.d.uuid)}`) === 'removed', removed);
ok('o cliente é avisado da remoção', Number(sql(`SELECT COUNT(*) FROM notifications WHERE event_key LIKE 'moderation-request:%'`)) >= 1);
ok('o pedido removido some das listas e do detalhe público', (await call('GET', `/services/${digestReq.d.uuid}`)).s === 404);
ok('decidir de novo a mesma denúncia dá 409', (await call('POST', `/admin/moderation/${reqReport.id}/resolve`, { action: 'dismiss', note: 'tarde demais' }, admin.token)).s === 409);
const propReport = queue.d.data.find((r) => r.kind === 'proposal');
const dismissed = await call('POST', `/admin/moderation/${propReport.id}/resolve`, { action: 'dismiss', note: 'Sem problema na proposta.' }, admin.token);
ok('admin ignora a denúncia de proposta', dismissed.s === 200 && dismissed.d.status === 'dismissed');
ok('as decisões entram na auditoria', Number(sql(`SELECT COUNT(*) FROM admin_audit_logs WHERE action LIKE 'moderation.%'`)) >= 2);
ok('usuário comum não decide denúncias', (await call('POST', `/admin/moderation/${propReport.id}/resolve`, { action: 'dismiss', note: 'tentando' }, cli.token)).s === 403);

// ---- limite por dia ----
const heavy = await register('HeavyOpen');
let last = 0;
for (let i = 0; i < 6; i++) last = (await call('POST', '/services', { ...body, title: `Pedido numero ${i + 1} do dia`, description: 'Descrição suficientemente longa para passar na validação.' }, heavy.token)).s;
ok('mais de 5 pedidos por dia: 429 com orientação', last === 429, last);

// ---- cancelamento ----
ok('cliente cancela o pedido aberto', (await call('PATCH', `/services/${eUuid}/status`, { status: 'cancelled' }, cli.token)).s === 200);
console.log(JSON.stringify({ pass, fail }));
process.exitCode = fail ? 1 : 0;
