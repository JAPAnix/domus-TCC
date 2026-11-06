import { useEffect, useId, useRef, useState } from 'react';
import api, { apiError } from '../services/api';
import { compressImage, validateImageFile, ACCEPTED_TYPES } from '../utils/image';
import ImageCropModal from './ImageCropModal';
import { Avatar, Button } from './ui';

let nextUploadId = 0;

function ProgressBar({ value, label }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${value}%` }} />
    </div>
  );
}

/**
 * Envio de imagens, único em todo o sistema.
 *
 * - variant="avatar": uma foto, com recorte quadrado. value = url | null; onChange(url | null).
 * - variant="gallery": várias fotos; a primeira é a capa. value = url[]; onChange(url[]).
 * - purpose: pasta no servidor (avatar, professional, portfolio, service, message, quick_reply).
 * - onBusyChange(boolean): avisa enquanto há envio em andamento, para bloquear o salvamento.
 */
export default function ImageUploader({ variant = 'gallery', purpose, value, onChange, max = 10, label, hint, name = '', showCover = false, reorderable = false, onBusyChange }) {
  const isAvatar = variant === 'avatar';
  const urls = isAvatar ? (value ? [value] : []) : (value ?? []);
  const [uploads, setUploads] = useState([]);
  const [errors, setErrors] = useState([]);
  const [cropFile, setCropFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const input = useRef(null);
  const labelId = useId();
  const statusId = useId();
  // Só fotos enviadas nesta tela podem ser apagadas do armazenamento: as outras já podem estar salvas em um registro.
  const sessionKeys = useRef(new Map());
  const latestUrls = useRef(urls);
  useEffect(() => { latestUrls.current = urls; });

  const remaining = (isAvatar ? 1 : max) - urls.length - uploads.length;
  const busy = uploads.length > 0;

  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  function publish(next) {
    latestUrls.current = next;
    onChange(isAvatar ? next[0] ?? null : next);
  }

  async function upload(file, alreadyProcessed) {
    const id = ++nextUploadId;
    const preview = URL.createObjectURL(file);
    setUploads((current) => [...current, { id, preview, progress: 0 }]);
    try {
      const processed = alreadyProcessed ? file : await compressImage(file);
      const form = new FormData();
      form.append('purpose', purpose);
      form.append('file', processed);
      const { data } = await api.post('/uploads', form, {
        onUploadProgress: ({ loaded, total }) => {
          if (total) setUploads((current) => current.map((item) => (item.id === id ? { ...item, progress: Math.round((loaded / total) * 100) } : item)));
        },
      });
      sessionKeys.current.set(data.url, data.key);
      publish(isAvatar ? [data.url] : [...latestUrls.current, data.url]);
    } catch (err) {
      const message = err.response || err.request ? apiError(err, 'Não foi possível enviar a imagem.') : err.message;
      setErrors((current) => [...current, `${file.name}: ${message}`]);
    } finally {
      URL.revokeObjectURL(preview);
      setUploads((current) => current.filter((item) => item.id !== id));
    }
  }

  function receive(fileList) {
    const files = [...fileList];
    const nextErrors = [];
    const accepted = [];
    for (const file of files) {
      const problem = validateImageFile(file);
      if (problem) nextErrors.push(problem);
      else accepted.push(file);
    }
    // No avatar, uma nova foto substitui a atual; na galeria, respeita o limite.
    const room = isAvatar ? 1 : Math.max(0, remaining);
    if (accepted.length > room) nextErrors.push(isAvatar ? 'Escolha apenas uma foto.' : `Você pode adicionar no máximo ${max} fotos.`);
    setErrors(nextErrors);
    const chosen = accepted.slice(0, room);
    if (isAvatar && chosen[0]) setCropFile(chosen[0]);
    else chosen.forEach((file) => upload(file, false));
  }

  function onInputChange(event) {
    receive(event.target.files);
    event.target.value = '';
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) receive(event.dataTransfer.files);
  }

  async function remove(url) {
    setRemoving(true);
    setErrors([]);
    const key = sessionKeys.current.get(url);
    publish(latestUrls.current.filter((item) => item !== url));
    if (key) {
      sessionKeys.current.delete(url);
      // A foto já saiu do formulário; uma falha aqui só deixa um arquivo sem uso no armazenamento.
      await api.delete('/uploads', { data: { key } }).catch(() => {});
    }
    setRemoving(false);
  }

  function makeCover(url) {
    publish([url, ...latestUrls.current.filter((item) => item !== url)]);
  }

  // Reordenar: arrastando ou pelos botões ‹ › (para quem não usa o mouse).
  function move(from, to) {
    const current = latestUrls.current;
    if (from === to || to < 0 || to >= current.length) return;
    const next = [...current];
    next.splice(to, 0, next.splice(from, 1)[0]);
    publish(next);
  }

  const dropProps = {
    onDragOver: (event) => { event.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop,
  };
  const zoneClass = `rounded-card border-2 border-dashed transition-colors ${dragging ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface'}`;
  const fileInput = <input ref={input} type="file" accept={ACCEPTED_TYPES.join(',')} multiple={!isAvatar} onChange={onInputChange} className="sr-only" tabIndex={-1} aria-hidden="true" />;
  const help = hint ?? 'JPG, PNG ou WebP, com até 5 MB.';

  const messages = (
    <>
      <div id={statusId} aria-live="polite" className="sr-only">{busy ? 'Enviando imagem.' : ''}</div>
      {errors.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">
          {errors.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(file) => { setCropFile(null); upload(file, true); }}
        />
      )}
    </>
  );

  if (isAvatar) {
    const uploading = uploads[0];
    return (
      <div role="group" aria-labelledby={label ? labelId : undefined}>
        {label && <p id={labelId} className="mb-2 text-sm font-medium text-ink">{label}</p>}
        <div {...dropProps} className={`${zoneClass} flex flex-wrap items-center gap-4 p-4`}>
          {uploading
            ? <img src={uploading.preview} alt="" className="h-24 w-24 shrink-0 rounded-full object-cover opacity-60" />
            : <Avatar src={urls[0]} name={name} size="xl" />}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs leading-5 text-ink-muted">{help} Arraste a foto até aqui ou escolha um arquivo.</p>
            {uploading && <ProgressBar value={uploading.progress} label="Progresso do envio da foto" />}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy}>{urls[0] ? 'Trocar foto' : 'Escolher foto'}</Button>
              {urls[0] && <Button variant="ghost" size="sm" onClick={() => remove(urls[0])} disabled={busy || removing}>Remover</Button>}
            </div>
          </div>
          {fileInput}
        </div>
        {messages}
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={label ? labelId : undefined}>
      {label && <p id={labelId} className="mb-2 text-sm font-medium text-ink">{label}</p>}
      {(urls.length > 0 || uploads.length > 0) && (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {urls.map((url, index) => (
            <li
              key={url}
              draggable={reorderable}
              onDragStart={reorderable ? (event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); setDragIndex(index); } : undefined}
              onDragOver={reorderable && dragIndex !== null ? (event) => event.preventDefault() : undefined}
              onDrop={reorderable && dragIndex !== null ? (event) => { event.preventDefault(); move(dragIndex, index); setDragIndex(null); } : undefined}
              onDragEnd={reorderable ? () => setDragIndex(null) : undefined}
              className={`overflow-hidden rounded-control border bg-surface ${dragIndex === index ? 'border-primary opacity-60' : 'border-line'} ${reorderable ? 'cursor-grab' : ''}`}
            >
              <div className="relative aspect-[4/3]">
                <img src={url} alt={`Foto ${index + 1}`} draggable={false} className="h-full w-full object-cover" />
                {showCover && index === 0 && <span className="absolute left-2 top-2 rounded-full bg-primary-deep px-2 py-0.5 text-xs font-semibold text-white">Capa</span>}
                {reorderable && (
                  <span className="absolute right-2 top-2 flex gap-1">
                    <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Mover foto ${index + 1} para antes`} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink shadow-card disabled:opacity-40">‹</button>
                    <button type="button" onClick={() => move(index, index + 1)} disabled={index === urls.length - 1} aria-label={`Mover foto ${index + 1} para depois`} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink shadow-card disabled:opacity-40">›</button>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap justify-between gap-1 p-1">
                {showCover && index > 0
                  ? <button type="button" onClick={() => makeCover(url)} className="min-h-control-sm rounded-control px-2 text-xs font-semibold text-primary-strong hover:bg-primary-soft">Tornar capa</button>
                  : <span />}
                <button type="button" onClick={() => remove(url)} aria-label={`Remover foto ${index + 1}`} className="min-h-control-sm rounded-control px-2 text-xs font-semibold text-danger hover:bg-danger-soft">Remover</button>
              </div>
            </li>
          ))}
          {uploads.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-control border border-line bg-surface">
              <img src={item.preview} alt="" className="aspect-[4/3] w-full object-cover opacity-60" />
              <div className="p-3"><ProgressBar value={item.progress} label="Progresso do envio" /></div>
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 && (
        <div {...dropProps} className={`${zoneClass} px-4 py-6 text-center`}>
          <p className="text-sm font-medium text-ink">Arraste as fotos até aqui</p>
          <p className="mt-1 text-xs text-ink-muted">{help} Até {max} fotos.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => input.current?.click()}>Escolher fotos</Button>
          {fileInput}
        </div>
      )}
      {messages}
    </div>
  );
}
