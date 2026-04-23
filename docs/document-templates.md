# Carta Compromiso & Acta Administrativa — PDF Template Spec

**Source:** `docs/reference/carta-compromiso-template.pdf` + `docs/reference/acta-administrativa-template.pdf` (legal-vetted by JOI, received 2026-04-22).
**Purpose:** Structured spec for PDF generation in Feature B2/B3 Phase 5a. CT translates this to jspdf calls; the reference PDFs are the visual truth.

## Conventions used below

Placeholders in `{curly.braces}` are populated from the finalization row. `{{hardcoded legal text}}` is generic boilerplate that doesn't change per document. Everything else is literal.

Fields on finalization rows:
- `doc_ref` — e.g. `CC20260421-1124` (carta) or `20260421-1126` (acta)
- `trabajador_name_snapshot` — UPPERCASE legal name
- `puesto_snapshot` — department / job title
- `horario_snapshot` — free-text schedule (shift + breaks)
- `supervisor_name_snapshot` — TL display name (work_name ?? full_name)
- `company_legal_name_snapshot` — "OUTSOURCE CONSULTING GROUP SAS"
- `company_legal_address_snapshot` — "Compostela 1958, Chapultepec Country, 44260 Guadalajara, Jal."
- `incident_date_long_snapshot` — e.g. "domingo, 12 de abril de 2026"
- `narrative` — HR-written formal version of the incident
- `reason` (on request) — short incident label, e.g. "Bajo desempeño / baja producción reiterada"
- `kpi_table` — carta only, array of `{area, indicador, meta}`
- `witnesses` — acta only, array of `{name, role}`
- `reincidencia_prior_carta_id` — acta only, FK to prior signed carta

## Page settings (both types)

- Letter size (8.5 × 11 in) — matches existing reference PDF dimensions
- Margins: ~1 inch top/bottom, ~0.75 inch left/right
- Font: Helvetica (jspdf default) — carta/acta use standard sans-serif in the reference
- Base font size: 10pt body, 11pt section headers, 9pt headers/footers
- Line height: 1.2x

---

# Carta Compromiso

**doc_ref format:** `CC{YYYYMMDD}-{HHMM}` (e.g. `CC20260421-1124`)

## Header (every page, right-aligned)

```
{doc_ref}                                                          [bold]
```

## Title block (page 1 only, centered)

```
OUTSOURCE CONSULTING GROUP SAS                                     [bold, centered]
CARTA COMPROMISO DE MEJORA DE DESEMPEÑO LABORAL                    [bold, centered]
```

## Date (right-aligned, below title)

```
{incident_date_long_snapshot}                                      [bold italic]
```

## Metadata table (3 rows, 2 cols; label col ~1.5in bold, value col fills rest)

```
| TRABAJADOR | {trabajador_name_snapshot}                          |
| HORARIO    | {horario_snapshot}                                  |
| PUESTO     | {puesto_snapshot}                                   |
```

Label cells use a light-gray background. Values are plain black text. Borders are thin.

## Opening paragraph

```
Por medio de la presente, yo {trabajador_name_snapshot}, en mi carácter de {puesto_snapshot}, manifiesto mi compromiso formal de mejorar mi desempeño laboral y acatar los reglamentos de la empresa {company_legal_name_snapshot} ubicada en {company_legal_address_snapshot}, atendiendo a los señalamientos realizados.
```

(Note: `{trabajador_name_snapshot}` and `{puesto_snapshot}` are rendered in bold underline within the paragraph.)

## Second paragraph

```
{{Con base en los reportes y evaluaciones emitidos, mismos que se me comunican de manera directa y oportuna. De manera específica, señalando lo siguiente:}}
```

## Incident heading (bold italic)

```
{reason}                                                           [bold italic]
```

(Uses the `reason` field from the request. If empty, render a generic fallback like "Situación reportada".)

## Narrative block (italic, justified, indented 0.25in on both sides)

```
"{narrative}"
```

Italic. Wrapped in curly quotes `"..."`. Justified alignment. Underlined (matches reference PDF, which underlines the narrative paragraph).

