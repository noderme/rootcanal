-- Add enrichment columns to leads table for the ENIGMA pipeline
alter table leads
  add column if not exists google_rank  integer,
  add column if not exists review_gap   integer,
  add column if not exists email_status text,
  add column if not exists state        text,
  add column if not exists zip          text;
