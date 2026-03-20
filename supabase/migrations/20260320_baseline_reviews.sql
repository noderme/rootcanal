-- Add baseline review tracking to subscribers table
-- Records the user's review count at the time they joined (trial or paid)
alter table subscribers
  add column if not exists baseline_review_count integer,
  add column if not exists baseline_recorded_at  timestamptz;
