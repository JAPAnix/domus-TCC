// Confere a configuração de e-mail sem mostrar nenhuma chave.
//   node --env-file=.env scripts/check-email.mjs                      (só consulta a Brevo)
//   node --env-file=.env scripts/check-email.mjs --send voce@email.com (e envia um e-mail de teste)
const key = (process.env.BREVO_API_KEY || '').trim();
const fromRaw = process.env.EMAIL_FROM || '';
const from = fromRaw.match(/<([^>]+)>/)?.[1] ?? fromRaw.trim();
const sendIndex = process.argv.indexOf('--send');
const target = sendIndex > -1 ? process.argv[sendIndex + 1] : null;
const problems = [];
const say = (ok, text) => console.log(`${ok ? 'ok   ' : 'ERRO '} ${text}`);

say(!!from, `EMAIL_FROM: ${from || 'não definido'}`);
if (!from) problems.push('Defina EMAIL_FROM, por exemplo: DOMMOS <seu-email@gmail.com>.');

if (!key) {
  say(false, 'BREVO_API_KEY não definida (sem ela o e-mail só sairia por SMTP, que o Render gratuito bloqueia).');
  problems.push('Defina BREVO_API_KEY com uma chave de API da Brevo.');
} else {
  say(key.startsWith('xkeysib-'), key.startsWith('xkeysib-') ? 'BREVO_API_KEY tem o formato de chave de API (xkeysib-).' : `BREVO_API_KEY não começa com xkeysib- (${key.startsWith('xsmtpsib-') ? 'é uma chave SMTP, não de API' : 'formato desconhecido'}).`);
  if (!key.startsWith('xkeysib-')) problems.push('Gere uma chave em Brevo > SMTP e API > aba "Chaves de API" (não a aba SMTP).');
  const headers = { 'api-key': key, accept: 'application/json' };
  const account = await fetch('https://api.brevo.com/v3/account', { headers }).catch(() => null);
  if (!account) { say(false, 'Sem conexão com a Brevo.'); problems.push('Verifique a internet.'); }
  else if (!account.ok) {
    const detail = await account.text().catch(() => '');
    say(false, `A Brevo recusou a chave (HTTP ${account.status}): ${detail.slice(0, 120)}`);
    if (/unrecognised IP/i.test(detail)) problems.push('A conta da Brevo só aceita chamadas de IPs cadastrados, e o IP do Render muda. Desative esse bloqueio em https://app.brevo.com/security/authorised_ips (Segurança > IPs autorizados).');
    else problems.push(account.status === 401 ? 'A chave não existe nesta conta da Brevo. Gere outra em SMTP e API > Chaves de API e copie a chave inteira.' : 'Veja a mensagem acima.');
  } else {
    say(true, 'A Brevo aceitou a chave.');
    const senders = await fetch('https://api.brevo.com/v3/senders', { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const list = senders?.senders ?? [];
    const match = list.find((item) => item.email.toLowerCase() === from.toLowerCase());
    say(!!match?.active, match ? `Remetente ${from}: ${match.active ? 'ativo' : 'INATIVO (confirme o link que a Brevo enviou para esse e-mail)'}` : `${from} NÃO está cadastrado como remetente. Remetentes da conta: ${list.map((item) => item.email).join(', ') || 'nenhum'}`);
    if (!match?.active) problems.push('Cadastre e confirme o e-mail do EMAIL_FROM em Brevo > Remetentes e IPs > Remetentes.');
  }
}

if (target && !problems.length) {
  const { sendPlainEmail } = await import('../src/services/emailService.js');
  try {
    const result = await sendPlainEmail({ to: target, subject: 'Teste de e-mail do Dommos', text: 'Se você recebeu esta mensagem, o envio de e-mail do Dommos está funcionando.' });
    say(result.delivery === 'provider-accepted', `Envio de teste para ${target}: ${result.delivery}. Confira também o spam.`);
  } catch (error) { say(false, `Falha no envio de teste: ${error.message}`); }
}

console.log(problems.length ? `\nO que corrigir:\n- ${problems.join('\n- ')}` : '\nConfiguração de e-mail OK.');
process.exitCode = problems.length ? 1 : 0;
