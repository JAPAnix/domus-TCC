import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { isValidCnpj, isValidCpf, onlyDigits } from '../utils/taxDocument.js';

/** Dados que o próprio usuário já informou, para os formulários virem preenchidos. Só o dono recebe, sem cache. */
export function buildPrefill(user) {
  const doc = onlyDigits(user.settings?.taxDocument ?? '');
  const validDoc = doc.length === 11 ? isValidCpf(doc) : doc.length === 14 && isValidCnpj(doc);
  return {
    firstName: user.firstName, lastName: user.lastName, name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    email: user.email, phone: onlyDigits(user.phoneNumber ?? ''), birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    document: validDoc ? doc : null, documentType: validDoc ? (doc.length === 11 ? 'cpf' : 'cnpj') : null, holderName: user.settings?.taxHolderName ?? null,
    address: { postal_code: onlyDigits(user.zipCode ?? ''), street: user.street ?? '', number: user.number ?? '', complement: user.complement ?? '', neighborhood: user.neighborhood ?? '', city: user.city ?? '', state: user.state ?? '' },
  };
}

export async function prefill(req, res) {
  try {
    const user = await prisma.user.findFirst({
      where: { id: BigInt(req.user.id), deletedAt: null },
      select: { firstName: true, lastName: true, email: true, phoneNumber: true, birthDate: true, zipCode: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, settings: { select: { taxDocument: true, taxHolderName: true } } },
    });
    if (!user) return res.status(401).json({ message: 'Entre novamente para continuar.' });
    return res.set('Cache-Control', 'no-store').json(buildPrefill(user));
  } catch (err) {
    logger.error('prefill', err);
    return res.status(500).json({ message: 'Não foi possível carregar os seus dados.' });
  }
}
