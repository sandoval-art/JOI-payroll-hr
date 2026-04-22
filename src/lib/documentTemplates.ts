// Legal boilerplate for carta compromiso + acta administrativa PDF generation.
// Text sourced from docs/document-templates.md (legal-vetted by JOI).
// Placeholders use {field} notation — replaced at render time.

// ── Carta Compromiso ────────────────────────────────────────────────

export const CARTA_OPENING =
  "Por medio de la presente, yo {trabajador_name}, en mi carácter de {puesto}, manifiesto mi compromiso formal de mejorar mi desempeño laboral y acatar los reglamentos de la empresa {company_name} ubicada en {company_address}, atendiendo a los señalamientos realizados.";

export const CARTA_SECOND_PARAGRAPH =
  "Con base en los reportes y evaluaciones emitidos, mismos que se me comunican de manera directa y oportuna. De manera específico, señalando lo siguiente:";

export const CARTA_ACKNOWLEDGMENT =
  "Reconozco y acepto que dichos reportes reflejan áreas de oportunidad relacionadas con mi conducta, desempeño, cumplimiento de funciones y/o apego a los procedimientos internos establecidos por la empresa. En consecuencia, me comprometo de manera expresa a:";

export const CARTA_COMMITMENTS: { bold: string; rest: string }[] = [
  { bold: "Atender y corregir", rest: " las conductas y áreas de mejora señaladas." },
  { bold: "Cumplir puntualmente", rest: " con mis obligaciones laborales y con los lineamientos internos." },
  { bold: "Mantener una actitud profesional", rest: ", respetuosa y colaborativa con mis superiores, compañeros y personal a mi cargo." },
  { bold: "Adoptar las medidas necesarias", rest: " para asegurar que no se reiteren las situaciones que dieron origen a los reportes evaluados." },
];

export const CARTA_EVAL_PERIOD =
  "30 días naturales contados a partir de la firma de la carta compromiso.";

export const CARTA_EVIDENCE =
  "Reportes diarios de producción, informe JOI SLOC Origination, Notas CRM, seguimiento de supervisión y evaluación semanal";

export const CARTA_CLOSING_1 =
  "Asimismo, se me hace saber que la empresa dará seguimiento a mi desempeño conforme a lo establecido en la Ley Federal del Trabajo, y que, de persistir las conductas u omisiones señaladas, la organización podrá aplicar las medidas disciplinarias correspondientes, conforme a la normativa laboral aplicable y a las políticas internas vigentes.";

export const CARTA_CLOSING_2 =
  "Declaro haber leído y entendido el contenido de este documento, y firmo de conformidad para los efectos legales a que haya lugar";

export const CARTA_CLOSING_3_TEMPLATE =
  "Por lo anterior se levanta la presente Carta Compromiso de Mejora Laboral, informándole que la empresa se reserva el derecho de aplicar las sanciones disciplinarias que procedan de conformidad con el Reglamento Interior de Trabajo y la Ley Federal del Trabajo. Asimismo, se le notifica al(a) C. {trabajador_name_lower}, que la presente se integrará a su expediente personal para los efectos conducentes.";

export const CARTA_CLOSING_4_TEMPLATE =
  "Se entrega la presente constancia de hechos, en {company_address}.";

// ── Acta Administrativa ─────────────────────────────────────────────

export const ACTA_OPENING_TEMPLATE =
  "Por medio de la presente, se hace constar que, siendo las {time} horas del día {incident_date_long}, en el domicilio ubicado en Calle Compostela número 1958, Colonia Chapultepec Country, Guadalajara, Jalisco, dentro de las instalaciones de OUTSOURCE CONSULTING GROUP S.A.S. (en adelante, \"LA EMPRESA\"), se procede a levantar la presente acta administrativa al empleado {trabajador_name}. Se encuentran presentes como testigos de asistencia los CC. {witness_1} y {witness_2}, ambos compañeros de trabajo del empleado, así como {supervisor_name}, en su carácter de jefe directo. En este acto, se hace del conocimiento del empleado {trabajador_name} que el motivo de la presente reunión es hacer constar los hechos que se le atribuyen, ocurridos: {incident_day_short}, durante su jornada de trabajo, consistentes en {reason} Para efectos de la presente acta, se tiene a la vista y se incorpora como parte integrante de la misma la constancia de hechos correspondiente, elaborada con base en los reportes recibidos y en las comunicaciones internas de la empresa, misma que se describe a continuación:";

