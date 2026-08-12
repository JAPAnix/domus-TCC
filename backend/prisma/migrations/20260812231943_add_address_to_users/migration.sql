-- DropIndex
DROP INDEX `professional_profiles_average_rating_idx` ON `professional_profiles`;

-- DropIndex
DROP INDEX `reviews_rating_idx` ON `reviews`;

-- DropIndex
DROP INDEX `services_created_at_idx` ON `services`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `city` VARCHAR(100) NULL,
    ADD COLUMN `complement` VARCHAR(100) NULL,
    ADD COLUMN `neighborhood` VARCHAR(100) NULL,
    ADD COLUMN `number` VARCHAR(20) NULL,
    ADD COLUMN `state` VARCHAR(2) NULL,
    ADD COLUMN `street` VARCHAR(255) NULL,
    ADD COLUMN `zip_code` VARCHAR(9) NULL;

-- CreateIndex
CREATE INDEX `professional_profiles_average_rating_idx` ON `professional_profiles`(`average_rating` DESC);

-- CreateIndex
CREATE INDEX `reviews_rating_idx` ON `reviews`(`rating` DESC);

-- CreateIndex
CREATE INDEX `services_created_at_idx` ON `services`(`created_at` DESC);