## Acknowledgment paragraph

```
{{Reconozco y acepto que dichos reportes reflejan áreas de oportunidad relacionadas con mi conducta, desempeño, cumplimiento de funciones y/o apego a los procedimientos internos establecidos por la empresa. En consecuencia, me comprometo de manera expresa a:}}
```

(`áreas de oportunidad` is bold.)

## Numbered commitments list (hardcoded, 4 items)

```
1. **Atender y corregir** las conductas y áreas de mejora señaladas.
2. **Cumplir puntualmente** con mis obligaciones laborales y con los lineamientos internos.
3. **Mantener una actitud profesional**, respetuosa y colaborativa con mis superiores, compañeros y personal a mi cargo.
4. **Adoptar las medidas necesarias** para asegurar que no se reiteren las situaciones que dieron origen a los reportes evaluados.
```

(Labels up to the comma are bold.)

## KPI table (for each row in `kpi_table`, render a 3-row mini-table)

```
| ÁREA A MEJORAR | {kpi.area}                                      |
| INDICADOR/KPI  | {kpi.indicador}                                 |
| META           | {kpi.meta}                                      |
```

If `kpi_table` is empty, skip this section entirely (no placeholder table).

If multiple KPI entries exist, stack the mini-tables with a small gap.

## Footer (every page, right-aligned)

```
P á g i n a {currentPage} | {totalPages}                           [9pt]
```

## Page 2 body (continuation)

### Period / Evidence table (2 rows)

```
| PERIODO DE EVALUACIÓN | 30 días naturales contados a partir de la firma de la carta compromiso. |
| EVIDENCIA             | Reportes diarios de producción, informe JOI SLOC Origination, Notas CRM, seguimiento de supervisión y evaluación semanal |
```

Both values are hardcoded legal text for Phase 5a. Future: make editable (followup).

### Closing paragraphs (hardcoded boilerplate)

```
{{Asimismo, se me hace saber que la empresa dará seguimiento a mi desempeño conforme a lo establecido en la **Ley Federal del Trabajo**, y que, de persistir las conductas u omisiones señaladas, la organización podrá aplicar las medidas disciplinarias correspondientes, conforme a la normativa laboral aplicable y a las políticas internas vigentes.}}

{{Declaro haber leído y entendido el contenido de este documento, y firmo de conformidad para los efectos legales a que haya lugar}}

{{Por lo anterior se levanta la presente **Carta Compromiso de Mejora Laboral**, informándole que la empresa se reserva el derecho de aplicar las sanciones disciplinarias que procedan de conformidad con el Reglamento Interior de Trabajo y la Ley Federal del Trabajo. Asimismo, se le notifica al(a) C. {trabajador_name_snapshot_lowercase}, que la presente se integrará a su expediente personal para los efectos conducentes.}}

Se entrega la presente constancia de hechos, en **{company_legal_address_snapshot}**.
```

(`{trabajador_name_snapshot_lowercase}` = `trabajador_name_snapshot.toLowerCase()` — matches reference PDF which lowercases the name in this paragraph specifically.)

### Signature blocks — 2 columns × 2 rows

Row 1:
```
  (empty)                                         ENTERADO                          [right col, bold]
  ____________________________                    ____________________________
  {supervisor_name_snapshot}                      {trabajador_name_snapshot}        [bold]
  SUPERVISOR TEAM LEAD                            TRABAJADOR                        [bold, centered]
```

Row 2:
```
  ____________________________                    ____________________________
  DIRECCIÓN ADMINISTRATIVA                        DIRECCIÓN DE OPERACIONES          [bold, centered]
```

Lines are for physical ink signatures. No names pre-printed on row 2 (admin + ops get filled in manually when signed).

---

# Acta Administrativa

**doc_ref format:** `{YYYYMMDD}-{HHMM}` (no `CC` prefix, e.g. `20260421-1126`)

## Header (every page)

Right-aligned:
```
{doc_ref}                                                          [bold]
```

Centered on page 1:
```
ASUNTO: ACTA ADMINISTRATIVA                                        [bold, underlined]
```

