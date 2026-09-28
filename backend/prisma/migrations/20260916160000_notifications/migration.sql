CREATE TABLE `notifications` (
 `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 `user_id` BIGINT UNSIGNED NOT NULL,
 `event_key` VARCHAR(191) NOT NULL,
 `message` VARCHAR(500) NOT NULL,
 `href` VARCHAR(255) NOT NULL,
 `read_at` DATETIME(3) NULL,
 `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE INDEX `notifications_event_key_key` (`event_key`),
 INDEX `notifications_user_id_read_at_created_at_idx` (`user_id`, `read_at`, `created_at`),
 CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
