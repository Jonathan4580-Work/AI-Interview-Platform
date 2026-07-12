ALTER TABLE `application_cv_screenings`
  ADD COLUMN `extraction_quality_score` INTEGER NULL,
  ADD COLUMN `extraction_metadata_removed` BOOLEAN NOT NULL DEFAULT false;
