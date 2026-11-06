import qrcode from 'qrcode-generator';

/** QR Code gerado no próprio navegador, a partir do "copia e cola" do Pix. Nada é enviado para fora. */
export default function PixQrCode({ payload, size = 192 }) {
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 2;
  const cells = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) cells.push(<rect key={`${row}-${col}`} x={col + margin} y={row + margin} width="1" height="1" />);
    }
  }
  const total = count + margin * 2;
  return (
    <svg role="img" aria-label="QR Code do Pix para pagar" viewBox={`0 0 ${total} ${total}`} width={size} height={size} shapeRendering="crispEdges" className="max-w-full rounded-control border border-line bg-white">
      <rect width={total} height={total} fill="#ffffff" />
      <g fill="#000000">{cells}</g>
    </svg>
  );
}
