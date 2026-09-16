export async function sendVerificationCode(phone, code) {
  if (process.env.SMS_PROVIDER === 'console' && process.env.NODE_ENV === 'development') {
    console.info(`[SMS LOCAL — não enviado] Código: ${code}; destino terminado em ${phone.slice(-4)}`);
    return { delivery: 'development-console' };
  }
  if (process.env.SMS_PROVIDER !== 'twilio' || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    throw Object.assign(new Error('O envio de SMS não está configurado.'), { status: 503 });
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!/^AC[a-fA-F0-9]{32}$/.test(sid)) throw Object.assign(new Error('Configuração de SMS inválida.'), { status: 503 });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_NUMBER, Body: `DOMMOS: seu código é ${code}. Expira em 10 minutos. Não compartilhe este código.` }),
  });
  if (!response.ok) throw Object.assign(new Error('Não foi possível enviar o SMS.'), { status: 502 });
  return { delivery: 'provider-accepted' };
}
