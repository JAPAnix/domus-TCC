-- AlterTable
ALTER TABLE `user_settings` ADD COLUMN `asaas_customer_id` VARCHAR(40) NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `amount_cents` INTEGER NULL,
    ADD COLUMN `auto_confirm_at` DATETIME(3) NULL,
    ADD COLUMN `client_fee_cents` INTEGER NULL,
    ADD COLUMN `commission_cents` INTEGER NULL,
    ADD COLUMN `escrow_id` VARCHAR(80) NULL,
    ADD COLUMN `expires_at` DATETIME(3) NULL,
    ADD COLUMN `fee_snapshot` JSON NULL,
    ADD COLUMN `gateway_fee_cents` INTEGER NULL,
    ADD COLUMN `installments` TINYINT UNSIGNED NULL,
    ADD COLUMN `invoice_url` VARCHAR(500) NULL,
    ADD COLUMN `payout_status` VARCHAR(16) NOT NULL DEFAULT 'none',
    ADD COLUMN `platform_share_cents` INTEGER NULL,
    ADD COLUMN `pro_share_cents` INTEGER NULL,
    ADD COLUMN `refunded_cents` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `released_at` DATETIME(3) NULL,
    MODIFY `method` ENUM('pix', 'cash', 'card_in_person', 'credit_card', 'boleto') NOT NULL,
    MODIFY `status` ENUM('pending', 'reported', 'confirmed', 'cancelled', 'refunded', 'expired', 'refused', 'disputed', 'chargeback') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `webhook_events` ADD COLUMN `error` VARCHAR(300) NULL,
    ADD COLUMN `event_name` VARCHAR(60) NULL,
    ADD COLUMN `reference` VARCHAR(80) NULL,
    ADD COLUMN `status` VARCHAR(12) NOT NULL DEFAULT 'done';

-- CreateTable
CREATE TABLE `payout_accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `provider` VARCHAR(20) NOT NULL DEFAULT 'asaas',
    `account_id` VARCHAR(60) NULL,
    `wallet_id` VARCHAR(60) NULL,
    `api_key_enc` TEXT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'not_started',
    `status_detail` JSON NULL,
    `rejection_reason` VARCHAR(300) NULL,
    `escrow_enabled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payout_accounts_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_disputes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `payment_id` BIGINT UNSIGNED NOT NULL,
    `opened_by_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'open',
    `resolution` VARCHAR(500) NULL,
    `resolved_by_id` BIGINT UNSIGNED NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_disputes_status_idx`(`status`),
    INDEX `payment_disputes_payment_id_idx`(`payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payout_accounts` ADD CONSTRAINT `payout_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_disputes` ADD CONSTRAINT `payment_disputes_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_disputes` ADD CONSTRAINT `payment_disputes_opened_by_id_fkey` FOREIGN KEY (`opened_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_disputes` ADD CONSTRAINT `payment_disputes_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

