ALTER TABLE `professional_profiles` ADD COLUMN `is_published` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `professional_profiles_is_published_idx` ON `professional_profiles`(`is_published`);
