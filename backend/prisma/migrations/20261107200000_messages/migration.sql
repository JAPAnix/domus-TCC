-- AlterTable
ALTER TABLE `user_settings` ADD COLUMN `message_suggestions` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `conversations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` BINARY(16) NOT NULL,
    `listing_id` BIGINT UNSIGNED NULL,
    `client_id` BIGINT UNSIGNED NOT NULL,
    `professional_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `last_message_at` DATETIME(3) NULL,
    `last_message_preview` VARCHAR(140) NULL,
    `client_last_read_at` DATETIME(3) NULL,
    `professional_last_read_at` DATETIME(3) NULL,
    `client_receipt_at` DATETIME(3) NULL,
    `professional_receipt_at` DATETIME(3) NULL,
    `client_archived_at` DATETIME(3) NULL,
    `professional_archived_at` DATETIME(3) NULL,
    `client_emailed_at` DATETIME(3) NULL,
    `professional_emailed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `conversations_uuid_key`(`uuid`),
    INDEX `conversations_client_id_last_message_at_idx`(`client_id`, `last_message_at`),
    INDEX `conversations_professional_id_last_message_at_idx`(`professional_id`, `last_message_at`),
    UNIQUE INDEX `conversations_listing_id_client_id_key`(`listing_id`, `client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` BINARY(16) NOT NULL,
    `conversation_id` BIGINT UNSIGNED NOT NULL,
    `sender_id` BIGINT UNSIGNED NOT NULL,
    `kind` VARCHAR(10) NOT NULL DEFAULT 'text',
    `body` TEXT NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `messages_uuid_key`(`uuid`),
    INDEX `messages_conversation_id_id_idx`(`conversation_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quick_replies` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(60) NOT NULL,
    `body` VARCHAR(1000) NOT NULL,
    `listing_id` BIGINT UNSIGNED NULL,
    `schedule` ENUM('none', 'before_service', 'after_service', 'review_request') NOT NULL DEFAULT 'none',
    `offset_hours` INTEGER NOT NULL DEFAULT 24,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quick_replies_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_sends` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `quick_reply_id` BIGINT UNSIGNED NOT NULL,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `scheduled_sends_quick_reply_id_order_id_key`(`quick_reply_id`, `order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_reports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `reporter_id` BIGINT UNSIGNED NOT NULL,
    `reported_id` BIGINT UNSIGNED NOT NULL,
    `conversation_id` BIGINT UNSIGNED NULL,
    `reason` VARCHAR(30) NOT NULL,
    `details` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_reports_reported_id_idx`(`reported_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedbacks` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `kind` VARCHAR(10) NOT NULL,
    `message` TEXT NOT NULL,
    `page` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_professional_id_fkey` FOREIGN KEY (`professional_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quick_replies` ADD CONSTRAINT `quick_replies_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quick_replies` ADD CONSTRAINT `quick_replies_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_sends` ADD CONSTRAINT `scheduled_sends_quick_reply_id_fkey` FOREIGN KEY (`quick_reply_id`) REFERENCES `quick_replies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_sends` ADD CONSTRAINT `scheduled_sends_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_reported_id_fkey` FOREIGN KEY (`reported_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedbacks` ADD CONSTRAINT `feedbacks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

