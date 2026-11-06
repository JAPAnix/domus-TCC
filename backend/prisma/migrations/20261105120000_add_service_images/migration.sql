-- CreateTable
CREATE TABLE `service_images` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` BIGINT UNSIGNED NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    INDEX `service_images_service_id_sort_order_idx`(`service_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service_images` ADD CONSTRAINT `service_images_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
