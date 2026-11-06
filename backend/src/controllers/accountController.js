import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { deviceLabel, maskIp, revokeSessions } from '../services/sessionService.js';
import { getStorage } from '../services/storage/index.js';

const googleClient = new OAuth2Client();
const me = (req) => BigInt(req.user.id);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

function handle(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}

// Senha errada devolve 403 (e não 401), porque o 401 encerra a sessão no navegador.
async function confirmPassword(user, password) {
  if (!user.passwordHash) return;
  if (!password || !(await bcrypt.compare(password, user.passwordHash))) fail(403, 'Senha incorreta.');
}

async function loadUser(userId) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) fail(401, 'Conta indisponível. Entre novamente.');
  return user;
}

// ---- Senha ----
export async function changePassword(req, res) {
  try {
    const user = await loadUser(me(req));
    const { current_password: current, new_password: next } = req.body;
    if (user.passwordHash) {
      if (!current || !(await bcrypt.compare(current, user.passwordHash))) fail(403, 'A senha atual está incorreta.');
      if (await bcrypt.compare(next, user.passwordHash)) fail(400, 'A nova senha precisa ser diferente da atual.');
    }
    const passwordHash = await bcrypt.hash(next, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.userSession.updateMany({ where: { userId: user.id, revokedAt: null, id: { not: req.user.sid } }, data: { revokedAt: new Date() } }),
    ]);
    res.json({ hasPassword: true, message: user.passwordHash ? 'Senha alterada. Os outros dispositivos foram desconectados.' : 'Senha criada. Agora você também pode entrar com e-mail e senha.' });
  } catch (err) { handle(res, err, 'changePassword'); }
}

// ---- Google ----
export async function linkGoogle(req, res) {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) fail(503, 'Login com Google não está configurado.');
    const user = await loadUser(me(req));
    let payload;
    try {
      payload = (await googleClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID })).getPayload();
    } catch { fail(400, 'Não foi possível confirmar a conta Google. Tente novamente.'); }
    if (!payload?.sub) fail(400, 'Não foi possível confirmar a conta Google.');
    const other = await prisma.user.findFirst({ where: { googleId: payload.sub, id: { not: user.id } }, select: { id: true } });
    if (other) fail(409, 'Esta conta Google já está conectada a outro usuário.');
    const sameEmail = payload.email_verified && payload.email?.toLowerCase() === user.email;
    await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub, ...(sameEmail ? { isEmailVerified: true } : {}) } });
    res.json({ googleLinked: true });
  } catch (err) { handle(res, err, 'linkGoogle'); }
}

export async function unlinkGoogle(req, res) {
  try {
    const user = await loadUser(me(req));
    if (!user.googleId) fail(400, 'Nenhuma conta Google está conectada.');
    if (!user.passwordHash) fail(409, 'Crie uma senha antes de desconectar o Google. Sem isso, você perderia o acesso à conta.');
    await prisma.user.update({ where: { id: user.id }, data: { googleId: null } });
    res.json({ googleLinked: false });
  } catch (err) { handle(res, err, 'unlinkGoogle'); }
}

// ---- Sessões ----
export async function listSessions(req, res) {
  try {
    const rows = await prisma.userSession.findMany({ where: { userId: me(req), revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: 'desc' } });
    res.set('Cache-Control', 'no-store').json(rows.map((row) => ({
      id: row.id, device: deviceLabel(row.userAgent ?? ''), ip: maskIp(row.ip ?? ''),
      createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, current: row.id === req.user.sid,
    })));
  } catch (err) { handle(res, err, 'listSessions'); }
}

export async function revokeSession(req, res) {
  try {
    const result = await prisma.userSession.updateMany({ where: { id: req.params.id, userId: me(req), revokedAt: null }, data: { revokedAt: new Date() } });
    if (!result.count) fail(404, 'Sessão não encontrada.');
    res.json({ current: req.params.id === req.user.sid });
  } catch (err) { handle(res, err, 'revokeSession'); }
}

export async function revokeOtherSessions(req, res) {
  try {
    const result = await revokeSessions(prisma, me(req), req.user.sid);
    res.json({ revoked: result.count });
  } catch (err) { handle(res, err, 'revokeOtherSessions'); }
}

// ---- Desativar e excluir ----
export async function deactivateAccount(req, res) {
  try {
    const user = await loadUser(me(req));
    await confirmPassword(user, req.body.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { deactivatedAt: new Date() } }),
      prisma.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    res.json({ message: 'Conta desativada. Entre novamente quando quiser reativá-la.' });
  } catch (err) { handle(res, err, 'deactivateAccount'); }
}

async function assertNoOngoingWork(userId) {
  const ongoing = await prisma.service.count({
    where: { deletedAt: null, status: 'in_progress', OR: [{ clientId: userId }, { proposals: { some: { professionalId: userId, status: 'accepted' } } }] },
  });
  const ongoingOrders = await prisma.order.count({ where: { status: { in: ['accepted', 'in_progress'] }, OR: [{ clientId: userId }, { professionalId: userId }] } });
  if (ongoing || ongoingOrders) fail(409, 'Você tem serviços em andamento. Conclua ou cancele esses serviços antes de excluir a conta.');
}

