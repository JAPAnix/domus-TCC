-- Local do pedido aberto: o profissional precisa saber a região antes de enviar proposta.
-- Colunas opcionais; pedidos antigos continuam sem local.
ALTER TABLE `services` ADD COLUMN `city` VARCHAR(100) NULL,
    ADD COLUMN `neighborhood` VARCHAR(100) NULL,
    ADD COLUMN `state` VARCHAR(2) NULL;
