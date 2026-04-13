/**
 * Time Clock Wizard CSV Parser
 * Parses TCW CSV exports to extract employee hours, working days, and flag anomalies
 */

export interface TCWResult {
  name: string;
  totalHours: number;
  daysWorked: string[];
  isWeekendTeam: boolean;
  status: 'ok' | 'warning' | 'critical' | 'new';
  hoursDeficit: number; // how many hours under threshold
  matchedEmployee: string | null; // matched known employee name, or null if new
}

interface EmployeeData {
  name: string;
  totalHours: number;
  daysWorked: string[];
  hasWeekendWork: boolean;
}

/**
 * Normalize a name for fuzzy matching
 * Converts to lowercase, trims, and removes accents
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Check if two names match (normalized comparison)
 */
function namesMatch(tcwName: string, knownName: string): boolean {
  return normalizeName(tcwName) === normalizeName(knownName);
}

/**
 * Find best matching known employee name using fuzzy matching
 */
function findMatchingEmployee(tcwName: string, knownEmployees: string[]): string | null {
  const normalizedTcw = normalizeName(tcwName);

  // Exact match first
  for (const known of knownEmployees) {
    if (normalizedTcw === normalizeName(known)) {
      return known;
    }
  }

  // No match found
  return null;
}

/**
 * Check if a date is a weekend (Saturday=6, Sunday=0 in JS Date)
 */
function isWeekend(dateStr: string): boolean {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Parse CSV text with proper handling of quoted fields
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // Field separator
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      // Row separator
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      // Skip \r\n combination
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentField += char;
    }
  }

  // Add final field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Main parser function
 */
export function parseTCW(csvText: string, knownEmployees: string[]): TCWResult[] {
  const rows = parseCSV(csvText);

  if (rows.length === 0) {
    return [];
  }

  // Find column indices from header
  const headers = rows[0].map((h) => normalizeName(h));
  const nameIdx = headers.findIndex((h) => h.includes('employee') && h.includes('name'));
  const dateIdx = headers.findIndex((h) => h === 'date');
  const hoursIdx = headers.findIndex(
    (h) => h.includes('totaldaywise') && h.includes('totalhours')
  );

  if (nameIdx === -1 || dateIdx === -1 || hoursIdx === -1) {
    console.warn('TCW CSV: Missing required columns (Employee Name, Date, TotalDaywiseTotalhours)');
    return [];
  }

  // Group rows by employee
  const employeeMap = new Map<string, EmployeeData>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(nameIdx, dateIdx, hoursIdx)) {
      continue; // Skip malformed rows
    }

    const name = row[nameIdx];
    const date = row[dateIdx];
    const hoursStr = row[hoursIdx];

    if (!name || !date || !hoursStr) {
      continue;
    }

    const hours = parseFloat(hoursStr);
    if (isNaN(hours)) {
      continue;
    }

    if (!employeeMap.has(name)) {
      employeeMap.set(name, {
        name,
        totalHours: hours,
        daysWorked: [],
        hasWeekendWork: false,
      });
    }

    const emp = employeeMap.get(name)!;
    emp.totalHours = hours; // Update to latest (should be same for all rows of same employee)
    emp.daysWorked.push(date);
    if (isWeekend(date)) {
      emp.hasWeekendWork = true;
    }
  }

  // Convert to results with flags
  const results: TCWResult[] = Array.from(employeeMap.values()).map((emp) => {
    const isWeekendTeam = emp.hasWeekendWork;
    const threshold = isWeekendTeam ? 30 : 36;
    const hoursDeficit = Math.max(0, threshold - emp.totalHours);

    let status: 'ok' | 'warning' | 'critical' | 'new' = 'ok';
    const matchedEmployee = findMatchingEmployee(emp.name, knownEmployees);

    if (matchedEmployee === null) {
      status = 'new';
    } else if (hoursDeficit >= 4) {
      status = 'critical';
    } else if (hoursDeficit > 0) {
      status = 'warning';
    }

    return {
      name: emp.name,
      totalHours: emp.totalHours,
      daysWorked: emp.daysWorked,
      isWeekendTeam,
      status,
      hoursDeficit,
      matchedEmployee,
    };
  });

  return results;
}
