/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PuntoCalibracion } from '../types';

export interface MagnitudeDefinition {
  id: string;
  nombre: string;
  unidades: string[];
  defaultUnit: string;
  defaultMin: number;
  defaultMax: number;
  defaultEmp: string;
  patronSugerido: string;
}

export const MAGNITUDES_SENSOR: MagnitudeDefinition[] = [
  {
    id: 'presion',
    nombre: 'Presión',
    unidades: ['PSI', 'Bar', 'kPa', 'MPa', 'mbar', 'mmHg', 'inH2O', 'kg/cm²'],
    defaultUnit: 'PSI',
    defaultMin: 0,
    defaultMax: 300,
    defaultEmp: '± 0.5% FS',
    patronSugerido: 'Calibrador de Presión / Balanza de Pesos Muertos'
  },
  {
    id: 'temperatura',
    nombre: 'Temperatura',
    unidades: ['°C', '°F', 'K'],
    defaultUnit: '°C',
    defaultMin: 0,
    defaultMax: 150,
    defaultEmp: '± 0.5 °C',
    patronSugerido: 'Bloque Seco / Termómetro Patrón RTD Pt100'
  },
  {
    id: 'caudal',
    nombre: 'Caudal / Flujo',
    unidades: ['m³/h', 'L/min', 'GPM', 'L/h', 'kg/h'],
    defaultUnit: 'm³/h',
    defaultMin: 0,
    defaultMax: 100,
    defaultEmp: '± 1.0% FS',
    patronSugerido: 'Caudalímetro Ultrasónico Patrón / Banco Volumétrico'
  },
  {
    id: 'nivel',
    nombre: 'Nivel',
    unidades: ['%', 'm', 'cm', 'mm', 'L', 'm³'],
    defaultUnit: '%',
    defaultMin: 0,
    defaultMax: 100,
    defaultEmp: '± 1.0% FS',
    patronSugerido: 'Simulador de Lazo / Cinta Métrica Patrón'
  },
  {
    id: 'masa',
    nombre: 'Masa / Balanza',
    unidades: ['kg', 'g', 'mg', 't', 'lb'],
    defaultUnit: 'kg',
    defaultMin: 0,
    defaultMax: 500,
    defaultEmp: '± 0.1% FS',
    patronSugerido: 'Juego de Pesas Patrón Clase F1 / M1'
  },
  {
    id: 'electrica',
    nombre: 'Señal Eléctrica / Lazos',
    unidades: ['mA', 'V', 'mV', 'Ω', 'Hz'],
    defaultUnit: 'mA',
    defaultMin: 4,
    defaultMax: 20,
    defaultEmp: '± 0.25% FS',
    patronSugerido: 'Calibrador de Procesos Multifunción Fluke 754'
  },
  {
    id: 'humedad',
    nombre: 'Humedad Relativa',
    unidades: ['%HR'],
    defaultUnit: '%HR',
    defaultMin: 10,
    defaultMax: 90,
    defaultEmp: '± 2.0 %HR',
    patronSugerido: 'Termohigrómetro Patrón Certificado'
  },
  {
    id: 'ph_conductividad',
    nombre: 'pH / Conductividad',
    unidades: ['pH', 'µS/cm', 'mS/cm', 'ppm'],
    defaultUnit: 'pH',
    defaultMin: 0,
    defaultMax: 14,
    defaultEmp: '± 0.05 pH',
    patronSugerido: 'Soluciones Buffer Trazables NIST (pH 4 / 7 / 10)'
  },
  {
    id: 'velocidad',
    nombre: 'Velocidad / RPM',
    unidades: ['RPM', 'm/s', 'Hz'],
    defaultUnit: 'RPM',
    defaultMin: 0,
    defaultMax: 3600,
    defaultEmp: '± 0.5% FS',
    patronSugerido: 'Tacómetro Óptico Patrón'
  },
  {
    id: 'vacio',
    nombre: 'Vacío',
    unidades: ['inHg', 'mbar', 'Torr', 'Pa', 'micrones'],
    defaultUnit: 'inHg',
    defaultMin: -30,
    defaultMax: 0,
    defaultEmp: '± 1.0% FS',
    patronSugerido: 'Vacuómetro Digital Patrón'
  },
  {
    id: 'fuerza_torque',
    nombre: 'Fuerza / Torque',
    unidades: ['N·m', 'N', 'kN', 'lbf·ft', 'kgf'],
    defaultUnit: 'N·m',
    defaultMin: 0,
    defaultMax: 200,
    defaultEmp: '± 1.0% FS',
    patronSugerido: 'Transductor Patrón de Torque / Celda de Carga'
  },
  {
    id: 'personalizada',
    nombre: 'Otra / Personalizada',
    unidades: ['%', 'u.i.'],
    defaultUnit: '%',
    defaultMin: 0,
    defaultMax: 100,
    defaultEmp: '± 0.5% FS',
    patronSugerido: 'Patrón Metrológico Certificado'
  }
];