export async function startDeleteAccount(req, res) {
  try {
    const user = await loadUser(me(req));
    await confirmPassword(user, req.body.password);
    await assertNoOngoingWork(user.id);
    const token = jwt.sign({ purpose: 'account-delete', id: user.id.toString() }, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ token, expiresInSeconds: 600 });
  } catch (err) { handle(res, err, 'startDeleteAccount'); }
}

export async function confirmDeleteAccount(req, res) {
  try {
    const userId = me(req);
    let claims;
    try { claims = jwt.verify(req.body.token, process.env.JWT_SECRET); } catch { fail(400, 'A confirmação expirou. Comece de novo.'); }
    if (claims.purpose !== 'account-delete' || claims.id !== userId.toString()) fail(400, 'Confirmação inválida. Comece de novo.');
    await assertNoOngoingWork(userId);
    const user = await loadUser(userId);
    const now = new Date();

    // Anonimiza em vez de apagar os registros: avaliações e histórico de outras pessoas continuam íntegros.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: {
        email: `conta-excluida-${userId}@excluida.invalid`, passwordHash: null, googleId: null, phoneNumber: null,
        firstName: 'Conta', lastName: 'excluída', preferredName: null, profilePictureUrl: null, birthDate: null,
        postalAddress: Prisma.DbNull, emergencyContact: Prisma.DbNull, isEmailVerified: false, isPhoneVerified: false,
        zipCode: null, street: null, number: null, complement: null, neighborhood: null, city: null, state: null,
        about: null, profession: null, school: null, funFact: null, yearsExperience: null,
        languages: Prisma.DbNull, interests: Prisma.DbNull, skills: Prisma.DbNull, serviceAreas: Prisma.DbNull,
        deletedAt: now,
      } });
      await tx.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.userSettings.deleteMany({ where: { userId } });
      await tx.contactVerification.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.favoriteList.deleteMany({ where: { userId } });
      await tx.recentView.deleteMany({ where: { userId } });
      await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.service.updateMany({ where: { clientId: userId, status: { in: ['draft', 'open'] }, deletedAt: null }, data: { status: 'cancelled', deletedAt: now } });
      await tx.proposal.updateMany({ where: { professionalId: userId, status: 'pending' }, data: { status: 'withdrawn' } });
      await tx.professionalPortfolioImage.deleteMany({ where: { professionalId: userId } });
      await tx.professionalAvailability.deleteMany({ where: { professionalId: userId } });
      await tx.professionalProfile.updateMany({ where: { userId }, data: { isPublished: false, displayName: null, publicPhotoUrl: null, headline: null, bio: null, certifications: null, serviceRegion: null } });
      for (const extra of deletionSteps) await extra(tx, userId, now);
    });

    // Fotos enviadas: o provedor remove a pasta do usuário. Se falhar, a conta já foi anonimizada.
    getStorage().removeAll?.(bufferToUuid(user.uuid)).catch((error) => logger.error('removeAll', error));
    res.json({ message: 'Sua conta foi excluída.' });
  } catch (err) { handle(res, err, 'confirmDeleteAccount'); }
}

// Outros módulos (ex.: anúncios) registram aqui o que também precisa ser tratado na exclusão.
const deletionSteps = [];
export function registerDeletionStep(step) { deletionSteps.push(step); }

// ---- Exportação de dados (LGPD) ----
const iso = (date) => (date ? new Date(date).toISOString() : null);

