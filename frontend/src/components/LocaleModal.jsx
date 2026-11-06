import LocaleOptions from './LocaleOptions';
import { Button, Modal } from './ui';

export default function LocaleModal({ open, onClose }) {
  return (
    <Modal open={open} title="Idioma e moeda" onClose={onClose} footer={<Button onClick={onClose}>Concluído</Button>}>
      <LocaleOptions />
    </Modal>
  );
}
