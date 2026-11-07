-- Contratação nascida de uma proposta aceita num pedido aberto: o Order passa a poder existir sem anúncio.
-- Só adiciona colunas opcionais e relaxa listing_id; nenhum dado existente é alterado.

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `proposal_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `service_id` BIGINT UNSIGNED NULL,
    MODIFY `listing_id` BIGINT UNSIGNED NULL;

-- CreateIndex
CREATE UNIQUE INDEX `orders_service_id_key` ON `orders`(`service_id`);

-- CreateIndex
CREATE UNIQUE INDEX `orders_proposal_id_key` ON `orders`(`proposal_id`);

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_proposal_id_fkey` FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
