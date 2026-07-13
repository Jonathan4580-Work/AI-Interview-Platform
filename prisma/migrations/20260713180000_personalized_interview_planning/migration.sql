ALTER TABLE `candidate_invitations`
  ADD COLUMN `interview_plan_version_id` VARCHAR(191) NULL;

CREATE INDEX `ci_plan_version_idx`
  ON `candidate_invitations`(`company_id`, `interview_plan_version_id`);

CREATE TABLE `application_interview_plans` (
  `id` VARCHAR(191) NOT NULL,
  `company_id` VARCHAR(191) NOT NULL,
  `application_id` VARCHAR(191) NOT NULL,
  `candidate_id` VARCHAR(191) NOT NULL,
  `job_id` VARCHAR(191) NOT NULL,
  `source_interview_plan_version_id` VARCHAR(191) NULL,
  `personalized_interview_plan_id` VARCHAR(191) NULL,
  `personalized_interview_plan_version_id` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `provider` VARCHAR(191) NULL,
  `model` VARCHAR(191) NULL,
  `basis_summary` TEXT NULL,
  `question_count` INTEGER NOT NULL DEFAULT 0,
  `input_length` INTEGER NULL,
  `failure_code` VARCHAR(191) NULL,
  `failure_message_safe` TEXT NULL,
  `safe_diagnostics_json` JSON NOT NULL,
  `generated_at` DATETIME(3) NULL,
  `created_by_user_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `app_int_plan_company_id_key`(`company_id`, `id`),
  UNIQUE INDEX `app_int_plan_app_key`(`company_id`, `application_id`),
  INDEX `app_int_plan_job_status_idx`(`company_id`, `job_id`, `status`),
  INDEX `app_int_plan_candidate_idx`(`company_id`, `candidate_id`),
  INDEX `app_int_plan_version_idx`(`company_id`, `personalized_interview_plan_version_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `candidate_invitations`
  ADD CONSTRAINT `ci_plan_version_fk`
  FOREIGN KEY (`company_id`, `interview_plan_version_id`) REFERENCES `interview_plan_versions`(`company_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `application_interview_plans`
  ADD CONSTRAINT `aip_company_fk`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `application_interview_plans`
  ADD CONSTRAINT `aip_application_fk`
  FOREIGN KEY (`company_id`, `application_id`) REFERENCES `candidate_applications`(`company_id`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `application_interview_plans`
  ADD CONSTRAINT `aip_candidate_fk`
  FOREIGN KEY (`company_id`, `candidate_id`) REFERENCES `candidates`(`company_id`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `application_interview_plans`
  ADD CONSTRAINT `aip_job_fk`
  FOREIGN KEY (`company_id`, `job_id`) REFERENCES `jobs`(`company_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `application_interview_plans`
  ADD CONSTRAINT `aip_source_version_fk`
  FOREIGN KEY (`company_id`, `source_interview_plan_version_id`) REFERENCES `interview_plan_versions`(`company_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `application_interview_plans`
  ADD CONSTRAINT `aip_plan_fk`
  FOREIGN KEY (`company_id`, `personalized_interview_plan_id`) REFERENCES `interview_plans`(`company_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `application_interview_plans`
  ADD CONSTRAINT `aip_personal_version_fk`
  FOREIGN KEY (`company_id`, `personalized_interview_plan_version_id`) REFERENCES `interview_plan_versions`(`company_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `application_interview_plans`
  ADD CONSTRAINT `aip_created_by_fk`
  FOREIGN KEY (`company_id`, `created_by_user_id`) REFERENCES `users`(`company_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
