// Asaas simulado para os testes: cria clientes, subcontas, cobranças (Pix, cartão, boleto), devolve QR Code e aceita estorno e split.
// Controles de teste: `accountStatus` (aprovar a subconta) e `remote` (situação de cada cobrança). Nunca fala com o Asaas de verdade.
import http from 'node:http';

export async function startFakeAsaas({ port = 3200, seed = Date.now() } = {}) {
  const calls = [];
  const remote = new Map(); // id da cobrança -> { status, value, split }
  const accountStatus = new Map(); // chave da subconta -> situação
  let seq = (seed % 1000000) * 1000;
  const fake = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      calls.push({ method: req.method, path: req.url, key: req.headers.access_token, body });
      const send = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
      const url = req.url;
      if (url === '/customers') return send(200, { id: 'cus_' + (++seq) });
      if (url === '/accounts' && req.method === 'POST') { const n = ++seq; accountStatus.set('subkey_' + n, 'AWAITING_APPROVAL'); return send(200, { id: 'acc_' + n, walletId: 'wal_' + n, accessToken: { apiKey: 'subkey_' + n } }); }
      if (/^\/accounts\/acc_\d+\/escrow$/.test(url)) return send(200, { enabled: true });
      if (url === '/myAccount/status/') { const s = accountStatus.get(req.headers.access_token) ?? 'PENDING'; return send(200, { general: s, commercialInfo: s, bankAccountInfo: s, documentation: s }); }
      if (url === '/payments' && req.method === 'POST') {
        const id = 'pay_' + (++seq); const value = body.value ?? body.totalValue;
        remote.set(id, { status: 'PENDING', value, escrow: 'ACTIVE' });
        return send(200, { id, status: 'PENDING', value, netValue: Math.round((value - 1.99) * 100) / 100, invoiceUrl: 'https://asaas.example/i/' + id });
      }
      let m = url.match(/^\/payments\/(pay_\d+)(\/\w+)?$/);
      if (m && remote.has(m[1])) {
        const p = remote.get(m[1]);
        if (!m[2] && req.method === 'GET') return send(200, { id: m[1], status: p.status });
        if (!m[2] && req.method === 'DELETE') { p.status = 'DELETED'; return send(200, { deleted: true }); }
        if (m[2] === '/pixQrCode') return send(200, { payload: '00020126ASAASDINAMICO' + m[1], encodedImage: 'x', expirationDate: '2099-11-07 23:59:59' });
        if (m[2] === '/refund') { if (globalThis.failRefund) return send(400, { errors: [{ description: 'Saldo insuficiente para o estorno.' }] }); p.refunded = body?.value ?? p.value; if (!body?.value) p.status = 'REFUNDED'; return send(200, { id: m[1], status: p.status }); }
        if (m[2] === '/escrow') return send(200, { id: 'esc_' + m[1], status: p.escrow });
      }
      m = url.match(/^\/lean\/payments\/(pay_\d+)$/);
      if (m) { remote.get(m[1]).split = body.split; return send(200, {}); }
      m = url.match(/^\/escrow\/esc_(pay_\d+)\/finish$/);
      if (m) { remote.get(m[1]).escrow = 'DONE'; return send(200, {}); }
      return send(404, { errors: [{ description: 'rota desconhecida' }] });
    });
  });
  await new Promise((resolve) => fake.listen(port, '127.0.0.1', resolve));
  return { server: fake, calls, remote, accountStatus, close: () => new Promise((resolve) => fake.close(resolve)) };
}
