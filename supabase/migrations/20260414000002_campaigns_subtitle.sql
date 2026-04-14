-- Campaigns: add subtitle to clients table
-- Subtitle distinguishes sub-campaigns under the same parent name
-- e.g. Name: "Torro", Subtitle: "SLOC Weekday"

alter table public.clients
  add column if not exists subtitle text default null;
