ALTER TABLE `professional_profiles`
 ADD COLUMN `display_name` VARCHAR(150) NULL,
 ADD COLUMN `public_photo_url` VARCHAR(2048) NULL,
 ADD COLUMN `service_region` VARCHAR(500) NULL,
 ADD COLUMN `billing_mode` ENUM('hourly', 'daily', 'quote') NOT NULL DEFAULT 'hourly',
 ADD COLUMN `certifications` TEXT NULL;
UPDATE `professional_profiles` AS p
 JOIN `users` AS u ON p.`user_id` = u.`id`
 SET p.`display_name` = LEFT(TRIM(CONCAT(u.`first_name`, ' ', u.`last_name`)), 150),
 p.`public_photo_url` = u.`profile_picture_url`;

UPDATE `professional_profiles`
 SET `billing_mode` = CASE
 WHEN `hourly_rate` > 0 THEN 'hourly'
 WHEN `daily_rate` > 0 THEN 'daily'
 ELSE 'quote' END;
