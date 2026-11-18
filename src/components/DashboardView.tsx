/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldAlert,
  ClipboardCheck
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { DigitalOrderTarget } from '../utils/digitalOrderLink';
import { canValidateDigitalOrder } from '../utils/rbac';
import { getPendingSupervisorValidations } from '../utils/supervisorValidations';
import { CalibrationKpiSection } from './dashboard/CalibrationKpiSection';
import {
  MESES_L,
  calcularKpiMensual,
  calcularKpiCalibracionMensual,
  calcularKpisTecnicos,
  calcularKpisMetrologos,
  generarMapaFoliosAnual,
  tecnicoPerteneceAEmpresa
} from '../utils/maintenanceEngine';

interface DashboardViewProps {
  onOpenDigitalValidation?: (target: DigitalOrderTarget) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenDigitalValidation }) => {
  const {
    clientes,
    selectedCliente,
    selectedAnio,
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    calibraciones,
    instrumentos,
    frecuencias,
    tecnicos
  } = useMaintenance();
  const { userProfile } = useAuth();

  const [panelModo, setPanelModo] = useState<'kpi_empresa' | 'kpi_tecnicos'>('kpi_empresa');
  const [tipoVistaKpi, setTipoVistaKpi] = useState<'mensual' | 'anual' | 'grafico'>('mensual');
  const [mesKpiSel, setMesKpiSel] = useState<number>(new Date().getMonth() + 1);
  const [tipoVistaCalKpi, setTipoVistaCalKpi] = useState<'mensual' | 'anual' | 'grafico'>('mensual');
  const [mesCalKpiSel, setMesCalKpiSel] = useState<number>(new Date().getMonth() + 1);

  // Filter entities by selected client
  const equiposFiltrados = selectedCliente === 'Todos'
    ? equipos
    : equipos.filter(e => e.cliente.trim() === selectedCliente.trim());

  const correctivosFiltrados = selectedCliente === 'Todos'
    ? correctivos
    : correctivos.filter(c => c.cliente.trim() === selectedCliente.trim());

  const ordenesFiltradas = selectedCliente === 'Todos'
    ? ordenesTrabajo
    : ordenesTrabajo.filter(o => o.cliente.trim() === selectedCliente.trim());

  const instrumentosFiltrados = selectedCliente === 'Todos'
    ? instrumentos
    : instrumentos.filter(i => i.cliente.trim() === selectedCliente.trim());

  const instrumentosActivosPlan = instrumentosFiltrados.filter(i => i.estado === 'Activo');
  const tienePlanCalibraciones = instrumentosActivosPlan.length > 0;

  const calibracionesFiltradas = selectedCliente === 'Todos'
    ? calibraciones
    : calibraciones.filter(c => c.cliente.trim() === selectedCliente.trim());

  const mapaFolios = generarMapaFoliosAnual(equiposFiltrados, selectedAnio, frecuencias, historial);

  // Calculate Monthly KPI (Maintenance)
  const kpiMes = calcularKpiMensual(
    equiposFiltrados,
    historial,
    frecuencias,
    mesKpiSel,
    selectedAnio,
    mapaFolios
  );

  // Calculate Annual KPI Acumulado (Maintenance)
  let anualProg = 0;
  let anualEnFecha = 0;
  let anualFueraFecha = 0;
  let anualPendientes = 0;

  for (let m = 1; m <= 12; m++) {
    const k = calcularKpiMensual(equiposFiltrados, historial, frecuencias, m, selectedAnio, mapaFolios);
    anualProg += k.total_programados;
    anualEnFecha += k.en_fecha;
    anualFueraFecha += k.fuera_fecha;
    anualPendientes += k.pendientes_vencidos;
  }
  const pctAnual = anualProg > 0 ? (anualEnFecha / anualProg) * 100 : 0;

  // 12-Month Data for Bar Chart (Maintenance)
  const evolutionData = MESES_L.map((mLabel, idx) => {
    const k = calcularKpiMensual(equiposFiltrados, historial, frecuencias, idx + 1, selectedAnio, mapaFolios);
    return {
      mes: mLabel,
      pct: Math.round(k.porcentaje_cumplimiento),
      programados: k.total_programados,
      enFecha: k.en_fecha,
      fueraFecha: k.fuera_fecha,
      vencidos: k.pendientes_vencidos
    };
  });

  // Calculate Calibration KPIs (only meaningful when company has active instruments in plan)
  const calEvolutionRaw = React.useMemo(() => {
    if (!tienePlanCalibraciones) return [];
    return MESES_L.map((_, idx) =>
      calcularKpiCalibracionMensual(
        instrumentosActivosPlan,
        calibracionesFiltradas,
        frecuencias,
        idx + 1,
        selectedAnio
      )
    );
  }, [tienePlanCalibraciones, instrumentosActivosPlan, calibracionesFiltradas, frecuencias, selectedAnio]);

  const calKpiMes = calEvolutionRaw[mesCalKpiSel - 1] || {
    mes_label: MESES_L[mesCalKpiSel - 1],
    total_programados: 0,
    en_fecha: 0,
    fuera_fecha: 0,
    pendientes_vencidos: 0,
    por_vencer: 0,
    porcentaje_cumplimiento: 0,
    no_conformes: 0
  };

  let calAnualProg = 0;
  let calAnualEnFecha = 0;
  let calAnualFueraFecha = 0;
  let calAnualPendientes = 0;
  for (const ck of calEvolutionRaw) {
    calAnualProg += ck.total_programados;
    calAnualEnFecha += ck.en_fecha;
    calAnualFueraFecha += ck.fuera_fecha;
    calAnualPendientes += ck.pendientes_vencidos;
  }
  const pctCalAnual = calAnualProg > 0 ? (calAnualEnFecha / calAnualProg) * 100 : 0;

  const calEvolutionData = calEvolutionRaw.map((k, idx) => ({
    mes: MESES_L[idx],
    pct: Math.round(k.porcentaje_cumplimiento),
    programados: k.total_programados,
    enFecha: k.en_fecha,
    fueraFecha: k.fuera_fecha,
    vencidos: k.pendientes_vencidos
  }));

  // Technician KPIs scoped to selectedCliente
  const tecnicosFiltrados = tecnicos.filter(t => tecnicoPerteneceAEmpresa(t, selectedCliente));
  const kpisTecnicos = calcularKpisTecnicos(tecnicosFiltrados, correctivosFiltrados, ordenesFiltradas);
  const kpisMetrologos = calcularKpisMetrologos(tecnicosFiltrados, calibracionesFiltradas);

  // Overdue / Urgent Alert Items
  const correctivosAbiertos = correctivosFiltrados.filter(c => c.estado === 'Pendiente');
  const otAbiertas = ordenesFiltradas.filter(o => o.estado === 'Pendiente');
  const calAbiertas = calibracionesFiltradas.filter(c => c.estado === 'Pendiente');
  const calConformesCount = calibracionesFiltradas.filter(c => c.estado !== 'Pendiente' && c.dictamen !== 'No Conforme').length;
  const calNoConformesCount = calibracionesFiltradas.filter(c => c.dictamen === 'No Conforme' || c.estado.includes('No Conforme')).length;

  const isSupervisor = canValidateDigitalOrder(userProfile);
  const pendingValidations = React.useMemo(() => {
    if (!isSupervisor) return [];
    const all = getPendingSupervisorValidations({
      userProfile,
      clientes,
      equipos,
      historial,
      correctivos,
      ordenesTrabajo,
      calibraciones
    });
    if (selectedCliente === 'Todos') return all;
    return all.filter((i) => i.cliente.trim() === selectedCliente.trim());
  }, [
    isSupervisor,
    userProfile,
    clientes,
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    calibraciones,
    selectedCliente
  ]);

  return (
    <div className="space-y-6">
      {/* View Header with Facility Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] tracking-tight">
            Panel de Indicadores y Desempeño
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5">
            Auditoría de cumplimiento preventivo, confiabilidad de planta y eficiencia técnica.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 prodexus:bg-[#E4ECF0] rounded-lg shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setPanelModo('kpi_empresa')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              panelModo === 'kpi_empresa'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            KPIs de Planta ({selectedCliente === 'Todos' ? 'Global' : selectedCliente})
          </button>
          <button
            onClick={() => setPanelModo('kpi_tecnicos')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              panelModo === 'kpi_tecnicos'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Rendimiento por Técnico
          </button>
        </div>
      </div>

      {/* Pending Supervisor Digital Validations Alert Strip */}
      {isSupervisor && pendingValidations.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-800/70 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                  {pendingValidations.length}{' '}
                  {pendingValidations.length === 1
                    ? 'orden cerrada digitalmente requiere validación'
                    : 'órdenes cerradas digitalmente requieren validación'}
                </h2>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Revise la ejecución, repuestos y firma del técnico para aprobar oficialmente el cierre.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {pendingValidations.slice(0, 6).map((item) => (
              <div
                key={item.key}
                className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 rounded-lg p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{item.folio}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      {item.tipo}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36] truncate">{item.nombreActivo}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.tecnico} · {item.fechaFirmaDigital || item.fechaReal}
                  </p>
                </div>
                {onOpenDigitalValidation && (
                  <button
                    type="button"
                    onClick={() => onOpenDigitalValidation(item.target)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 transition-colors"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Validar</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 4 Essential Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Cumplimiento {MESES_L[mesKpiSel - 1]}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono tabular-nums">
              {kpiMes.porcentaje_cumplimiento.toFixed(1)}%
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              ({kpiMes.en_fecha}/{kpiMes.total_programados})
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
            {kpiMes.fuera_fecha} cerrados fuera de tolerancia · {kpiMes.pendientes_vencidos} vencidos
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Cumplimiento Anual {selectedAnio}</span>
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] font-mono tabular-nums">
              {pctAnual.toFixed(1)}%
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              ({anualEnFecha}/{anualProg})
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
            Meta corporativa SLA: 95.0% puntualidad
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Correctivos Abiertos</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono tabular-nums">
              {correctivosAbiertos.length}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">en atención</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
            {correctivosFiltrados.length} correctivos totales en historial
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Equipos Protegidos</span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 prodexus:text-[#2F7CF6]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono tabular-nums">
              {equiposFiltrados.length}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">activos industriales</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-2">
            {tecnicosFiltrados.filter(t => t.estado === 'Activo').length} técnicos activos asignados
          </p>
        </div>
      </div>

      {/* Main Panel Content */}
      {panelModo === 'kpi_empresa' ? (
        <div className="space-y-6">
          {/* Sub Navigation for Empresa KPIs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 prodexus:bg-[#E4ECF0] rounded-lg">
              <button
                onClick={() => setTipoVistaKpi('mensual')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tipoVistaKpi === 'mensual'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Auditoría Mensual
              </button>
              <button
                onClick={() => setTipoVistaKpi('anual')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tipoVistaKpi === 'anual'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Acumulado Anual
              </button>
              <button
                onClick={() => setTipoVistaKpi('grafico')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tipoVistaKpi === 'grafico'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Evolución Gráfica (12 Meses)
              </button>
            </div>

            {tipoVistaKpi === 'mensual' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976]">Mes de análisis:</span>
                <select
                  value={mesKpiSel}
                  onChange={(e) => setMesKpiSel(Number(e.target.value))}
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

          {/* VISTA 1: Mensual */}
          {tipoVistaKpi === 'mensual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 prodexus:text-[#4D6976] uppercase">Programados</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono mt-1 tabular-nums">
                    {kpiMes.total_programados}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] uppercase">A Tiempo</span>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] font-mono mt-1 tabular-nums">
                    {kpiMes.en_fecha}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">Fuera de Fecha</span>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1 tabular-nums">
                    {kpiMes.fuera_fecha}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">Vencidos Pendientes</span>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1 tabular-nums">
                    {kpiMes.pendientes_vencidos}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] uppercase">Por Vencer</span>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] font-mono mt-1 tabular-nums">
                    {kpiMes.por_vencer}
                  </div>
                </div>
              </div>

              {/* Big KPI Visual Card */}
              <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] text-center relative overflow-hidden">
                <div className="max-w-md mx-auto">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] uppercase tracking-widest">
                    Cumplimiento Preventivo Mensual · {MESES_L[mesKpiSel - 1]} {selectedAnio}
                  </span>
                  <div className="text-5xl sm:text-6xl font-black text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] font-mono mt-3 tabular-nums">
                    {kpiMes.porcentaje_cumplimiento.toFixed(1)}%
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-3">
                    {kpiMes.en_fecha} de {kpiMes.total_programados} mantenimientos preventivos completados dentro de ventana de tolerancia.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 2: Anual Acumulado */}
          {tipoVistaKpi === 'anual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <span className="text-[11px] font-bold text-slate-400 prodexus:text-[#4D6976] uppercase">Anual Programados</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-mono mt-1 tabular-nums">
                    {anualProg}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] uppercase">A Tiempo</span>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] font-mono mt-1 tabular-nums">
                    {anualEnFecha}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">Fuera de Término</span>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1 tabular-nums">
                    {anualFueraFecha}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">Vencidos Acumulados</span>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1 tabular-nums">
                    {anualPendientes}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] text-center">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] uppercase tracking-widest">
                  Cumplimiento Preventivo Consolidado {selectedAnio}
                </span>
                <div className="text-5xl sm:text-6xl font-black text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] font-mono mt-3 tabular-nums">
                  {pctAnual.toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-3">
                  Basado en {anualProg} intervenciones anuales planificadas en el calendario maestro.
                </p>
              </div>
            </div>
          )}

          {/* VISTA 3: Evolución Gráfica (12 Meses) */}
          {tipoVistaKpi === 'grafico' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                    Evolución Mensual de Cumplimiento (%) - {selectedAnio}
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

              {/* Clean SVG Bar Chart with Tabular Numerals */}
              <div className="pt-4 pb-2">
                <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-end h-64 border-b border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] px-2 relative">
                  {/* Target line at 95% */}
                  <div
                    className="absolute left-0 right-0 border-b border-dashed border-rose-400 pointer-events-none z-10 flex justify-end pr-2"
                    style={{ bottom: '95%' }}
                  >
                    <span className="text-[10px] font-mono font-bold text-rose-500 dark:text-rose-400 bg-white/90 dark:bg-slate-900/90 px-1 rounded -translate-y-2.5">
                      Meta 95%
                    </span>
                  </div>

                  {evolutionData.map((d, i) => {
                    const heightPct = Math.min(100, Math.max(d.pct, 4));
                    const isSelected = mesKpiSel === i + 1;
                    return (
                      <div
                        key={d.mes}
                        onClick={() => {
                          setMesKpiSel(i + 1);
                          setTipoVistaKpi('mensual');
                        }}
                        className="flex flex-col items-center h-full justify-end cursor-pointer group"
                      >
                        {/* Hover Tooltip */}
                        <div className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] opacity-80 group-hover:opacity-100 mb-1 transition-opacity">
                          {d.pct}%
                        </div>

                        {/* Bar */}
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

                        {/* Label */}
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

          {/* CALIBRATION KPIs SECTION (when company has active instruments in plan) */}
          {tienePlanCalibraciones && (
            <CalibrationKpiSection
              selectedAnio={selectedAnio}
              tipoVistaCalKpi={tipoVistaCalKpi}
              setTipoVistaCalKpi={setTipoVistaCalKpi}
              mesCalKpiSel={mesCalKpiSel}
              setMesCalKpiSel={setMesCalKpiSel}
              calKpiMes={calKpiMes}
              calAnualProg={calAnualProg}
              calAnualEnFecha={calAnualEnFecha}
              calAnualFueraFecha={calAnualFueraFecha}
              calAnualPendientes={calAnualPendientes}
              pctCalAnual={pctCalAnual}
              calAbiertasCount={calAbiertas.length}
              calConformesCount={calConformesCount}
              calNoConformesCount={calNoConformesCount}
              instrumentosActivosCount={instrumentosActivosPlan.length}
              calibracionesTotalesCount={calibracionesFiltradas.length}
              calEvolutionData={calEvolutionData}
            />
          )}
        </div>
      ) : (
        /* VISTA TÉCNICOS */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] bg-slate-50/50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                  Desempeño Operativo por Técnico (MC y OT)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                  Consolidado de órdenes correctivas y de trabajo asignadas frente a cerradas a tiempo.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {kpisTecnicos.length} Técnicos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 prodexus:bg-[#F3F6F8] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Técnico</th>
                    <th className="py-3 px-4">Especialidad</th>
                    <th className="py-3 px-4 text-center">Asignadas Total</th>
                    <th className="py-3 px-4 text-center">Pendientes</th>
                    <th className="py-3 px-4 text-center">A Tiempo</th>
                    <th className="py-3 px-4 text-center">Fuera Término</th>
                    <th className="py-3 px-4 text-right">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 prodexus:divide-[#E6EEF2]">
                  {kpisTecnicos.map(tec => (
                    <tr key={tec.codigo_tec} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                        {tec.codigo_tec}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                        {tec.nombre}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {tec.especialidad}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-800 dark:text-slate-200">
                        {tec.asignadas_total}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-amber-600 dark:text-amber-400">
                        {tec.pendientes}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C]">
                        {tec.a_tiempo}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-rose-600 dark:text-rose-400">
                        {tec.fuera_termino}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        <span className={tec.cumplimiento_pct >= 90 ? 'text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C]' : 'text-slate-800 dark:text-slate-200'}>
                          {tec.cumplimiento_pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {tienePlanCalibraciones && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] bg-slate-50/50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                    Desempeño Metrológico por Técnico (Calibraciones)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                    Consolidado de órdenes de calibración asignadas frente a cerradas conformes a tiempo.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {kpisMetrologos.length} Técnicos
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 prodexus:bg-[#F3F6F8] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                    <tr>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Técnico / Metrólogo</th>
                      <th className="py-3 px-4">Especialidad</th>
                      <th className="py-3 px-4 text-center">Asignadas Total</th>
                      <th className="py-3 px-4 text-center">Pendientes</th>
                      <th className="py-3 px-4 text-center">Conformes a Tiempo</th>
                      <th className="py-3 px-4 text-center">Fuera Término / NC</th>
                      <th className="py-3 px-4 text-right">Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 prodexus:divide-[#E6EEF2]">
                    {kpisMetrologos.map(tec => (
                      <tr key={`cal_${tec.codigo_tec}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                          {tec.codigo_tec}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                          {tec.nombre}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                          {tec.especialidad}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-800 dark:text-slate-200">
                          {tec.asignadas_total}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-amber-600 dark:text-amber-400">
                          {tec.pendientes}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C]">
                          {tec.a_tiempo}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-rose-600 dark:text-rose-400">
                          {tec.fuera_termino}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          <span className={tec.cumplimiento_pct >= 90 ? 'text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C]' : 'text-slate-800 dark:text-slate-200'}>
                            {tec.cumplimiento_pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Immediate Attention Queue */}
      {(correctivosAbiertos.length > 0 || otAbiertas.length > 0 || (tienePlanCalibraciones && calAbiertas.length > 0)) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                Órdenes en Espera de Cierre / Atención
              </h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {correctivosAbiertos.length + otAbiertas.length + (tienePlanCalibraciones ? calAbiertas.length : 0)} órdenes abiertas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {correctivosAbiertos.slice(0, 4).map(c => (
              <div
                key={c.id_ot}
                className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/25 text-xs flex justify-between items-start gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 font-mono font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px]">MC</span>
                    <span>{c.id_ot}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-300 font-sans font-normal">{c.codigo_eq}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 mt-1 line-clamp-1">{c.falla_reportada}</p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Compromiso: <span className="text-slate-600 dark:text-slate-300 font-medium">{c.fecha_tentativa}</span> · Asignado: {c.tecnico}
                  </p>
                </div>
              </div>
            ))}

            {otAbiertas.slice(0, 4).map(o => (
              <div
                key={o.id_ot}
                className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-800/70 prodexus:border-[#2F7CF6]/40 bg-blue-50/40 dark:bg-blue-950/25 prodexus:bg-[#EBF3FF]/60 text-xs flex justify-between items-start gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 font-mono font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 prodexus:bg-[#2F7CF6] text-blue-800 dark:text-blue-200 prodexus:text-white text-[10px]">OT</span>
                    <span>{o.id_ot}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-300 font-sans font-normal">{o.codigo_eq}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 mt-1 line-clamp-1">{o.trabajo_solicitado}</p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Entrega: <span className="text-slate-600 dark:text-slate-300 font-medium">{o.fecha_tentativa}</span> · Asignado: {o.tecnico}
                  </p>
                </div>
              </div>
            ))}

            {tienePlanCalibraciones && calAbiertas.slice(0, 4).map(cal => (
              <div
                key={cal.id_ot}
                className="p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-800/70 prodexus:border-[#2F7CF6]/40 bg-indigo-50/40 dark:bg-indigo-950/25 prodexus:bg-[#EBF3FF]/60 text-xs flex justify-between items-start gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 font-mono font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 prodexus:bg-[#2F7CF6] text-indigo-800 dark:text-indigo-200 prodexus:text-white text-[10px]">CAL</span>
                    <span>{cal.id_ot}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-300 font-sans font-normal">{cal.codigo_eq}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 mt-1 line-clamp-1">
                    {cal.instrumento_nombre} ({cal.rango_operacion})
                  </p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Programada: <span className="text-slate-600 dark:text-slate-300 font-medium">{cal.fecha_tentativa || cal.fecha_programada}</span> · Metrólogo: {cal.metrologo_laboratorio}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