export const TEST_POINT_PRESETS: Array<{ count: number; label: string; incluirBajada: boolean }> = [
  { count: 3, label: '3 Puntos (0% - 50% - 100%)', incluirBajada: false },
  { count: 5, label: '5 Puntos Estándar (0% - 25% - 50% - 75% - 100%)', incluirBajada: false },
  { count: 6, label: '6 Puntos (cada 20%)', incluirBajada: false },
  { count: 9, label: '9 Puntos Subida y Bajada (Histéresis)', incluirBajada: true },
  { count: 11, label: '11 Puntos (cada 10%)', incluirBajada: false }
];

export function findMagnitudeByName(name?: string): MagnitudeDefinition | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return MAGNITUDES_SENSOR.find(
    m => m.id === n || m.nombre.toLowerCase() === n || m.nombre.toLowerCase().includes(n)
  );
}

export function inferMagnitudeFromVariable(variable?: string, unitHint?: string): MagnitudeDefinition {
  const v = `${variable || ''} ${unitHint || ''}`.toLowerCase();
  if (v.includes('vacío') || v.includes('vacio') || v.includes('inhg') || v.includes('torr') || v.includes('micron')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'vacio')!;
  }
  if (v.includes('presi') || v.includes('psi') || v.includes('bar') || v.includes('kpa') || v.includes('mpa') || v.includes('manóm')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'presion')!;
  }
  if (v.includes('temp') || v.includes('°c') || v.includes('°f') || v.includes('rtd') || v.includes('termop') || v.includes('pt100')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'temperatura')!;
  }
  if (v.includes('caud') || v.includes('fluj') || v.includes('gpm') || v.includes('m³/h') || v.includes('l/min')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'caudal')!;
  }
  if (v.includes('nivel')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'nivel')!;
  }
  if (v.includes('masa') || v.includes('balanz') || v.includes('peso') || v.includes('báscul') || v.includes('kg')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'masa')!;
  }
  if (v.includes('4-20') || v.includes('ma') || v.includes('volt') || v.includes('eléctr') || v.includes('electr') || v.includes('lazo') || v.includes('corr')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'electrica')!;
  }
  if (v.includes('humed') || v.includes('%hr') || v.includes('hr')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'humedad')!;
  }
  if (v.includes('ph') || v.includes('conduct') || v.includes('ppm') || v.includes('µs')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'ph_conductividad')!;
  }
  if (v.includes('rpm') || v.includes('veloc')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'velocidad')!;
  }
  if (v.includes('torq') || v.includes('fuerz') || v.includes('n·m')) {
    return MAGNITUDES_SENSOR.find(m => m.id === 'fuerza_torque')!;
  }
  return MAGNITUDES_SENSOR[0];
}

export function formatMetrologyNum(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded) < 1e-9) return '0';
  return Number.isInteger(rounded) ? String(rounded) : String(Number(rounded.toFixed(2)));
}

