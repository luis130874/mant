/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Compass, TrendingUp } from 'lucide-react';
import { KpiCalibracionMensual, MESES_L } from '../../utils/maintenanceEngine';

export interface CalibrationEvolutionItem {
  mes: string;
  pct: number;
  programados: number;
  enFecha: number;
  fueraFecha: number;
  vencidos: number;
}

interface CalibrationKpiSectionProps {
  selectedAnio: number;
  tipoVistaCalKpi: 'mensual' | 'anual' | 'grafico';
  setTipoVistaCalKpi: (v: 'mensual' | 'anual' | 'grafico') => void;
  mesCalKpiSel: number;
  setMesCalKpiSel: (m: number) => void;
  calKpiMes: KpiCalibracionMensual;
  calAnualProg: number;
  calAnualEnFecha: number;
  calAnualFueraFecha: number;
  calAnualPendientes: number;
  pctCalAnual: number;
  calAbiertasCount: number;
  calConformesCount: number;
  calNoConformesCount: number;
  instrumentosActivosCount: number;
  calibracionesTotalesCount: number;
  calEvolutionData: CalibrationEvolutionItem[];
}

export const CalibrationKpiSection: React.FC<CalibrationKpiSectionProps> = ({
  selectedAnio,
  tipoVistaCalKpi,
  setTipoVistaCalKpi,
  mesCalKpiSel,
  setMesCalKpiSel,
  calKpiMes,
  calAnualProg,
  calAnualEnFecha,
  calAnualFueraFecha,
  calAnualPendientes,
  pctCalAnual,
  calAbiertasCount,
  calConformesCount,
  calNoConformesCount,
  instrumentosActivosCount,
  calibracionesTotalesCount,
  calEvolutionData,
}) => {
  return (
    <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] tracking-tight">
            Indicadores del Plan de Calibraciones
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5">
            Auditoría de cumplimiento metrológico, trazabilidad de instrumentos y puntualidad de
            certificaciones.
          </p>
        </div>
      </div>

      {/* Top 4 Essential Calibration Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Cumplimiento {MESES_L[mesCalKpiSel - 1]}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono tabular-nums">
              {calKpiMes.porcentaje_cumplimiento.toFixed(1)}%
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              ({calKpiMes.en_fecha}/{calKpiMes.total_programados})
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
            {calKpiMes.fuera_fecha} fuera de tolerancia · {calKpiMes.pendientes_vencidos} vencidos
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Cumplimiento Anual {selectedAnio}</span>
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] font-mono tabular-nums">
              {pctCalAnual.toFixed(1)}%
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              ({calAnualEnFecha}/{calAnualProg})
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
            Meta corporativa SLA: 95.0% puntualidad
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Calibraciones Abiertas</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono tabular-nums">
              {calAbiertasCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              en atención
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
            {calConformesCount} conformes · {calNoConformesCount} no conformes
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Instrumentos en Plan</span>
            <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400 prodexus:text-[#2F7CF6]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono tabular-nums">
              {instrumentosActivosCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              instrumentos activos
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
            {calibracionesTotalesCount} órdenes totales registradas
          </p>
        </div>
      </div>

      {/* Sub Navigation for Calibration KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 prodexus:bg-[#E4ECF0] rounded-lg">
          <button
            onClick={() => setTipoVistaCalKpi('mensual')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tipoVistaCalKpi === 'mensual'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Auditoría Mensual
          </button>
          <button
            onClick={() => setTipoVistaCalKpi('anual')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tipoVistaCalKpi === 'anual'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Acumulado Anual
          </button>
          <button
            onClick={() => setTipoVistaCalKpi('grafico')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tipoVistaCalKpi === 'grafico'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Evolución Gráfica (12 Meses)
          </button>
        </div>

        {tipoVistaCalKpi === 'mensual' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976]">
              Mes de análisis:
            </span>
            <select
              value={mesCalKpiSel}
              onChange={(e) => setMesCalKpiSel(Number(e.target.value))}
              className="text-xs font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-slate-50 dark:bg-slate-800 prodexus:bg-[#F3F6F8] border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              {MESES_L.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {idx + 1} - {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* CALIBRACIÓN VISTA 1: Mensual */}
      {tipoVistaCalKpi === 'mensual' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 prodexus:text-[#4D6976] uppercase">
                Programados
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono mt-1 tabular-nums">
                {calKpiMes.total_programados}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] uppercase">
                A Tiempo
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] font-mono mt-1 tabular-nums">
                {calKpiMes.en_fecha}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                Fuera de Fecha
              </span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1 tabular-nums">
                {calKpiMes.fuera_fecha}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                Vencidos Pendientes
              </span>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1 tabular-nums">
                {calKpiMes.pendientes_vencidos}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] uppercase">
                Por Vencer
              </span>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] font-mono mt-1 tabular-nums">
                {calKpiMes.por_vencer}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] text-center relative overflow-hidden">
            <div className="max-w-md mx-auto">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] uppercase tracking-widest">
                Cumplimiento Calibración Mensual · {MESES_L[mesCalKpiSel - 1]} {selectedAnio}
              </span>
              <div className="text-5xl sm:text-6xl font-black text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] font-mono mt-3 tabular-nums">
                {calKpiMes.porcentaje_cumplimiento.toFixed(1)}%
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-3">
                {calKpiMes.en_fecha} de {calKpiMes.total_programados} calibraciones conformes
                completadas dentro de ventana de tolerancia.
                {calKpiMes.no_conformes > 0
                  ? ` (${calKpiMes.no_conformes} fuera de tolerancia EMP)`
                  : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CALIBRACIÓN VISTA 2: Anual Acumulado */}
      {tipoVistaCalKpi === 'anual' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <span className="text-[11px] font-bold text-slate-400 prodexus:text-[#4D6976] uppercase">
                Anual Programados
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono mt-1 tabular-nums">
                {calAnualProg}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] uppercase">
                A Tiempo
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] font-mono mt-1 tabular-nums">
                {calAnualEnFecha}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                Fuera de Término
              </span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1 tabular-nums">
                {calAnualFueraFecha}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                Vencidos Acumulados
              </span>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1 tabular-nums">
                {calAnualPendientes}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] text-center">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] uppercase tracking-widest">
              Cumplimiento Calibración Consolidado {selectedAnio}
            </span>
            <div className="text-5xl sm:text-6xl font-black text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] font-mono mt-3 tabular-nums">
              {pctCalAnual.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-3">
              Basado en {calAnualProg} calibraciones anuales planificadas en el calendario
              metrológico.
            </p>
          </div>
        </div>
      )}

      {/* CALIBRACIÓN VISTA 3: Evolución Gráfica (12 Meses) */}
      {tipoVistaCalKpi === 'grafico' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                Evolución Mensual de Cumplimiento de Calibraciones (%) - {selectedAnio}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                Histórico mes a mes con umbral objetivo del 95%
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-blue-600 prodexus:bg-[#2F7CF6] rounded-sm"></span>
                <span className="text-slate-600 dark:text-slate-300">% Cumplimiento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-rose-500 border-b border-dashed border-rose-500"></span>
                <span className="text-slate-600 dark:text-slate-300">Meta (95%)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 pb-2">
            <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-end h-64 border-b border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] px-2 relative">
              <div
                className="absolute left-0 right-0 border-b border-dashed border-rose-400 pointer-events-none z-10 flex justify-end pr-2"
                style={{ bottom: '95%' }}
              >
                <span className="text-[10px] font-mono font-bold text-rose-500 dark:text-rose-400 bg-white/90 dark:bg-slate-900/90 px-1 rounded -translate-y-2.5">
                  Meta 95%
                </span>
              </div>

              {calEvolutionData.map((d, i) => {
                const heightPct = Math.min(100, Math.max(d.pct, 4));
                const isSelected = mesCalKpiSel === i + 1;
                return (
                  <div
                    key={d.mes}
                    onClick={() => {
                      setMesCalKpiSel(i + 1);
                      setTipoVistaCalKpi('mensual');
                    }}
                    className="flex flex-col items-center h-full justify-end cursor-pointer group"
                  >
                    <div className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] opacity-80 group-hover:opacity-100 mb-1 transition-opacity">
                      {d.pct}%
                    </div>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all ${
                        isSelected
                          ? 'bg-blue-600 prodexus:bg-[#2F7CF6] shadow-sm'
                          : d.pct >= 95
                            ? 'bg-emerald-500 prodexus:bg-[#1FB85C] group-hover:bg-emerald-600'
                            : d.pct >= 80
                              ? 'bg-blue-500 prodexus:bg-[#2F7CF6] group-hover:bg-blue-600'
                              : 'bg-amber-500 group-hover:bg-amber-600'
                      }`}
                    />

                    <div className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
                      {d.mes}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
