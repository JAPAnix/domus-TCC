import test from 'node:test';
import assert from 'node:assert/strict';
import { detectImageType, isOwnedStorageKey } from '../src/utils/imageFile.js';
import { signCloudinaryParams } from '../src/services/storage/cloudinaryStorage.js';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const file = '33333333-3333-4333-8333-333333333333';

test('reconhece JPG, PNG e WebP pelo conteúdo', () => {
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])).extension, 'jpg');
  assert.equal(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).extension, 'png');
  assert.equal(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')).extension, 'webp');
});

test('rejeita arquivos disfarçados de imagem', () => {
  assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(detectImageType(Buffer.from('<?php echo 1; ?>')), null);
  assert.equal(detectImageType(Buffer.from('GIF89a')), null);
  assert.equal(detectImageType(Buffer.alloc(0)), null);
  assert.equal(detectImageType('não é buffer'), null);
});

test('só aceita remover arquivo da pasta do próprio usuário', () => {
  assert.equal(isOwnedStorageKey(`${owner}/avatar/${file}.jpg`, owner), true);
  assert.equal(isOwnedStorageKey(`${owner}/avatar/${file}`, owner), true);
  assert.equal(isOwnedStorageKey(`${other}/avatar/${file}.jpg`, owner), false);
});

test('recusa chaves com caminhos ou formatos inesperados', () => {
  assert.equal(isOwnedStorageKey(`${owner}/../${other}/avatar/${file}.jpg`, owner), false);
  assert.equal(isOwnedStorageKey(`${owner}/avatar/../../segredo.env`, owner), false);
  assert.equal(isOwnedStorageKey(`${owner}/outro/${file}.jpg`, owner), false);
  assert.equal(isOwnedStorageKey(`${owner}/avatar/${file}.svg`, owner), false);
  assert.equal(isOwnedStorageKey(null, owner), false);
});

test('assina os parâmetros do Cloudinary em ordem alfabética', () => {
  // Exemplo da documentação do Cloudinary (autenticação de envios assinados).
  const signature = signCloudinaryParams({ timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }, 'abcd');
  assert.equal(signature, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});
