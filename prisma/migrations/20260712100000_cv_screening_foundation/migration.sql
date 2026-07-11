CREATE TABLE `application_cv_screenings` (
  `id` VARCHAR(191) NOT NULL,
  `company_id` VARCHAR(191) NOT NULL,
  `application_id` VARCHAR(191) NOT NULL,
  `candidate_id` VARCHAR(191) NOT NULL,
  `job_id` VARCHAR(191) NOT NULL,
  `cv_document_id` VARCHAR(191) NULL,
  `processing_workflow_id` VARCHAR(191) NULL,
  `extraction_status` ENUM('PENDING', 'COMPLETE', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `screening_status` ENUM('PENDING', 'COMPLETE', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `extracted_text` LONGTEXT NULL,
  `extracted_text_hash` VARCHAR(191) NULL,
  `match_score` INTEGER NULL,
  `recommendation` ENUM('RECOMMENDED', 'MAYBE', 'NOT_RECOMMENDED') NULL,
  `confidence` ENUM('HIGH', 'MODERATE', 'LIMITED', 'INSUFFICIENT_EVIDENCE') NULL,
  `hr_summary` TEXT NULL,
  `matched_skills_json` JSON NOT NULL,
  `missing_skills_json` JSON NOT NULL,
  `experience_match` TEXT NULL,
  `responsibility_match` TEXT NULL,
  `education_match` TEXT NULL,
  `concerns_json` JSON NOT NULL,
  `focus_areas_json` JSON NOT NULL,
  `evidence_json` JSON NOT NULL,
  `limitations_json` JSON NOT NULL,
  `provider` VARCHAR(191) NULL,
  `model` VARCHAR(191) NULL,
  `failure_code` VARCHAR(191) NULL,
  `failure_message_safe` TEXT NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `cv_screen_company_id_key`(`company_id`, `id`),
  UNIQUE INDEX `cv_screen_app_key`(`company_id`, `application_id`),
  INDEX `cv_screen_job_status_idx`(`company_id`, `job_id`, `screening_status`),
  INDEX `cv_screen_candidate_idx`(`company_id`, `candidate_id`),
  INDEX `cv_screen_workflow_idx`(`company_id`, `processing_workflow_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `application_cv_screenings`
  ADD CONSTRAINT `cv_screen_company_fk`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `application_cv_screenings`
  ADD CONSTRAINT `cv_screen_app_fk`
  FOREIGN KEY (`company_id`, `application_id`) REFERENCES `candidate_applications`(`company_id`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `application_cv_screenings`
  ADD CONSTRAINT `cv_screen_candidate_fk`
  FOREIGN KEY (`company_id`, `candidate_id`) REFERENCES `candidates`(`company_id`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `application_cv_screenings`
  ADD CONSTRAINT `cv_screen_job_fk`
  FOREIGN KEY (`company_id`, `job_id`) REFERENCES `jobs`(`company_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `application_cv_screenings`
  ADD CONSTRAINT `cv_screen_doc_fk`
  FOREIGN KEY (`company_id`, `cv_document_id`) REFERENCES `candidate_documents`(`company_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
