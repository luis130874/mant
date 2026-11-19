/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Printer,
  Trash2,
  Share2,
  Smartphone
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { hasActionAccess } from '../utils/rbac';
import { formatFechaDDMMYYYY, parseFecha, tecnicoPerteneceAEmpresa } from '../utils/maintenanceEngine';
import { OrdenCorrectivo } from '../types';
import { RepuestosConsumoSelector, SelectedRepuestoConsumo } from './RepuestosConsumoSelector';
import { PrintableDocument } from './PrintModal';
import { DigitalOrderTarget } from '../utils/digitalOrderLink';
import { ModuleFilterBar } from './ui/ModuleFilterBar';
import { EmptyState } from './ui/EmptyState';

interface CorrectivosViewProps {
  onPrintOrder?: (order: PrintableDocument) => void;
  onShareOrder?: (target: DigitalOrderTarget) => void;
  onOpenDigitalExecution?: (target: DigitalOrderTarget) => void;
}

export const CorrectivosView: React.FC<CorrectivosViewProps> = ({
  onPrintOrder,
  onShareOrder,
  onOpenDigitalExecution
}) => {
  const {
    selectedCliente,
    equipos,
    correctivos,
    tecnicos,
    crearCorrectivo,
    cerrarCorrectivo,
    deleteCorrectivo,
    registrarSalidasStockBatch,
    confirmAction,
    addToast
  } = useMaintenance();
  const { userProfile } = useAuth();
  const canEmit = hasActionAccess(userProfile, 'emitir_ordenes');
  const canClose = hasActionAccess(userProfile, 'cerrar_ordenes');
  const canDelete = hasActionAccess(userProfile, 'eliminar');
  const canPrint = hasActionAccess(userProfile, 'imprimir_pdf');

  const [activeSubTab, setActiveSubTab] = useState<'emitir' | 'cierre' | 'historial'>('emitir');
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState<'todos' | 'pendientes' | 'vencidos' | 'cerrados'>('todos');

  // Form states for Emission
  const [selectedEquipoCode, setSelectedEquipoCode] = useState('');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0, 10));
  const [fechaTentativa, setFechaTentativa] = useState(new Date().toISOString().slice(0, 10));
  const [diasTolerancia, setDiasTolerancia] = useState(2);
  const [tecnicoAsignado, setTecnicoAsignado] = useState('');
  const [fallaReportada, setFallaReportada] = useState('');
  const [prioridad, setPrioridad] = useState<'Urgente' | 'Alta' | 'Media' | 'Baja'>('Alta');

  // Form states for Cierre
  const [selectedMCToClose, setSelectedMCToClose] = useState('');
  const [cierreFechaReal, setCierreFechaReal] = useState(new Date().toISOString().slice(0, 10));
  const [cierreTecnico, setCierreTecnico] = useState('');
  const [accionesRealizadas, setAccionesRealizadas] = useState('');
  const [repuestosUtilizados, setRepuestosUtilizados] = useState('');
  const [stockConsumido, setStockConsumido] = useState<SelectedRepuestoConsumo[]>([]);

  const equiposCliente = selectedCliente === 'Todos'
    ? equipos
    : equipos.filter(e => e.cliente.trim() === selectedCliente.trim());

  const correctivosCliente = selectedCliente === 'Todos'
    ? correctivos
    : correctivos.filter(c => c.cliente.trim() === selectedCliente.trim());

  const isCorrectivoVencido = (c: OrdenCorrectivo) => {
    if (c.estado !== 'Pendiente') return false;
    const dTent = parseFecha(c.fecha_tentativa);
    if (!dTent) return false;
    const limite = new Date(dTent.getFullYear(), dTent.getMonth(), dTent.getDate() + (c.dias_tolerancia || 0));
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy > limite;
  };

  const pendientesList = correctivosCliente.filter(c => c.estado === 'Pendiente');
  const vencidosList = pendientesList.filter(isCorrectivoVencido);
  const cerradosList = correctivosCliente.filter(c => c.estado.startsWith('Cerrada'));

  const filteredCorrectivosHistorial = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return correctivosCliente.filter(c => {
      if (listFilter === 'pendientes' && c.estado !== 'Pendiente') return false;
      if (listFilter === 'vencidos' && !isCorrectivoVencido(c)) return false;
      if (listFilter === 'cerrados' && !c.estado.startsWith('Cerrada')) return false;
      if (!q) return true;
      return (
        c.id_ot.toLowerCase().includes(q) ||
        c.codigo_eq.toLowerCase().includes(q) ||
        c.falla_reportada.toLowerCase().includes(q) ||
        (c.acciones_realizadas || '').toLowerCase().includes(q) ||
        (c.tecnico || '').toLowerCase().includes(q)
      );
    });
  }, [correctivosCliente, listFilter, searchQuery]);

  const handleEmitirSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipoCode) {
      addToast('Seleccione el equipo averiado.', 'warning');
      return;
    }
    if (!fallaReportada.trim()) {
      addToast('Describa la falla reportada.', 'warning');
      return;
    }

    const eqObj = equipos.find(eq => eq.codigo_eq === selectedEquipoCode);
    const clienteName = eqObj?.cliente || (selectedCliente !== 'Todos' ? selectedCliente : 'Planta General');

    const dEmision = parseFecha(fechaEmision) || new Date();
    const dTent = parseFecha(fechaTentativa) || new Date();

    crearCorrectivo({
      codigo_eq: selectedEquipoCode,
      cliente: clienteName,
      fecha_emision: formatFechaDDMMYYYY(dEmision),
      fecha_tentativa: formatFechaDDMMYYYY(dTent),
      dias_tolerancia: diasTolerancia,
      falla_reportada: fallaReportada,
      tecnico: tecnicoAsignado || 'Por asignar',
      prioridad
    });

    setFallaReportada('');
  };

  const handleCierreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMCToClose) {
      addToast('Seleccione la orden correctiva a cerrar.', 'warning');
      return;
    }
    if (!accionesRealizadas.trim()) {
      addToast('Describa las acciones realizadas.', 'warning');
      return;
    }

    const dReal = parseFecha(cierreFechaReal) || new Date();
    const targetMC = pendientesList.find(p => p.id_ot === selectedMCToClose);

    const deductedLabels = stockConsumido.length > 0
      ? registrarSalidasStockBatch(
          stockConsumido.map(item => ({ repuesto_id: item.repuestoId, cantidad: item.cantidad })),
          {
            motivo: `Consumo en Mantenimiento Correctivo ${selectedMCToClose}`,
            ot_asociada: selectedMCToClose,
            equipo_asociado: targetMC?.codigo_eq,
            solicitante: cierreTecnico || 'Técnico Correctivo'
          }
        )
      : [];

    const repuestosFinal = [...deductedLabels, repuestosUtilizados.trim()].filter(Boolean).join(' | ');

    cerrarCorrectivo(selectedMCToClose, {
      fecha_real: formatFechaDDMMYYYY(dReal),
      tecnico: cierreTecnico,
      acciones_realizadas: accionesRealizadas,
      repuestos_utilizados: repuestosFinal
    });

    setSelectedMCToClose('');
    setAccionesRealizadas('');
    setRepuestosUtilizados('');
    setStockConsumido([]);
    setActiveSubTab('historial');
  };

  const buildDigitalTargetMC = (c: OrdenCorrectivo): DigitalOrderTarget => {
    const eq = equipos.find(e => e.codigo_eq === c.codigo_eq && e.cliente.trim() === c.cliente.trim())
      || equipos.find(e => e.codigo_eq === c.codigo_eq);
    return {
      tipo: 'MC',
      folio: c.id_ot,
      cliente: c.cliente,
      codigoEq: c.codigo_eq,
      nombreActivo: eq?.nombre || c.codigo_eq,
      fechaProgramada: c.fecha_tentativa,
      tecnicoSugerido: c.tecnico,
      equipo: eq,
      correctivo: c
    };
  };

  const handlePrint = (c: OrdenCorrectivo) => {
    if (!onPrintOrder) return;
    const eq = equipos.find(e => e.codigo_eq === c.codigo_eq && e.cliente.trim() === c.cliente.trim())
      || equipos.find(e => e.codigo_eq === c.codigo_eq)
      || {
        codigo_eq: c.codigo_eq,
        cliente: c.cliente,
        nombre: c.codigo_eq,
        sistema: 'General',
        marca: 'N/A',
        modelo: 'N/A',
        frecuencia: 'Correctivo',
        tareas: '',
        tecnico: c.tecnico,
        fecha_proxima: ''
      };
    onPrintOrder({
      tipo: 'MC',
      folio: c.id_ot,
      equipo: eq,
      fechaEmision: c.fecha_emision,
      fechaTentativa: c.fecha_tentativa,
      diasTolerancia: c.dias_tolerancia,
      falla: c.falla_reportada,
      tecnico: c.tecnico,
      isCerrada: c.estado !== 'Pendiente',
      fechaReal: c.fecha_real,
      accionesRealizadas: c.acciones_realizadas,
      repuestos: c.repuestos_utilizados,
      firmaTecnico: c.firma_tecnico,
      firmaSupervisor: c.firma_supervisor,
      firmadoPor: c.firmado_por,
      firmadoSupervisorPor: c.firmado_supervisor_por,
      fechaFirmaDigital: c.fecha_firma_digital,
      fechaValidacionSupervisor: c.fecha_validacion_supervisor,
      observacionSupervisor: c.observacion_supervisor,
      ejecucionDigital: c.ejecucion_digital
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            Mantenimiento Correctivo (Averías & Reparaciones)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5">
            Emisión de órdenes MC con fecha de compromiso, tolerancia de atraso y cálculo automático de efectividad.
          </p>
        </div>

        {/* Subtabs */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 prodexus:bg-[#E4ECF0] rounded-lg shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('emitir')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeSubTab === 'emitir'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white prodexus:hover:text-[#132B36]'
            }`}
          >
            Emitir Avería / Orden MC
          </button>
          <button
            onClick={() => setActiveSubTab('cierre')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeSubTab === 'cierre'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white prodexus:hover:text-[#132B36]'
            }`}
          >
            Cierre de Correctivos ({pendientesList.length})
          </button>
          <button
            onClick={() => {
              setActiveSubTab('historial');
              setListFilter('todos');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all tabular-nums ${
              activeSubTab === 'historial'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white prodexus:hover:text-[#132B36]'
            }`}
          >
            Historial ({cerradosList.length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1: Emitir Avería */}
      {activeSubTab === 'emitir' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] uppercase tracking-wider">
              Nueva Falla Reportada (MC)
            </h2>

            <form onSubmit={handleEmitirSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Equipo Afectado *
                </label>
                <select
                  value={selectedEquipoCode}
                  onChange={(e) => setSelectedEquipoCode(e.target.value)}
                  required
                  className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6] focus:outline-none"
                >
                  <option value="">-- Seleccionar Equipo --</option>
                  {Array.from(new Map(equiposCliente.map(e => [e.codigo_eq, e])).values()).map(eq => (
                    <option key={eq.codigo_eq} value={eq.codigo_eq}>
                      {eq.codigo_eq} - {eq.nombre} ({eq.sistema})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                    Fecha de Reporte *
                  </label>
                  <input
                    type="date"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    required
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                    Fecha Compromiso *
                  </label>
                  <input
                    type="date"
                    value={fechaTentativa}
                    onChange={(e) => setFechaTentativa(e.target.value)}
                    required
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                    Tolerancia (Días)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={diasTolerancia}
                    onChange={(e) => setDiasTolerancia(Number(e.target.value))}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                    Prioridad
                  </label>
                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as 'Urgente' | 'Alta' | 'Media' | 'Baja')}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Urgente">Urgente (Parada de línea)</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Técnico Asignado (Preliminar)
                </label>
                <select
                  value={tecnicoAsignado}
                  onChange={(e) => setTecnicoAsignado(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Por asignar / Cuadrilla de turno --</option>
                  {(() => {
                    const eqSel = equiposCliente.find(e => e.codigo_eq === selectedEquipoCode);
                    const targetClienteMC = eqSel?.cliente || selectedCliente;
                    return tecnicos
                      .filter(t => t.estado === 'Activo' && tecnicoPerteneceAEmpresa(t, targetClienteMC))
                      .map(t => (
                        <option key={t.codigo_tec} value={t.nombre}>
                          {t.nombre} ({t.especialidad})
                        </option>
                      ));
                  })()}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Descripción de la Falla y Síntomas Observados *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describa síntomas: ruidos, fuga de fluidos, temperatura elevada, código de alarma en panel, etc."
                  value={fallaReportada}
                  onChange={(e) => setFallaReportada(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {canEmit ? (
                <button
                  type="submit"
                  className="w-full min-h-[44px] py-2.5 px-4 font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors shadow-xs whitespace-nowrap"
                >
                  Emitir Orden Correctiva (MC)
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300 text-[11px] font-medium text-center">
                  Sin permiso para emitir nuevas órdenes correctivas.
                </div>
              )}
            </form>
          </div>

          {/* Pending List and Printable sheets */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] uppercase tracking-wider tabular-nums">
                Órdenes Correctivas en Curso ({pendientesList.length})
              </h2>
            </div>

            {pendientesList.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="Sin averías pendientes"
                description="No hay órdenes correctivas pendientes en curso. Todos los equipos reportados se encuentran operativos."
                secondaryLabel={cerradosList.length > 0 ? `Ver historial (${cerradosList.length})` : undefined}
                onSecondaryAction={
                  cerradosList.length > 0
                    ? () => {
                        setListFilter('cerrados');
                        setActiveSubTab('historial');
                      }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {pendientesList.map(c => {
                  const eq = equipos.find(e => e.codigo_eq === c.codigo_eq);
                  const vencida = isCorrectivoVencido(c);
                  return (
                    <div
                      key={c.id_ot}
                      className={`bg-white dark:bg-slate-900 rounded-xl border p-4 space-y-2.5 shadow-xs ${
                        vencida
                          ? 'border-rose-300 dark:border-rose-800/80'
                          : 'border-amber-200 dark:border-amber-800/70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/70">
                              {c.id_ot}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                              {eq?.nombre || c.codigo_eq}
                            </span>
                            {vencida && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                Vencida
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                            Reportada: <span className="font-mono">{c.fecha_emision}</span> · Compromiso: <strong className="font-mono text-slate-800 dark:text-slate-200">{c.fecha_tentativa}</strong> (±{c.dias_tolerancia}d tol.)
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                          {onShareOrder && (
                            <button
                              type="button"
                              onClick={() => onShareOrder(buildDigitalTargetMC(c))}
                              className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 text-xs sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/70 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                              title="Enviar enlace o WhatsApp al técnico"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Compartir</span>
                            </button>
                          )}
                          {onOpenDigitalExecution && (
                            <button
                              type="button"
                              onClick={() => onOpenDigitalExecution(buildDigitalTargetMC(c))}
                              className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 text-xs sm:text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/70 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                              title="Completar y firmar digitalmente"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Completar Digital</span>
                            </button>
                          )}
                          {canPrint && (
                            <button
                              type="button"
                              onClick={() => handlePrint(c)}
                              className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 text-xs sm:text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                              title="Imprimir Orden en papel / PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Imprimir</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={async () => {
                                const confirmed = await confirmAction({
                                  title: 'Eliminar Orden Correctiva',
                                  message: `¿Está seguro de eliminar la orden correctiva ${c.id_ot}?`,
                                  confirmText: 'Sí, Eliminar',
                                  tone: 'danger'
                                });
                                if (confirmed) {
                                  deleteCorrectivo(c.id_ot);
                                }
                              }}
                              className="min-h-[44px] min-w-[44px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Eliminar"
                              aria-label={`Eliminar orden ${c.id_ot}`}
                            >
                              <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 prodexus:border-[#E2ECF1]">
                        {c.falla_reportada}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>Técnico: <strong className="text-slate-700 dark:text-slate-200">{c.tecnico}</strong></span>
                        <span className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400">EN ATENCIÓN</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: Cierre de Correctivos */}
      {activeSubTab === 'cierre' && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
              Cierre y Certificación de Reparación (MC)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
              El sistema evalúa automáticamente si la reparación se completó a tiempo según la tolerancia.
            </p>
          </div>

          {pendientesList.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              No hay órdenes correctivas pendientes de cierre.
            </div>
          ) : (
            <form onSubmit={handleCierreSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Seleccione Orden Correctiva Pendiente *
                </label>
                <select
                  value={selectedMCToClose}
                  onChange={(e) => {
                    const fol = e.target.value;
                    setSelectedMCToClose(fol);
                    const match = pendientesList.find(p => p.id_ot === fol);
                    if (match?.tecnico) setCierreTecnico(match.tecnico);
                  }}
                  required
                  className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Seleccionar Orden --</option>
                  {pendientesList.map(c => (
                    <option key={c.id_ot} value={c.id_ot}>
                      {c.id_ot} | {c.codigo_eq} | Compromiso: {c.fecha_tentativa} | {c.falla_reportada.slice(0, 35)}...
                    </option>
                  ))}
                </select>
              </div>

              {selectedMCToClose && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                        Fecha Real de Reparación *
                      </label>
                      <input
                        type="date"
                        value={cierreFechaReal}
                        onChange={(e) => setCierreFechaReal(e.target.value)}
                        required
                        className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                        Técnico / Responsable *
                      </label>
                      <select
                        value={cierreTecnico}
                        onChange={(e) => setCierreTecnico(e.target.value)}
                        required
                        className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Seleccionar Técnico --</option>
                        {(() => {
                          const mcSel = pendientesList.find(p => p.id_ot === selectedMCToClose);
                          const targetClienteMC = mcSel?.cliente || selectedCliente;
                          const scoped = tecnicos.filter(
                            t => t.estado === 'Activo' && tecnicoPerteneceAEmpresa(t, targetClienteMC)
                          );
                          const hasSaved = cierreTecnico && scoped.some(t => t.nombre === cierreTecnico);
                          return (
                            <>
                              {cierreTecnico && !hasSaved && (
                                <option value={cierreTecnico}>{cierreTecnico}</option>
                              )}
                              {scoped.map(t => (
                                <option key={t.codigo_tec} value={t.nombre}>
                                  {t.nombre} ({t.especialidad})
                                </option>
                              ))}
                            </>
                          );
                        })()}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const selectedMC = pendientesList.find(p => p.id_ot === selectedMCToClose);
                    return (
                      <RepuestosConsumoSelector
                        clienteNombre={selectedMC?.cliente}
                        equipoCodigo={selectedMC?.codigo_eq}
                        selectedItems={stockConsumido}
                        onChangeItems={setStockConsumido}
                        manualText={repuestosUtilizados}
                        onChangeManualText={setRepuestosUtilizados}
                        manualLabel="Repuestos y Materiales Adicionales o No Registrados (Texto Libre)"
                        manualPlaceholder="Ej. Kit empaquetaduras, rodamiento externo, aceite ISO VG 46..."
                      />
                    );
                  })()}

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                      Acciones Realizadas y Pruebas Operativas de Arranque *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Describa el trabajo de desarme, calibración, componentes cambiados y parámetros finales de prueba..."
                      value={accionesRealizadas}
                      onChange={(e) => setAccionesRealizadas(e.target.value)}
                      className="w-full text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {canClose ? (
                    <button
                      type="submit"
                      className="w-full min-h-[44px] py-2.5 px-4 font-bold text-white bg-emerald-600 prodexus:bg-[#1FB85C] rounded-lg hover:bg-emerald-700 prodexus:hover:bg-[#189A4C] transition-colors shadow-xs"
                    >
                      Confirmar Cierre de Avería
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300 text-[11px] font-medium text-center">
                      Su perfil no tiene permiso para cerrar órdenes correctivas.
                    </div>
                  )}
                </>
              )}
            </form>
          )}
        </div>
      )}

      {/* SUBTAB 3: Historial y Listado General de Correctivos */}
      {activeSubTab === 'historial' && (
        <div className="space-y-4">
          <ModuleFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Buscar por folio, equipo, falla o técnico..."
            activeStatus={listFilter}
            onStatusChange={(key) => setListFilter(key as 'todos' | 'pendientes' | 'vencidos' | 'cerrados')}
            statusOptions={[
              { key: 'todos', label: 'Todos', count: correctivosCliente.length, tone: 'neutral' },
              { key: 'pendientes', label: 'Pendientes', count: pendientesList.length, tone: 'amber' },
              { key: 'vencidos', label: 'Vencidos', count: vencidosList.length, tone: 'rose' },
              { key: 'cerrados', label: 'Cerrados', count: cerradosList.length, tone: 'emerald' }
            ]}
            totalVisible={filteredCorrectivosHistorial.length}
            totalLabel="órdenes"
          />

          <div className="cmms-table-wrap">
            {filteredCorrectivosHistorial.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={AlertTriangle}
                  title="Sin órdenes correctivas para mostrar"
                  description={
                    searchQuery || listFilter !== 'todos'
                      ? 'No se encontraron registros que coincidan con el filtro o búsqueda aplicada.'
                      : 'Aún no existen órdenes correctivas registradas para esta planta.'
                  }
                  actionLabel={canEmit && correctivosCliente.length === 0 ? 'Emitir Primera Orden MC' : undefined}
                  onAction={canEmit && correctivosCliente.length === 0 ? () => setActiveSubTab('emitir') : undefined}
                  secondaryLabel={searchQuery || listFilter !== 'todos' ? 'Ver todas' : undefined}
                  onSecondaryAction={
                    searchQuery || listFilter !== 'todos'
                      ? () => {
                          setSearchQuery('');
                          setListFilter('todos');
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[65vh]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="cmms-th py-3 px-3">Folio MC</th>
                      <th className="cmms-th py-3 px-3">Equipo</th>
                      <th className="cmms-th py-3 px-3">Falla Reportada</th>
                      <th className="cmms-th py-3 px-3 text-center">Emisión</th>
                      <th className="cmms-th py-3 px-3 text-center">Fecha Real</th>
                      <th className="cmms-th py-3 px-3 text-center">Estado</th>
                      <th className="cmms-th py-3 px-3">Técnico</th>
                      <th className="cmms-th py-3 px-3">Acciones Realizadas</th>
                      <th className="cmms-th py-3 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCorrectivosHistorial.map(row => {
                      const vencida = isCorrectivoVencido(row);
                      const isPend = row.estado === 'Pendiente';
                      return (
                        <tr key={row.id_ot} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="cmms-td py-2.5 px-3 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                            {row.id_ot}
                            {row.firma_tecnico && (
                              <span className="block text-[10px] font-sans font-semibold text-emerald-700 dark:text-emerald-400">
                                Firmada Digital
                              </span>
                            )}
                          </td>
                          <td className="cmms-td py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] whitespace-nowrap">
                            {row.codigo_eq}
                          </td>
                          <td className="cmms-td py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={row.falla_reportada}>
                            {row.falla_reportada}
                          </td>
                          <td className="cmms-td py-2.5 px-3 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {row.fecha_emision}
                          </td>
                          <td className="cmms-td py-2.5 px-3 text-center font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {row.fecha_real || '—'}
                          </td>
                          <td className="cmms-td py-2.5 px-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              vencida
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
                                : isPend
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
                                : row.estado.includes('A tiempo')
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                vencida ? 'bg-rose-500' : isPend ? 'bg-amber-500' : row.estado.includes('A tiempo') ? 'bg-emerald-500' : 'bg-amber-500'
                              }`} />
                              {vencida ? 'Vencida' : row.estado}
                            </span>
                          </td>
                          <td className="cmms-td py-2.5 px-3 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {row.tecnico}
                          </td>
                          <td className="cmms-td py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={row.acciones_realizadas}>
                            {row.acciones_realizadas || '—'}
                          </td>
                          <td className="cmms-td py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {onOpenDigitalExecution && (
                                <button
                                  type="button"
                                  onClick={() => onOpenDigitalExecution(buildDigitalTargetMC(row))}
                                  className="min-h-[36px] px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 border border-blue-200 dark:border-blue-800/70 rounded-md inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                                  title="Abrir ejecución / detalle digital"
                                >
                                  <Smartphone className="w-3.5 h-3.5" />
                                  <span>{isPend ? 'Digital' : 'Ver'}</span>
                                </button>
                              )}
                              {canPrint && onPrintOrder && (
                                <button
                                  type="button"
                                  onClick={() => handlePrint(row)}
                                  className="min-h-[36px] px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                                  title="Imprimir / PDF Orden"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>PDF</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
