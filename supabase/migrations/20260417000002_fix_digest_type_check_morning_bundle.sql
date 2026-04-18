-- Align eod_digest_log.digest_type CHECK with what the send-eod-digest edge function writes.
-- The function writes 'morning_bundle' (matches handleMorningBundle + the cron job name
-- eod-morning-bundle-check + the POST body {"type":"morning_bundle"}); the previous constraint
-- only allowed 'late_bundle', which would have raised a CHECK violation the first time the
-- morning bundle had real data to log. No existing rows used 'late_bundle', so no data
-- migration is required.

ALTER TABLE public.eod_digest_log DROP CONSTRAINT IF EXISTS eod_digest_log_digest_type_check;

ALTER TABLE public.eod_digest_log
  ADD CONSTRAINT eod_digest_log_digest_type_check
  CHECK (digest_type = ANY (ARRAY['daily'::text, 'morning_bundle'::text]));
