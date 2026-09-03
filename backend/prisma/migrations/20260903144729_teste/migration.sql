-- DropIndex
DROP INDEX `professional_profiles_average_rating_idx` ON `professional_profiles`;

-- DropIndex
DROP INDEX `reviews_rating_idx` ON `reviews`;

-- DropIndex
DROP INDEX `services_created_at_idx` ON `services`;

-- CreateIndex
CREATE INDEX `professional_profiles_average_rating_idx` ON `professional_profiles`(`average_rating` DESC);

-- CreateIndex
CREATE INDEX `reviews_rating_idx` ON `reviews`(`rating` DESC);

-- CreateIndex
CREATE INDEX `services_created_at_idx` ON `services`(`created_at` DESC);
