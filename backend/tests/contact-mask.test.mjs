import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { maskContacts } from '../src/utils/contactMask.js';

test('esconde e-mail, telefone, links, redes sociais e CPF', () => {
  const cases = [
    'me chama em joao.silva@gmail.com', 'ligue (41) 99999-1234', 'whatsapp 41 99999 1234', 'veja www.meusite.com.br/portfolio',
    'https://instagram.com/fulano', 'me segue @fulano_oficial', 'instagram fulano123', 'cpf 529.982.247-25', 'meusite.com.br',
  ];
  for (const input of cases) {
    const { text, masked } = maskContacts(input);
    assert.ok(masked, input);
    assert.ok(!/gmail|99999|www\.|https|@fulano|fulano123|529|meusite/i.test(text), `${input} -> ${text}`);
  }
});

test('não mexe em texto normal (medidas, quantidades, datas, preços)', () => {
  for (const input of ['Preciso pintar um quarto de 12 m² e uma sala de 20 m², 2 demãos.', 'Trocar 3 tomadas e 1 chuveiro até dia 15/12.', 'Orçamento de R$ 1.500,00 a R$ 2.000,00', 'Apartamento 302, bloco B, 4º andar', 'Instalar cinco prateleiras e instalação de chuveiro', 'Faceta de porcelana e zapateado', 'Reformar a fachada com telas']) {
    const { text, masked } = maskContacts(input);
    assert.equal(masked, false, input);
    assert.equal(text, input);
  }
});

test('avisos seguidos viram um só', () => {
  const { text } = maskContacts('a@b.com, c@d.com, 41 99999-1234');
  assert.equal((text.match(/\[contato removido\]/g) ?? []).length, 1, text);
});

test('o arquivo do frontend é idêntico ao do backend', () => {
  assert.equal(fs.readFileSync(new URL('../src/utils/contactMask.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n'), fs.readFileSync(new URL('../../frontend/src/utils/contactMask.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
});
