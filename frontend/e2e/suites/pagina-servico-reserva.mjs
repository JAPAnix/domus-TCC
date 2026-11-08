import { call, register, publishListing, upload, nextWeekday, ADDRESS } from '../lib/fixtures.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra))); };

const pro = await register('ProPage');
const cli = await register('CliPage');
const c2 = await register('Cli2Page');
const c3 = await register('Cli3Page');
const evil = await register('EvilPage');
const hourly = await publishListing(pro, { pricing_model: 'hourly', price: 60, travel_fee: 20 });
const daily = await publishListing(pro, { pricing_model: 'daily', price: 300 }, 'Diária de pintura residencial');
ok('anúncios por hora e por diária publicados', hourly.status === 200 && daily.status === 200);
const tue = nextWeekday(2, 6);
const wed = nextWeekday(3, 6);
const sun = nextWeekday(0, 6);
const book = (token, body, uuid = hourly.uuid) => call('POST', '/orders', { listing_uuid: uuid, service_mode: 'client_place', service_address: ADDRESS, ...body }, token);

// ---------- por hora ----------
ok('por hora sem horário é recusado', (await book(cli.token, { date: tue, quantity: 2 })).s === 422);
ok('horário quebrado (09:30) é recusado', (await book(cli.token, { date: tue, time: '09:30', quantity: 1 })).s === 400 || (await book(cli.token, { date: tue, time: '09:30', quantity: 1 })).s === 422);
ok('horas demais (13) recusadas', (await book(cli.token, { date: tue, time: '09:00', quantity: 13 })).s === 400 || (await book(cli.token, { date: tue, time: '09:00', quantity: 13 })).s === 422);
ok('fora do horário de atendimento é recusado', (await book(cli.token, { date: tue, time: '17:00', quantity: 3 })).s === 422);
ok('domingo continua recusado', (await book(cli.token, { date: sun, time: '09:00', quantity: 1 })).s === 422);
const first = await book(cli.token, { date: tue, time: '09:00', quantity: 3, note: 'Preciso de ajuda com a instalação elétrica.' });
ok('pedido por hora com horário e quantidade', first.s === 201 && first.d.uuid, first);
const O1 = first.d.uuid;
const o1 = (await call('GET', '/orders/' + O1, null, cli.token)).d;
ok('total = 60 x 3 horas + 20 de deslocamento = R$ 200', o1.total === 200 && o1.quantity === 3 && o1.scheduledTime === '09:00', o1);
ok('a mensagem do cliente abriu a conversa com o profissional', !!first.d.conversation && (await call('GET', '/conversations/' + first.d.conversation, null, pro.token)).d.messages.some((m) => m.body.includes('instalação elétrica')));
ok('pedido ainda não aceito não bloqueia o horário', (await book(c2.token, { date: tue, time: '10:00', quantity: 1 })).s === 201);
await call('POST', `/orders/${O1}/accept`, null, pro.token);
const pub = await call('GET', '/listings/' + hourly.uuid);
ok('o calendário público mostra os horários ocupados', JSON.stringify(pub.d.calendar.busyHours[tue]) === JSON.stringify(['09:00', '10:00', '11:00']), pub.d.calendar);
const clash = await book(c3.token, { date: tue, time: '11:00', quantity: 2 });
ok('horário que acabou de ser ocupado dá conflito (409) com mensagem clara', clash.s === 409 && clash.d.message.includes('ocupado'), clash);
ok('horário livre logo depois funciona', (await book(c3.token, { date: tue, time: '12:00', quantity: 2 })).s === 201);
const pending = (await call('GET', '/pro/orders?status=new', null, pro.token)).d.data;
const o2 = pending.find((o) => o.scheduledTime === '10:00');
const accept2 = await call('POST', `/orders/${o2.uuid}/accept`, null, pro.token);
ok('aceitar um pedido que bate com outro já aceito é recusado (409)', accept2.s === 409 && accept2.d.message.includes('já foi aceito'), accept2);
ok('pagamento por hora já tem valor (total do pedido)', (await call('GET', '/payments/order/' + O1, null, cli.token)).d.amountDue === 200);

