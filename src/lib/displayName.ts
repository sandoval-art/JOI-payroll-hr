/**
 * Returns work_name if set, otherwise full_name.
 * work_name is the preferred day-to-day display name; full_name is the legal name.
 */
export function getDisplayName(emp: { work_name?: string | null; full_name: string }): string {
  return emp.work_name?.trim() || emp.full_name;
}
