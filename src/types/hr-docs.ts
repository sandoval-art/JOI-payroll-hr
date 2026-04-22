// B2/B3 domain types — cartas de compromiso + actas administrativas
// Hand-curated shapes for UI/hook use. Snake_case in DB → camelCase here.

export type HrDocumentRequestType = 'carta' | 'acta';

export type HrDocumentRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'fulfilled'
  | 'canceled'
  | 'downgraded';

export interface HrDocumentRequest {
  id: string;
  employeeId: string;
  requestType: HrDocumentRequestType;
  status: HrDocumentRequestStatus;
  filedBy: string;
  filedAt: string;
  incidentDate: string;
  tlNarrative: string;
  reason: string | null;
  fulfilledCartaId: string | null;
  fulfilledActaId: string | null;
  canceledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartaKpiRow {
  area: string;
  indicador: string;
  meta: string;
}

export interface CartaCompromiso {
  id: string;
  employeeId: string;
  requestId: string | null;
  docRef: string | null;
  incidentDate: string;
  narrative: string | null;
  kpiTable: CartaKpiRow[];
  trabajadorNameSnapshot: string | null;
  puestoSnapshot: string | null;
  horarioSnapshot: string | null;
  supervisorNameSnapshot: string | null;
  companyLegalNameSnapshot: string | null;
  companyLegalAddressSnapshot: string | null;
  incidentDateLongSnapshot: string | null;
  pdfPath: string | null;
  signedAt: string | null;
  signedScanPath: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActaWitness {
  name: string;
  role: string;
}

export interface ActaAdministrativa {
  id: string;
  employeeId: string;
  requestId: string | null;
  docRef: string | null;
  incidentDate: string;
  narrative: string | null;
  witnesses: ActaWitness[];
  reincidenciaPriorCartaId: string | null;
  trabajadorNameSnapshot: string | null;
  puestoSnapshot: string | null;
  horarioSnapshot: string | null;
  supervisorNameSnapshot: string | null;
  companyLegalNameSnapshot: string | null;
  companyLegalAddressSnapshot: string | null;
  incidentDateLongSnapshot: string | null;
  pdfPath: string | null;
  signedAt: string | null;
  signedScanPath: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
