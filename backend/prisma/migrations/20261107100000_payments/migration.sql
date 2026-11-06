
-- AlterTable
ALTER TABLE `user_settings` ADD COLUMN `accepted_payment_methods` VARCHAR(60) NOT NULL DEFAULT 'pix';

-- CreateTable
CREATE TABLE `payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` BINARY(16) NOT NULL,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `client_id` BIGINT UNSIGNED NOT NULL,
    `professional_id` BIGINT UNSIGNED NOT NULL,
    `provider` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `method` ENUM('pix', 'cash', 'card_in_person') NOT NULL,
    `status` ENUM('pending', 'reported', 'confirmed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    `amount` DECIMAL(10, 2) NOT NULL,
    `external_id` VARCHAR(80) NULL,
    `pix_payload` TEXT NULL,
    `receipt_number` VARCHAR(24) NULL,
    `note` VARCHAR(300) NULL,
    `reported_at` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `refunded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_uuid_key`(`uuid`),
    UNIQUE INDEX `payments_external_id_key`(`external_id`),
    UNIQUE INDEX `payments_receipt_number_key`(`receipt_number`),
    INDEX `payments_order_id_status_idx`(`order_id`, `status`),
    INDEX `payments_client_id_created_at_idx`(`client_id`, `created_at`),
    INDEX `payments_professional_id_created_at_idx`(`professional_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `payment_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NULL,
    `type` VARCHAR(30) NOT NULL,
    `from_status` VARCHAR(20) NULL,
    `to_status` VARCHAR(20) NOT NULL,
    `detail` VARCHAR(300) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_events_payment_id_created_at_idx`(`payment_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(20) NOT NULL,
    `event_key` VARCHAR(120) NOT NULL,
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `webhook_events_provider_event_key_key`(`provider`, `event_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_professional_id_fkey` FOREIGN KEY (`professional_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