export const ACTA_LEGAL_BOILERPLATE_TEMPLATE =
  "Por lo anterior, el trabajador incurre en el supuesto normativo previsto en el Reglamento Interior de Trabajo, actualizándose además la hipótesis legal contemplada en el LFT artículo 134, fracción I, \"Cumplir las disposiciones de las normas de trabajo que les sean aplicables\"; artículo 134, fracción III, \"Desempeñar el servicio bajo la dirección del patrón o de su representante, a cuya autoridad estarán subordinados en todo lo concerniente al trabajo\"; Reglamento Interior de Trabajo, artículo 18, \"deberá notificarlo a LA EMPRESA con antelación o, a más tardar, dentro de los primeros 15 (quince) minutos posteriores al inicio de su jornada laboral\"; artículo 20, \"el personal deberá reportarse a su jefe inmediato, sin perjuicio de la obligación de justificar sus faltas\"; artículo 21, \"Las faltas de asistencia solo podrán ser justificadas por personal del Instituto Mexicano del Seguro Social\"; artículo 22, \"Cualquier falta que no cuente con justificante médico expedido por el Instituto Mexicano del Seguro Social, que demuestre la absoluta imposibilidad de haberse comunicado o asistido a su trabajo, legalmente se considerará como falta de asistencia injustificada\"; artículo 61, \"Las inasistencias injustificadas generan consecuencias conforme a la LFT\"; artículo 133, fracción IV, \"Acta administrativa\"; artículo 134, fracción III, \"Determinación por escrito circunstanciada de los hechos\"; cláusula primera del contrato individual de trabajo, \"cumplir con las instrucciones de 'LA EMPRESA', su supervisor(a) inmediato(a)\" y \"cualquier otra obligación prevista en el presente contrato, el Reglamento\"; cláusula tercera del contrato individual de trabajo, \"de manera puntual, para el desarrollo del presente proyecto\"; cláusula cuarta del contrato individual de trabajo, \"Todos los empleados tienen la obligación de realizar un registro oficial, en los siguientes momentos de su jornada laboral: · A la hora de su ingreso a labores\" En virtud de lo anterior, se considera que el trabajador ha cometido una FALTA (GRAVE), realizando conductas contrarias a las políticas y normas de la Empresa. Por lo tanto, en este acto el representante legal de OUTSOURCE CONSULTING GROUP SAS, hace del conocimiento del trabajador los hechos que se le atribuyen. Hechos de los cuales \"LA EMPRESA\" tuvo conocimiento el día {incident_day_short}, por personal de la empresa, contando con evidencias de estos, como son registros documentales, testimoniales, así como medios electrónicos y digitales, en términos de lo dispuesto por el artículo 776 de la Ley Federal del Trabajo.";

export const ACTA_AUDIENCIA_TEMPLATE =
  "Por lo anterior se levanta esta Acta Administrativa, solicitando al trabajador(a) {trabajador_name}, se sirva suscribirla y dándole el derecho de audiencia y de manifestar lo que a sus intereses convenga, solicitando al empleado describa con su puño y letra porque motivo incurrió en dicha falta:";

export const ACTA_CLOSING_1 =
  "Por lo anterior se levanta esta Acta Administrativa, informándole que derivado de lo anterior la Empresa se reserva a proceder de conformidad las sanciones disciplinarias establecidas en la Ley y el Reglamento Interior de Trabajo de la Empresa.";

export const ACTA_CLOSING_2_TEMPLATE =
  "Asimismo, se le notifica al empleado(a): {trabajador_name}, que la presente amonestación se integrará a su expediente personal para los efectos conducentes.";

export const ACTA_CLOSING_3_TEMPLATE =
  "Se entrega la presente Acta Administrativa en la calle {company_address}";

export const ACTA_CLOSING_4_TEMPLATE =
  "Se cierra la presente Acta Administrativa siendo las _____:_____ horas del día {incident_date_short}, suscribiéndola quienes participaron en ella.";

// ── Template rendering helper ───────────────────────────────────────

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
