-- AlterTable
ALTER TABLE `reviews` ADD COLUMN `replied_at` DATETIME(3) NULL,
    ADD COLUMN `reply` TEXT NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `end_date` DATE NULL,
    ADD COLUMN `quantity` SMALLINT UNSIGNED NULL,
    ADD COLUMN `reference_images` JSON NULL,
    ADD COLUMN `scheduled_time` VARCHAR(5) NULL;

-- CreateTable
CREATE TABLE `listing_reports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `listing_id` BIGINT UNSIGNED NOT NULL,
    `reporter_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(30) NOT NULL,
    `details` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `listing_reports_listing_id_reporter_id_key`(`listing_id`, `reporter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `listing_reports` ADD CONSTRAINT `listing_reports_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_reports` ADD CONSTRAINT `listing_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

