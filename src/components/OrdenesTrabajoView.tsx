/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ClipboardList,
  Printer,
  Search,
  Trash2,
  Share2,
  Smartphone
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { hasActionAccess } from '../utils/rbac';
import { formatFechaDDMMYYYY, parseFecha, tecnicoPerteneceAEmpresa } from '../utils/maintenanceEngine';
import { OrdenTrabajoOT } from '../types';
import { RepuestosConsumoSelector, SelectedRepuestoConsumo } from './RepuestosConsumoSelector';
import { PrintableDocument } from './PrintModal';
import { DigitalOrderTarget } from '../utils/digitalOrderLink';

interface OrdenesTrabajoViewProps {
  onPrintOrder?: (order: PrintableDocument) => void;
  onShareOrder?: (target: DigitalOrderTarget) => void;
  onOpenDigitalExecution?: (target: DigitalOrderTarget) => void;
}

export const OrdenesTrabajoView: React.FC<OrdenesTrabajoViewProps> = ({
  onPrintOrder,
  onShareOrder,
  onOpenDigitalExecution
}) => {
  const {
    selectedCliente,
    equipos,
    ordenesTrabajo,
    tecnicos,
    crearOrdenTrabajo,
    cerrarOrdenTrabajo,
    deleteOrdenTrabajo,
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

  // Form states for Emission
  const [selectedEquipoCode, setSelectedEquipoCode] = useState('');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0, 10));
  const [fechaTentativa, setFechaTentativa] = useState(new Date().toISOString().slice(0, 10));
  const [diasTolerancia, setDiasTolerancia] = useState(5);
  const [tecnicoAsignado, setTecnicoAsignado] = useState('');
  const [trabajoSolicitado, setTrabajoSolicitado] = useState('');
  const [prioridad, setPrioridad] = useState<'Urgente' | 'Alta' | 'Media' | 'Baja'>('Media');

  // Form states for Cierre
  const [selectedOTToClose, setSelectedOTToClose] = useState('');
  const [cierreFechaReal, setCierreFechaReal] = useState(new Date().toISOString().slice(0, 10));
  const [cierreTecnico, setCierreTecnico] = useState('');
  const [accionesRealizadas, setAccionesRealizadas] = useState('');
  const [materialesUtilizados, setMaterialesUtilizados] = useState('');
  const [stockConsumido, setStockConsumido] = useState<SelectedRepuestoConsumo[]>([]);

  const equiposCliente = selectedCliente === 'Todos'
    ? equipos
    : equipos.filter(e => e.cliente.trim() === selectedCliente.trim());

  const ordenesCliente = selectedCliente === 'Todos'
    ? ordenesTrabajo
    : ordenesTrabajo.filter(o => o.cliente.trim() === selectedCliente.trim());

  const pendientesList = ordenesCliente.filter(o => o.estado === 'Pendiente');
  const cerradosList = ordenesCliente.filter(o => o.estado.startsWith('Cerrada'));

  const handleEmitirSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trabajoSolicitado.trim()) {
      addToast('Describa el trabajo solicitado.', 'warning');
      return;
    }

    const eqObj = equipos.find(eq => eq.codigo_eq === selectedEquipoCode);
    const clienteName = eqObj?.cliente || (selectedCliente !== 'Todos' ? selectedCliente : 'Planta General');

    const dEmision = parseFecha(fechaEmision) || new Date();
    const dTent = parseFecha(fechaTentativa) || new Date();

    crearOrdenTrabajo({
      codigo_eq: selectedEquipoCode || 'PLANTA-GEN',
      cliente: clienteName,
      fecha_emision: formatFechaDDMMYYYY(dEmision),
      fecha_tentativa: formatFechaDDMMYYYY(dTent),
      dias_tolerancia: diasTolerancia,
      trabajo_solicitado: trabajoSolicitado,
      tecnico: tecnicoAsignado || 'Por asignar',
      prioridad
    });

    setTrabajoSolicitado('');
  };

  const handleCierreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOTToClose) {
      addToast('Seleccione la orden de trabajo a cerrar.', 'warning');
      return;
    }
    if (!accionesRealizadas.trim()) {
      addToast('Describa las acciones realizadas.', 'warning');
      return;
    }

    const dReal = parseFecha(cierreFechaReal) || new Date();
    const targetOT = pendientesList.find(p => p.id_ot === selectedOTToClose);

    const deductedLabels = stockConsumido.length > 0
      ? registrarSalidasStockBatch(
          stockConsumido.map(item => ({ repuesto_id: item.repuestoId, cantidad: item.cantidad })),
          {
            motivo: `Consumo en Orden de Trabajo ${selectedOTToClose}`,
            ot_asociada: selectedOTToClose,
            equipo_asociado: targetOT?.codigo_eq,
            solicitante: cierreTecnico || 'Responsable OT'
          }
        )
      : [];

    const materialesFinal = [...deductedLabels, materialesUtilizados.trim()].filter(Boolean).join(' | ');

    cerrarOrdenTrabajo(selectedOTToClose, {
      fecha_real: formatFechaDDMMYYYY(dReal),
      tecnico: cierreTecnico,
      acciones_realizadas: accionesRealizadas,
      materiales_utilizados: materialesFinal
    });

    setSelectedOTToClose('');
    setAccionesRealizadas('');
    setMaterialesUtilizados('');
    setStockConsumido([]);
    setActiveSubTab('historial');
  };

  const buildDigitalTargetOT = (o: OrdenTrabajoOT): DigitalOrderTarget => {
    const eq = equipos.find(e => e.codigo_eq === o.codigo_eq && e.cliente.trim() === o.cliente.trim())
      || equipos.find(e => e.codigo_eq === o.codigo_eq);
    return {
      tipo: 'OT',
      folio: o.id_ot,
      cliente: o.cliente,
      codigoEq: o.codigo_eq,
      nombreActivo: eq?.nombre || 'Instalaciones Generales de Planta',
      fechaProgramada: o.fecha_tentativa,
      tecnicoSugerido: o.tecnico,
      equipo: eq,
      ordenTrabajo: o
    };
  };

  const handlePrint = (o: OrdenTrabajoOT) => {
    if (!onPrintOrder) return;
    const eq = equipos.find(e => e.codigo_eq === o.codigo_eq && e.cliente.trim() === o.cliente.trim())
      || equipos.find(e => e.codigo_eq === o.codigo_eq)
      || {
        codigo_eq: o.codigo_eq,
        cliente: o.cliente,
        nombre: 'Instalaciones Generales de Planta',
        sistema: 'General',
        marca: 'N/A',
        modelo: 'N/A',
        frecuencia: 'N/A',
        tareas: '',
        tecnico: o.tecnico,
        fecha_proxima: ''
      };
    onPrintOrder({
      tipo: 'OT',
      folio: o.id_ot,
      equipo: eq,
      fechaEmision: o.fecha_emision,
      fechaTentativa: o.fecha_tentativa,
      diasTolerancia: o.dias_tolerancia,
      trabajo: o.trabajo_solicitado,
      tecnico: o.tecnico,
      isCerrada: o.estado !== 'Pendiente',
      fechaReal: o.fecha_real,
      accionesRealizadas: o.acciones_realizadas,
      repuestos: o.materiales_utilizados,
      firmaTecnico: o.firma_tecnico,
      firmaSupervisor: o.firma_supervisor,
      firmadoPor: o.firmado_por,
      firmadoSupervisorPor: o.firmado_supervisor_por,
      fechaFirmaDigital: o.fecha_firma_digital,
      fechaValidacionSupervisor: o.fecha_validacion_supervisor,
      observacionSupervisor: o.observacion_supervisor,
      ejecucionDigital: o.ejecucion_digital
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
            Órdenes de Trabajo (OT) - Mejoras & Proyectos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5">
            Gestión de nuevas instalaciones mecánicas/eléctricas, montajes y modificaciones de infraestructura.
          </p>
        </div>

        {/* Subtabs */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 prodexus:bg-[#E4ECF0] rounded-lg shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('emitir')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeSubTab === 'emitir'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Emitir Orden (OT)
          </button>
          <button
            onClick={() => setActiveSubTab('cierre')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeSubTab === 'cierre'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cierre de OT ({pendientesList.length})
          </button>
          <button
            onClick={() => setActiveSubTab('historial')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeSubTab === 'historial'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Historial ({cerradosList.length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1: Emitir OT */}
      {activeSubTab === 'emitir' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] uppercase tracking-wider">
              Nueva Orden de Trabajo (OT)
            </h2>

            <form onSubmit={handleEmitirSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Equipo o Ubicación de Planta
                </label>
                <select
                  value={selectedEquipoCode}
                  onChange={(e) => setSelectedEquipoCode(e.target.value)}
                  className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Toda la Planta / Ubicación General --</option>
                  {Array.from(new Map(equiposCliente.map(e => [e.codigo_eq, e])).values()).map(eq => (
                    <option key={eq.codigo_eq} value={eq.codigo_eq}>
                      {eq.codigo_eq} - {eq.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                    Fecha de Emisión *
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
                    Compromiso de Entrega *
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
                    Días Tolerancia
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
                    <option value="Urgente">Urgente</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Responsable Técnico
                </label>
                <select
                  value={tecnicoAsignado}
                  onChange={(e) => setTecnicoAsignado(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Por asignar / Cuadrilla de Proyectos --</option>
                  {(() => {
                    const eqSel = equiposCliente.find(e => e.codigo_eq === selectedEquipoCode);
                    const targetClienteOT = eqSel?.cliente || selectedCliente;
                    return tecnicos
                      .filter(t => t.estado === 'Activo' && tecnicoPerteneceAEmpresa(t, targetClienteOT))
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
                  Descripción del Trabajo Solicitado *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ej: Montaje de tuberías de acero, instalación de nuevo tablero de control, acondicionamiento de sala de compresores..."
                  value={trabajoSolicitado}
                  onChange={(e) => setTrabajoSolicitado(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {canEmit ? (
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
                >
                  Emitir Orden de Trabajo (OT)
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 text-[11px] font-medium text-center">
                  Sin permiso para emitir órdenes de trabajo.
                </div>
              )}
            </form>
          </div>

          {/* Pending List and Printable sheets */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] uppercase tracking-wider">
              Órdenes en Ejecución ({pendientesList.length})
            </h2>

            {pendientesList.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-8 text-center rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] text-slate-500 dark:text-slate-400 text-xs">
                No hay proyectos u órdenes de trabajo pendientes en esta planta.
              </div>
            ) : (
              <div className="space-y-3">
                {pendientesList.map(o => {
                  const eq = equipos.find(e => e.codigo_eq === o.codigo_eq);
                  return (
                    <div
                      key={o.id_ot}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800/70 prodexus:border-[#2F7CF6]/40 p-4 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300 prodexus:text-[#2F7CF6] bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#EBF3FF] px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/70">
                              {o.id_ot}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                              {eq?.nombre || o.codigo_eq}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Emisión: {o.fecha_emision} · Entrega estimada: <strong className="text-slate-800 dark:text-slate-200">{o.fecha_tentativa}</strong> (±{o.dias_tolerancia}d tol.)
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {onShareOrder && (
                            <button
                              type="button"
                              onClick={() => onShareOrder(buildDigitalTargetOT(o))}
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/70 rounded-md flex items-center gap-1"
                              title="Enviar enlace o WhatsApp al técnico"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Compartir</span>
                            </button>
                          )}
                          {onOpenDigitalExecution && (
                            <button
                              type="button"
                              onClick={() => onOpenDigitalExecution(buildDigitalTargetOT(o))}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 prodexus:text-[#2F7CF6] bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#EBF3FF] hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/70 rounded-md flex items-center gap-1"
                              title="Completar y firmar digitalmente"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Completar Digital</span>
                            </button>
                          )}
                          {canPrint && (
                            <button
                              type="button"
                              onClick={() => handlePrint(o)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md flex items-center gap-1"
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
                                  title: 'Eliminar Orden de Trabajo',
                                  message: `¿Está seguro de eliminar la orden de trabajo ${o.id_ot}?`,
                                  confirmText: 'Sí, Eliminar',
                                  tone: 'danger'
                                });
                                if (confirmed) {
                                  deleteOrdenTrabajo(o.id_ot);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 prodexus:bg-[#F3F6F8] p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 prodexus:border-[#D5E0E6]">
                        {o.trabajo_solicitado}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>Responsable: <strong className="text-slate-700 dark:text-slate-200">{o.tecnico}</strong></span>
                        <span className="text-[10px] font-mono font-semibold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]">EN PROGRESO</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: Cierre de OT */}
      {activeSubTab === 'cierre' && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
              Certificación y Cierre de Orden de Trabajo (OT)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
              Registre la fecha de entrega real y el detalle de materiales para auditar el cumplimiento del compromiso.
            </p>
          </div>

          {pendientesList.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
              No hay órdenes de trabajo pendientes de cierre.
            </div>
          ) : (
            <form onSubmit={handleCierreSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Seleccione Orden de Trabajo a Cerrar *
                </label>
                <select
                  value={selectedOTToClose}
                  onChange={(e) => {
                    const fol = e.target.value;
                    setSelectedOTToClose(fol);
                    const match = pendientesList.find(p => p.id_ot === fol);
                    if (match?.tecnico) setCierreTecnico(match.tecnico);
                  }}
                  required
                  className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Seleccionar Orden --</option>
                  {pendientesList.map(o => (
                    <option key={o.id_ot} value={o.id_ot}>
                      {o.id_ot} | {o.codigo_eq} | Entrega: {o.fecha_tentativa} | {o.trabajo_solicitado.slice(0, 35)}...
                    </option>
                  ))}
                </select>
              </div>

              {selectedOTToClose && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                        Fecha Real de Finalización *
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
                        Responsable / Supervisor *
                      </label>
                      <select
                        value={cierreTecnico}
                        onChange={(e) => setCierreTecnico(e.target.value)}
                        required
                        className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Seleccionar Responsable --</option>
                        {(() => {
                          const otSel = pendientesList.find(p => p.id_ot === selectedOTToClose);
                          const targetClienteOT = otSel?.cliente || selectedCliente;
                          const scoped = tecnicos.filter(
                            t => t.estado === 'Activo' && tecnicoPerteneceAEmpresa(t, targetClienteOT)
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
                    const selectedOT = pendientesList.find(p => p.id_ot === selectedOTToClose);
                    return (
                      <RepuestosConsumoSelector
                        clienteNombre={selectedOT?.cliente}
                        equipoCodigo={selectedOT?.codigo_eq}
                        selectedItems={stockConsumido}
                        onChangeItems={setStockConsumido}
                        manualText={materialesUtilizados}
                        onChangeManualText={setMaterialesUtilizados}
                        manualLabel="Materiales e Insumos Adicionales o No Registrados (Texto Libre)"
                        manualPlaceholder="Ej. Tubería acero 2 pulgadas, cables siliconados, soportería Unistrut..."
                      />
                    );
                  })()}

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                      Acciones Realizadas y Pruebas Operacionales *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Describa el montaje, conexiones, pruebas de presión, calibración y entrega conforme a operaciones..."
                      value={accionesRealizadas}
                      onChange={(e) => setAccionesRealizadas(e.target.value)}
                      className="w-full text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {canClose ? (
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 font-bold text-white bg-emerald-600 prodexus:bg-[#1FB85C] rounded-lg hover:bg-emerald-700 prodexus:hover:bg-[#199C4D] transition-colors shadow-xs"
                    >
                      Confirmar Finalización de OT
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 text-[11px] font-medium text-center">
                      Su perfil no tiene permiso para cerrar órdenes de trabajo.
                    </div>
                  )}
                </>
              )}
            </form>
          )}
        </div>
      )}

      {/* SUBTAB 3: Historial de OT */}
      {activeSubTab === 'historial' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por folio, ubicación o trabajo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 prodexus:bg-[#F3F6F8] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                <tr>
                  <th className="py-2.5 px-3">Folio OT</th>
                  <th className="py-2.5 px-3">Ubicación / Equipo</th>
                  <th className="py-2.5 px-3">Trabajo Realizado</th>
                  <th className="py-2.5 px-3 text-center">Emisión</th>
                  <th className="py-2.5 px-3 text-center">Entrega Real</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3">Materiales</th>
                  <th className="py-2.5 px-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 prodexus:divide-[#E6EEF2]">
                {cerradosList
                  .filter(o => {
                    if (!searchQuery) return true;
                    return o.id_ot.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      o.codigo_eq.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      o.trabajo_solicitado.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      o.acciones_realizadas.toLowerCase().includes(searchQuery.toLowerCase());
                  })
                  .map(row => (
                    <tr key={row.id_ot} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700 dark:text-blue-400 prodexus:text-[#2F7CF6]">
                        {row.id_ot}
                        {row.firma_tecnico && (
                          <span className="block text-[9.5px] font-sans font-semibold text-emerald-700 dark:text-emerald-400 prodexus:text-[#1FB85C]">
                            Firmada Digital
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                        {row.codigo_eq}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={row.trabajo_solicitado}>
                        {row.trabajo_solicitado}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                        {row.fecha_emision}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-emerald-700 dark:text-emerald-400 prodexus:text-[#1FB85C]">
                        {row.fecha_real}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.estado.includes('A tiempo')
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70'
                        }`}>
                          {row.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-200">
                        {row.tecnico}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={row.materiales_utilizados}>
                        {row.materiales_utilizados || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {canPrint && onPrintOrder && (
                          <button
                            type="button"
                            onClick={() => handlePrint(row)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded inline-flex items-center gap-1"
                            title="Imprimir / PDF Orden Cerrada"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