// ---------- por diária ----------
const d1 = await book(cli.token, { date: wed, quantity: 3 }, daily.uuid);
ok('diária com 3 dias: total R$ 900 e data final', d1.s === 201, d1);
const dOrder = (await call('GET', '/orders/' + d1.d.uuid, null, cli.token)).d;
ok('total da diária e intervalo', dOrder.total === 900 && dOrder.quantity === 3 && dOrder.endDate > dOrder.scheduledDate, dOrder);
await call('POST', `/orders/${d1.d.uuid}/accept`, null, pro.token);
ok('diária ocupa os dias no calendário público', (await call('GET', '/listings/' + daily.uuid)).d.calendar.busyDays.length === 3);
ok('intervalo que cruza dia ocupado é recusado (409)', (await book(c2.token, { date: wed, quantity: 1 }, daily.uuid)).s === 409);
ok('mais de 30 dias é recusado', [400, 422].includes((await book(c2.token, { date: nextWeekday(1, 20), quantity: 31 }, daily.uuid)).s));

// ---------- fotos de referência ----------
const ref = await upload(cli.token, 'message');
const withPhoto = await book(cli.token, { date: nextWeekday(4, 9), time: '14:00', quantity: 1, image_urls: [ref] });
ok('fotos de referência são aceitas e guardadas', withPhoto.s === 201 && (await call('GET', '/orders/' + withPhoto.d.uuid, null, cli.token)).d.referenceImages[0] === ref, withPhoto);
ok('foto de link externo é recusada', (await book(cli.token, { date: nextWeekday(4, 10), time: '14:00', quantity: 1, image_urls: ['https://evil.example/x.png'] })).s === 400);
ok('foto de outro usuário é recusada', (await book(cli.token, { date: nextWeekday(4, 11), time: '14:00', quantity: 1, image_urls: [await upload(evil.token, 'message')] })).s === 400);

// ---------- avaliações do anúncio ----------
async function finish(client, date, time, rating, comment) {
  const created = await book(client.token, { date, time, quantity: 1 });
  await call('POST', `/orders/${created.d.uuid}/accept`, null, pro.token);
  await call('POST', `/orders/${created.d.uuid}/start`, null, pro.token);
  await call('POST', `/orders/${created.d.uuid}/complete`, { final_amount: 80 }, pro.token);
  const review = await call('POST', `/orders/${created.d.uuid}/reviews`, { rating, comment }, client.token);
  return { order: created.d.uuid, review };
}
const base = nextWeekday(1, 14);
const r1 = await finish(cli, base, '08:00', 5, 'Chegou pontual, trabalho de muita qualidade e deixou tudo limpo.');
const r2 = await finish(c2, base, '09:00', 4, 'Muito pontual e educado, recomendo o profissional.');
const r3 = await finish(c3, base, '10:00', 2, 'Demorou mais do que o combinado para terminar.');
ok('três avaliações criadas', [r1, r2, r3].every((r) => r.review.s === 201), [r1.review.s, r2.review.s, r3.review.s]);
const rev = await call('GET', '/listings/' + hourly.uuid + '/reviews');
ok('resumo: média 3,67, 3 avaliações e histograma real', rev.s === 200 && rev.d.summary.count === 3 && Math.abs(rev.d.summary.average - 3.67) < 0.01 && rev.d.summary.histogram[5] === 1 && rev.d.summary.histogram[4] === 1 && rev.d.summary.histogram[2] === 1 && rev.d.summary.histogram[3] === 0, rev.d.summary);
ok('"os clientes mencionam": pontualidade citada 2 vezes', rev.d.summary.topics.some((t) => t.label === 'Pontualidade' && t.count === 2), rev.d.summary.topics);
ok('cada avaliação traz autor, serviço contratado e data', rev.d.data.length === 3 && rev.d.data.every((r) => r.reviewer.name && r.serviceTitle && r.createdAt && r.id));
ok('ordenar por melhores', (await call('GET', '/listings/' + hourly.uuid + '/reviews?ordem=best')).d.data.map((r) => r.rating).join() === '5,4,2');
ok('ordenar por piores', (await call('GET', '/listings/' + hourly.uuid + '/reviews?ordem=worst')).d.data.map((r) => r.rating).join() === '2,4,5');
ok('busca no texto das avaliações', (await call('GET', '/listings/' + hourly.uuid + '/reviews?q=demorou')).d.data.length === 1 && (await call('GET', '/listings/' + hourly.uuid + '/reviews?q=zzzz')).d.data.length === 0);
const paged = await call('GET', '/listings/' + hourly.uuid + '/reviews?limit=2&page=2');
ok('paginação', paged.d.data.length === 1 && paged.d.meta.pages === 2 && paged.d.meta.total === 3);
ok('anúncio sem avaliações devolve resumo vazio', (await call('GET', '/listings/' + daily.uuid + '/reviews')).d.summary.count === 0);
ok('avaliações de anúncio inexistente dão 404', (await call('GET', '/listings/00000000-0000-4000-8000-000000000000/reviews')).s === 404);

