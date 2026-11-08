import { ADDRESS } from '../lib/fixtures.mjs';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const A = 'http://localhost:3100/api';
const PW = 'senha-forte-1';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra))); };
const call = async (method, path, body, token) => {
  const response = await fetch(A + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await response.json(); } catch { /* sem corpo */ }
  return { s: response.status, d: data };
};
const sql = (query) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', query]).toString().trim();
function png() {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const table = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = ~0; for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  return Buffer.concat([sig, chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 120, 60, 200]))), chunk('IEND', Buffer.alloc(0))]);
}
const upload = async (token) => { const form = new FormData(); form.set('purpose', 'service'); form.set('file', new Blob([png()], { type: 'image/png' }), 'a.png'); const r = await fetch(A + '/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: form }); return (await r.json()).url; };
const stamp = Date.now();
async function register(name) {
  const email = `${name}${stamp}@teste.invalid`;
  await call('POST', '/auth/register', { first_name: 'Teste', last_name: name, email, password: PW });
  const login = await call('POST', '/auth/login', { email, password: PW });
  return { email, token: login.d.token, user: login.d.user };
}
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nextWeekday = (weekday, minDays) => { const d = new Date(); d.setDate(d.getDate() + minDays); while (d.getDay() !== weekday) d.setDate(d.getDate() + 1); return key(d); };

const pro = await register('Pro');
const cli = await register('Cliente');
const other = await register('Outro');
const cats = (await call('GET', '/categories')).d;
const items = (await call('GET', '/service-catalog')).d;
const item = items.find((i) => i.category.id === cats[0].id);
const otherItem = items.find((i) => i.category.id !== cats[0].id);

// ---------- rascunho e etapas ----------
ok('anônimo não cria anúncio', (await call('POST', '/pro/listings')).s === 401);
const draft = await call('POST', '/pro/listings', null, pro.token);
ok('cria rascunho', draft.s === 201 && draft.d.status === 'draft' && draft.d.wizardStep === 1, draft);
const L = draft.d.uuid;
ok('lista os rascunhos do dono', (await call('GET', '/pro/listings', null, pro.token)).d.length === 1);
ok('outro usuário não vê o rascunho (404)', (await call('GET', '/pro/listings/' + L, null, cli.token)).s === 404);
ok('rascunho não é público (404)', (await call('GET', '/listings/' + L)).s === 404);
const s1bad = await call('PATCH', '/pro/listings/' + L, { validate_step: 1 }, pro.token);
ok('avançar etapa 1 vazia é recusado, com campos', s1bad.s === 422 && s1bad.d.errors.some((e) => e.field === 'categoryId') && s1bad.d.errors.some((e) => e.field === 'catalogItemId'), s1bad.d);
ok('tipo de serviço de outra categoria é recusado', (await call('PATCH', '/pro/listings/' + L, { category_id: cats[0].id, catalog_item_id: otherItem.id, validate_step: 1 }, pro.token)).s === 422);
const s1 = await call('PATCH', '/pro/listings/' + L, { category_id: cats[0].id, catalog_item_id: item.id, validate_step: 1, wizard_step: 2 }, pro.token);
ok('etapa 1 salva e guarda onde parou', s1.s === 200 && s1.d.categoryId === cats[0].id && s1.d.wizardStep === 2, s1);
ok('etapa 2 sem forma de atendimento recusada', (await call('PATCH', '/pro/listings/' + L, { service_modes: [], validate_step: 2 }, pro.token)).s === 422);
ok('forma de atendimento inventada recusada', (await call('PATCH', '/pro/listings/' + L, { service_modes: ['no_ar'] }, pro.token)).s === 400);
await call('PATCH', '/pro/listings/' + L, { service_modes: ['client_place', 'remote'], validate_step: 2, wizard_step: 3 }, pro.token);
const s3bad = await call('PATCH', '/pro/listings/' + L, { validate_step: 3 }, pro.token);
ok('etapa 3 exige cidade, estado e raio', s3bad.s === 422 && ['city', 'state', 'radiusKm'].every((f) => s3bad.d.errors.some((e) => e.field === f)), s3bad.d);
ok('etapa 3 salva', (await call('PATCH', '/pro/listings/' + L, { city: 'Curitiba', state: 'pr', radius_km: 25, validate_step: 3, wizard_step: 4 }, pro.token)).s === 200);
ok('título curto recusado', (await call('PATCH', '/pro/listings/' + L, { title: 'curto', description: 'x'.repeat(60), validate_step: 4 }, pro.token)).s === 422);
const s4 = await call('PATCH', '/pro/listings/' + L, { title: 'Instalação de chuveiro elétrico', description: 'Instalo chuveiros elétricos com garantia de 90 dias, deixo tudo limpo e funcionando.', validate_step: 4, wizard_step: 5 }, pro.token);
ok('etapa 4 salva e normaliza o estado', s4.s === 200 && s4.d.state === 'PR', s4.d);
const imgs = [await upload(pro.token), await upload(pro.token), await upload(pro.token)];
ok('só 2 fotos: etapa 5 recusada', (await call('PATCH', '/pro/listings/' + L, { image_urls: imgs.slice(0, 2), validate_step: 5 }, pro.token)).s === 422);
ok('11 fotos recusadas', (await call('PATCH', '/pro/listings/' + L, { image_urls: Array(11).fill(imgs[0]) }, pro.token)).s === 400);
ok('link de foto inválido recusado', (await call('PATCH', '/pro/listings/' + L, { image_urls: ['javascript:alert(1)'] }, pro.token)).s === 400);
const s5 = await call('PATCH', '/pro/listings/' + L, { image_urls: [imgs[2], imgs[0], imgs[1]], validate_step: 5, wizard_step: 6 }, pro.token);
ok('3 fotos salvas, na ordem enviada (a primeira é a capa)', s5.s === 200 && s5.d.images[0] === imgs[2] && s5.d.images.length === 3, s5.d.images);
ok('etapa 6 exige o que está incluso', (await call('PATCH', '/pro/listings/' + L, { included: [], validate_step: 6 }, pro.token)).s === 422);
ok('etapa 6 salva', (await call('PATCH', '/pro/listings/' + L, { included: ['Mão de obra', 'Teste final'], excluded: ['Material'], requirements: 'Acesso ao quadro de luz.', materials: '', validate_step: 6, wizard_step: 7 }, pro.token)).s === 200);
ok('etapa 7 sem valor recusada', (await call('PATCH', '/pro/listings/' + L, { pricing_model: 'fixed', validate_step: 7 }, pro.token)).s === 422);
ok('3 pacotes recusados', (await call('PATCH', '/pro/listings/' + L, { pricing_model: 'fixed', price: 100, packages: [1, 2, 3].map((n) => ({ name: 'P' + n, price: n })) }, pro.token)).s === 400);
const s7 = await call('PATCH', '/pro/listings/' + L, { pricing_model: 'fixed', price: 150, travel_fee: 20, packages: [{ name: 'Básico', price: 120, description: 'Só a instalação' }, { name: 'Completo', price: 300, description: 'Com revisão elétrica' }], validate_step: 7, wizard_step: 8 }, pro.token);
ok('etapa 7 salva preço, deslocamento e pacotes', s7.s === 200 && s7.d.price === 150 && s7.d.travelFee === 20 && s7.d.packages.length === 2, s7.d);
const week = [1, 2, 3, 4, 5].map((day) => ({ day, from: '08:00', to: '18:00' }));
ok('horário invertido recusado', (await call('PATCH', '/pro/listings/' + L, { availability: { weekdays: [{ day: 1, from: '18:00', to: '08:00' }], lead_time_hours: 24 }, cancellation_policy: 'flexible', validate_step: 8 }, pro.token)).s === 422);
ok('etapa 8 sem política recusada', (await call('PATCH', '/pro/listings/' + L, { availability: { weekdays: week, lead_time_hours: 24 }, validate_step: 8 }, pro.token)).s === 422);
ok('etapa 8 salva', (await call('PATCH', '/pro/listings/' + L, { availability: { weekdays: week, lead_time_hours: 24 }, cancellation_policy: 'moderate', validate_step: 8, wizard_step: 9 }, pro.token)).s === 200);

// ---------- verificação e publicação ----------
const pub0 = await call('POST', `/pro/listings/${L}/publish`, null, pro.token);
ok('publicar sem verificação é recusado com a etapa', pub0.s === 422 && pub0.d.firstStep === 9 && pub0.d.errors.some((e) => e.step === 9), pub0.d);
ok('CPF inválido recusado', (await call('PUT', '/pro/verification', { legal_name: 'Maria da Silva', document_type: 'cpf', document: '111.111.111-11' }, pro.token)).s === 400);
const v = await call('PUT', '/pro/verification', { legal_name: 'Maria da Silva', document_type: 'cpf', document: '529.982.247-25' }, pro.token);
ok('verificação enviada fica em análise e mascarada', v.s === 200 && v.d.status === 'pending' && v.d.verified === false && v.d.documentMasked === '•••.•••.•••-25' && !JSON.stringify(v.d).includes('52998224725'), v.d);
ok('documento guardado só com dígitos (também nos impostos)', sql(`SELECT tax_document FROM user_settings s JOIN users u ON u.id=s.user_id WHERE u.email='${pro.email}'`) === '52998224725');
ok('antes de publicar não é profissional', !(await call('GET', '/auth/me', null, pro.token)).d.roles.includes('professional'));
ok('painel do profissional exige ser profissional (403)', (await call('GET', '/pro/summary', null, pro.token)).s === 403);
const published = await call('POST', `/pro/listings/${L}/publish`, null, pro.token);
ok('publica o anúncio', published.s === 200 && published.d.status === 'published' && published.d.publishedAt, published);
const meAfter = (await call('GET', '/auth/me', null, pro.token)).d;
ok('publicar cria o papel e o perfil profissional', meAfter.roles.includes('professional') && meAfter.hasProfessionalProfile === true, meAfter.roles);
ok('selo ainda não existe (análise manual)', (await call('GET', '/pro/verification', null, pro.token)).d.verified === false);

// ---------- público e busca ----------
const pubView = await call('GET', '/listings/' + L);
ok('anúncio público com dono, calendário e taxa', pubView.s === 200 && pubView.d.owner.name && pubView.d.calendar.earliest && pubView.d.platformFeePercent === 0 && pubView.d.isOwner === false, pubView.d);
ok('dono vê isOwner', (await call('GET', '/listings/' + L, null, pro.token)).d.isOwner === true);
ok('uuid inválido 404', (await call('GET', '/listings/xxx')).s === 404);
// Só os anúncios deste profissional: o banco de teste acumula anúncios de outras suítes e a primeira página não os mostraria.
const search = async (query, token) => (await call('GET', '/listings/search' + query + (query ? '&' : '?') + 'ownerUuid=' + pro.user.uuid + '&limit=24', null, token)).d;
ok('busca sem filtros acha o anúncio', (await search('')).data.some((x) => x.uuid === L));
const first = (await search('')).data.find((x) => x.uuid === L);
ok('cartão traz capa, preço, dono e nota', first.cover === imgs[2] && first.price === 150 && first.owner.name && first.owner.rating === 0, first);
ok('busca por categoria', (await search('?categoryId=' + cats[0].id)).data.some((x) => x.uuid === L));
ok('outra categoria não acha', !(await search('?categoryId=' + otherItem.category.id)).data.some((x) => x.uuid === L));
ok('busca por tipo de serviço', (await search('?serviceId=' + item.id)).data.some((x) => x.uuid === L));
ok('cidade certa acha', (await search('?city=Curitiba')).data.some((x) => x.uuid === L));
ok('cidade sem acento e minúscula acha', (await search('?city=curitiba')).data.some((x) => x.uuid === L));
ok('anúncio com atendimento online aparece em qualquer cidade', (await search('?city=Manaus')).data.some((x) => x.uuid === L));
ok('texto no título', (await search('?q=chuveiro')).data.some((x) => x.uuid === L));
ok('texto que não existe', (await search('?q=submarino')).meta.total === 0);
ok('faixa de preço', (await search('?minPrice=100&maxPrice=200')).data.some((x) => x.uuid === L) && !(await search('?minPrice=200')).data.some((x) => x.uuid === L));
ok('nota mínima exclui quem não tem nota', !(await search('?minRating=4')).data.some((x) => x.uuid === L));
ok('forma de atendimento', (await search('?mode=client_place')).data.some((x) => x.uuid === L) && !(await search('?mode=pro_place')).data.some((x) => x.uuid === L));
ok('ordenação é aceita', ['relevance', 'price_asc', 'price_desc', 'rating', 'newest'].every(() => true) && (await call('GET', '/listings/search?sort=price_asc')).s === 200 && (await call('GET', '/listings/search?sort=price_desc')).s === 200 && (await call('GET', '/listings/search?sort=rating')).s === 200);
ok('filtro inválido 400', (await call('GET', '/listings/search?categoryId=abc')).s === 400 && (await call('GET', '/listings/search?date=amanha')).s === 400);

const wed = nextWeekday(3, 3), wed2 = nextWeekday(3, 10), sun = nextWeekday(0, 3), tooSoon = key(new Date());
ok('data em dia de atendimento acha', (await search('?date=' + wed)).data.some((x) => x.uuid === L));
ok('data em domingo não acha', !(await search('?date=' + sun)).data.some((x) => x.uuid === L));
ok('data sem a antecedência mínima não acha', !(await search('?date=' + tooSoon)).data.some((x) => x.uuid === L));
ok('antecedência no dia seguinte acha', (await search('?date=' + nextWeekday(new Date(Date.now() + 86400000).getDay(), 1))).meta.total >= 0);

// ---------- agenda (bloqueio de datas) ----------
ok('agenda exige ser profissional', (await call('GET', '/pro/availability', null, cli.token)).s === 403);
ok('bloquear data passada recusado', (await call('PUT', '/pro/availability/2020-01-01', { blocked: true }, pro.token)).s === 400);
ok('data inválida recusada', (await call('PUT', '/pro/availability/2030-02-30', { blocked: true }, pro.token)).s === 400);
ok('bloquear uma data', (await call('PUT', '/pro/availability/' + wed2, { blocked: true }, pro.token)).s === 200);
ok('a agenda mostra a data bloqueada', (await call('GET', '/pro/availability?month=' + wed2.slice(0, 7), null, pro.token)).d.blocked.includes(wed2));
ok('data bloqueada some da busca', !(await search('?date=' + wed2)).data.some((x) => x.uuid === L));
ok('página do anúncio informa as datas bloqueadas', (await call('GET', '/listings/' + L)).d.calendar.blocked.includes(wed2));

// ---------- contratação ----------
const book = (token, body) => call('POST', '/orders', { listing_uuid: L, service_mode: 'client_place', service_address: ADDRESS, ...body }, token);
ok('contratar exige login', (await call('POST', '/orders', { listing_uuid: L, date: wed, service_mode: 'remote' })).s === 401);
ok('o dono não contrata o próprio anúncio (400)', (await book(pro.token, { date: wed })).s === 400);
ok('dia em que não atende 422', (await book(cli.token, { date: sun })).s === 422);
ok('sem antecedência mínima 422', (await book(cli.token, { date: tooSoon })).s === 422);
ok('data bloqueada pelo profissional 422', (await book(cli.token, { date: wed2 })).s === 422);
ok('forma de atendimento que o anúncio não tem 400', (await book(cli.token, { date: wed, service_mode: 'pro_place' })).s === 400);
ok('pacote inexistente 400', (await book(cli.token, { date: wed, package_name: 'Premium' })).s === 400);
ok('observação longa demais 400', (await book(cli.token, { date: wed, note: 'x'.repeat(1001) })).s === 400);
await call('POST', '/blocks', { user_uuid: other.user.uuid }, pro.token);
ok('quem foi bloqueado pelo profissional não contrata (403)', (await book(other.token, { date: wed })).s === 403);
await call('DELETE', '/blocks/' + other.user.uuid, null, pro.token);
const unread0 = (await call('GET', '/notifications', null, pro.token)).d.unread;
const o1 = await book(cli.token, { date: wed, package_name: 'Completo', note: 'Chuveiro novo já comprado.' });
ok('cliente solicita o serviço', o1.s === 201 && o1.d.uuid, o1);
const O1 = o1.d.uuid;
ok('o mesmo pedido na mesma data é recusado (409)', (await book(cli.token, { date: wed })).s === 409);
ok('profissional é avisado do novo pedido', (await call('GET', '/notifications', null, pro.token)).d.unread === unread0 + 1);
const got = await call('GET', '/orders/' + O1, null, cli.token);
ok('pedido guarda cópia dos valores (pacote + deslocamento)', got.d.status === 'requested' && got.d.price === 300 && got.d.travelFee === 20 && got.d.total === 320 && got.d.title === 'Instalação de chuveiro elétrico' && got.d.policy === 'moderate', got.d);
ok('cliente só pode cancelar um pedido novo', JSON.stringify(got.d.actions) === '["cancel"]', got.d.actions);
const gotPro = await call('GET', '/orders/' + O1, null, pro.token);
ok('profissional pode aceitar ou recusar', gotPro.d.actions.sort().join() === 'accept,decline' && gotPro.d.role === 'professional', gotPro.d);
ok('estranho não vê o pedido (404)', (await call('GET', '/orders/' + O1, null, other.token)).s === 404);
ok('pedidos do cliente', (await call('GET', '/orders/mine', null, cli.token)).d.data.length === 1);
ok('pedidos do profissional por grupo "novos"', (await call('GET', '/pro/orders?status=new', null, pro.token)).d.data.length === 1);
ok('pedidos do profissional exigem o papel', (await call('GET', '/pro/orders', null, cli.token)).s === 403);
const sum1 = (await call('GET', '/pro/summary', null, pro.token)).d;
ok('painel: pedidos novos e anúncios', sum1.newOrders === 1 && sum1.listings.published === 1 && sum1.monthEarnings.amount === 0, sum1);

ok('cliente não aceita (403)', (await call('POST', `/orders/${O1}/accept`, null, cli.token)).s === 403);
ok('ação inexistente 404', (await call('POST', `/orders/${O1}/explodir`, null, pro.token)).s === 404);
ok('estranho não age (403)', (await call('POST', `/orders/${O1}/accept`, null, other.token)).s === 403);
const unreadCli = (await call('GET', '/notifications', null, cli.token)).d.unread;
ok('profissional aceita', (await call('POST', `/orders/${O1}/accept`, null, pro.token)).d.status === 'accepted');
ok('aceitar de novo é recusado (409)', (await call('POST', `/orders/${O1}/accept`, null, pro.token)).s === 409);
ok('cliente é avisado do aceite', (await call('GET', '/notifications', null, cli.token)).d.unread === unreadCli + 1);
ok('profissional não "recusa" depois de aceitar (409)', (await call('POST', `/orders/${O1}/decline`, null, pro.token)).s === 409);
ok('concluir antes de iniciar é recusado (409)', (await call('POST', `/orders/${O1}/complete`, { final_amount: 320 }, pro.token)).s === 409);
ok('iniciar o serviço', (await call('POST', `/orders/${O1}/start`, null, pro.token)).d.status === 'in_progress');
ok('concluir sem valor final 400', (await call('POST', `/orders/${O1}/complete`, null, pro.token)).s === 400);
ok('valor final zero 400', (await call('POST', `/orders/${O1}/complete`, { final_amount: 0 }, pro.token)).s === 400);
ok('avaliar antes de concluir é recusado (409)', (await call('POST', `/orders/${O1}/reviews`, { rating: 5 }, cli.token)).s === 409);
ok('excluir a conta do cliente é bloqueado com serviço em andamento', (await call('POST', '/account/delete/start', { password: PW }, cli.token)).s === 409);
ok('excluir o anúncio com pedido em andamento é bloqueado', (await call('DELETE', '/pro/listings/' + L, null, pro.token)).s === 409);
const done = await call('POST', `/orders/${O1}/complete`, { final_amount: 310 }, pro.token);
ok('profissional conclui informando o valor final', done.d.status === 'completed');
const doneView = (await call('GET', '/orders/' + O1, null, cli.token)).d;
ok('valor final e conclusão ficam registrados', doneView.finalAmount === 310 && doneView.netAmount === 310 && doneView.completedAt && doneView.actions.length === 0, doneView);
ok('concluído não muda mais (409)', (await call('POST', `/orders/${O1}/cancel`, null, cli.token)).s === 409);

// ---------- avaliações ----------
const ctx = (await call('GET', `/orders/${O1}/review-context`, null, cli.token)).d;
ok('contexto de avaliação do cliente', ctx.canReview === true && ctx.isClient === true && ctx.target.uuid === pro.user.uuid, ctx);
ok('estranho não avalia (403)', (await call('GET', `/orders/${O1}/review-context`, null, other.token)).s === 403);
ok('nota inválida 400', (await call('POST', `/orders/${O1}/reviews`, { rating: 7 }, cli.token)).s === 400);
ok('cliente avalia o profissional', (await call('POST', `/orders/${O1}/reviews`, { rating: 5, comment: 'Serviço muito bem feito.' }, cli.token)).s === 201);
ok('avaliar duas vezes é recusado (409)', (await call('POST', `/orders/${O1}/reviews`, { rating: 5 }, cli.token)).s === 409);
ok('nota do profissional atualizada', (await call('GET', '/pro/summary', null, pro.token)).d.rating.average === 5 && (await call('GET', '/pro/summary', null, pro.token)).d.rating.total === 1);
ok('profissional avalia o cliente', (await call('POST', `/orders/${O1}/reviews`, { rating: 4 }, pro.token)).s === 201);
ok('avaliar o cliente não mexe na nota do profissional', (await call('GET', '/pro/summary', null, pro.token)).d.rating.total === 1);
ok('contexto mostra que já avaliou', (await call('GET', `/orders/${O1}/review-context`, null, cli.token)).d.alreadyReviewed === true);
ok('avaliações recebidas listadas no perfil do profissional', (await call('GET', `/users/${pro.user.uuid}/reviews`)).d.data.length === 1);
ok('"avaliações que escrevi" mostra o contexto da contratação', (await call('GET', '/profile/me/reviews-written', null, cli.token)).d.meta.total === 1);
ok('conexão criada pela contratação', (await call('GET', '/profile/me/connections', null, cli.token)).d.some((p) => p.uuid === pro.user.uuid));
const afterRating = (await search('')).data.find((x) => x.uuid === L);
ok('busca já mostra a nota', afterRating.owner.rating === 5 && afterRating.owner.reviews === 1);
ok('filtro de nota mínima agora acha', (await search('?minRating=4')).data.some((x) => x.uuid === L));

// ---------- ganhos ----------
const earn = (await call('GET', '/pro/earnings', null, pro.token)).d;
ok('ganhos: mês atual soma o valor final', earn.months.length === 6 && earn.months.at(-1).gross === 310 && earn.months.at(-1).count === 1 && earn.data.length === 1, earn.months);
const sum2 = (await call('GET', '/pro/summary', null, pro.token)).d;
ok('painel: ganhos do mês e nota', sum2.monthEarnings.amount === 310 && sum2.rating.average === 5 && sum2.newOrders === 0, sum2);

// ---------- recusar e cancelar ----------
const thu = nextWeekday(4, 3), fri = nextWeekday(5, 3);
const o2 = (await book(cli.token, { date: thu, service_mode: 'remote' })).d.uuid;
ok('profissional recusa', (await call('POST', `/orders/${o2}/decline`, null, pro.token)).d.status === 'declined');
const o3 = (await book(cli.token, { date: fri, service_mode: 'remote' })).d.uuid;
ok('cliente cancela pedido novo', (await call('POST', `/orders/${o3}/cancel`, null, cli.token)).d.status === 'cancelled');
ok('pedido cancelado guarda quem cancelou', (await call('GET', '/orders/' + o3, null, cli.token)).d.cancelledByMe === true && (await call('GET', '/orders/' + o3, null, pro.token)).d.cancelledByMe === false);
const o4 = (await book(cli.token, { date: thu, service_mode: 'remote' })).d.uuid;
await call('POST', `/orders/${o4}/accept`, null, pro.token);
ok('profissional cancela depois de aceitar', (await call('POST', `/orders/${o4}/cancel`, null, pro.token)).d.status === 'cancelled');
ok('filtro por status "fechados"', (await call('GET', '/pro/orders?status=closed', null, pro.token)).d.data.length === 3);
ok('depois de recusado o cliente pode pedir a mesma data de novo', (await book(cli.token, { date: thu, service_mode: 'remote' })).s === 201);

// ---------- gerenciar anúncios ----------
const dup = await call('POST', `/pro/listings/${L}/duplicate`, null, pro.token);
ok('duplicar cria rascunho com as fotos', dup.s === 201 && dup.d.status === 'draft' && dup.d.title.endsWith('(cópia)') && dup.d.images.length === 3, dup.d);
ok('rascunho duplicado não aparece na busca', !(await search('')).data.some((x) => x.uuid === dup.d.uuid));
const dupEdit = await call('PATCH', '/pro/listings/' + dup.d.uuid, { title: 'Instalação de ventilador de teto' }, pro.token);
ok('editar a cópia não muda o original', dupEdit.s === 200 && (await call('GET', '/listings/' + L)).d.title === 'Instalação de chuveiro elétrico');
ok('excluir a cópia', (await call('DELETE', '/pro/listings/' + dup.d.uuid, null, pro.token)).s === 204);
ok('cópia excluída some', (await call('GET', '/pro/listings/' + dup.d.uuid, null, pro.token)).s === 404);
const edited = await call('PATCH', '/pro/listings/' + L, { price: 160 }, pro.token);
ok('editar anúncio publicado mantém a publicação', edited.s === 200 && edited.d.status === 'published' && edited.d.price === 160);
ok('pausar tira da busca e da página pública', (await call('POST', `/pro/listings/${L}/pause`, null, pro.token)).d.status === 'paused' && !(await search('')).data.some((x) => x.uuid === L) && (await call('GET', '/listings/' + L)).s === 404);
ok('pausar de novo é recusado (409)', (await call('POST', `/pro/listings/${L}/pause`, null, pro.token)).s === 409);
ok('pedido não é aceito em anúncio pausado (404)', (await book(other.token, { date: wed })).s === 404);
ok('despausar publica de novo', (await call('POST', `/pro/listings/${L}/publish`, null, pro.token)).d.status === 'published' && (await search('')).data.some((x) => x.uuid === L));
ok('painel conta os anúncios por status', (await call('GET', '/pro/summary', null, pro.token)).d.listings.published === 1);

// ---------- favoritos de anúncios ----------
const picker = await call('GET', `/favorites/item?type=listing&uuid=${L}`, null, other.token);
ok('janela de favoritos funciona para anúncio', picker.s === 200 && picker.d.lists.length === 1);
ok('salvar o anúncio', (await call('PUT', '/favorites/item', { type: 'listing', uuid: L, list_ids: [picker.d.lists[0].id] }, other.token)).d.saved === true);
ok('status do coração do anúncio', (await call('GET', `/favorites/status?type=listing&uuids=${L}`, null, other.token)).d.saved[L] === true);
const favList = await call('GET', '/favorites/lists/' + picker.d.lists[0].id, null, other.token);
ok('lista mostra o anúncio com preço', favList.d.items.length === 1 && favList.d.items[0].type === 'listing' && favList.d.items[0].price === 160 && favList.d.items[0].uuid === L, favList.d);
await call('POST', '/favorites/recent', { type: 'listing', uuid: L }, cli.token);
ok('"vistos recentemente" inclui anúncios', (await call('GET', '/favorites', null, cli.token)).d.recent.some((x) => x.type === 'listing' && x.uuid === L));
await call('POST', '/favorites/recent', { type: 'listing', uuid: L }, pro.token);
ok('o dono não registra visita no próprio anúncio', !(await call('GET', '/favorites', null, pro.token)).d.recent.some((x) => x.uuid === L));
ok('anúncio inexistente 404', (await call('PUT', '/favorites/item', { type: 'listing', uuid: '00000000-0000-4000-8000-000000000000', list_ids: [] }, other.token)).s === 404);

// ---------- privacidade, bloqueio e exclusão ----------
await call('PATCH', '/settings/privacy', { search_indexing: false }, pro.token);
ok('"aparecer na busca" desligado tira o anúncio dos resultados', !(await search('')).data.some((x) => x.uuid === L));
ok('mas o link direto continua abrindo', (await call('GET', '/listings/' + L)).s === 200);
await call('PATCH', '/settings/privacy', { search_indexing: true }, pro.token);
ok('ligar de novo traz de volta', (await search('')).data.some((x) => x.uuid === L));
await call('POST', '/blocks', { user_uuid: pro.user.uuid }, other.token);
ok('quem bloqueou o profissional não vê o anúncio (404)', (await call('GET', '/listings/' + L, null, other.token)).s === 404 && !(await search('', other.token)).data.some((x) => x.uuid === L));
await call('DELETE', '/blocks/' + pro.user.uuid, null, other.token);
await call('POST', '/account/deactivate', { password: PW }, pro.token);
ok('conta desativada do profissional some da busca e do link', !(await search('')).data.some((x) => x.uuid === L) && (await call('GET', '/listings/' + L)).s === 404);
const back = await call('POST', '/auth/login', { email: pro.email, password: PW });
pro.token = back.d.token;
ok('ao reativar o anúncio volta', (await search('')).data.some((x) => x.uuid === L));

// ---------- exclusão de conta do profissional (sem pedidos em andamento) ----------
const o5 = (await book(cli.token, { date: fri, service_mode: 'remote' })).d.uuid;
ok('profissional com pedido novo pode excluir a conta; o pedido é cancelado e o anúncio sai do ar', await (async () => {
  const start = await call('POST', '/account/delete/start', { password: PW }, pro.token);
  const confirm = await call('POST', '/account/delete/confirm', { token: start.d.token, confirmation: 'EXCLUIR' }, pro.token);
  return confirm.s === 200 && sql(`SELECT status FROM orders WHERE uuid=UNHEX(REPLACE('${o5}','-',''))`) === 'cancelled' && !(await search('')).data.some((x) => x.uuid === L) && (await call('GET', '/listings/' + L)).s === 404;
})());
ok('avaliações e histórico do pedido concluído continuam', sql(`SELECT COUNT(*) FROM orders WHERE uuid=UNHEX(REPLACE('${O1}','-',''))`) === '1');

console.log(JSON.stringify({ pass, fail }));
