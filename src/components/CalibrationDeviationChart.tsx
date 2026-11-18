/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PuntoCalibracion } from '../types';
import {
  calcularResumenDesvio,
  extractPuntosForChart,
  formatMetrologyNum,
  parseRangoMedicion
} from '../utils/calibrationMetrology';

interface CalibrationDeviationChartProps {
  puntos: PuntoCalibracion[];
  rangoOperacion?: string;
  rangoMin?: number;
  rangoMax?: number;
  unidad?: string;
  toleranciaEmp?: string;
  variableMedicion?: string;
  variant?: 'ui' | 'print';
}

export const CalibrationDeviationChart: React.FC<CalibrationDeviationChartProps> = ({
  puntos,
  rangoOperacion,
  rangoMin,
  rangoMax,
  unidad,
  toleranciaEmp,
  variableMedicion,
  variant = 'ui'
}) => {
  const isPrint = variant === 'print';

  const parsedRange = useMemo(() => {
    const fallback = parseRangoMedicion(rangoOperacion, variableMedicion, unidad);
    return {
      min: typeof rangoMin === 'number' && Number.isFinite(rangoMin) ? rangoMin : fallback.min,
      max: typeof rangoMax === 'number' && Number.isFinite(rangoMax) ? rangoMax : fallback.max,
      unit: unidad || fallback.unit
    };
  }, [rangoOperacion, rangoMin, rangoMax, unidad, variableMedicion]);

  const resumen = useMemo(
    () =>
      calcularResumenDesvio(
        puntos,
        parsedRange.min,
        parsedRange.max,
        toleranciaEmp,
        parsedRange.unit
      ),
    [puntos, parsedRange, toleranciaEmp]
  );

  const chartPoints = useMemo(
    () =>
      extractPuntosForChart(
        puntos,
        parsedRange.min,
        parsedRange.max,
        toleranciaEmp
      ),
    [puntos, parsedRange, toleranciaEmp]
  );

  const measuredPts = chartPoints.filter(p => p.desvio !== null);
  const empLimitAbs = resumen.empInfo.absLimit;

  // SVG Layout geometry
  const W = 720;
  const H = 250;
  const PAD_L = 68;
  const PAD_R = 54;
  const PAD_T = 26;
  const PAD_B = 46;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const maxDataAbs = measuredPts.reduce((acc, p) => Math.max(acc, Math.abs(p.desvio || 0)), 0);
  const yHalfRange = Math.max(empLimitAbs * 1.35, maxDataAbs * 1.28, 0.5);

  const yToPx = (val: number) => {
    const clamped = Math.max(-yHalfRange, Math.min(yHalfRange, val));
    return PAD_T + ((yHalfRange - clamped) / (2 * yHalfRange)) * plotH;
  };

  const totalCount = Math.max(chartPoints.length, 1);
  const xToPx = (idx: number) => {
    if (totalCount === 1) return PAD_L + plotW / 2;
    return PAD_L + (idx / (totalCount - 1)) * plotW;
  };

  const zeroY = yToPx(0);
  const empTopY = yToPx(empLimitAbs);
  const empBotY = yToPx(-empLimitAbs);

  const yTicks = [-yHalfRange, -empLimitAbs, 0, empLimitAbs, yHalfRange];

  const polylineCoords = chartPoints
    .map((p, idx) => (p.desvio !== null ? `${xToPx(idx).toFixed(1)},${yToPx(p.desvio).toFixed(1)}` : null))
    .filter((v): v is string => v !== null)
    .join(' ');

  const unitLabel = parsedRange.unit ? parsedRange.unit : 'u.';

  const containerCls = isPrint
    ? 'border border-slate-300 rounded-lg bg-white p-3.5 space-y-2.5 text-slate-900'
    : 'border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] rounded-xl bg-white dark:bg-slate-900 p-3.5 space-y-2.5';

  const badgeOkCls = isPrint
    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70';

  const badgeFailCls = isPrint
    ? 'bg-rose-50 text-rose-800 border-rose-300'
    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70';

  return (
    <div className={containerCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Activity className={`w-4 h-4 ${isPrint ? 'text-indigo-700' : 'text-indigo-600 dark:text-indigo-400 prodexus:text-[#2F7CF6]'}`} />
          <h4 className={`text-xs font-bold uppercase tracking-wider ${isPrint ? 'text-slate-900' : 'text-slate-800 dark:text-slate-100 prodexus:text-[#132B36]'}`}>
            Gráfica de Desvío Metrológico (Instrumento − Patrón)
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
          <span className={`px-2 py-0.5 rounded border font-mono font-semibold ${
            isPrint
              ? 'bg-slate-50 text-slate-700 border-slate-300'
              : 'bg-slate-50 dark:bg-slate-800 prodexus:bg-[#F3F6F8] text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE]'
          }`}>
            EMP: ±{formatMetrologyNum(empLimitAbs)} {unitLabel}
          </span>
          {measuredPts.length > 0 && (
            <>
              <span className={`px-2 py-0.5 rounded border font-mono font-bold ${
                isPrint
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  : 'bg-indigo-50 dark:bg-indigo-950/60 prodexus:bg-[#EEF5FF] text-indigo-700 dark:text-indigo-300 prodexus:text-[#2F7CF6] border-indigo-200 dark:border-indigo-800/70 prodexus:border-[#B9D2FA]'
              }`}>
                Máx. Hallado: {resumen.errorMaxLabel}
              </span>
              <span className={`px-2 py-0.5 rounded border font-bold inline-flex items-center gap-1 ${
                resumen.allConforme ? badgeOkCls : badgeFailCls
              }`}>
                {resumen.allConforme ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                <span>
                  {resumen.conformesCount}/{resumen.measuredCount} Conformes
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {measuredPts.length === 0 ? (
        <div className={`py-7 px-4 text-center rounded-lg border border-dashed text-xs ${
          isPrint
            ? 'border-slate-300 bg-slate-50 text-slate-500'
            : 'border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] bg-slate-50 dark:bg-slate-800/40 prodexus:bg-[#F3F6F8] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]'
        }`}>
          Ingrese las lecturas del patrón y del instrumento en los puntos de prueba para generar automáticamente la curva de desvío y la banda de tolerancia ±EMP.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto min-w-[460px] select-none"
            role="img"
            aria-label="Gráfica de desvío metrológico respecto a tolerancia EMP"
          >
            {/* Background plot area */}
            <rect
              x={PAD_L}
              y={PAD_T}
              width={plotW}
              height={plotH}
              rx={4}
              fill={isPrint ? '#ffffff' : '#f8fafc'}
              stroke={isPrint ? '#cbd5e1' : '#e2e8f0'}
              strokeWidth={1}
            />

            {/* Permissible ±EMP tolerance band */}
            <rect
              x={PAD_L}
              y={empTopY}
              width={plotW}
              height={Math.max(1, empBotY - empTopY)}
              fill="#10b981"
              fillOpacity={isPrint ? 0.11 : 0.13}
            />

            {/* Horizontal grid lines */}
            {yTicks.map((tickVal, tIdx) => {
              const y = yToPx(tickVal);
              const isZero = Math.abs(tickVal) < 1e-9;
              const isEmp = Math.abs(Math.abs(tickVal) - empLimitAbs) < 1e-6;
              return (
                <g key={tIdx}>
                  <line
                    x1={PAD_L}
                    y1={y}
                    x2={PAD_L + plotW}
                    y2={y}
                    stroke={isZero ? '#334155' : isEmp ? '#e11d48' : '#cbd5e1'}
                    strokeWidth={isZero ? 1.4 : isEmp ? 1.2 : 0.8}
                    strokeDasharray={isZero ? undefined : isEmp ? '5 4' : '2 3'}
                  />
                  <text
                    x={PAD_L - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize={10}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontWeight={isZero || isEmp ? 700 : 500}
                    fill={isEmp ? '#be123c' : isZero ? '#0f172a' : '#64748b'}
                  >
                    {tickVal > 0 ? `+${formatMetrologyNum(tickVal)}` : formatMetrologyNum(tickVal)}
                  </text>
                </g>
              );
            })}

            {/* Right-side annotations for +EMP, 0, -EMP */}
            <text x={PAD_L + plotW + 6} y={empTopY + 3.5} fontSize={9.5} fontWeight={700} fill="#be123c">
              +EMP
            </text>
            <text x={PAD_L + plotW + 6} y={zeroY + 3.5} fontSize={9.5} fontWeight={700} fill="#334155">
              Ideal (0)
            </text>
            <text x={PAD_L + plotW + 6} y={empBotY + 3.5} fontSize={9.5} fontWeight={700} fill="#be123c">
              -EMP
            </text>

            {/* Vertical grid lines & X-axis labels */}
            {chartPoints.map((pt, idx) => {
              const x = xToPx(idx);
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={PAD_T}
                    x2={x}
                    y2={PAD_T + plotH}
                    stroke="#e2e8f0"
                    strokeWidth={0.8}
                  />
                  <text
                    x={x}
                    y={PAD_T + plotH + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontWeight={600}
                    fill="#334155"
                  >
                    {pt.shortLabel}
                  </text>
                </g>
              );
            })}

            {/* Axis Titles */}
            <text
              x={14}
              y={PAD_T + plotH / 2}
              transform={`rotate(-90 14 ${PAD_T + plotH / 2})`}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={700}
              fill="#475569"
            >
              Desvío ({unitLabel})
            </text>
            <text
              x={PAD_L + plotW / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={700}
              fill="#475569"
            >
              Puntos Nominales de Prueba ({unitLabel})
            </text>

            {/* Deviation Curve Polyline */}
            {measuredPts.length > 1 && (
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth={2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polylineCoords}
              />
            )}

            {/* Deviation Data Points & Value Callouts */}
            {chartPoints.map((pt, idx) => {
              if (pt.desvio === null) return null;
              const cx = xToPx(idx);
              const cy = yToPx(pt.desvio);
              const isAboveZero = pt.desvio >= 0;
              const labelY = isAboveZero ? Math.max(PAD_T + 11, cy - 9) : Math.min(PAD_T + plotH - 4, cy + 16);
              const dotColor = pt.conforme ? '#059669' : '#e11d48';
              const devText = `${pt.desvio >= 0 ? '+' : ''}${formatMetrologyNum(pt.desvio)}`;

              return (
                <g key={idx}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4.8}
                    fill={dotColor}
                    stroke="#ffffff"
                    strokeWidth={1.6}
                  />
                  <text
                    x={cx}
                    y={labelY}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontWeight={700}
                    fill={pt.conforme ? '#065f46' : '#be123c'}
                  >
                    {devText}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Legend */}
      <div className={`flex flex-wrap items-center justify-between gap-2 pt-1 border-t text-[10px] ${
        isPrint
          ? 'border-slate-200 text-slate-600'
          : 'border-slate-100 dark:border-slate-800 prodexus:border-[#E4ECF0] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]'
      }`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-2 rounded-xs bg-emerald-500/25 border border-emerald-500/50 inline-block" />
            Banda Tolerancia ±EMP
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-600 inline-block" />
            Curva de Desvío Medida
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
            Punto Conforme
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
            Fuera de EMP
          </span>
        </div>
        <span className="font-mono">
          Rango: {formatMetrologyNum(parsedRange.min)} a {formatMetrologyNum(parsedRange.max)} {unitLabel}
        </span>
      </div>
    </div>
  );
};
