import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { sendPlainEmail, smtpConfigured } from '../services/emailService.js';

const me = (req) => (req.user ? BigInt(req.user.id) : null);

export async function sendFeedback(req, res) {
  try {
    await prisma.helpFeedback.create({ data: { articleSlug: req.body.slug, helpful: req.body.helpful, userId: me(req) } });
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error('sendFeedback', err);
    res.status(500).json({ message: 'Não foi possível registrar sua resposta.' });
  }
}

export async function createTicket(req, res) {
  try {
    const userId = me(req);
    let { name, email } = req.body;
    if (userId) {
      const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { firstName: true, lastName: true, email: true } });
      if (!user) return res.status(401).json({ message: 'Conta indisponível. Entre novamente.' });
      name = [user.firstName, user.lastName].filter(Boolean).join(' ');
      email = user.email;
    } else if (!name || !email) {
      return res.status(400).json({ message: 'Dados inválidos', errors: [!name && { field: 'name', message: 'Informe seu nome.' }, !email && { field: 'email', message: 'Informe seu e-mail.' }].filter(Boolean) });
    }
    const ticket = await prisma.supportTicket.create({ data: { userId, name, email, category: req.body.category, subject: req.body.subject, message: req.body.message } });

    // O chamado já está salvo; o e-mail para a equipe é um aviso extra e pode falhar sem problema.
    const supportAddress = process.env.SUPPORT_EMAIL;
    let notified = false;
    if (supportAddress && smtpConfigured()) {
      notified = true;
      sendPlainEmail({
        to: supportAddress, replyTo: email, subject: `[Chamado #${ticket.id}] ${ticket.subject}`,
        text: `De: ${name} <${email}>\nAssunto: ${ticket.category}\n\n${ticket.message}`,
      }).catch((error) => logger.error('ticketEmail', error));
    }
    res.status(201).json({ id: ticket.id.toString(), notified });
  } catch (err) {
    logger.error('createTicket', err);
    res.status(500).json({ message: 'Não foi possível enviar sua mensagem. Tente novamente.' });
  }
}

export async function myTickets(req, res) {
  try {
    const rows = await prisma.supportTicket.findMany({ where: { userId: me(req) }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.set('Cache-Control', 'no-store').json(rows.map((row) => ({ id: row.id.toString(), category: row.category, subject: row.subject, message: row.message, status: row.status, createdAt: row.createdAt })));
  } catch (err) {
    logger.error('myTickets', err);
    res.status(500).json({ message: 'Não foi possível carregar seus chamados.' });
  }
}
