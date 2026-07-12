ALTER TABLE `application_cv_screenings`
  ADD COLUMN `extraction_method` VARCHAR(191) NULL,
  ADD COLUMN `extraction_raw_length` INTEGER NULL,
  ADD COLUMN `extraction_cleaned_length` INTEGER NULL;
