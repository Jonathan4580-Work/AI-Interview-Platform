ALTER TABLE `interview_availability_slots`
  ADD COLUMN `purpose` VARCHAR(64) NOT NULL DEFAULT 'AI_INTERVIEW';

ALTER TABLE `application_availability_requests`
  ADD COLUMN `purpose` VARCHAR(64) NOT NULL DEFAULT 'AI_INTERVIEW';

CREATE INDEX `ias_purpose_job_status_idx`
  ON `interview_availability_slots`(`company_id`, `purpose`, `job_id`, `status`, `start_at`);

CREATE INDEX `aar_purpose_app_status_idx`
  ON `application_availability_requests`(`company_id`, `purpose`, `application_id`, `status`);
