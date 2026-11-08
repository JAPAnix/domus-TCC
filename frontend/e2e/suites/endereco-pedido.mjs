import { call, register, publishListing, nextWeekday } from '../lib/fixtures.mjs';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra))); };

const pro = await register('ProEnd');
const cli = await register('CliEnd');
const listing = await publishListing(pro, { pricing_model: 'fixed', price: 100 });
ok('anúncio publicado', listing.status === 200 || listing.status === 201, listing);
const address = { postal_code: '80010-000', street: 'Rua das Flores', number: '123', complement: 'Apto 4', neighborhood: 'Centro', city: 'Curitiba', state: 'pr' };
const base = (date, extra = {}) => ({ listing_uuid: listing.uuid, date, service_mode: 'client_place', ...extra });

let d = 9;
const noAddress = await call('POST', '/orders', base(nextWeekday(1, d++)), cli.token);
ok('na casa do cliente sem endereço é recusado', noAddress.s === 422 && /endereço/i.test(noAddress.d?.message), noAddress);
const badCep = await call('POST', '/orders', base(nextWeekday(1, d++), { service_address: { ...address, postal_code: '123' } }), cli.token);
ok('CEP inválido é recusado com o campo certo', badCep.s === 400 && badCep.d?.errors?.some((e) => /postal_code/.test(e.field)), badCep.d);
const badState = await call('POST', '/orders', base(nextWeekday(1, d++), { service_address: { ...address, state: 'Paraná' } }), cli.token);
ok('estado precisa ter 2 letras', badState.s === 400 && badState.d?.errors?.some((e) => /state/.test(e.field)), badState.d);
const empty = await call('POST', '/orders', base(nextWeekday(1, d++), { service_address: { ...address, street: '   ' } }), cli.token);
ok('rua em branco é recusada', empty.s === 400, empty.d);

const created = await call('POST', '/orders', base(nextWeekday(2, d++), { note: 'Chuveiro novo já comprado.', service_address: address }), cli.token);
ok('pedido com endereço é criado', created.s === 201, created);
const uuid = created.d?.uuid;

const asClient = (await call('GET', '/orders/' + uuid, null, cli.token)).d;
ok('o cliente vê o endereço completo (estado em maiúsculas)', asClient.serviceAddress?.street === 'Rua das Flores' && asClient.serviceAddress?.state === 'PR' && !asClient.serviceAddress?.partial, asClient.serviceAddress);
const proBefore = (await call('GET', '/orders/' + uuid, null, pro.token)).d;
ok('antes de aceitar, o profissional vê só bairro e cidade', proBefore.serviceAddress?.partial === true && proBefore.serviceAddress.neighborhood === 'Centro' && proBefore.serviceAddress.street === undefined && proBefore.serviceAddress.number === undefined && proBefore.serviceAddress.postal_code === undefined, proBefore.serviceAddress);
const outsider = await register('Intruso');
ok('quem não é parte do pedido não vê nada', (await call('GET', '/orders/' + uuid, null, outsider.token)).s === 404);
ok('o aceite funciona', (await call('POST', `/orders/${uuid}/accept`, null, pro.token)).s === 200);
const proAfter = (await call('GET', '/orders/' + uuid, null, pro.token)).d;
ok('depois de aceitar, o profissional vê o endereço completo', proAfter.serviceAddress?.street === 'Rua das Flores' && proAfter.serviceAddress?.number === '123' && proAfter.serviceAddress?.complement === 'Apto 4' && !proAfter.serviceAddress?.partial, proAfter.serviceAddress);

const remote = await call('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(3, d++), service_mode: 'remote', service_address: address }, cli.token);
const remoteRead = (await call('GET', '/orders/' + remote.d?.uuid, null, cli.token)).d;
ok('atendimento remoto não guarda endereço', remote.s === 201 && remoteRead.serviceAddress === null, remoteRead.serviceAddress);

console.log(JSON.stringify({ pass, fail }));
process.exit(fail ? 1 : 0);