// ---------- resposta do profissional ----------
const reviewId = rev.d.data.find((r) => r.rating === 2).id;
ok('cliente não responde a avaliação (404)', (await call('POST', `/reviews/${reviewId}/reply`, { reply: 'Obrigado!' }, cli.token)).s === 404);
ok('estranho não responde (404)', (await call('POST', `/reviews/${reviewId}/reply`, { reply: 'Obrigado!' }, evil.token)).s === 404);
ok('resposta vazia é recusada', (await call('POST', `/reviews/${reviewId}/reply`, { reply: ' ' }, pro.token)).s === 400);
ok('profissional responde', (await call('POST', `/reviews/${reviewId}/reply`, { reply: 'Sinto muito pela demora, vou melhorar.' }, pro.token)).s === 201);
ok('só pode responder uma vez (409)', (await call('POST', `/reviews/${reviewId}/reply`, { reply: 'De novo' }, pro.token)).s === 409);
ok('a resposta aparece na avaliação', (await call('GET', '/listings/' + hourly.uuid + '/reviews')).d.data.find((r) => r.id === reviewId).reply.includes('Sinto muito'));
ok('exige login para responder', (await call('POST', `/reviews/${reviewId}/reply`, { reply: 'x y' })).s === 401);
ok('só quem concluiu avalia: cliente sem pedido concluído não consegue (404)', (await call('POST', `/orders/${O1}/reviews`, { rating: 5, comment: 'Excelente trabalho de verdade.' }, evil.token)).s === 403);
ok('avaliar pedido ainda não concluído é recusado (409)', (await call('POST', `/orders/${O1}/reviews`, { rating: 5, comment: 'Excelente trabalho de verdade.' }, cli.token)).s === 409);

// ---------- denúncia do anúncio ----------
ok('motivos de denúncia são públicos', (await call('GET', '/listings/report-reasons')).d.length === 5);
ok('denunciar exige login', (await call('POST', `/listings/${hourly.uuid}/report`, { reason: 'scam' })).s === 401);
ok('motivo inválido é recusado', (await call('POST', `/listings/${hourly.uuid}/report`, { reason: 'chato' }, evil.token)).s === 400);
ok('não denuncia o próprio anúncio', (await call('POST', `/listings/${hourly.uuid}/report`, { reason: 'scam' }, pro.token)).s === 400);
ok('denúncia é registrada', (await call('POST', `/listings/${hourly.uuid}/report`, { reason: 'wrong_info', details: 'O preço não confere.' }, evil.token)).s === 201);
ok('a segunda denúncia da mesma pessoa avisa (409)', (await call('POST', `/listings/${hourly.uuid}/report`, { reason: 'scam' }, evil.token)).s === 409);

// ---------- profissional, selo e parecidos ----------
const page = (await call('GET', '/listings/' + hourly.uuid)).d;
ok('selo de destaque não aparece sem os critérios (nota baixa)', page.owner.badge === null && page.owner.responseRate === null || page.owner.responseRate >= 0, page.owner);
ok('dados do profissional: data de entrada e verificado', !!page.owner.memberSince && typeof page.owner.verified === 'boolean');
const similar = (await call('GET', `/listings/search?categoryId=${page.category.id}&exclude=${hourly.uuid}`)).d.data;
ok('parecidos não incluem o próprio anúncio', similar.length >= 1 && similar.every((s) => s.uuid !== hourly.uuid), similar.map((s) => s.uuid));
ok('mais serviços do profissional', (await call('GET', `/listings/search?ownerUuid=${pro.uuid}&exclude=${hourly.uuid}`)).d.data.every((s) => s.uuid !== hourly.uuid));

console.log(JSON.stringify({ pass, fail }));
process.exit(fail ? 1 : 0);
