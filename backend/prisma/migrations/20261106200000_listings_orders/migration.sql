-- AlterTable
ALTER TABLE `reviews` ADD COLUMN `order_id` BIGINT UNSIGNED NULL,
    MODIFY `service_id` BIGINT UNSIGNED NULL;

-- AlterTable
ALTER TABLE `favorite_items` ADD COLUMN `listing_id` BIGINT UNSIGNED NULL;

-- CreateTable
CREATE TABLE `listings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` BINARY(16) NOT NULL,
    `owner_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('draft', 'published', 'paused') NOT NULL DEFAULT 'draft',
    `wizard_step` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `category_id` INTEGER UNSIGNED NULL,
    `catalog_item_id` INTEGER UNSIGNED NULL,
    `at_client_place` BOOLEAN NOT NULL DEFAULT false,
    `at_pro_place` BOOLEAN NOT NULL DEFAULT false,
    `is_remote` BOOLEAN NOT NULL DEFAULT false,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(2) NULL,
    `radius_km` SMALLINT UNSIGNED NULL,
    `title` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `included` JSON NULL,
    `excluded` JSON NULL,
    `requirements` TEXT NULL,
    `materials` TEXT NULL,
    `pricing_model` ENUM('hourly', 'daily', 'fixed', 'quote') NULL,
    `price` DECIMAL(10, 2) NULL,
    `travel_fee` DECIMAL(10, 2) NULL,
    `packages` JSON NULL,
    `availability` JSON NULL,
    `cancellation_policy` ENUM('flexible', 'moderate', 'strict') NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `listings_uuid_key`(`uuid`),
    INDEX `listings_owner_id_status_idx`(`owner_id`, `status`),
    INDEX `listings_status_category_id_idx`(`status`, `category_id`),
    INDEX `listings_status_city_idx`(`status`, `city`),
    INDEX `listings_status_published_at_idx`(`status`, `published_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listing_images` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `listing_id` BIGINT UNSIGNED NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    INDEX `listing_images_listing_id_sort_order_idx`(`listing_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recent_listing_views` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `listing_id` BIGINT UNSIGNED NOT NULL,
    `viewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `recent_listing_views_user_id_viewed_at_idx`(`user_id`, `viewed_at`),
    PRIMARY KEY (`user_id`, `listing_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professional_verifications` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `legal_name` VARCHAR(150) NOT NULL,
    `document_type` VARCHAR(4) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` BINARY(16) NOT NULL,
    `listing_id` BIGINT UNSIGNED NOT NULL,
    `client_id` BIGINT UNSIGNED NOT NULL,
    `professional_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('requested', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled') NOT NULL DEFAULT 'requested',
    `scheduled_date` DATE NOT NULL,
    `service_mode` VARCHAR(12) NOT NULL,
    `package_name` VARCHAR(60) NULL,
    `note` TEXT NULL,
    `title_snapshot` VARCHAR(120) NOT NULL,
    `pricing_model_snapshot` ENUM('hourly', 'daily', 'fixed', 'quote') NULL,
    `price_snapshot` DECIMAL(10, 2) NULL,
    `travel_fee_snapshot` DECIMAL(10, 2) NULL,
    `policy_snapshot` ENUM('flexible', 'moderate', 'strict') NULL,
    `platform_fee_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `final_amount` DECIMAL(10, 2) NULL,
    `cancelled_by_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,

    UNIQUE INDEX `orders_uuid_key`(`uuid`),
    INDEX `orders_client_id_status_idx`(`client_id`, `status`),
    INDEX `orders_professional_id_status_idx`(`professional_id`, `status`),
    INDEX `orders_listing_id_idx`(`listing_id`),
    INDEX `orders_professional_id_scheduled_date_idx`(`professional_id`, `scheduled_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `reviews_order_id_reviewer_id_reviewed_id_key` ON `reviews`(`order_id`, `reviewer_id`, `reviewed_id`);

-- CreateIndex
CREATE INDEX `favorite_items_listing_id_idx` ON `favorite_items`(`listing_id`);

-- CreateIndex
CREATE UNIQUE INDEX `favorite_items_list_id_listing_id_key` ON `favorite_items`(`list_id`, `listing_id`);

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite_items` ADD CONSTRAINT `favorite_items_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listings` ADD CONSTRAINT `listings_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listings` ADD CONSTRAINT `listings_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listings` ADD CONSTRAINT `listings_catalog_item_id_fkey` FOREIGN KEY (`catalog_item_id`) REFERENCES `service_catalog_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_images` ADD CONSTRAINT `listing_images_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recent_listing_views` ADD CONSTRAINT `recent_listing_views_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recent_listing_views` ADD CONSTRAINT `recent_listing_views_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professional_verifications` ADD CONSTRAINT `professional_verifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_professional_id_fkey` FOREIGN KEY (`professional_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