export function formatRangoOperacion(min: number, max: number, unit: string): string {
  const minStr = formatMetrologyNum(min);
  const maxStr = formatMetrologyNum(max);
  const cleanUnit = unit.trim();
  if (!cleanUnit) return `${minStr} a ${maxStr}`;
  if (cleanUnit === '%') return `${minStr} a ${maxStr}%`;
  return `${minStr} a ${maxStr} ${cleanUnit}`;
}

export function parseRangoMedicion(
  rangoStr?: string,
  variableHint?: string,
  explicitUnit?: string
): { min: number; max: number; unit: string } {
  const mag = inferMagnitudeFromVariable(variableHint, rangoStr);
  const clean = (rangoStr || '').trim();

  // Match patterns like "0 a 300 PSI", "-50 a 150 °C", "4 - 20 mA", "-30 to 0 inHg", "0 a 100%"
  const match = clean.match(
    /^\s*(-?\d+(?:[.,]\d+)?)\s*(?:a|al|to|hasta|-|–|—)\s*(-?\d+(?:[.,]\d+)?)\s*(.*)$/i
  );

  if (match) {
    const min = Number(match[1].replace(',', '.'));
    const max = Number(match[2].replace(',', '.'));
    const rawUnit = match[3].trim();
    const unit = explicitUnit || rawUnit || mag.defaultUnit;
    if (Number.isFinite(min) && Number.isFinite(max) && max !== min) {
      return { min, max, unit };
    }
  }

  return {
    min: mag.defaultMin,
    max: mag.defaultMax,
    unit: explicitUnit || mag.defaultUnit
  };
}

export function parseNumericInput(val: string | number | undefined | null): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (!val) return null;
  const cleaned = String(val).trim().replace(',', '.');
  const match = cleaned.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface EmpLimitInfo {
  kind: 'percent_fs' | 'absolute';
  rawValue: number;
  absLimit: number;
  pctLimit: number;
  label: string;
}

export function parseEmpLimit(
  empStr: string | undefined,
  min: number,
  max: number
): EmpLimitInfo {
  const span = Math.abs(max - min) || 100;
  const raw = (empStr || '± 0.5% FS').trim();
  const numMatch = raw.match(/\d+(?:[.,]\d+)?/);
  const val = numMatch ? Number(numMatch[0].replace(',', '.')) : 0.5;
  const safeVal = Number.isFinite(val) && val > 0 ? val : 0.5;

  const isPercent = raw.includes('%') && !raw.toLowerCase().includes('%hr');
  if (isPercent) {
    const absLimit = (span * safeVal) / 100;
    return {
      kind: 'percent_fs',
      rawValue: safeVal,
      absLimit,
      pctLimit: safeVal,
      label: `± ${formatMetrologyNum(safeVal)}% FS (± ${formatMetrologyNum(absLimit)})`
    };
  }

  const pctLimit = (safeVal / span) * 100;
  return {
    kind: 'absolute',
    rawValue: safeVal,
    absLimit: safeVal,
    pctLimit,
    label: raw
  };
}

