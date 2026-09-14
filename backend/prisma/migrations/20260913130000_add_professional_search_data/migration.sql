ALTER TABLE `professional_profiles` ADD COLUMN `daily_rate` DECIMAL(10, 2) NULL;

CREATE TABLE `professional_catalog_services` (
  `professional_id` BIGINT UNSIGNED NOT NULL,
  `catalog_item_id` INTEGER UNSIGNED NOT NULL,
  PRIMARY KEY (`professional_id`, `catalog_item_id`),
  INDEX `professional_catalog_services_catalog_item_id_idx`(`catalog_item_id`),
  CONSTRAINT `professional_catalog_services_professional_id_fkey` FOREIGN KEY (`professional_id`) REFERENCES `professional_profiles`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `professional_catalog_services_catalog_item_id_fkey` FOREIGN KEY (`catalog_item_id`) REFERENCES `service_catalog_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `professional_availability` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `professional_id` BIGINT UNSIGNED NOT NULL,
  `date` DATE NOT NULL,
  `is_available` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `professional_availability_professional_id_date_key`(`professional_id`, `date`),
  INDEX `professional_availability_date_is_available_idx`(`date`, `is_available`),
  CONSTRAINT `professional_availability_professional_id_fkey` FOREIGN KEY (`professional_id`) REFERENCES `professional_profiles`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `professional_portfolio_images` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `professional_id` BIGINT UNSIGNED NOT NULL,
  `url` VARCHAR(2048) NOT NULL,
  `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `professional_portfolio_images_professional_id_sort_order_idx`(`professional_id`, `sort_order`),
  CONSTRAINT `professional_portfolio_images_professional_id_fkey` FOREIGN KEY (`professional_id`) REFERENCES `professional_profiles`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