Right-aligned, below header:
```
{incident_date_long_snapshot}                                      [bold, underlined]
```

## Metadata table (3 rows)

```
| TRABAJADOR: | {trabajador_name_snapshot}                         |
| PUESTO:     | {puesto_snapshot}                                  |
| HORARIO:    | {horario_snapshot}                                 |
```

## Opening paragraph (with dynamic witness name interpolation)

```
Por medio de la presente, se hace constar que, siendo las **{HH:MM}** horas del día **{incident_date_long_snapshot}**, en el domicilio ubicado en **Calle Compostela número 1958, Colonia Chapultepec Country, Guadalajara, Jalisco**, dentro de las instalaciones de **OUTSOURCE CONSULTING GROUP S.A.S.** (en adelante, **"LA EMPRESA"**), se procede a levantar la presente **acta administrativa** al empleado **{trabajador_name_snapshot}**. Se encuentran presentes como testigos de asistencia los CC. {witness_1_name_or_blank} y {witness_2_name_or_blank}, ambos compañeros de trabajo del empleado, así como **{supervisor_name_snapshot}**, en su carácter de jefe directo. En este acto, se hace del conocimiento del empleado **{trabajador_name_snapshot}** que el motivo de la presente reunión es hacer constar los hechos que se le atribuyen, ocurridos: **{incident_day_short}**, durante su jornada de trabajo, consistentes en **{reason}** Para efectos de la presente acta, se tiene a la vista y se incorpora como parte integrante de la misma la constancia de hechos correspondiente, elaborada con base en los reportes recibidos y en las comunicaciones internas de la empresa, misma que se describe a continuación:
```

