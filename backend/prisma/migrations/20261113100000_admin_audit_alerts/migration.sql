-- Alertas resolvíveis, reembolso parcial nas reclamações e registro de auditoria das decisões do administrador.
-- Só acrescenta colunas opcionais e uma tabela nova; nenhum dado existente muda.

-- AlterTable
ALTER TABLE `payment_events` ADD COLUMN `resolution_note` VARCHAR(500) NULL,
    ADD COLUMN `resolved_at` DATETIME(3) NULL,
    ADD COLUMN `resolved_by_id` BIGINT UNSIGNED NULL;

-- AlterTable
ALTER TABLE `payment_disputes` ADD COLUMN `refunded_cents` INTEGER NULL;

-- CreateIndex
CREATE INDEX `payment_events_resolved_at_idx` ON `payment_events`(`resolved_at`);

-- CreateTable
CREATE TABLE `admin_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `admin_id` BIGINT UNSIGNED NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `target_type` VARCHAR(30) NOT NULL,
    `target_id` VARCHAR(64) NOT NULL,
    `detail` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_logs_created_at_idx`(`created_at`),
    INDEX `admin_audit_logs_admin_id_idx`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
