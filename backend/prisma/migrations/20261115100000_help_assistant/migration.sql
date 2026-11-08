-- Assistente de ajuda: perguntas feitas (sem dados pessoais), se havia resposta e se ajudou.
-- Tabela nova; nenhum dado existente muda.

-- CreateTable
CREATE TABLE `help_assistant_questions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` BINARY(16) NOT NULL,
    `question` VARCHAR(200) NOT NULL,
    `article_slug` VARCHAR(120) NULL,
    `answered` BOOLEAN NOT NULL,
    `helpful` BOOLEAN NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `help_assistant_questions_uuid_key`(`uuid`),
    INDEX `help_assistant_questions_answered_created_at_idx`(`answered`, `created_at`),
    INDEX `help_assistant_questions_article_slug_idx`(`article_slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
