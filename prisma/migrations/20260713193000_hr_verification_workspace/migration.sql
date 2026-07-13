ALTER TABLE `application_decision_history`
  MODIFY COLUMN `decision` ENUM(
    'SHORTLISTED',
    'NOT_SELECTED',
    'RETURNED_TO_REVIEW',
    'HR_VERIFIED',
    'HR_REJECTED',
    'HOLD',
    'REQUEST_ANOTHER_AI_INTERVIEW'
  ) NOT NULL;
