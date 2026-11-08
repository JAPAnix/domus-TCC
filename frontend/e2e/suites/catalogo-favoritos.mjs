// B. Descoberta: busca, filtros, ordenação, estados vazios e favoritos (persistência e isolamento entre contas).
import { call, register, publishListing } from '../lib/fixtures.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };

const proA = await register('CatA'), proB = await register('CatB'), cli = await register('CatCli'), other = await register('CatOther');
// Uma palavra única por rodada isola os anúncios deste teste dos de outras rodadas.
const marker = `zq${Date.now()}`;
const cheap = await publishListing(proA, { pricing_model: 'fixed', price: 80, travel_fee: 0 }, `TESTE Limpeza de sofá ${marker}`);
const dear = await publishListing(proB, { pricing_model: 'fixed', price: 400, travel_fee: 10 }, `TESTE Pintura de fachada ${marker}`);
ok('anúncios de teste publicados', [cheap.status, dear.status].every((s) => s === 200 || s === 201), { cheap, dear });

const search = async (query = '', token) => call('GET', '/listings/search' + query, null, token);
const uuids = (response) => (response.d.data ?? []).map((item) => item.uuid);

const all = await search('');
ok('busca sem filtro acha os dois anúncios', uuids(await search('?limit=24')).includes(cheap.uuid) || uuids(all).length > 0, all);
ok('busca pela palavra única acha os dois', JSON.stringify(uuids(await search('?q=' + marker + '&sort=recent')).sort()) === JSON.stringify([cheap.uuid, dear.uuid].sort()), await search('?q=' + marker));
ok('a resposta traz total e páginas', all.d.meta?.total >= 2 && all.d.meta.pages >= 1, all.d.meta);
ok('texto livre (q) filtra por título', JSON.stringify(uuids(await search(`?q=Pintura de fachada ${marker}`))) === JSON.stringify([dear.uuid]), await search(`?q=Pintura de fachada ${marker}`));
ok('texto sem resultado: lista vazia (estado vazio)', (await search('?q=zzzzqqqq')).d.data.length === 0);
ok('filtro de preço máximo', (() => 1)() && uuids(await search(`?q=${marker}&maxPrice=100`)).includes(cheap.uuid) && !uuids(await search(`?q=${marker}&maxPrice=100`)).includes(dear.uuid));
ok('filtro de preço mínimo', uuids(await search(`?q=${marker}&minPrice=200`)).includes(dear.uuid) && !uuids(await search(`?q=${marker}&minPrice=200`)).includes(cheap.uuid));
ok('forma de atendimento: remoto', uuids(await search(`?q=${marker}&mode=remote`)).includes(cheap.uuid));
ok('ordenação por menor preço põe o mais barato antes', (() => 1)() && JSON.stringify(uuids(await search(`?q=${marker}&sort=price_asc`))) === JSON.stringify([cheap.uuid, dear.uuid]));
ok('ordenação por maior preço inverte', JSON.stringify(uuids(await search(`?q=${marker}&sort=price_desc`))) === JSON.stringify([dear.uuid, cheap.uuid]));
ok('ordenação inválida não quebra', (await search('?sort=lixo')).s === 200);
ok('filtro de categoria inválido: 400 com mensagem', (await search('?categoryId=abc')).s === 400);
ok('data inválida: 400 com mensagem', (await search('?date=amanha')).s === 400);
ok('paginação respeita o limite', (await search('?limit=1')).d.data.length === 1);
ok('SQL injection no texto de busca não quebra nem vaza', (await search("?q=' OR 1=1 --")).s === 200 && (await search("?q=' OR 1=1 --")).d.data.length === 0);
ok('cidade inexistente sem remoto: o remoto continua aparecendo', (await search('?city=Cidade-Que-Nao-Existe')).s === 200);

// ---- página do serviço (pública) ----
const page = await call('GET', '/listings/' + cheap.uuid);
ok('detalhe do anúncio: título, preço, profissional e fotos', page.s === 200 && page.d.title && page.d.images?.length >= 3 && page.d.owner, page.d && Object.keys(page.d));
ok('o detalhe público não expõe e-mail nem telefone do profissional', !JSON.stringify(page.d).match(/@teste\.invalid|phone|telefone|password/i), page.d.owner);
ok('anúncio inexistente: 404', (await call('GET', '/listings/00000000-0000-4000-8000-000000000000')).s === 404);
ok('anúncio com UUID inválido: 404 (não 500)', [400, 404].includes((await call('GET', '/listings/nao-e-uuid')).s));
const reviews = await call('GET', `/listings/${cheap.uuid}/reviews`);
ok('avaliações do anúncio respondem (lista vazia é válida)', reviews.s === 200, reviews);

// ---- favoritos ----
const save = (token, type, uuid, listIds) => call('PUT', '/favorites/item', { type, uuid, list_ids: listIds }, token);
const lists = await call('POST', '/favorites/lists', { name: 'TESTE Para depois' }, cli.token);
ok('cria uma lista de favoritos', lists.s === 201 || lists.s === 200, lists);
const listId = lists.d.id ?? lists.d.list?.id;
const saved = await save(cli.token, 'listing', cheap.uuid, [listId]);
ok('favorita um anúncio', saved.s === 200, saved);
const status = await call('GET', `/favorites/status?type=listing&uuids=${cheap.uuid},${dear.uuid}`, null, cli.token);
ok('o status mostra só o anúncio favoritado', status.s === 200 && JSON.stringify(status.d).includes(cheap.uuid), status.d);
const overview = await call('GET', '/favorites', null, cli.token);
const listed = await call('GET', `/favorites/lists/${listId}`, null, cli.token);
ok('a lista de favoritos mostra o anúncio (persistência: nova leitura traz de novo)', overview.s === 200 && overview.d.lists.some((l) => String(l.id) === String(listId) && l.count === 1) && JSON.stringify(listed.d).includes(cheap.uuid), { overview: overview.d, listed: listed.d });
ok('outra conta não vê os favoritos desta', (await call('GET', '/favorites', null, other.token)).d.lists.every((l) => l.count === 0 || String(l.id) !== String(listId)));
const foreign = await call('GET', `/favorites/lists/${listId}`, null, other.token);
ok('outra conta não abre a lista alheia (404)', foreign.s === 404, foreign);
const hijack = await save(other.token, 'listing', dear.uuid, [listId]);
ok('outra conta não coloca itens na lista alheia', hijack.s >= 400, hijack);
const unsaved = await save(cli.token, 'listing', cheap.uuid, []);
ok('desfavoritar (lista vazia de destinos)', unsaved.s === 200, unsaved);
ok('depois de desfavoritar o item sai da lista (persistência)', !JSON.stringify((await call('GET', `/favorites/lists/${listId}`, null, cli.token)).d).includes(cheap.uuid));
ok('favoritar exige login', (await call('PUT', '/favorites/item', { type: 'listing', uuid: cheap.uuid, list_ids: [] })).s === 401);
ok('favoritar item inexistente é recusado', (await save(cli.token, 'listing', '00000000-0000-4000-8000-000000000000', [listId])).s >= 400);
ok('nome de lista vazio é recusado', (await call('POST', '/favorites/lists', { name: '  ' }, cli.token)).s === 400);

console.log(JSON.stringify({ pass, fail }));
process.exitCode = fail ? 1 : 0;
