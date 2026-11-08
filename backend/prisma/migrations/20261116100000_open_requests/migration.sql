-- Pedido aberto completo: validade, limite de propostas, preferências do cliente, moderação, contador de oportunidades
-- novas e rascunho. Só acrescenta colunas com valor padrão, valores de enum e tabelas; nenhum dado existente muda.
-- Para desfazer (antes de usar): DROP das tabelas service_views, service_reports e service_drafts e DROP COLUMN das colunas novas.

-- AlterTable: services
ALTER TABLE `services` MODIFY `status` ENUM('draft', 'open', 'in_progress', 'completed', 'cancelled', 'expired', 'removed') NOT NULL DEFAULT 'draft',
    ADD COLUMN `expires_at` DATETIME(3) NULL,
    ADD COLUMN `max_proposals` SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    ADD COLUMN `only_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `min_rating` DECIMAL(2, 1) NULL,
    ADD COLUMN `modes` JSON NULL,
    ADD COLUMN `removed_at` DATETIME(3) NULL,
    ADD COLUMN `removed_reason` VARCHAR(200) NULL;

-- Pedidos abertos que já estavam abertos ganham 7 dias a partir de agora (antes não venciam).
UPDATE `services` SET `expires_at` = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 7 DAY) WHERE `status` = 'open' AND `expires_at` IS NULL;

-- AlterTable: proposals
ALTER TABLE `proposals` MODIFY `status` ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'expired') NOT NULL DEFAULT 'pending',
    ADD COLUMN `included` VARCHAR(500) NULL,
    ADD COLUMN `valid_until` DATETIME(3) NULL,
    ADD COLUMN `edited_at` DATETIME(3) NULL;

-- AlterTable: orders (origem da contratação)
ALTER TABLE `orders` ADD COLUMN `origin` ENUM('anuncio', 'pedido_aberto') NOT NULL DEFAULT 'anuncio';
UPDATE `orders` SET `origin` = 'pedido_aberto' WHERE `service_id` IS NOT NULL;

-- AlterTable: professional_profiles
ALTER TABLE `professional_profiles` ADD COLUMN `opportunity_digest_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `services_status_expires_at_idx` ON `services`(`status`, `expires_at`);

-- CreateTable
CREATE TABLE `service_views` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `service_id` BIGINT UNSIGNED NOT NULL,
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dismissed_at` DATETIME(3) NULL,

    INDEX `service_views_service_id_idx`(`service_id`),
    PRIMARY KEY (`user_id`, `service_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_reports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `reporter_id` BIGINT UNSIGNED NOT NULL,
    `service_id` BIGINT UNSIGNED NOT NULL,
    `proposal_id` BIGINT UNSIGNED NULL,
    `reason` VARCHAR(40) NOT NULL,
    `details` VARCHAR(500) NULL,
    `status` ENUM('open', 'dismissed', 'removed') NOT NULL DEFAULT 'open',
    `resolved_by_id` BIGINT UNSIGNED NULL,
    `resolved_at` DATETIME(3) NULL,
    `resolution_note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `service_reports_status_created_at_idx`(`status`, `created_at`),
    INDEX `service_reports_service_id_idx`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_drafts` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `data` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service_views` ADD CONSTRAINT `service_views_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `service_views` ADD CONSTRAINT `service_views_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `service_reports` ADD CONSTRAINT `service_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `service_reports` ADD CONSTRAINT `service_reports_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `service_drafts` ADD CONSTRAINT `service_drafts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
