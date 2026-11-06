import { useEffect, useRef, useState } from 'react';
import { loadImage, cropSquare } from '../utils/image';
import { Button, Modal } from './ui';

const VIEW_SIZE = 280;
const KEY_STEP = 10;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Recorte quadrado: arrastar ou usar as setas para mover, controle deslizante para o zoom. */
export default function ImageCropModal({ file, onCancel, onConfirm }) {
  const [source, setSource] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const drag = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let active = true;
    loadImage(url).then((image) => { if (active) setSource({ image, url }); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  const baseScale = source ? VIEW_SIZE / Math.min(source.image.naturalWidth, source.image.naturalHeight) : 1;
  const scale = baseScale * zoom;
  const displayWidth = source ? source.image.naturalWidth * scale : VIEW_SIZE;
  const displayHeight = source ? source.image.naturalHeight * scale : VIEW_SIZE;
  const limitX = (displayWidth - VIEW_SIZE) / 2;
  const limitY = (displayHeight - VIEW_SIZE) / 2;
  const position = { x: clamp(offset.x, -limitX, limitX), y: clamp(offset.y, -limitY, limitY) };

  function startDrag(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX - position.x, y: event.clientY - position.y };
  }

  function moveDrag(event) {
    if (!drag.current) return;
    setOffset({ x: clamp(event.clientX - drag.current.x, -limitX, limitX), y: clamp(event.clientY - drag.current.y, -limitY, limitY) });
  }

  function onKeyDown(event) {
    const moves = { ArrowLeft: [KEY_STEP, 0], ArrowRight: [-KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setOffset({ x: clamp(position.x + move[0], -limitX, limitX), y: clamp(position.y + move[1], -limitY, limitY) });
  }

  async function confirm() {
    setSaving(true);
    try {
      const size = VIEW_SIZE / scale;
      const x = (displayWidth / 2 - VIEW_SIZE / 2 - position.x) / scale;
      const y = (displayHeight / 2 - VIEW_SIZE / 2 - position.y) / scale;
      onConfirm(await cropSquare(source.image, { x, y, size }));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal open title="Ajustar foto" onClose={onCancel} footer={<>
      <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button>
      <Button onClick={confirm} loading={saving} disabled={!source}>Usar esta foto</Button>
    </>}>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : (
        <div className="flex flex-col items-center gap-4">
          <div
            role="application"
            tabIndex={0}
            aria-label="Área de recorte. Use as setas do teclado para mover a foto."
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            onKeyDown={onKeyDown}
            style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
            className="relative max-w-full cursor-move touch-none overflow-hidden rounded-full bg-surface-muted"
          >
            {source && (
              <img
                src={source.url}
                alt=""
                draggable={false}
                style={{ width: displayWidth, height: displayHeight, maxWidth: 'none', left: VIEW_SIZE / 2 - displayWidth / 2 + position.x, top: VIEW_SIZE / 2 - displayHeight / 2 + position.y }}
                className="absolute select-none"
              />
            )}
          </div>
          <label className="w-full max-w-[280px] text-sm font-medium text-ink">
            Zoom
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-2 block w-full" />
          </label>
          <p className="text-center text-xs text-ink-muted">Arraste a foto para centralizar.</p>
        </div>
      )}
    </Modal>
  );
}
