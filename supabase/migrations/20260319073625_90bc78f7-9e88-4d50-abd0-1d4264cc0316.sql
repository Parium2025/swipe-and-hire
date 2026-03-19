-- Clean up employer_notes: keep only the latest row per employer_id
DELETE FROM employer_notes
WHERE id NOT IN (
  SELECT DISTINCT ON (employer_id) id
  FROM employer_notes
  ORDER BY employer_id, updated_at DESC
);

-- Clean up jobseeker_notes: keep only the latest row per user_id
DELETE FROM jobseeker_notes
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM jobseeker_notes
  ORDER BY user_id, updated_at DESC
);

-- Add unique constraints to prevent future duplicates
ALTER TABLE employer_notes ADD CONSTRAINT employer_notes_employer_id_unique UNIQUE (employer_id);
ALTER TABLE jobseeker_notes ADD CONSTRAINT jobseeker_notes_user_id_unique UNIQUE (user_id);