-- Estágio de proposta nos pedidos "sob consulta" e expiração de pedidos e propostas sem resposta.
-- Só acrescenta valores ao enum e colunas opcionais; nenhum pedido existente muda.
-- Pedidos já em andamento continuam com expires_at nulo (nunca expiram sozinhos).

-- AlterTable
ALTER TABLE `orders` MODIFY `status` ENUM('requested', 'proposed', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled', 'expired') NOT NULL DEFAULT 'requested',
    ADD COLUMN `proposal_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `proposal_days` SMALLINT UNSIGNED NULL,
    ADD COLUMN `proposal_date` DATE NULL,
    ADD COLUMN `proposal_included` VARCHAR(500) NULL,
    ADD COLUMN `proposal_note` VARCHAR(1000) NULL,
    ADD COLUMN `proposal_valid_until` DATETIME(3) NULL,
    ADD COLUMN `proposed_at` DATETIME(3) NULL,
    ADD COLUMN `expires_at` DATETIME(3) NULL,
    ADD COLUMN `decline_reason` VARCHAR(200) NULL;

-- CreateIndex
CREATE INDEX `orders_status_expires_at_idx` ON `orders`(`status`, `expires_at`);

-- CreateIndex
CREATE INDEX `orders_status_proposal_valid_until_idx` ON `orders`(`status`, `proposal_valid_until`);
