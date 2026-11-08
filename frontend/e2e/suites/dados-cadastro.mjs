import { call, register, nextWeekday } from '../lib/fixtures.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };

const u = await register('PrefU');
const cats = (await call('GET', '/categories')).d;

ok('sem login não há dados', (await call('GET', '/account/prefill')).s === 401);
const before = await call('GET', '/account/prefill', null, u.token);
ok('conta nova: só nome e e-mail, sem endereço nem documento', before.s === 200 && before.d.name.includes('PrefU') && before.d.email === u.email && before.d.address.city === '' && before.d.document === null, before.d);

const addr = await call('PATCH', '/users/me/personal/residencial', { zip_code: '80010-000', street: 'Rua das Flores', number: '123', complement: 'Apto 4', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' }, u.token);
ok('endereço salvo no cadastro', addr.s === 200, addr);
const tax = await call('PUT', '/settings/tax', { document_type: 'cpf', document: '529.982.247-25', holder_name: 'Maria da Silva' }, u.token);
ok('CPF salvo em Impostos', tax.s === 200, tax);

const after = (await call('GET', '/account/prefill', null, u.token)).d;
ok('o endereço do cadastro vem pronto (CEP só dígitos)', after.address.postal_code === '80010000' && after.address.street === 'Rua das Flores' && after.address.number === '123' && after.address.neighborhood === 'Centro' && after.address.city === 'Curitiba' && after.address.state === 'PR', after.address);
ok('o CPF e o nome do titular vêm prontos', after.document === '52998224725' && after.documentType === 'cpf' && after.holderName === 'Maria da Silva', after);
const other = (await call('GET', '/account/prefill', null, (await register('PrefOutro')).token)).d;
ok('cada pessoa só recebe os próprios dados', other.document === null && other.address.city === '' && !JSON.stringify(other).includes('Maria da Silva'), other);

// pedido aberto agora pede o local
const base = { title: 'Instalar chuveiro elétrico', description: 'Preciso instalar um chuveiro elétrico novo no banheiro.', category_id: cats[0].id, budget_min: 100, budget_max: 300, deadline: nextWeekday(4, 12) };
const noCity = await call('POST', '/services', base, u.token);
ok('pedido sem cidade e estado é recusado, com o campo certo', noCity.s === 400 && noCity.d?.errors?.some((e) => /city|state/.test(e.field)), noCity.d);
const badState = await call('POST', '/services', { ...base, city: 'Curitiba', state: 'Paraná' }, u.token);
ok('estado precisa ter 2 letras', badState.s === 400, badState.d);
const created = await call('POST', '/services', { ...base, city: 'Curitiba', state: 'pr', neighborhood: 'Centro' }, u.token);
ok('pedido com local é criado (UF em maiúsculas)', created.s === 201 && created.d.city === 'Curitiba' && created.d.state === 'PR' && created.d.neighborhood === 'Centro', created);
const read = (await call('GET', '/services/' + created.d.uuid)).d;
ok('o local aparece na página pública do pedido (só cidade, estado e bairro)', read.city === 'Curitiba' && read.state === 'PR' && read.neighborhood === 'Centro' && !JSON.stringify(read).includes('Rua das Flores'), read);
const list = (await call('GET', '/services')).d;
ok('o local aparece na lista de pedidos abertos', (list.data ?? list).some((s) => s.uuid === created.d.uuid && s.city === 'Curitiba'), list);

console.log(JSON.stringify({ pass, fail }));
process.exit(fail ? 1 : 0);
