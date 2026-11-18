import { describe, expect, it } from 'vitest';
import {
  addFrequencyStep,
  calcularKpiCalibracionMensual,
  calcularKpiMensual,
  calcularKpisMetrologos,
  calcularKpisTecnicos,
  calcularOcurrenciasEquipo,
  calcularOcurrenciasInstrumento,
  formatFechaDDMMYYYY,
  formatFechaYYYYMMDD,
  generarFolioCAL,
  generarFolioMC,
  generarFolioMP,
  generarFolioOT,
  parseFecha,
  tecnicoPerteneceAEmpresa,
  TODAS_LAS_EMPRESAS,
} from '../maintenanceEngine';
import type {
  Equipo,
  FrecuenciaConfig,
  Instrumento,
  OrdenCalibracion,
  OrdenCorrectivo,
  OrdenTrabajoOT,
  RegistroHistorialMP,
  Tecnico,
} from '../../types';

const FREQUENCIAS: FrecuenciaConfig[] = [
  { nombre_freq: 'Diaria', dias_tolerancia: 1, paso_meses: 0 },
  { nombre_freq: 'Semanal', dias_tolerancia: 1, paso_meses: 0 },
  { nombre_freq: 'Quincenal', dias_tolerancia: 2, paso_meses: 0 },
  { nombre_freq: 'Mensual', dias_tolerancia: 4, paso_meses: 1 },
  { nombre_freq: 'Trimestral', dias_tolerancia: 7, paso_meses: 3 },
  { nombre_freq: 'Semestral', dias_tolerancia: 15, paso_meses: 6 },
  { nombre_freq: 'Anual', dias_tolerancia: 30, paso_meses: 12 },
];

