export type Turno = 'Lunes-Jueves' | 'Lunes-Viernes' | 'Viernes-Domingo' | 'Viernes-Lunes';

export interface Employee {
  id: string;
  nombre: string;
  sueldoBase: number;
  descuentoPorDia: number;
  kpiMonto: number;
  turno: Turno;
  _uuid?: string; // Supabase internal UUID
}

export interface PayrollConfig {
  empleadoId: string;
  diasFaltados: number;
  kpiAplicado: boolean;
  diasExtra: number;
  primaDominical: boolean;
  diaFestivo: boolean;
  bonosAdicionales: number;
}

export interface PayrollResult {
  sueldoQuincenal: number;
  sueldoDiario: number;
  descuentoFaltas: number;
  montoKpi: number;
  montoDiasExtra: number;
  montoPrimaDominical: number;
  montoDiaFestivo: number;
  bonosAdicionales: number;
  totalExtras: number;
  totalRetenciones: number;
  netoAPagar: number;
}

export interface PayrollRecord {
  id: string;
  periodo: string;
  fechaCierre: string;
  empleadoId: string;
  empleadoNombre: string;
  config: PayrollConfig;
  result: PayrollResult;
  sueldoBase: number;
}

export function calcularNomina(emp: Employee, config: PayrollConfig): PayrollResult {
  const sueldoQuincenal = emp.sueldoBase / 2;
  const sueldoDiario = emp.sueldoBase / 30;
  const descuentoFaltas = config.diasFaltados * emp.descuentoPorDia;
  const montoKpi = config.kpiAplicado ? emp.kpiMonto : 0;
  const montoDiasExtra = config.diasExtra * 1000;
  const montoPrimaDominical = config.primaDominical ? sueldoDiario * 0.25 : 0;
  const montoDiaFestivo = config.diaFestivo ? sueldoDiario * 3 : 0;
  const bonosAdicionales = config.bonosAdicionales;

  const totalExtras = montoKpi + montoDiasExtra + montoPrimaDominical + montoDiaFestivo + bonosAdicionales;
  const totalRetenciones = descuentoFaltas;
  const netoAPagar = sueldoQuincenal - totalRetenciones + totalExtras;

  return {
    sueldoQuincenal,
    sueldoDiario,
    descuentoFaltas,
    montoKpi,
    montoDiasExtra,
    montoPrimaDominical,
    montoDiaFestivo,
    bonosAdicionales,
    totalExtras,
    totalRetenciones,
    netoAPagar,
  };
}
