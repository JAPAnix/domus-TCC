ALTER TABLE `users`
  ADD COLUMN `is_phone_verified` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `preferred_name` VARCHAR(100) NULL,
  ADD COLUMN `birth_date` DATE NULL,
  ADD COLUMN `postal_same_as_home` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `postal_address` JSON NULL,
  ADD COLUMN `emergency_contact` JSON NULL;

CREATE TABLE `contact_verifications` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` VARCHAR(10) NOT NULL,
  `target` VARCHAR(255) NOT NULL,
  `code_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `delivered_at` DATETIME(3) NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `contact_verifications_user_id_type_created_at_idx` (`user_id`, `type`, `created_at`),
  INDEX `contact_verifications_target_created_at_idx` (`target`, `created_at`),
  CONSTRAINT `contact_verifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
