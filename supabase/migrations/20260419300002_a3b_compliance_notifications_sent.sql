-- A3b: Compliance email notification deduplication table
-- Tracks which compliance emails have been sent to prevent repeats.
-- One row per (employee, notification_type, optional document).

CREATE TABLE public.compliance_notifications_sent (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  notification_type   text        NOT NULL
                      CHECK (notification_type IN ('rejection', 'reminder_7d', 'reminder_3d', 'reminder_1d', 'lock')),
  related_document_id uuid        REFERENCES public.employee_documents(id) ON DELETE SET NULL,
  sent_at             timestamptz NOT NULL DEFAULT now(),

  -- Rejection rows are per-document (related_document_id is set).
  -- Reminder/lock rows have NULL related_document_id (one per employee per type).
  UNIQUE (employee_id, notification_type, related_document_id)
);

COMMENT ON TABLE public.compliance_notifications_sent IS
  'Dedupe table for compliance email notifications. Prevents sending the same email twice.';

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.compliance_notifications_sent ENABLE ROW LEVEL SECURITY;

-- Leadership can read (for audit visibility)
CREATE POLICY "leadership_select_compliance_notifications"
  ON public.compliance_notifications_sent FOR SELECT TO authenticated
  USING (public.is_leadership());

-- No insert/update/delete policies for authenticated users.
-- Only service_role (edge function) may write.
