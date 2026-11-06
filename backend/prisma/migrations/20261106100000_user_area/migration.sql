-- AlterTable
ALTER TABLE `users` ADD COLUMN `about` TEXT NULL,
    ADD COLUMN `deactivated_at` DATETIME(3) NULL,
    ADD COLUMN `fun_fact` VARCHAR(200) NULL,
    ADD COLUMN `interests` JSON NULL,
    ADD COLUMN `languages` JSON NULL,
    ADD COLUMN `profession` VARCHAR(120) NULL,
    ADD COLUMN `school` VARCHAR(120) NULL,
    ADD COLUMN `service_areas` JSON NULL,
    ADD COLUMN `skills` JSON NULL,
    ADD COLUMN `years_experience` TINYINT UNSIGNED NULL;

-- CreateTable
CREATE TABLE `user_settings` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `profile_visibility` ENUM('everyone', 'members', 'connections') NOT NULL DEFAULT 'everyone',
    `read_receipts` BOOLEAN NOT NULL DEFAULT true,
    `search_indexing` BOOLEAN NOT NULL DEFAULT true,
    `show_written_reviews` BOOLEAN NOT NULL DEFAULT true,
    `cookie_preferences` JSON NULL,
    `notification_preferences` JSON NULL,
    `language` VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    `currency` VARCHAR(3) NOT NULL DEFAULT 'BRL',
    `tax_document_type` VARCHAR(4) NULL,
    `tax_document` VARCHAR(20) NULL,
    `tax_holder_name` VARCHAR(150) NULL,
    `payout_key_type` VARCHAR(10) NULL,
    `payout_key` VARCHAR(140) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `user_agent` VARCHAR(300) NULL,
    `ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,

    INDEX `user_sessions_user_id_revoked_at_idx`(`user_id`, `revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_blocks` (
    `blocker_id` BIGINT UNSIGNED NOT NULL,
    `blocked_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_blocks_blocked_id_idx`(`blocked_id`),
    PRIMARY KEY (`blocker_id`, `blocked_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorite_lists` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `favorite_lists_user_id_name_key`(`user_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorite_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `list_id` BIGINT UNSIGNED NOT NULL,
    `professional_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `favorite_items_professional_id_idx`(`professional_id`),
    UNIQUE INDEX `favorite_items_list_id_professional_id_key`(`list_id`, `professional_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recent_views` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `professional_id` BIGINT UNSIGNED NOT NULL,
    `viewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `recent_views_user_id_viewed_at_idx`(`user_id`, `viewed_at`),
    PRIMARY KEY (`user_id`, `professional_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `help_feedback` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `article_slug` VARCHAR(120) NOT NULL,
    `helpful` BOOLEAN NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `help_feedback_article_slug_idx`(`article_slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `category` VARCHAR(60) NOT NULL,
    `subject` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('open', 'answered', 'closed') NOT NULL DEFAULT 'open',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `support_tickets_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `support_tickets_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_blocks` ADD CONSTRAINT `user_blocks_blocker_id_fkey` FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_blocks` ADD CONSTRAINT `user_blocks_blocked_id_fkey` FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite_lists` ADD CONSTRAINT `favorite_lists_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite_items` ADD CONSTRAINT `favorite_items_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `favorite_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite_items` ADD CONSTRAINT `favorite_items_professional_id_fkey` FOREIGN KEY (`professional_id`) REFERENCES `professional_profiles`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recent_views` ADD CONSTRAINT `recent_views_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recent_views` ADD CONSTRAINT `recent_views_professional_id_fkey` FOREIGN KEY (`professional_id`) REFERENCES `professional_profiles`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