export function generarPuntosCalibracion(params: {
  min: number;
  max: number;
  unit: string;
  numPuntos?: number;
  incluirBajada?: boolean;
  emptyReadings?: boolean;
}): PuntoCalibracion[] {
  const min = Number.isFinite(params.min) ? params.min : 0;
  const max = Number.isFinite(params.max) && params.max !== min ? params.max : min + 100;
  const unit = (params.unit || '').trim();
  const count = Math.max(2, Math.min(21, Math.round(params.numPuntos || 5)));
  const emptyReadings = Boolean(params.emptyReadings);

  const ascFractions: number[] = [];
  for (let i = 0; i < count; i++) {
    ascFractions.push(i / (count - 1));
  }

  const makePoint = (frac: number, dirLabel?: 'Subida' | 'Bajada'): PuntoCalibracion => {
    const pct = Math.round(frac * 100);
    const val = min + (max - min) * frac;
    const roundedVal = Math.round(val * 1000) / 1000;
    const valStr = formatMetrologyNum(roundedVal);
    const unitSuffix = unit ? (unit === '%' ? '%' : ` ${unit}`) : '';
    const suffixDir = dirLabel === 'Bajada' ? ' ↓' : dirLabel === 'Subida' ? ' ↑' : '';
    return {
      punto_nominal: `${pct}% (${valStr}${unitSuffix})${suffixDir}`,
      valor_nominal: roundedVal,
      lectura_patron: emptyReadings ? '' : valStr,
      lectura_instrumento: '',
      error_calculado: emptyReadings ? '' : '0.00%',
      desvio: 0,
      unidad: unit,
      conforme: true
    };
  };

  if (params.incluirBajada) {
    const up = ascFractions.map(f => makePoint(f, 'Subida'));
    const down = [...ascFractions]
      .slice(0, -1)
      .reverse()
      .map(f => makePoint(f, 'Bajada'));
    return [...up, ...down];
  }

  return ascFractions.map(f => makePoint(f));
}

export function resolveNominalNumeric(punto: PuntoCalibracion): number | null {
  if (typeof punto.valor_nominal === 'number' && Number.isFinite(punto.valor_nominal)) {
    return punto.valor_nominal;
  }
  const parenMatch = punto.punto_nominal.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = parseNumericInput(parenMatch[1]);
    if (inside !== null) return inside;
  }
  const pat = parseNumericInput(punto.lectura_patron);
  if (pat !== null) return pat;
  return parseNumericInput(punto.punto_nominal);
}

export function recalcularPuntoCalibracion(
  punto: PuntoCalibracion,
  min: number,
  max: number,
  empStr?: string,
  fallbackUnit?: string
): PuntoCalibracion {
  const patVal = parseNumericInput(punto.lectura_patron);
  const instVal = parseNumericInput(punto.lectura_instrumento);
  const unit = punto.unidad || fallbackUnit || '';

  if (patVal === null || instVal === null) {
    return {
      ...punto,
      unidad: unit,
      desvio: undefined,
      error_calculado: punto.lectura_instrumento.trim() === '' ? '' : punto.error_calculado,
      conforme: true
    };
  }

  const desvio = Number((instVal - patVal).toFixed(4));
  const span = Math.abs(max - min) || Math.max(Math.abs(patVal), 1);
  const errPct = (desvio / span) * 100;
  const emp = parseEmpLimit(empStr, min, max);

  const conforme =
    emp.kind === 'absolute'
      ? Math.abs(desvio) <= emp.absLimit + 1e-9
      : Math.abs(errPct) <= emp.pctLimit + 1e-9;

  const signPct = errPct >= 0 ? '+' : '';
  const signAbs = desvio >= 0 ? '+' : '';
  const errorLabel =
    emp.kind === 'absolute'
      ? `${signAbs}${desvio.toFixed(2)}${unit ? ` ${unit}` : ''}`
      : `${signPct}${errPct.toFixed(2)}%`;

  return {
    ...punto,
    unidad: unit,
    desvio,
    error_calculado: errorLabel,
    conforme
  };
}

export interface ResumenDesvio {
  measuredCount: number;
  totalPoints: number;
  conformesCount: number;
  allConforme: boolean;
  maxAbsDesvio: number;
  maxSignedDesvio: number;
  maxAbsPct: number;
  maxSignedPct: number;
  errorMaxLabel: string;
  suggestedDictamen: 'Conforme' | 'No Conforme';
  empInfo: EmpLimitInfo;
}

