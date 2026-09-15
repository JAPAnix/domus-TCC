import nodemailer from 'nodemailer';

export async function sendPasswordResetEmail({ email, link }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) {
    console.warn('SMTP não configurado; link de redefinição não foi enviado.');
    return;
  }
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const logo = process.env.EMAIL_LOGO_URL
    ? `<img src="${process.env.EMAIL_LOGO_URL}" alt="DOMMOS" width="140" style="display:block;margin:0 auto;max-width:140px" />`
    : '<div style="font-size:30px;font-weight:800;letter-spacing:-1px;color:#7C3AED">dommos<span style="color:#111827">.</span></div>';
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F9FAFB;font-family:Arial,sans-serif;color:#111827"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #E5E7EB;border-radius:20px;overflow:hidden"><tr><td align="center" style="padding:32px 32px 22px">${logo}</td></tr><tr><td style="padding:0 32px 32px"><h1 style="font-size:24px;margin:0 0 14px">Redefina sua senha</h1><p style="font-size:16px;line-height:1.55;color:#4B5563;margin:0 0 24px">Recebemos uma solicitação para redefinir a senha da sua conta.</p><p style="text-align:center;margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#7C3AED;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700">Redefinir minha senha</a></p><p style="font-size:14px;line-height:1.5;color:#6B7280;margin:0 0 12px">Este link expira em 30 minutos.</p><p style="font-size:14px;line-height:1.5;color:#6B7280;margin:0">Se você não fez esta solicitação, ignore este email.</p></td></tr></table></td></tr></table></body></html>`;
  const result = await transport.sendMail({ from: process.env.EMAIL_FROM, to: email, subject: 'Redefina sua senha do DOMMOS', text: `Recebemos uma solicitação para redefinir sua senha. Este link expira em 30 minutos: ${link}`, html });
  console.info(`E-mail de recuperação aceito pelo SMTP: ${result.accepted?.length ?? 0} destinatário(s).`);
}

export async function sendEmailVerification({ email, code }) {
  if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) {
    throw Object.assign(new Error('O envio de email não está configurado.'), { status: 503 });
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : {}),
    connectionTimeout: 10000, socketTimeout: 15000,
  });
  const escape = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const logo = /^https?:\/\//.test(process.env.EMAIL_LOGO_URL || '') ? `<img src="${escape(process.env.EMAIL_LOGO_URL)}" alt="DOMMOS" width="140" />` : '<strong style="color:#7C3AED;font-size:28px">DOMMOS</strong>';
  const result = await transport.sendMail({
    from: process.env.EMAIL_FROM, to: email, subject: 'Confirme seu email no DOMMOS',
    text: `Seu código DOMMOS é ${code}. Ele expira em 10 minutos. Se você não solicitou esta alteração, ignore esta mensagem.`,
    html: `<html lang="pt-BR"><body style="background:#F9FAFB;font-family:Arial,sans-serif;padding:24px;color:#111827"><div style="max-width:520px;margin:auto;padding:32px;background:white;border:1px solid #E5E7EB;border-radius:16px">${logo}<h1 style="font-size:24px">Confirme seu email</h1><p>Use este código para confirmar o endereço de email da sua conta.</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#5B21B6">${code}</p><p>O código expira em 10 minutos e só pode ser usado uma vez.</p><p style="color:#6B7280">Se você não solicitou esta alteração, ignore esta mensagem. Não compartilhe o código.</p></div></body></html>`,
  });
  if (!result.accepted?.length) throw Object.assign(new Error('Não foi possível enviar o email.'), { status: 502 });
  return { delivery: 'provider-accepted' };
}