describe('maintenanceEngine', () => {
  describe('date parsing, formatting, and folio generators', () => {
    it('parses DD/MM/YYYY and YYYY-MM-DD formats reliably', () => {
      const d1 = parseFecha('05/03/2026');
      expect(d1?.getFullYear()).toBe(2026);
      expect(d1?.getMonth()).toBe(2);
      expect(d1?.getDate()).toBe(5);

      const d2 = parseFecha('2026-11-18');
      expect(d2?.getFullYear()).toBe(2026);
      expect(d2?.getMonth()).toBe(10);
      expect(d2?.getDate()).toBe(18);

      expect(parseFecha('')).toBeNull();
    });

    it('formats dates and generates sequential folios', () => {
      const d = new Date(2026, 0, 9);
      expect(formatFechaDDMMYYYY(d)).toBe('09/01/2026');
      expect(formatFechaYYYYMMDD(d)).toBe('2026-01-09');
      expect(generarFolioMP(3, 12, 2026)).toBe('MP-2026-03-0012');
      expect(generarFolioMC(11, 5, 2026)).toBe('MC-2026-11-0005');
      expect(generarFolioOT(7, 1, 2026)).toBe('OT-2026-07-0001');
      expect(generarFolioCAL(12, 99, 2026)).toBe('CAL-2026-12-0099');
    });
  });

  describe('addFrequencyStep', () => {
    it('clamps month-end dates when stepping into shorter months', () => {
      const jan31 = new Date(2026, 0, 31);
      const feb = addFrequencyStep(jan31, 'Mensual', FREQUENCIAS, 31);
      expect(formatFechaYYYYMMDD(feb)).toBe('2026-02-28');

      // Recovers preferred day 31 when stepping into March
      const mar = addFrequencyStep(feb, 'Mensual', FREQUENCIAS, 31);
      expect(formatFechaYYYYMMDD(mar)).toBe('2026-03-31');

      // Handles leap year 2024
      const febLeap = addFrequencyStep(new Date(2024, 0, 31), 'Mensual', FREQUENCIAS, 31);
      expect(formatFechaYYYYMMDD(febLeap)).toBe('2024-02-29');
    });

    it('steps sub-monthly frequencies by exact day counts', () => {
      const base = new Date(2026, 4, 1);
      expect(formatFechaYYYYMMDD(addFrequencyStep(base, 'Diaria', FREQUENCIAS))).toBe('2026-05-02');
      expect(formatFechaYYYYMMDD(addFrequencyStep(base, 'Semanal', FREQUENCIAS))).toBe(
        '2026-05-08'
      );
      expect(formatFechaYYYYMMDD(addFrequencyStep(base, 'Quincenal', FREQUENCIAS))).toBe(
        '2026-05-15'
      );
    });
  });

  describe('calcularOcurrenciasEquipo (ISO plan preservation & Y+1 projection)', () => {
    const equipo: Equipo = {
      id: 'CH-01___Trimestral',
      codigo_eq: 'CH-01',
      cliente: 'Planta Norte',
      nombre: 'Chiller Principal',
      sistema: 'Refrigeración',
      marca: 'Carrier',
      modelo: '30XA',
      frecuencia: 'Trimestral',
      tareas: 'Inspección',
      tecnico: 'Juan Pérez',
      fecha_proxima: '2026-01-15',
    };

    it('preserves all annual slots inside the same year even when executed late', () => {
      const historial: RegistroHistorialMP[] = [
        {
          id: 'h1',
          codigo_eq: 'CH-01',
          mes_n: 1,
          fecha_real: '28/01/2026',
          id_ot: 'MP-2026-01-0001',
          comentarios: 'Ejecutado tarde',
          tecnico: 'Juan Pérez',
          frecuencia: 'Trimestral',
        },
      ];

      const occ2026 = calcularOcurrenciasEquipo(equipo, 2026, FREQUENCIAS, historial, [equipo]);
      expect(occ2026.map((o) => o.mes_n)).toEqual([1, 4, 7, 10]);
      expect(occ2026[0].historialMatch?.id_ot).toBe('MP-2026-01-0001');
      expect(formatFechaYYYYMMDD(occ2026[1].fecha)).toBe('2026-04-15');
    });

    it('anchors year Y+1 from the last real closing date of year Y', () => {
      const historial: RegistroHistorialMP[] = [
        {
          id: 'h-oct',
          codigo_eq: 'CH-01',
          mes_n: 10,
          fecha_real: '20/11/2026',
          id_ot: 'MP-2026-10-0004',
          comentarios: 'Cierre tardío',
          tecnico: 'Juan Pérez',
          frecuencia: 'Trimestral',
        },
      ];

      const occ2027 = calcularOcurrenciasEquipo(equipo, 2027, FREQUENCIAS, historial, [equipo]);
      expect(formatFechaYYYYMMDD(occ2027[0].fecha)).toBe('2027-02-20');
      expect(occ2027.map((o) => o.mes_n)).toEqual([2, 5, 8, 11]);
    });
  });

  describe('calcularOcurrenciasInstrumento', () => {
    const inst: Instrumento = {
      codigo_inst: 'MAN-01',
      nombre: 'Manómetro Caldera',
      cliente: 'Planta Norte',
      variable_medicion: 'Presión',
      rango_operacion: '0 a 300 PSI',
      tolerancia_emp: '± 0.5% FS',
      frecuencia: 'Semestral',
      estado: 'Activo',
      fecha_alta: '01/01/2026',
      fecha_proxima: '2026-02-10',
    };

    it('returns empty schedule for Baja instruments', () => {
      expect(
        calcularOcurrenciasInstrumento({ ...inst, estado: 'Baja' }, 2026, FREQUENCIAS, [])
      ).toEqual([]);
    });

    it('uses explicit proxima_calibracion when projecting year Y+1', () => {
      const cals: OrdenCalibracion[] = [
        {
          id_ot: 'CAL-2026-08-0002',
          codigo_eq: 'MAN-01',
          cliente: 'Planta Norte',
          instrumento_nombre: 'Manómetro Caldera',
          variable_medicion: 'Presión',
          rango_operacion: '0 a 300 PSI',
          tolerancia_emp: '± 0.5% FS',
          frecuencia_calibracion: 'Semestral',
          fecha_emision: '01/08/2026',
          fecha_programada: '10/08/2026',
          fecha_tentativa: '25/08/2026',
          dias_tolerancia: 15,
          estado: 'Conforme (A tiempo)',
          fecha_real: '12/08/2026',
          proxima_calibracion: '15/03/2027',
          metrologo_laboratorio: 'Lab Metro',
        },
      ];

      const occ2027 = calcularOcurrenciasInstrumento(inst, 2027, FREQUENCIAS, cals);
      expect(formatFechaYYYYMMDD(occ2027[0].fecha)).toBe('2027-03-15');
      expect(occ2027.map((o) => o.mes_n)).toEqual([3, 9]);
    });
  });

  describe('KPI calculations', () => {
    it('computes monthly maintenance KPI percentages cleanly', () => {
      const eq: Equipo = {
        id: 'BOM-01___Mensual',
        codigo_eq: 'BOM-01',
        cliente: 'Planta',
        nombre: 'Bomba',
        sistema: 'Hidráulico',
        marca: 'KSB',
        modelo: 'Mega',
        frecuencia: 'Mensual',
        tareas: 'Lubricar',
        tecnico: 'Ana',
        fecha_proxima: '2026-01-10',
      };
      const hist: RegistroHistorialMP[] = [
        {
          id: '1',
          codigo_eq: 'BOM-01',
          mes_n: 1,
          fecha_real: '12/01/2026',
          id_ot: 'MP-2026-01-0001',
          comentarios: 'OK',
          tecnico: 'Ana',
          frecuencia: 'Mensual',
        },
        {
          id: '2',
          codigo_eq: 'BOM-01',
          mes_n: 2,
          fecha_real: '25/02/2026',
          id_ot: 'MP-2026-02-0001',
          comentarios: 'Demora',
          tecnico: 'Ana',
          frecuencia: 'Mensual',
        },
      ];

      const kpiEne = calcularKpiMensual([eq], hist, FREQUENCIAS, 1, 2026);
      expect(kpiEne.total_programados).toBe(1);
      expect(kpiEne.en_fecha).toBe(1);
      expect(kpiEne.porcentaje_cumplimiento).toBe(100);

      const kpiFeb = calcularKpiMensual([eq], hist, FREQUENCIAS, 2, 2026);
      expect(kpiFeb.total_programados).toBe(1);
      expect(kpiFeb.fuera_fecha).toBe(1);
      expect(kpiFeb.porcentaje_cumplimiento).toBe(0);
    });

    it('computes monthly calibration KPI counting No Conforme properly', () => {
      const inst: Instrumento = {
        codigo_inst: 'TT-01',
        nombre: 'Transmisor Temp',
        cliente: 'Planta',
        variable_medicion: 'Temperatura',
        rango_operacion: '0 a 150 °C',
        tolerancia_emp: '± 0.5 °C',
        frecuencia: 'Anual',
        estado: 'Activo',
        fecha_alta: '01/01/2026',
        fecha_proxima: '2026-03-10',
      };
      const cal: OrdenCalibracion = {
        id_ot: 'CAL-2026-03-0001',
        codigo_eq: 'TT-01',
        cliente: 'Planta',
        instrumento_nombre: 'Transmisor Temp',
        variable_medicion: 'Temperatura',
        rango_operacion: '0 a 150 °C',
        tolerancia_emp: '± 0.5 °C',
        frecuencia_calibracion: 'Anual',
        fecha_emision: '01/03/2026',
        fecha_programada: '10/03/2026',
        fecha_tentativa: '20/03/2026',
        dias_tolerancia: 30,
        estado: 'No Conforme / Fuera de Tolerancia',
        dictamen: 'No Conforme',
        fecha_real: '10/03/2026',
        metrologo_laboratorio: 'Luis',
      };

      const kpi = calcularKpiCalibracionMensual([inst], [cal], FREQUENCIAS, 3, 2026);
      expect(kpi.total_programados).toBe(1);
      expect(kpi.no_conformes).toBe(1);
      expect(kpi.fuera_fecha).toBe(1);
      expect(kpi.porcentaje_cumplimiento).toBe(0);
    });

    it('aggregates technician and metrologist KPI metrics', () => {
      const tecs: Tecnico[] = [
        { codigo_tec: 'T1', nombre: 'Carlos Ruiz', especialidad: 'Mecánica', estado: 'Activo' },
      ];
      const mcs: OrdenCorrectivo[] = [
        {
          id_ot: 'MC-2026-01-0001',
          codigo_eq: 'EQ-1',
          cliente: 'Planta',
          fecha_emision: '01/01/2026',
          falla_reportada: 'Fuga',
          fecha_tentativa: '03/01/2026',
          dias_tolerancia: 2,
          estado: 'Cerrada (A tiempo)',
          fecha_real: '02/01/2026',
          acciones_realizadas: 'Sello',
          tecnico: 'Carlos Ruiz',
        },
      ];
      const ots: OrdenTrabajoOT[] = [
        {
          id_ot: 'OT-2026-01-0002',
          codigo_eq: 'EQ-1',
          cliente: 'Planta',
          fecha_emision: '05/01/2026',
          trabajo_solicitado: 'Guardas',
          fecha_tentativa: '10/01/2026',
          dias_tolerancia: 2,
          estado: 'Cerrada (Fuera de término)',
          fecha_real: '20/01/2026',
          acciones_realizadas: 'Instalado',
          tecnico: 'Carlos Ruiz',
        },
      ];
      const cals: OrdenCalibracion[] = [
        {
          id_ot: 'CAL-2026-02-0001',
          codigo_eq: 'MAN-1',
          cliente: 'Planta',
          instrumento_nombre: 'Manómetro',
          variable_medicion: 'Presión',
          rango_operacion: '0 a 100 PSI',
          tolerancia_emp: '± 1% FS',
          frecuencia_calibracion: 'Anual',
          fecha_emision: '01/02/2026',
          fecha_programada: '05/02/2026',
          fecha_tentativa: '10/02/2026',
          dias_tolerancia: 5,
          estado: 'Conforme (A tiempo)',
          fecha_real: '05/02/2026',
          metrologo_laboratorio: 'Carlos Ruiz',
        },
      ];

      const kpiTec = calcularKpisTecnicos(tecs, mcs, ots);
      expect(kpiTec[0].asignadas_total).toBe(2);
      expect(kpiTec[0].a_tiempo).toBe(1);
      expect(kpiTec[0].fuera_termino).toBe(1);
      expect(kpiTec[0].cumplimiento_pct).toBe(50);

      const kpiMet = calcularKpisMetrologos(tecs, cals);
      expect(kpiMet[0].asignadas_total).toBe(1);
      expect(kpiMet[0].a_tiempo).toBe(1);
      expect(kpiMet[0].cumplimiento_pct).toBe(100);
    });
  });

  describe('tecnicoPerteneceAEmpresa', () => {
    it('supports single-company, multi-company, all-companies, and legacy records', () => {
      expect(tecnicoPerteneceAEmpresa({ empresas: ['Planta Sur'] }, 'Planta Sur')).toBe(true);
      expect(tecnicoPerteneceAEmpresa({ empresas: ['Planta Sur'] }, 'Planta Norte')).toBe(false);
      expect(tecnicoPerteneceAEmpresa({ empresas: ['Planta A', 'Planta B'] }, 'Planta B')).toBe(
        true
      );
      expect(tecnicoPerteneceAEmpresa({ empresas: [TODAS_LAS_EMPRESAS] }, 'Cualquiera')).toBe(true);
      expect(tecnicoPerteneceAEmpresa({ empresas: undefined }, 'Cualquiera')).toBe(true);
      expect(tecnicoPerteneceAEmpresa({ empresas: [] }, 'Cualquiera')).toBe(false);
    });
  });
});
