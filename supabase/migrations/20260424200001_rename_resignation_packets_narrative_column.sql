-- Align column name with cartas_compromiso + actas_administrativas.
-- Both of those use `narrative`; resignation_packets had `renuncia_narrative`.
-- Client save code was written using `narrative` (correct — matches the other
-- two), so renaming the column here is the lowest-friction fix.
--
-- Surfaced 2026-04-24: PGRST204 "Could not find the 'narrative' column of
-- 'resignation_packets' in the schema cache" when HR tried to save a renuncia
-- draft.
--
-- Applied via Cowork MCP 2026-04-24; this file commits for audit trail.

ALTER TABLE public.resignation_packets
  RENAME COLUMN renuncia_narrative TO narrative;

NOTIFY pgrst, 'reload schema';
