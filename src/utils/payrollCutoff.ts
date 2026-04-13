/**
 * Payroll Cutoff Date Calculator
 * Calculates payroll cutoff dates and deadlines based on pay schedule
 */

export interface PayrollCutoffInfo {
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string; // e.g., "1-15 abril 2026"
  payday: Date;
  suggestedCutoff: Date;
  daysUntilCutoff: number;
  urgency: 'normal' | 'soon' | 'urgent' | 'overdue'; // normal=4+, soon=3, urgent=1-2, overdue=0 or past
}

// Spanish month names
const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Check if a date is a weekday (Monday-Friday)
 */
function isWeekday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // 1=Monday, 5=Friday
}

/**
 * Get previous Friday from a given date
 */
function getPreviousFriday(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();

  if (dayOfWeek === 5) {
    // Already Friday
    return result;
  } else if (dayOfWeek === 6) {
    // Saturday -> Friday (1 day back)
    result.setDate(result.getDate() - 1);
  } else if (dayOfWeek === 0) {
    // Sunday -> Friday (2 days back)
    result.setDate(result.getDate() - 2);
  } else {
    // Weekday but not Friday -> previous Friday
    const daysBack = dayOfWeek === 1 ? 3 : dayOfWeek - 5; // Monday=3 days, Tue=1, Wed=2, Thu=3
    result.setDate(result.getDate() - daysBack);
  }

  return result;
}

/**
 * Count business days between two dates (exclusive of end date)
 */
function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    if (isWeekday(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Subtract N business days from a date
 */
function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (isWeekday(result)) {
      remaining--;
    }
  }

  return result;
}

/**
 * Get the actual pay date (move to Friday if it falls on weekend)
 */
function getActualPayday(nominalPayday: Date): Date {
  if (isWeekday(nominalPayday)) {
    return new Date(nominalPayday);
  }
  return getPreviousFriday(nominalPayday);
}

/**
 * Format a date as Spanish locale (e.g., "13 de abril de 2026")
 */
export function formatDateES(date: Date): string {
  const day = date.getDate();
  const month = MONTHS_ES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

/**
 * Get the payroll cutoff info for a given reference date
 * If referenceDate is not provided, uses today
 */
export function getPayrollCutoffInfo(referenceDate?: Date): PayrollCutoffInfo {
  const today = referenceDate ? new Date(referenceDate) : new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Determine current period
  let periodStart: Date;
  let periodEnd: Date;
  let nominalPayday: Date;

  if (today.getDate() <= 15) {
    // Current period is 1-15
    periodStart = new Date(year, month, 1);
    periodEnd = new Date(year, month, 15);
    nominalPayday = new Date(year, month, 15);
  } else {
    // Current period is 16-last day
    periodStart = new Date(year, month, 16);
    periodEnd = new Date(year, month + 1, 0); // Last day of month
    nominalPayday = new Date(year, month + 1, 0); // Last day of month
  }

  // Get actual payday (adjusted for weekends)
  const payday = getActualPayday(nominalPayday);

  // Calculate cutoff: 4 business days before payday
  const cutoffDate = subtractBusinessDays(payday, 4);
  const suggestedCutoff = isWeekday(cutoffDate) ? cutoffDate : getPreviousFriday(cutoffDate);

  // Calculate days until cutoff from today
  const daysUntilCutoff = Math.ceil(
    (suggestedCutoff.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Determine urgency
  let urgency: 'normal' | 'soon' | 'urgent' | 'overdue';
  if (daysUntilCutoff <= -1) {
    urgency = 'overdue';
  } else if (daysUntilCutoff <= 0) {
    urgency = 'overdue';
  } else if (daysUntilCutoff === 1 || daysUntilCutoff === 2) {
    urgency = 'urgent';
  } else if (daysUntilCutoff === 3) {
    urgency = 'soon';
  } else {
    urgency = 'normal';
  }

  // Create period label (e.g., "1-15 abril 2026")
  const monthName = MONTHS_ES[month];
  const startDay = periodStart.getDate();
  const endDay = periodEnd.getDate();
  const periodLabel = `${startDay}-${endDay} ${monthName} ${year}`;

  return {
    periodStart,
    periodEnd,
    periodLabel,
    payday,
    suggestedCutoff,
    daysUntilCutoff,
    urgency,
  };
}