async function collectData(userId) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { settings: true, professionalProfile: { include: { catalogServices: { include: { catalogItem: { select: { name: true } } } }, portfolioImages: true } }, roles: { include: { role: true } } },
  });
  const [services, proposals, written, received, lists, blocks, tickets, notifications, sessions] = await Promise.all([
    prisma.service.findMany({ where: { clientId: userId }, include: { category: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.proposal.findMany({ where: { professionalId: userId }, include: { service: { select: { title: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.review.findMany({ where: { reviewerId: userId }, orderBy: { createdAt: 'asc' } }),
    prisma.review.findMany({ where: { reviewedId: userId }, orderBy: { createdAt: 'asc' } }),
    prisma.favoriteList.findMany({ where: { userId }, include: { items: { include: { professional: { select: { displayName: true, user: { select: { uuid: true } } } } } } } }),
    prisma.userBlock.findMany({ where: { blockerId: userId }, include: { blocked: { select: { uuid: true } } } }),
    prisma.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, take: 500 }),
    prisma.userSession.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
  ]);
  const s = user.settings;
  return {
    geradoEm: new Date().toISOString(),
    aviso: 'Estes são os dados que o Dommos guarda sobre a sua conta. Senhas e códigos de verificação não são incluídos.',
    conta: {
      uuid: bufferToUuid(user.uuid), email: user.email, emailConfirmado: user.isEmailVerified, telefone: user.phoneNumber, telefoneConfirmado: user.isPhoneVerified,
      nome: user.firstName, sobrenome: user.lastName, nomeDeExibicao: user.preferredName, nascimento: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      fotoUrl: user.profilePictureUrl, papeis: user.roles.map((item) => item.role.name), criadaEm: iso(user.createdAt), desativadaEm: iso(user.deactivatedAt),
      endereco: { cep: user.zipCode, rua: user.street, numero: user.number, complemento: user.complement, bairro: user.neighborhood, cidade: user.city, estado: user.state },
      enderecoPostal: user.postalSameAsHome ? 'Mesmo do residencial' : user.postalAddress, contatoDeEmergencia: user.emergencyContact,
      loginComGoogle: !!user.googleId, possuiSenha: !!user.passwordHash,
    },
    perfil: { sobreMim: user.about, profissao: user.profession, estudos: user.school, curiosidade: user.funFact, idiomas: user.languages, interesses: user.interests, habilidades: user.skills, areasDeAtuacao: user.serviceAreas, anosDeExperiencia: user.yearsExperience },
    configuracoes: s ? {
      privacidade: { quemVePerfil: s.profileVisibility, confirmacaoDeLeitura: s.readReceipts, aparecerNaBusca: s.searchIndexing, mostrarAvaliacoesQueEscrevi: s.showWrittenReviews },
      cookies: s.cookiePreferences, notificacoes: s.notificationPreferences, idioma: s.language, moeda: s.currency,
      impostos: { tipo: s.taxDocumentType, documento: s.taxDocument, titular: s.taxHolderName, tipoDaChavePix: s.payoutKeyType, chavePix: s.payoutKey },
    } : null,
    perfilProfissional: user.professionalProfile ? {
      nomeProfissional: user.professionalProfile.displayName, titulo: user.professionalProfile.headline, apresentacao: user.professionalProfile.bio, regiao: user.professionalProfile.serviceRegion,
      servicos: user.professionalProfile.catalogServices.map((item) => item.catalogItem.name), fotos: user.professionalProfile.portfolioImages.map((item) => item.url),
      nota: Number(user.professionalProfile.averageRating), avaliacoes: user.professionalProfile.totalReviews, verificado: user.professionalProfile.isVerified,
    } : null,
    pedidosPublicados: services.map((item) => ({ titulo: item.title, descricao: item.description, categoria: item.category.name, status: item.status, orcamentoMin: item.budgetMin && Number(item.budgetMin), orcamentoMax: item.budgetMax && Number(item.budgetMax), criadoEm: iso(item.createdAt) })),
    propostasEnviadas: proposals.map((item) => ({ pedido: item.service.title, valor: Number(item.proposedPrice), prazoEmDias: item.deliveryTimeDays, status: item.status, apresentacao: item.coverLetter, enviadaEm: iso(item.createdAt) })),
    avaliacoesQueEscrevi: written.map((item) => ({ nota: item.rating, comentario: item.comment, criadaEm: iso(item.createdAt) })),
    avaliacoesQueRecebi: received.map((item) => ({ nota: item.rating, comentario: item.comment, criadaEm: iso(item.createdAt) })),
    favoritos: lists.map((list) => ({ lista: list.name, itens: list.items.map((item) => item.professional?.displayName ?? bufferToUuid(item.professional?.user.uuid ?? Buffer.alloc(16))) })),
    usuariosBloqueados: blocks.map((item) => bufferToUuid(item.blocked.uuid)),
    chamadosDeSuporte: tickets.map((item) => ({ assunto: item.subject, categoria: item.category, mensagem: item.message, status: item.status, criadoEm: iso(item.createdAt) })),
    notificacoes: notifications.map((item) => ({ mensagem: item.message, lidaEm: iso(item.readAt), criadaEm: iso(item.createdAt) })),
    sessoes: sessions.map((item) => ({ dispositivo: deviceLabel(item.userAgent ?? ''), criadaEm: iso(item.createdAt), ultimoAcesso: iso(item.lastSeenAt), encerradaEm: iso(item.revokedAt) })),
  };
}

function flatten(value, path, rows) {
  if (value == null || value === '') { rows.push([path, '']); return; }
  if (Array.isArray(value)) {
    if (!value.length) rows.push([path, '']);
    value.forEach((item, index) => flatten(item, `${path}[${index + 1}]`, rows));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) flatten(item, path ? `${path}.${key}` : key, rows);
    return;
  }
  rows.push([path, String(value)]);
}

// Evita que o Excel interprete texto do usuário como fórmula.
const csvCell = (text) => `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;

export async function exportData(req, res) {
  try {
    const data = await collectData(me(req));
    if (req.query.format === 'csv') {
      const rows = [];
      flatten(data, '', rows);
      const body = `﻿${['Campo', 'Valor'].map(csvCell).join(',')}\r\n${rows.map(([key, value]) => [key, value].map(csvCell).join(',')).join('\r\n')}`;
      return res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="dommos-meus-dados.csv"', 'Cache-Control': 'no-store' }).send(body);
    }
    res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="dommos-meus-dados.json"', 'Cache-Control': 'no-store' }).send(JSON.stringify(data, null, 2));
  } catch (err) { handle(res, err, 'exportData'); }
}
