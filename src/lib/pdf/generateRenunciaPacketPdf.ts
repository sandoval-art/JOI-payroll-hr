import type { FinalizationDraft, HrDocumentRequestQueueItem } from "@/hooks/useHrDocumentRequests";
import { formatDateSpanishFull } from "@/lib/localDate";
import {
  RENUNCIA_OPENING,
  RENUNCIA_CLOSING,
  FINIQUITO_BODY_TEMPLATE,
  FINIQUITO_LEGAL_BOILERPLATE,
  ENCUESTA_INTRO,
  ENCUESTA_CATEGORIES,
  ENCUESTA_OPEN_QUESTIONS,
  ENCUESTA_CAUSA_OPTIONS,
  renderTemplate,
} from "@/lib/documentTemplates";
import {
  createDoc,
  drawParagraph,
  drawMetadataTable,
  drawFooters,
  drawSignatureBlock,
  ensureSpace,
  MARGIN_LEFT,
  PAGE_WIDTH,
  MARGIN_TOP,
  CONTENT_WIDTH,
  PAGE_HEIGHT,
  MARGIN_BOTTOM,
} from "./pdfHelpers";

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "$ 0.00";
  return `$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateEnMixed(dateISO: string | null | undefined): string {
  if (!dateISO) return "";
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00`);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

