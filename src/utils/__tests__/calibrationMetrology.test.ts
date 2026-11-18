import { describe, expect, it } from 'vitest';
import {
  calcularResumenDesvio,
  extractPuntosForChart,
  generarPuntosCalibracion,
  parseEmpLimit,
  parseRangoMedicion,
  recalcularPuntoCalibracion,
} from '../calibrationMetrology';
import type { PuntoCalibracion } from '../../types';

describe('calibrationMetrology', () => {
  describe('parseRangoMedicion', () => {
    it('parses standard positive pressure ranges with unit', () => {
      const res = parseRangoMedicion('0 a 300 PSI', 'Presión');
      expect(res).toEqual({ min: 0, max: 300, unit: 'PSI' });
    });

    it('parses negative-to-zero vacuum ranges', () => {
      const res = parseRangoMedicion('-30 a 0 inHg', 'Vacío');
      expect(res).toEqual({ min: -30, max: 0, unit: 'inHg' });
    });

    it('parses temperature ranges with hyphen separator and decimal comma', () => {
      const res = parseRangoMedicion('-20,5 - 150 °C', 'Temperatura');
      expect(res).toEqual({ min: -20.5, max: 150, unit: '°C' });
    });

    it('falls back to inferred magnitude defaults when range string is empty or invalid', () => {
      const res = parseRangoMedicion('', 'Temperatura');
      expect(res).toEqual({ min: 0, max: 150, unit: '°C' });

      const explicitUnit = parseRangoMedicion('invalido', 'Presión', 'Bar');
      expect(explicitUnit).toEqual({ min: 0, max: 300, unit: 'Bar' });
    });
  });

  describe('parseEmpLimit', () => {
    it('computes percent FS tolerances accurately', () => {
      const emp = parseEmpLimit('± 0.5% FS', 0, 200);
      expect(emp.kind).toBe('percent_fs');
      expect(emp.pctLimit).toBe(0.5);
      expect(emp.absLimit).toBeCloseTo(1.0, 5);
    });

    it('treats %HR as absolute humidity tolerance rather than % FS', () => {
      const emp = parseEmpLimit('± 2.0 %HR', 10, 90);
      expect(emp.kind).toBe('absolute');
      expect(emp.absLimit).toBe(2.0);
      expect(emp.pctLimit).toBeCloseTo(2.5, 5);
    });

    it('parses absolute unit tolerances', () => {
      const emp = parseEmpLimit('± 0.5 °C', -50, 150);
      expect(emp.kind).toBe('absolute');
      expect(emp.absLimit).toBe(0.5);
      expect(emp.pctLimit).toBeCloseTo(0.25, 5);
    });
  });

  describe('generarPuntosCalibracion', () => {
    it('generates 3, 5, 6, and 11 point linear steps', () => {
      const p3 = generarPuntosCalibracion({ min: 0, max: 100, unit: 'PSI', numPuntos: 3 });
      expect(p3.map((p) => p.valor_nominal)).toEqual([0, 50, 100]);

      const p5 = generarPuntosCalibracion({ min: 4, max: 20, unit: 'mA', numPuntos: 5 });
      expect(p5.map((p) => p.valor_nominal)).toEqual([4, 8, 12, 16, 20]);
      expect(p5[2].punto_nominal).toBe('50% (12 mA)');

      const p6 = generarPuntosCalibracion({ min: 0, max: 100, unit: '%', numPuntos: 6 });
      expect(p6.map((p) => p.valor_nominal)).toEqual([0, 20, 40, 60, 80, 100]);

      const p11 = generarPuntosCalibracion({ min: 0, max: 100, unit: 'Bar', numPuntos: 11 });
      expect(p11).toHaveLength(11);
      expect(p11[1].valor_nominal).toBe(10);
    });

    it('generates 9 ascending + descending hysteresis points', () => {
      const p9 = generarPuntosCalibracion({
        min: 0,
        max: 100,
        unit: 'PSI',
        numPuntos: 5,
        incluirBajada: true,
      });
      expect(p9).toHaveLength(9);
      expect(p9.map((p) => p.valor_nominal)).toEqual([0, 25, 50, 75, 100, 75, 50, 25, 0]);
      expect(p9[0].punto_nominal).toContain('↑');
      expect(p9[5].punto_nominal).toContain('↓');
    });
  });

  describe('recalcularPuntoCalibracion & calcularResumenDesvio', () => {
    it('evaluates deviation sign (instrumento - patron) and boundary conformance', () => {
      const punto: PuntoCalibracion = {
        punto_nominal: '50% (100 PSI)',
        valor_nominal: 100,
        lectura_patron: '100',
        lectura_instrumento: '101',
        error_calculado: '',
        conforme: true,
      };

      const within = recalcularPuntoCalibracion(punto, 0, 200, '± 0.5% FS', 'PSI');
      expect(within.desvio).toBe(1);
      expect(within.error_calculado).toBe('+0.50%');
      expect(within.conforme).toBe(true);

      const outside = recalcularPuntoCalibracion(
        { ...punto, lectura_instrumento: '101.2' },
        0,
        200,
        '± 0.5% FS',
        'PSI'
      );
      expect(outside.desvio).toBe(1.2);
      expect(outside.conforme).toBe(false);
    });

    it('recommends No Conforme when any measured point exceeds EMP', () => {
      const pts: PuntoCalibracion[] = [
        {
          punto_nominal: '0% (0 °C)',
          valor_nominal: 0,
          lectura_patron: '0',
          lectura_instrumento: '0.2',
          error_calculado: '',
          conforme: true,
        },
        {
          punto_nominal: '100% (100 °C)',
          valor_nominal: 100,
          lectura_patron: '100',
          lectura_instrumento: '99.1',
          error_calculado: '',
          conforme: true,
        },
      ];

      const summary = calcularResumenDesvio(pts, 0, 100, '± 0.5 °C', '°C');
      expect(summary.measuredCount).toBe(2);
      expect(summary.conformesCount).toBe(1);
      expect(summary.allConforme).toBe(false);
      expect(summary.maxAbsDesvio).toBeCloseTo(0.9, 4);
      expect(summary.maxSignedDesvio).toBeCloseTo(-0.9, 4);
      expect(summary.suggestedDictamen).toBe('No Conforme');
      expect(summary.errorMaxLabel).toBe('-0.90 °C');
    });

    it('extracts deviation chart series preserving hysteresis direction labels', () => {
      const pts = generarPuntosCalibracion({
        min: 0,
        max: 100,
        unit: 'Bar',
        numPuntos: 3,
        incluirBajada: true,
      });
      pts[0].lectura_instrumento = '0.1';
      pts[4].lectura_instrumento = '-0.2';

      const series = extractPuntosForChart(pts, 0, 100, '± 0.5% FS');
      expect(series).toHaveLength(5);
      expect(series[0].shortLabel).toBe('0');
      expect(series[4].shortLabel).toBe('0↓');
      expect(series[0].desvio).toBe(0.1);
      expect(series[4].desvio).toBe(-0.2);
    });
  });
});