Rules:
- `{HH:MM}` = doc generation time in MX time (derivable from `doc_ref`'s trailing `-HHMM` segment, e.g. `1126` → `11:26`).
- `{incident_day_short}` = short-form Spanish date, e.g. "sabado 18 de abril 2026". Render from incident_date via new helper `formatDateMXShort()` — add it alongside `formatDateMXLong()` in `src/lib/localDate.ts`.
- `{witness_1_name_or_blank}` / `{witness_2_name_or_blank}` — if `witnesses[0].name` exists, render it with a trailing underscore line (`Juan Pérez _______________`). If empty, render a plain blank line: `_______________________________`. Same for witness 2.
- If more than 2 witnesses in the array, list them all (beyond the 2 reference slots) — format: `Juan Pérez, María López y Pedro Ruiz` instead of two blanks.

## Incident heading (bold italic)

```
{reason}                                                           [bold italic]
```

## Narrative block

```
"{narrative}"
```

Italic, justified, indented, underlined. Same styling as carta narrative.

## Reincidencia reference (conditional — only when `reincidencia_prior_carta_id IS NOT NULL`)

```
Antecedente: se cita la carta compromiso previa {prior_carta.doc_ref} emitida el {prior_carta.created_at_formatted}.
```

Render as a separate italic paragraph after the narrative. Fetched via `usePriorSignedCartaForEmployee` or a new `useCartaById(id)` hook — whichever is cleaner.

## Legal boilerplate paragraph (hardcoded — multi-line, dense)

```
{{Por lo anterior, el trabajador incurre en el supuesto normativo previsto en el Reglamento Interior de Trabajo, actualizándose además la hipótesis legal contemplada en el LFT artículo 134, fracción I, "Cumplir las disposiciones de las normas de trabajo que les sean aplicables"; artículo 134, fracción III, "Desempeñar el servicio bajo la dirección del patrón o de su representante, a cuya autoridad estarán subordinados en todo lo concerniente al trabajo"; Reglamento Interior de Trabajo, artículo 18, "deberá notificarlo a LA EMPRESA con antelación o, a más tardar, dentro de los primeros 15 (quince) minutos posteriores al inicio de su jornada laboral"; artículo 20, "el personal deberá reportarse a su jefe inmediato, sin perjuicio de la obligación de justificar sus faltas"; artículo 21, "Las faltas de asistencia solo podrán ser justificadas por personal del Instituto Mexicano del Seguro Social"; artículo 22, "Cualquier falta que no cuente con justificante médico expedido por el Instituto Mexicano del Seguro Social, que demuestre la absoluta imposibilidad de haberse comunicado o asistido a su trabajo, legalmente se considerará como falta de asistencia injustificada"; artículo 61, "Las inasistencias injustificadas generan consecuencias conforme a la LFT"; artículo 133, fracción IV, "Acta administrativa"; artículo 134, fracción III, "Determinación por escrito circunstanciada de los hechos"; cláusula primera del contrato individual de trabajo, "cumplir con las instrucciones de 'LA EMPRESA', su supervisor(a) inmediato(a)" y "cualquier otra obligación prevista en el presente contrato, el Reglamento"; cláusula tercera del contrato individual de trabajo, "de manera puntual, para el desarrollo del presente proyecto"; cláusula cuarta del contrato individual de trabajo, "Todos los empleados tienen la obligación de realizar un registro oficial, en los siguientes momentos de su jornada laboral: · A la hora de su ingreso a labores" En virtud de lo anterior, se considera que el trabajador ha cometido una **FALTA (GRAVE)**, realizando conductas contrarias a las políticas y normas de la Empresa. Por lo tanto, en este acto el representante legal de OUTSOURCE CONSULTING GROUP SAS, hace del conocimiento del trabajador los hechos que se le atribuyen. Hechos de los cuales "LA EMPRESA" tuvo conocimiento el día {incident_day_short}, por personal de la empresa, contando con evidencias de estos, como son registros documentales, testimoniales, así como medios electrónicos y digitales, en términos de lo dispuesto por el artículo 776 de la Ley Federal del Trabajo.}}

{{Por lo anterior se levanta esta Acta Administrativa, solicitando al trabajador(a) {trabajador_name_snapshot}, se sirva suscribirla y dándole el derecho de audiencia y de manifestar lo que a sus intereses convenga, solicitando al empleado describa con su puño y letra porque motivo incurrió en dicha falta:}}
```

## Employee response area (empty ruled-line box, ~12 lines tall)

Just a rectangle with 12 horizontal rule lines for the employee to hand-write their response.

## Closing boilerplate

```
{{Por lo anterior se levanta esta Acta Administrativa, informándole que derivado de lo anterior la Empresa se reserva a proceder de conformidad las sanciones disciplinarias establecidas en la Ley y el Reglamento Interior de Trabajo de la Empresa.}}

{{Asimismo, se le notifica al empleado(a): {trabajador_name_snapshot}, que la presente amonestación se integrará a su expediente personal para los efectos conducentes.}}

{{Se entrega la presente Acta Administrativa en la calle {company_legal_address_snapshot}}}

{{Se cierra la presente Acta Administrativa siendo las _____:_____ horas del día {incident_date_short}, suscribiéndola quienes participaron en ella.}}
```

(`{incident_date_short}` = e.g. "21 de abril de 2026" — short long-form, no weekday prefix.)

## Signature blocks

Row 1 (2 columns):
```
  ATENTAMENTE                                     TRABAJADOR                         [bold, centered]
  ____________________________                    ____________________________
  OUTSOURCE CONSULTING GROUP SAS                  {trabajador_name_snapshot}         [bold, centered]
```

Row 2 (1 column, centered):
```
  JEFE DIRECTO                                                                       [bold, centered]
  ____________________________
  {supervisor_name_snapshot}                                                         [bold, centered]
```

Row 3 (2 columns):
```
  TESTIGO                                         TESTIGO                            [bold, centered]
  ____________________________                    ____________________________
  {witnesses[0].name_or_blank}                    {witnesses[1].name_or_blank}       [bold, centered]
```

If the `witnesses` array has 0 or 1 entries, render the missing slot with a blank line + "TESTIGO" label but no name above.

## Footer (every page)

Page 1 only needs a page number marker; acta typically runs 2-3 pages. `P á g i n a {currentPage} | {totalPages}` right-aligned.

---

# Implementation notes

- **jspdf** is already a dep (`^4.2.1`). Use `jsPDF` class directly — no `html2canvas` dep needed.
- Use `doc.text()`, `doc.rect()`, `doc.line()`, `doc.setFont()`, `doc.setFontSize()`, `doc.internal.pageSize.getWidth()` etc.
- For word-wrapping paragraphs, use `doc.splitTextToSize(text, maxWidth)`.
- For tables, implement a small helper rather than pulling in `jspdf-autotable` (keeps deps lean). Alternatively, add `jspdf-autotable` if the table layout effort turns into a time-sink — it's a small, well-maintained companion lib.
- Legal boilerplate lives in a constants file (new `src/lib/documentTemplates.ts`) so text changes don't require editing the renderer.
- The renderer file lives at `src/lib/pdf/generateCartaPdf.ts` and `src/lib/pdf/generateActaPdf.ts` — one per doc type, each exporting a `generate(draft, request, priorCarta?) => Blob` function.

---

# Resignation Packet (Renuncia + Finiquito + Encuesta de Salida)

Added 2026-04-23. Full plan + LFT calculation formulas live in `docs/resignation-packet-plan.md`; this section is the template visual spec.

**Reference PDF:** `docs/reference/resignation-packet-template.pdf`. Four pages total — renuncia + finiquito + 2-page encuesta.

**doc_ref format:** `RN{YYYYMMDD}-{HHMM}` (generated in MX timezone, same pattern as CC/acta).

## Page 1 — Renuncia (resignation letter)

Employee-authored first-person letter. No explicit header block; content flows naturally.

```
Guadalajara, Jalisco, a {day_of_week_en}, {day_num} de {month_en} de {year}  [right-aligned — the template PDF weirdly mixes English weekday/month; keep as-is until HR says otherwise]

OUTSOURCE CONSULTING GROUP SAS:                                                 [bold]


{{Por este medio quiero presentar mi renuncia voluntaria e irrevocable al puesto de "{puesto_snapshot}" que he venido desempeñando en esta empresa, siendo efectiva a partir del día de hoy {incident_date_long_es_lowercase}. Tomo esta decisión de manera libre y consciente, por motivos personales y porque así conviene a mis intereses.}}

{{Agradezco sinceramente la oportunidad que me dieron de trabajar aquí, el buen trato que recibí durante mi tiempo en la empresa, recibir los pagos de mi salario puntualmente, así como todas las prestaciones de ley que me corresponden.}}

ATENTAMENTE

____________________________                                                    [signature line]
```

Placeholders: `{puesto_snapshot}` (in bold + quotes, uppercase — "TRANSFER AGENT"), `{incident_date_long_es_lowercase}` ("miércoles, 18 de marzo de 2026" — lowercase-leading Spanish long date, bold).

Signature line is blank for the employee to ink-sign. No witness blocks, no supervisor signature on page 1.

## Page 2 — Finiquito

Header (right-aligned on the first block, bold): `FINIQUITO` + date.

Metadata table (label ~1.7in bold, value column fills rest):

```
| Nombre del trabajador: | {trabajador_name_snapshot}                            |
| Fecha de ingreso:      | {hire_date_snapshot}  ("09 de junio de 2025")        |
| Fecha de renuncia:     | {effective_date_long}  ("miércoles, 18 de marzo...") |
| Puesto desempeñado:    | {puesto_snapshot}                                     |
| Horario de Trabajo:    | {horario_snapshot}  (multi-line OK)                   |
| Salario Diario:        | $ {salario_diario_snapshot}  (e.g. $ 600.00)          |
```

Paragraph below:

```
{{Por medio del presente, hago constar que recibo de la empresa **"OUTSOURCE CONSULTING GROUP, S.A.S."**, la cantidad total de **${total_monto} ({total_en_letras})** por concepto de finiquito derivado de mi renuncia voluntaria con fecha al **{effective_date_long}**, cantidad que recibo a mi entera satisfacción, mismo que se desglosa de la siguiente manera:}}
```

Itemized table:

```
| Concepto                    | Monto                                            |
| Aguinaldo proporcional      | $ {aguinaldo_monto}                              |
| Vacaciones correspondientes | $ {vacaciones_monto}                             |
| Prima vacacional (25%)      | $ {prima_vacacional_monto}                       |
| **Total**                   | **$ {total_monto}**                              |
| Importe con letra           | {total_en_letras}                                |
```

Closing boilerplate (hardcoded, ~15 lines of legal liability-release language — extract to constants file per the carta/acta pattern). Ends with:

```
Firma de conformidad:

_________________________________________                [signature line]
CLAVE DE ELECTOR: {clave_elector}
CURP: {curp_snapshot}
RFC: {rfc_snapshot}
```

Plus two small boxes labeled `Huella Digital izquierda` and `Huella digital derecha` in the bottom-right — blank squares for ink fingerprints on paper.

## Pages 3–4 — Encuesta de Salida (blank for paper fill)

Header:

```
ENCUESTA DE SALIDA                                                              [bold, centered]
FECHA: {effective_date_long}
NOMBRE: {trabajador_name_snapshot}
PUESTO: {puesto_snapshot}
```

Intro paragraph (hardcoded). Then a 5-column Likert satisfaction table:

```
|                                              | MUY SATISFECHO | SATISFECHO | NEUTRAL | INSATISFECHO | MUY INSATISFECHO |
| Liderazgo y supervisión                      |                |            |         |              |                  |
|   Trato y apoyo por parte de su jefe ...     | [ ]            | [ ]        | [ ]     | [ ]          | [ ]              |
|   Retroalimentación recibida...              | [ ]            | [ ]        | [ ]     | [ ]          | [ ]              |
|   Claridad de instrucciones...               | [ ]            | [ ]        | [ ]     | [ ]          | [ ]              |
|   Solución oportuna de problemas...          | [ ]            | [ ]        | [ ]     | [ ]          | [ ]              |
| Organización del trabajo                     |                |            |         |              |                  |
|   Carga de trabajo asignada                  | [ ]            | [ ]        | [ ]     | [ ]          | [ ]              |
| ... (full list in reference PDF)             |                |            |         |              |                  |
```

Full category list (all pre-filled text, rows with blank boxes):
- **Liderazgo y supervisión** — 4 questions
- **Organización del trabajo** — 4 questions
- **Desarrollo laboral** — 4 questions
- **Condiciones laborales** — 4 questions
- **Cultura y clima laboral** — 4 questions
- **Comunicación institucional** — 3 questions

Then four open-ended questions (just labels + blank underline for pen-fill):
- ¿Cuál considera que fue la principal razón de su separación de la empresa?
- ¿Qué considera que la empresa podría mejorar?
- ¿Qué fue lo que más le agradó de trabajar con nosotros?
- ¿Desea compartir algún comentario adicional?

Then causa-de-baja checkbox list (two-column):
- Motivos personales ☐        Inconformidad con ambiente laboral ☐
- Mejora salarial ☐           Inconformidad con salario o prestaciones ☐
- Mejor oportunidad laboral ☐ Falta de crecimiento ☐
- Problemas de horario ☐      Cambio de residencia ☐
- Distancia o traslado ☐      Otro: ______________
- Inconformidad con jefe inmediato ☐

Signature line at bottom:

```
_____________________________________________
{trabajador_name_snapshot}
```

**Critical:** all encuesta content is BLANK for paper fill. Do not capture digital responses in Phase F1/F2. Digital survey is a future followup (see `docs/resignation-packet-plan.md`).

## Renderer file

New file `src/lib/pdf/generateRenunciaPacketPdf.ts` exports:
```ts
generateRenunciaPacketPdf(draft: ResignationPacket, request: HrDocumentRequest): Blob
```

All three documents render into a single 4-page PDF. Existing helpers in `src/lib/pdf/pdfHelpers.ts` (paragraph wrapping, metadata tables, signature blocks, pagination) get reused.

Legal boilerplate for page 2 closing + page 1 opening goes into `src/lib/documentTemplates.ts` alongside the carta/acta constants.
