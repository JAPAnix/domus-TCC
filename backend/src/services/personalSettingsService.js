import { prisma } from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { bufferToUuid } from '../utils/uuid.js';

export function accountError(status, message) { return Object.assign(new Error(message), { status }); }
export async function lockAccount(tx, userId) {
  const users = await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} AND deleted_at IS NULL FOR UPDATE`;
  if (!users.length) throw accountError(401, 'Conta indisponível. Entre novamente.');
}
export async function getPersonalSettings(userId) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, include: { roles: { include: { role: true } }, professionalProfile: { select: { userId: true } } } });
  if (!user) throw accountError(401, 'Conta indisponível. Entre novamente.');
  const pending = await prisma.contactVerification.findMany({ where: { userId, usedAt: null, deliveredAt: { not: null } }, orderBy: { createdAt: 'desc' }, select: { type: true, target: true, expiresAt: true, createdAt: true, attempts: true } });
  return {
    uuid: bufferToUuid(user.uuid), firstName: user.firstName, lastName: user.lastName, preferredName: user.preferredName,
    email: user.email, phoneNumber: user.phoneNumber, isEmailVerified: user.isEmailVerified, isPhoneVerified: user.isPhoneVerified,
    profilePictureUrl: user.profilePictureUrl, createdAt: user.createdAt,
    birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
    zipCode: user.zipCode, street: user.street, number: user.number, complement: user.complement, neighborhood: user.neighborhood, city: user.city, state: user.state,
    postalSameAsHome: user.postalSameAsHome, postalAddress: user.postalAddress, emergencyContact: user.emergencyContact,
    roles: user.roles.map(({ role }) => role.name), hasProfessionalProfile: !!user.professionalProfile,
    pending: Object.fromEntries(pending.map((item) => [item.type, { ...item, resendAt: new Date(item.createdAt.getTime() + 60000) }])),
  };
}
export async function savePersonalSettings(userId, section, body) {
  let data;
  if (section === 'nome') data = { firstName: body.first_name, lastName: body.last_name };
  if (section === 'preferencia') data = { preferredName: body.preferred_name || null };
  if (section === 'nascimento') data = { birthDate: body.birth_date ? new Date(`${body.birth_date}T00:00:00Z`) : null };
  if (section === 'residencial') { const { zip_code, ...address } = body; data = { ...address, zipCode: zip_code, complement: address.complement || null }; }
  if (section === 'postal') data = { postalSameAsHome: body.same_as_home, postalAddress: body.same_as_home ? Prisma.DbNull : body.address };
  if (section === 'emergencia') data = { emergencyContact: body.contact === null ? Prisma.DbNull : body };
  await prisma.$transaction(async (tx) => { await lockAccount(tx, userId); await tx.user.update({ where: { id: userId }, data }); });
  return getPersonalSettings(userId);
}