export function generateRenunciaPacketPdf(
  draft: FinalizationDraft,
  request: HrDocumentRequestQueueItem,
): Blob {
  const doc = createDoc();
  const effectiveDate = draft.effectiveDate ?? draft.incidentDate;
  const effectiveDateLong = formatDateSpanishFull(effectiveDate);
  const effectiveDateEnMixed = formatDateEnMixed(effectiveDate);
  const trabajador = draft.trabajadorNameSnapshot ?? "";
  const puesto = draft.puestoSnapshot ?? "";

  // ── Page 1: Renuncia letter ─────────────────────────────────────
  let y = MARGIN_TOP;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Guadalajara, Jalisco, a ${effectiveDateEnMixed}`,
    PAGE_WIDTH - 0.75,
    y,
    { align: "right" },
  );
  y += 0.4;

  doc.setFont("Helvetica", "bold");
  doc.text("OUTSOURCE CONSULTING GROUP SAS:", MARGIN_LEFT, y);
  y += 0.4;

  const renunciaVars = {
    puesto: puesto.toUpperCase(),
    effective_date: effectiveDateLong,
  };
  y = drawParagraph(
    doc,
    renderTemplate(RENUNCIA_OPENING, renunciaVars),
    MARGIN_LEFT,
    y,
    CONTENT_WIDTH,
  );
  y += 0.2;

  y = drawParagraph(doc, RENUNCIA_CLOSING, MARGIN_LEFT, y, CONTENT_WIDTH);
  y += 0.4;

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ATENTAMENTE", MARGIN_LEFT, y);
  y += 0.5;

  y = drawSignatureBlock(
    doc,
    MARGIN_LEFT,
    y,
    CONTENT_WIDTH / 2,
    "",
  );

  // ── Page 2: Finiquito ──────────────────────────────────────────
  doc.addPage();
  y = MARGIN_TOP;

  doc.setFont("Helvetica", "bolditalic");
  doc.setFontSize(11);
  doc.text("FINIQUITO", MARGIN_LEFT, y);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `Guadalajara, Jalisco, ${effectiveDateLong}`,
    PAGE_WIDTH - 0.75,
    y,
    { align: "right" },
  );
  y += 0.3;

  // Metadata table
  const hireDateFormatted = draft.hireDateSnapshot
    ? formatDateSpanishFull(draft.hireDateSnapshot)
    : "";
  y = drawMetadataTable(
    doc,
    [
      { label: "Nombre del trabajador:", value: trabajador },
      { label: "Fecha de ingreso:", value: hireDateFormatted },
      { label: "Fecha de renuncia:", value: effectiveDateLong },
      { label: "Puesto desempeñado:", value: puesto },
      { label: "Horario de Trabajo:", value: draft.horarioSnapshot ?? "" },
      { label: "Salario Diario:", value: fmtMoney(draft.salarioDiarioSnapshot) },
    ],
    MARGIN_LEFT,
    y,
    1.7,
    CONTENT_WIDTH,
  );
  y += 0.2;

  // Finiquito body paragraph
  const finVars = {
    total_monto: fmtMoney(draft.totalMonto),
    total_en_letras: draft.totalEnLetras ?? "",
    effective_date: effectiveDateLong,
  };
  y = drawParagraph(
    doc,
    renderTemplate(FINIQUITO_BODY_TEMPLATE, finVars),
    MARGIN_LEFT,
    y,
    CONTENT_WIDTH,
  );
  y += 0.2;

  // Itemized table
  const items = [
    { label: "Aguinaldo proporcional", value: fmtMoney(draft.aguinaldoMonto) },
    { label: "Vacaciones correspondientes", value: fmtMoney(draft.vacacionesMonto) },
    { label: "Prima vacacional (25%)", value: fmtMoney(draft.primaVacacionalMonto) },
  ];
  y = drawMetadataTable(doc, items.map((i) => ({ label: i.label, value: i.value })), MARGIN_LEFT, y, 2.5, CONTENT_WIDTH);

  // Total row (bold)
  const totalRowH = 0.3;
  y = ensureSpace(doc, y, totalRowH);
  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN_LEFT, y, 2.5, totalRowH, "FD");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total", MARGIN_LEFT + 0.08, y + 0.2);
  doc.rect(MARGIN_LEFT + 2.5, y, CONTENT_WIDTH - 2.5, totalRowH);
  doc.text(fmtMoney(draft.totalMonto), MARGIN_LEFT + 2.58, y + 0.2);
  y += totalRowH;

  // Importe con letra row
  const letraRowH = 0.3;
  doc.rect(MARGIN_LEFT, y, 2.5, letraRowH);
  doc.setFont("Helvetica", "normal");
  doc.text("Importe con letra", MARGIN_LEFT + 0.08, y + 0.2);
  doc.rect(MARGIN_LEFT + 2.5, y, CONTENT_WIDTH - 2.5, letraRowH);
  doc.setFontSize(8);
  const letraText = draft.totalEnLetras ?? "";
  const letraLines = doc.splitTextToSize(letraText, CONTENT_WIDTH - 2.5 - 0.16);
  doc.text(letraLines[0] ?? "", MARGIN_LEFT + 2.58, y + 0.2);
  y += letraRowH + 0.2;

  doc.setFontSize(10);

  // Legal boilerplate
  y = drawParagraph(doc, FINIQUITO_LEGAL_BOILERPLATE, MARGIN_LEFT, y, CONTENT_WIDTH);
  y += 0.3;

  // Signature
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Firma de conformidad:", MARGIN_LEFT, y);
  y += 0.4;
  y = drawSignatureBlock(doc, MARGIN_LEFT, y, CONTENT_WIDTH / 2, "");
  y += 0.1;

  // Identity info
  doc.setFont("Helvetica", "italic");
  doc.setFontSize(9);
  doc.text(`CLAVE DE ELECTOR: ${draft.claveElector ?? ""}`, MARGIN_LEFT, y);
  y += 0.15;
  doc.text(`CURP: ${draft.curpSnapshot ?? ""}`, MARGIN_LEFT, y);
  y += 0.15;
  doc.text(`RFC: ${draft.rfcSnapshot ?? ""}`, MARGIN_LEFT, y);
  y += 0.3;

  // Fingerprint boxes
  const boxSize = 0.8;
  const boxX1 = PAGE_WIDTH - 0.75 - boxSize * 2 - 0.3;
  const boxX2 = PAGE_WIDTH - 0.75 - boxSize;
  y = ensureSpace(doc, y, boxSize + 0.3);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7);
  doc.rect(boxX1, y, boxSize, boxSize);
  doc.text("Huella Digital izquierda", boxX1, y + boxSize + 0.12, { align: "left" });
  doc.rect(boxX2, y, boxSize, boxSize);
  doc.text("Huella digital derecha", boxX2, y + boxSize + 0.12, { align: "left" });

  // ── Page 3: Encuesta part 1 ────────────────────────────────────
  doc.addPage();
  y = MARGIN_TOP;

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ENCUESTA DE SALIDA", PAGE_WIDTH / 2, y, { align: "center" });
  y += 0.3;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`FECHA: ${effectiveDateLong}`, MARGIN_LEFT, y);
  y += 0.17;
  doc.text(`NOMBRE: ${trabajador}`, MARGIN_LEFT, y);
  y += 0.17;
  doc.text(`PUESTO: ${puesto}`, MARGIN_LEFT, y);
  y += 0.25;

  y = drawParagraph(doc, ENCUESTA_INTRO, MARGIN_LEFT, y, CONTENT_WIDTH, { fontSize: 9 });
  y += 0.15;

  // Likert table
  const likertHeaders = ["MUY\nSATISFECHO", "SATISFECHO", "NEUTRAL", "INSATISFECHO", "MUY\nINSATISFECHO"];
  const qColW = CONTENT_WIDTH * 0.42;
  const optColW = (CONTENT_WIDTH - qColW) / 5;
  const rowH = 0.25;

  // Header row
  y = ensureSpace(doc, y, 0.4);
  doc.setFillColor(220, 220, 220);
  doc.rect(MARGIN_LEFT, y, qColW, 0.35, "FD");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(6);
  for (let i = 0; i < 5; i++) {
    const cx = MARGIN_LEFT + qColW + optColW * i;
    doc.rect(cx, y, optColW, 0.35, "FD");
    const lines = likertHeaders[i].split("\n");
    doc.text(lines, cx + optColW / 2, y + 0.12, { align: "center" });
  }
  y += 0.35;

  // Categories + questions
  for (const cat of ENCUESTA_CATEGORIES) {
    // Category header
    y = ensureSpace(doc, y, rowH + rowH * cat.questions.length);
    doc.setFillColor(240, 240, 240);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, rowH, "FD");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text(cat.title, MARGIN_LEFT + 0.08, y + 0.17);
    y += rowH;

    // Questions
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    for (const q of cat.questions) {
      y = ensureSpace(doc, y, rowH);
      doc.rect(MARGIN_LEFT, y, qColW, rowH);
      doc.text(q, MARGIN_LEFT + 0.08, y + 0.17);
      for (let i = 0; i < 5; i++) {
        const cx = MARGIN_LEFT + qColW + optColW * i;
        doc.rect(cx, y, optColW, rowH);
      }
      y += rowH;
    }
  }

  y += 0.2;

  // Open questions
  y = ensureSpace(doc, y, 0.5);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Preguntas abiertas", MARGIN_LEFT, y);
  y += 0.2;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  for (const q of ENCUESTA_OPEN_QUESTIONS) {
    y = ensureSpace(doc, y, 0.5);
    doc.text(q, MARGIN_LEFT, y);
    y += 0.2;
    // Two blank lines for pen-fill
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN_LEFT, y, MARGIN_LEFT + CONTENT_WIDTH, y);
    y += 0.2;
    doc.line(MARGIN_LEFT, y, MARGIN_LEFT + CONTENT_WIDTH, y);
    doc.setDrawColor(0, 0, 0);
    y += 0.25;
  }

  // Causa de baja
  y = ensureSpace(doc, y, 1.5);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Causa principal de baja:", MARGIN_LEFT, y);
  y += 0.25;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  const causaColW = CONTENT_WIDTH / 2;
  for (let i = 0; i < ENCUESTA_CAUSA_OPTIONS.length; i++) {
    const col = i % 2;
    if (col === 0) y = ensureSpace(doc, y, 0.22);
    const cx = MARGIN_LEFT + col * causaColW;
    // Checkbox
    doc.rect(cx, y - 0.1, 0.12, 0.12);
    doc.text(ENCUESTA_CAUSA_OPTIONS[i], cx + 0.18, y);
    if (col === 1 || i === ENCUESTA_CAUSA_OPTIONS.length - 1) y += 0.22;
  }

  y += 0.3;

  // Signature line
  y = ensureSpace(doc, y, 0.6);
  y = drawSignatureBlock(doc, MARGIN_LEFT + CONTENT_WIDTH / 4, y, CONTENT_WIDTH / 2, "", trabajador, { bold: true });

  // ── Footers ────────────────────────────────────────────────────
  drawFooters(doc, draft.docRef ?? "");

  return doc.output("blob");
}