export function calcularResumenDesvio(
  puntos: PuntoCalibracion[],
  min: number,
  max: number,
  empStr?: string,
  unit?: string
): ResumenDesvio {
  const empInfo = parseEmpLimit(empStr, min, max);
  const span = Math.abs(max - min) || 100;

  let measuredCount = 0;
  let conformesCount = 0;
  let maxAbsDesvio = 0;
  let maxSignedDesvio = 0;
  let maxAbsPct = 0;
  let maxSignedPct = 0;

  for (const p of puntos) {
    const pat = parseNumericInput(p.lectura_patron);
    const inst = parseNumericInput(p.lectura_instrumento);
    if (pat !== null && inst !== null) {
      measuredCount++;
      const dev = Number((inst - pat).toFixed(4));
      const pct = (dev / span) * 100;
      const isOk =
        empInfo.kind === 'absolute'
          ? Math.abs(dev) <= empInfo.absLimit + 1e-9
          : Math.abs(pct) <= empInfo.pctLimit + 1e-9;
      if (isOk) conformesCount++;
      if (Math.abs(dev) >= maxAbsDesvio) {
        maxAbsDesvio = Math.abs(dev);
        maxSignedDesvio = dev;
      }
      if (Math.abs(pct) >= maxAbsPct) {
        maxAbsPct = Math.abs(pct);
        maxSignedPct = pct;
      }
    }
  }

  const allConforme = measuredCount > 0 ? conformesCount === measuredCount : true;
  const signAbs = maxSignedDesvio >= 0 ? '+' : '';
  const signPct = maxSignedPct >= 0 ? '+' : '';
  const cleanUnit = unit ? ` ${unit}` : '';
  const errorMaxLabel =
    measuredCount === 0
      ? 'Pendiente'
      : empInfo.kind === 'absolute'
      ? `${signAbs}${maxSignedDesvio.toFixed(2)}${cleanUnit}`
      : `${signPct}${maxSignedPct.toFixed(2)}% FS`;

  return {
    measuredCount,
    totalPoints: puntos.length,
    conformesCount,
    allConforme,
    maxAbsDesvio,
    maxSignedDesvio,
    maxAbsPct,
    maxSignedPct,
    errorMaxLabel,
    suggestedDictamen: allConforme ? 'Conforme' : 'No Conforme',
    empInfo
  };
}

export function extractPuntosForChart(
  puntos: PuntoCalibracion[],
  min: number,
  max: number,
  empStr?: string
): Array<{
  index: number;
  label: string;
  shortLabel: string;
  nominal: number | null;
  patron: number | null;
  instrumento: number | null;
  desvio: number | null;
  errPct: number | null;
  conforme: boolean;
}> {
  const empInfo = parseEmpLimit(empStr, min, max);
  const span = Math.abs(max - min) || 100;

  return puntos.map((p, idx) => {
    const nominal = resolveNominalNumeric(p);
    const patron = parseNumericInput(p.lectura_patron);
    const instrumento = parseNumericInput(p.lectura_instrumento);
    const desvio =
      patron !== null && instrumento !== null
        ? Number((instrumento - patron).toFixed(4))
        : typeof p.desvio === 'number'
        ? p.desvio
        : null;
    const errPct = desvio !== null ? Number(((desvio / span) * 100).toFixed(3)) : null;

    let conforme = p.conforme;
    if (desvio !== null && errPct !== null) {
      conforme =
        empInfo.kind === 'absolute'
          ? Math.abs(desvio) <= empInfo.absLimit + 1e-9
          : Math.abs(errPct) <= empInfo.pctLimit + 1e-9;
    }

    const shortMatch = p.punto_nominal.match(/^(\d+%)/);
    const isDown = p.punto_nominal.includes('↓') || p.punto_nominal.toLowerCase().includes('bajada');
    const shortLabel =
      nominal !== null
        ? `${formatMetrologyNum(nominal)}${isDown ? '↓' : ''}`
        : shortMatch
        ? `${shortMatch[1]}${isDown ? '↓' : ''}`
        : `P${idx + 1}`;

    return {
      index: idx,
      label: p.punto_nominal,
      shortLabel,
      nominal,
      patron,
      instrumento,
      desvio,
      errPct,
      conforme
    };
  });
}
