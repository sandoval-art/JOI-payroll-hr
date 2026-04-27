/**
 * Add requires_request flag to company_holidays
 *
 * Holidays where requires_request = false are mandatory days off —
 * employees don't need to submit a request (Christmas, New Year's).
 * The UI shows these as "Mandatory day off" instead of a request button.
 *
 * Applied manually via MCP execute_sql 2026-04-27.
 */

ALTER TABLE public.company_holidays
  ADD COLUMN requires_request boolean NOT NULL DEFAULT true;

-- Christmas and New Year's are mandatory — no request needed.
-- Pattern matches any year so future holiday seeds inherit the flag.
UPDATE public.company_holidays
  SET requires_request = false
  WHERE (EXTRACT(MONTH FROM date) = 12 AND EXTRACT(DAY FROM date) = 25)
     OR (EXTRACT(MONTH FROM date) = 1  AND EXTRACT(DAY FROM date) = 1);
