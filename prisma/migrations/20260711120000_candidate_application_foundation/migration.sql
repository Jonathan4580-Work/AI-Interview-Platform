CREATE TABLE `candidate_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `company_id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `normalized_email` VARCHAR(191) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `password_hash` TEXT NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `email_verified_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,

  UNIQUE INDEX `cand_acc_company_id_key`(`company_id`, `id`),
  UNIQUE INDEX `cand_acc_email_key`(`company_id`, `normalized_email`),
  INDEX `cand_acc_status_idx`(`company_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `candidate_account_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `account_id` VARCHAR(191) NOT NULL,
  `company_id` VARCHAR(191) NOT NULL,
  `token_hash` VARCHAR(191) NOT NULL,
  `status` ENUM('ACTIVE', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `expires_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `cas_token_hash_key`(`token_hash`),
  INDEX `cas_comp_acc_status_exp_idx`(`company_id`, `account_id`, `status`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `candidate_applications`
  ADD COLUMN `candidate_account_id` VARCHAR(191) NULL;

CREATE INDEX `ca_cand_account_idx`
  ON `candidate_applications`(`candidate_account_id`);

ALTER TABLE `candidate_accounts`
  ADD CONSTRAINT `cand_acc_company_fk`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `candidate_account_sessions`
  ADD CONSTRAINT `cas_account_fk`
  FOREIGN KEY (`company_id`, `account_id`) REFERENCES `candidate_accounts`(`company_id`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `candidate_applications`
  ADD CONSTRAINT `ca_cand_account_fk`
  FOREIGN KEY (`candidate_account_id`) REFERENCES `candidate_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
