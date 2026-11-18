/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  X,
  AlertTriangle,
  FileCheck2,
  ClipboardList,
  Plus,
  Compass,
  Send
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { formatFechaDDMMYYYY, parseFecha, tecnicoPerteneceAEmpresa } from '../utils/maintenanceEngine';
import { DigitalOrderTarget } from '../utils/digitalOrderLink';
import {
  MAGNITUDES_SENSOR,
  TEST_POINT_PRESETS,
  findMagnitudeByName,
  formatRangoOperacion,
  generarPuntosCalibracion,
  inferMagnitudeFromVariable,
  parseRangoMedicion
} from '../utils/calibrationMetrology';
import { OrdenCalibracion, OrdenCorrectivo, OrdenTrabajoOT } from '../types';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShareOrder?: (target: DigitalOrderTarget) => void;
  onOpenDigitalExecution?: (target: DigitalOrderTarget) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onShareOrder,
  onOpenDigitalExecution
}) => {
  const {
    selectedCliente,
    clientes,
    equipos,
    instrumentos,
    tecnicos,
    crearCorrectivo,
    crearOrdenTrabajo,
    registrarCierrePreventivo,
    crearOrdenCalibracion,
    addToast
  } = useMaintenance();

  const [tipo, setTipo] = useState<'MC' | 'OT' | 'MP' | 'CAL'>('MC');
  const [equipoCode, setEquipoCode] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaTentativa, setFechaTentativa] = useState(new Date().toISOString().slice(0, 10));
  const [diasTolerancia, setDiasTolerancia] = useState(2);
  const [tecnico, setTecnico] = useState('');

  // Calibration metrology fields
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [calInstrumentoNombre, setCalInstrumentoNombre] = useState('');
  const [calMagnitud, setCalMagnitud] = useState(MAGNITUDES_SENSOR[0].nombre);
  const [calUnidad, setCalUnidad] = useState(MAGNITUDES_SENSOR[0].defaultUnit);
  const [calRangoMin, setCalRangoMin] = useState<number>(MAGNITUDES_SENSOR[0].defaultMin);
  const [calRangoMax, setCalRangoMax] = useState<number>(MAGNITUDES_SENSOR[0].defaultMax);
  const [calNumPuntos, setCalNumPuntos] = useState<number>(5);
  const [calIncluirBajada, setCalIncluirBajada] = useState<boolean>(false);
  const [calEmp, setCalEmp] = useState<string>(MAGNITUDES_SENSOR[0].defaultEmp);
  const [calPatron, setCalPatron] = useState<string>(MAGNITUDES_SENSOR[0].patronSugerido);
  const [calFrecuencia, setCalFrecuencia] = useState<string>('Semestral');

  const activeMagnitude = useMemo(
    () => findMagnitudeByName(calMagnitud) || inferMagnitudeFromVariable(calMagnitud, calUnidad),
    [calMagnitud, calUnidad]
  );

  const puntosPreview = useMemo(
    () =>
      generarPuntosCalibracion({
        min: Number.isFinite(calRangoMin) ? calRangoMin : 0,
        max: Number.isFinite(calRangoMax) && calRangoMax !== calRangoMin ? calRangoMax : (calRangoMin || 0) + 100,
        unit: calUnidad,
        numPuntos: calIncluirBajada ? 5 : calNumPuntos,
        incluirBajada: calIncluirBajada,
        emptyReadings: false
      }),
    [calRangoMin, calRangoMax, calUnidad, calNumPuntos, calIncluirBajada]
  );

  if (!isOpen) return null;

  const equiposDisponibles =
    selectedCliente === 'Todos'
      ? equipos
      : equipos.filter((e) => e.cliente.trim() === selectedCliente.trim());

  const instrumentosDisponibles = (
    selectedCliente === 'Todos'
      ? instrumentos
      : instrumentos.filter((i) => i.cliente.trim() === selectedCliente.trim())
  ).filter((i) => i.estado === 'Activo');

  const resetForm = () => {
    setDescripcion('');
    setSelectedInstrumentId('');
    setCalInstrumentoNombre('');
    setEquipoCode('');
    setTecnico('');
  };

  const handleCloseModal = () => {
    resetForm();
    onClose();
  };

  const handleSelectMagnitude = (magNombre: string) => {
    setCalMagnitud(magNombre);
    const mag = findMagnitudeByName(magNombre);
    if (mag) {
      setCalUnidad(mag.defaultUnit);
      setCalRangoMin(mag.defaultMin);
      setCalRangoMax(mag.defaultMax);
      setCalEmp(mag.defaultEmp);
      setCalPatron(mag.patronSugerido);
    }
  };

  const handleSelectInstrumento = (instKey: string) => {
    setSelectedInstrumentId(instKey);
    const inst = instrumentosDisponibles.find(
      (i) => `${i.cliente}___${i.codigo_inst}` === instKey
    );
    if (!inst) return;
    if (inst.equipo_asociado) setEquipoCode(inst.equipo_asociado);
    setCalInstrumentoNombre(inst.nombre);
    const mag =
      findMagnitudeByName(inst.magnitud) ||
      inferMagnitudeFromVariable(inst.variable_medicion, inst.unidad_medida || inst.rango_operacion);
    const parsedRange = parseRangoMedicion(inst.rango_operacion, inst.variable_medicion, inst.unidad_medida);
    setCalMagnitud(inst.magnitud || mag.nombre);
    setCalUnidad(inst.unidad_medida || parsedRange.unit || mag.defaultUnit);
    setCalRangoMin(typeof inst.rango_min === 'number' ? inst.rango_min : parsedRange.min);
    setCalRangoMax(typeof inst.rango_max === 'number' ? inst.rango_max : parsedRange.max);
    const ptsCount = inst.puntos_prueba || 5;
    setCalIncluirBajada(ptsCount === 9);
    setCalNumPuntos(ptsCount === 9 ? 5 : ptsCount);
    setCalEmp(inst.tolerancia_emp || mag.defaultEmp);
    setCalPatron(inst.patron_habitual || mag.patronSugerido);
    if (inst.frecuencia) setCalFrecuencia(inst.frecuencia);
    if (inst.metrologo_habitual && !tecnico) setTecnico(inst.metrologo_habitual);
  };

  const createOrderAndMaybeDispatch = (dispatchMode: 'none' | 'share' | 'execute') => {
    const instObj = instrumentosDisponibles.find(
      (i) => `${i.cliente}___${i.codigo_inst}` === selectedInstrumentId
    );
    const eqObj = equipos.find((e) => e.codigo_eq === equipoCode);

    if (tipo !== 'CAL' && !descripcion.trim()) {
      addToast('Por favor ingrese la descripción de la orden.', 'warning');
      return;
    }

    if (tipo === 'CAL' && !calInstrumentoNombre.trim() && !descripcion.trim() && !eqObj && !instObj) {
      addToast('Ingrese el nombre del instrumento o seleccione un sensor/equipo.', 'warning');
      return;
    }

    if (tipo === 'CAL' && (!Number.isFinite(calRangoMin) || !Number.isFinite(calRangoMax) || calRangoMin === calRangoMax)) {
      addToast('El rango mínimo y máximo de calibración deben ser valores numéricos distintos.', 'warning');
      return;
    }

    const clienteName =
      instObj?.cliente ||
      eqObj?.cliente ||
      (selectedCliente !== 'Todos' ? selectedCliente : clientes[0]?.nombre || 'Planta');
    const hoyStr = formatFechaDDMMYYYY(new Date());
    const tentDate = parseFecha(fechaTentativa) || new Date();
    const tentStr = formatFechaDDMMYYYY(tentDate);

    if (tipo === 'MC') {
      const code = equipoCode || equiposDisponibles[0]?.codigo_eq || 'EQ-01';
      const folio = crearCorrectivo({
        codigo_eq: code,
        cliente: clienteName,
        fecha_emision: hoyStr,
        fecha_tentativa: tentStr,
        dias_tolerancia: diasTolerancia,
        falla_reportada: descripcion,
        tecnico: tecnico || 'Por Cuadrilla'
      });
      if (dispatchMode !== 'none') {
        const mcObj: OrdenCorrectivo = {
          id_ot: folio,
          codigo_eq: code,
          cliente: clienteName,
          fecha_emision: hoyStr,
          fecha_tentativa: tentStr,
          dias_tolerancia: diasTolerancia,
          falla_reportada: descripcion,
          estado: 'Pendiente',
          fecha_real: '',
          tecnico: tecnico || 'Por Cuadrilla',
          acciones_realizadas: ''
        };
        const target: DigitalOrderTarget = {
          tipo: 'MC',
          folio,
          cliente: clienteName,
          codigoEq: code,
          nombreActivo: eqObj?.nombre || code,
          fechaProgramada: tentStr,
          anio: tentDate.getFullYear(),
          tecnicoSugerido: tecnico || 'Por Cuadrilla',
          equipo: eqObj,
          correctivo: mcObj
        };
        onClose();
        if (dispatchMode === 'share') onShareOrder?.(target);
        else onOpenDigitalExecution?.(target);
        return;
      }
    } else if (tipo === 'OT') {
      const code = equipoCode || 'PLANTA-GEN';
      const folio = crearOrdenTrabajo({
        codigo_eq: code,
        cliente: clienteName,
        fecha_emision: hoyStr,
        fecha_tentativa: tentStr,
        dias_tolerancia: diasTolerancia,
        trabajo_solicitado: descripcion,
        tecnico: tecnico || 'Por Cuadrilla'
      });
      if (dispatchMode !== 'none') {
        const otObj: OrdenTrabajoOT = {
          id_ot: folio,
          codigo_eq: code,
          cliente: clienteName,
          fecha_emision: hoyStr,
          fecha_tentativa: tentStr,
          dias_tolerancia: diasTolerancia,
          trabajo_solicitado: descripcion,
          estado: 'Pendiente',
          fecha_real: '',
          tecnico: tecnico || 'Por Cuadrilla',
          acciones_realizadas: ''
        };
        const target: DigitalOrderTarget = {
          tipo: 'OT',
          folio,
          cliente: clienteName,
          codigoEq: code,
          nombreActivo: eqObj?.nombre || 'Planta / Infraestructura',
          fechaProgramada: tentStr,
          anio: tentDate.getFullYear(),
          tecnicoSugerido: tecnico || 'Por Cuadrilla',
          equipo: eqObj,
          ordenTrabajo: otObj
        };
        onClose();
        if (dispatchMode === 'share') onShareOrder?.(target);
        else onOpenDigitalExecution?.(target);
        return;
      }
    } else if (tipo === 'MP') {
      const mesActual = new Date().getMonth() + 1;
      const anioActual = new Date().getFullYear();
      const folioGen = `MP-${anioActual}-${String(mesActual).padStart(2, '0')}-MANUAL`;
      registrarCierrePreventivo({
        codigo_eq: equipoCode || equiposDisponibles[0]?.codigo_eq || 'EQ-01',
        mes_n: mesActual,
        fecha_real: hoyStr,
        id_ot: folioGen,
        comentarios: descripcion,
        tecnico: tecnico || 'Técnico de Turno',
        duracion_horas: 2.0
      });
    } else if (tipo === 'CAL') {
      const code = instObj?.codigo_inst || equipoCode || equiposDisponibles[0]?.codigo_eq || 'INST-01';
      const instName =
        calInstrumentoNombre.trim() ||
        instObj?.nombre ||
        (eqObj ? `Sensor / Instrumento de ${eqObj.nombre}` : descripcion.trim());
      const rangoTexto = formatRangoOperacion(calRangoMin, calRangoMax, calUnidad);
      const ptsCount = calIncluirBajada ? 9 : calNumPuntos;
      const obs =
        descripcion.trim() ||
        `Calibración de ${instName} (${calMagnitud} | ${rangoTexto})`;
      const calPayload = {
        codigo_eq: code,
        cliente: clienteName,
        instrumento_nombre: instName,
        magnitud: calMagnitud,
        unidad_medida: calUnidad,
        rango_min: calRangoMin,
        rango_max: calRangoMax,
        puntos_prueba: ptsCount,
        variable_medicion: `${calMagnitud} (${calUnidad})`,
        rango_operacion: rangoTexto,
        tolerancia_emp: calEmp.trim() || '± 0.5% FS',
        patron_utilizado: calPatron.trim() || activeMagnitude.patronSugerido,
        frecuencia_calibracion: calFrecuencia,
        fecha_emision: hoyStr,
        fecha_programada: tentStr,
        fecha_tentativa: tentStr,
        dias_tolerancia: diasTolerancia,
        metrologo_laboratorio: tecnico || 'Metrología Interna',
        puntos_calibracion: puntosPreview,
        observaciones: obs
      };
      const folio = crearOrdenCalibracion(calPayload);

      if (dispatchMode !== 'none') {
        const calObj: OrdenCalibracion = {
          ...calPayload,
          id_ot: folio,
          estado: 'Pendiente',
          fecha_real: ''
        };
        const target: DigitalOrderTarget = {
          tipo: 'CAL',
          folio,
          cliente: clienteName,
          codigoEq: code,
          nombreActivo: instName,
          fechaProgramada: tentStr,
          mes_n: tentDate.getMonth() + 1,
          anio: tentDate.getFullYear(),
          frecuencia: calFrecuencia,
          tecnicoSugerido: tecnico || 'Metrología Interna',
          equipo: eqObj,
          calibracion: calObj
        };
        handleCloseModal();
        if (dispatchMode === 'share') onShareOrder?.(target);
        else onOpenDigitalExecution?.(target);
        return;
      }
    }

    handleCloseModal();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderAndMaybeDispatch('none');
  };

  const unitOptions = Array.from(
    new Set([...(activeMagnitude?.unidades || ['%']), ...(calUnidad ? [calUnidad] : [])])
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto ${
          tipo === 'CAL' ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
            Nueva Orden de Mantenimiento & Metrología
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Selector */}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => {
              setTipo('MC');
              setDiasTolerancia(2);
            }}
            className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
              tipo === 'MC'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Correctivo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTipo('CAL');
              setDiasTolerancia(7);
            }}
            className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
              tipo === 'CAL'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Calibración</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTipo('OT');
              setDiasTolerancia(5);
            }}
            className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
              tipo === 'OT'
                ? 'border-blue-500 prodexus:border-[#2F7CF6] bg-blue-50 dark:bg-blue-950/50 prodexus:bg-[#EBF3FF] text-blue-900 dark:text-blue-200 prodexus:text-[#132B36] shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
            <span>Trabajo/OT</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTipo('MP');
              setDiasTolerancia(0);
            }}
            className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
              tipo === 'MP'
                ? 'border-emerald-500 prodexus:border-[#1FB85C] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C]" />
            <span>Preventivo</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {tipo === 'CAL' && (
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 prodexus:bg-[#EBF3FF]/60 border border-indigo-200 dark:border-indigo-800/60 prodexus:border-[#C5D5DE] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-indigo-900 dark:text-indigo-200 prodexus:text-[#132B36] flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Configuración Metrológica del Sensor
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {puntosPreview.length} puntos auto-generados
                </span>
              </div>

              {instrumentosDisponibles.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Instrumento Registrado (Opcional)
                  </label>
                  <select
                    value={selectedInstrumentId}
                    onChange={(e) => handleSelectInstrumento(e.target.value)}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Carga manual de sensor / nuevo instrumento --</option>
                    {instrumentosDisponibles.map((inst, idx) => {
                      const instKey = `${inst.cliente}___${inst.codigo_inst}`;
                      return (
                        <option key={`${instKey}_${idx}`} value={instKey}>
                          {inst.codigo_inst} - {inst.nombre} ({inst.rango_operacion})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Nombre / Tag del Sensor *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Transmisor de Presión PT-101"
                    value={calInstrumentoNombre}
                    onChange={(e) => setCalInstrumentoNombre(e.target.value)}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Magnitud del Sensor *
                  </label>
                  <select
                    value={calMagnitud}
                    onChange={(e) => handleSelectMagnitude(e.target.value)}
                    className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {MAGNITUDES_SENSOR.map((m) => (
                      <option key={m.id} value={m.nombre}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Unidad
                  </label>
                  <select
                    value={calUnidad}
                    onChange={(e) => setCalUnidad(e.target.value)}
                    className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Rango Mín
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={calRangoMin}
                    onChange={(e) => setCalRangoMin(Number(e.target.value))}
                    className="w-full font-mono font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Rango Máx
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={calRangoMax}
                    onChange={(e) => setCalRangoMax(Number(e.target.value))}
                    className="w-full font-mono font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-3 sm:col-span-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    EMP
                  </label>
                  <input
                    type="text"
                    value={calEmp}
                    onChange={(e) => setCalEmp(e.target.value)}
                    placeholder="± 0.5% FS"
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Puntos de Prueba
                  </label>
                  <select
                    value={calIncluirBajada ? 9 : calNumPuntos}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val === 9) {
                        setCalIncluirBajada(true);
                        setCalNumPuntos(5);
                      } else {
                        setCalIncluirBajada(false);
                        setCalNumPuntos(val);
                      }
                    }}
                    className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {TEST_POINT_PRESETS.map((preset) => (
                      <option key={preset.count} value={preset.count}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Patrón Sugerido
                  </label>
                  <input
                    type="text"
                    value={calPatron}
                    onChange={(e) => setCalPatron(e.target.value)}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Generated test points preview */}
              <div className="pt-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 mb-1">
                  Puntos generados según rango ({formatRangoOperacion(calRangoMin, calRangoMax, calUnidad)}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {puntosPreview.map((pt, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-[10px] font-mono font-semibold text-indigo-900 dark:text-indigo-200"
                    >
                      {pt.punto_nominal}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
              Equipo Asociado {tipo === 'CAL' ? '(Opcional)' : '*'}
            </label>
            <select
              value={equipoCode}
              onChange={(e) => setEquipoCode(e.target.value)}
              className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Toda la Planta / Ubicación General --</option>
              {Array.from(
                new Map(equiposDisponibles.map((e) => [`${e.cliente}___${e.codigo_eq}`, e])).values()
              ).map((e, idx) => (
                <option key={`${e.cliente}_${e.codigo_eq}_${idx}`} value={e.codigo_eq}>
                  {e.codigo_eq} - {e.nombre} ({e.sistema})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                Fecha Compromiso
              </label>
              <input
                type="date"
                value={fechaTentativa}
                onChange={(e) => setFechaTentativa(e.target.value)}
                required
                className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

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
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
              {tipo === 'CAL' ? 'Metrólogo / Técnico Asignado' : 'Técnico Asignado'}
            </label>
            <select
              value={tecnico}
              onChange={(e) => setTecnico(e.target.value)}
              className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Por asignar / Cuadrilla de turno --</option>
              {(() => {
                const eqObjSel = equipos.find((e) => e.codigo_eq === equipoCode);
                const targetCliente = eqObjSel?.cliente || selectedCliente;
                return tecnicos
                  .filter((t) => t.estado === 'Activo' && tecnicoPerteneceAEmpresa(t, targetCliente))
                  .map((t) => (
                    <option key={t.codigo_tec} value={t.nombre}>
                      {t.nombre} ({t.especialidad})
                    </option>
                  ));
              })()}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
              {tipo === 'CAL' ? 'Observaciones / Instrucciones (Opcional)' : 'Descripción / Tareas a Realizar *'}
            </label>
            <textarea
              rows={tipo === 'CAL' ? 2 : 3}
              required={tipo !== 'CAL'}
              placeholder={
                tipo === 'CAL'
                  ? 'Notas metrológicas, procedimiento o punto de instalación...'
                  : 'Describa el requerimiento, síntomas observados o trabajo a ejecutar...'
              }
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            {tipo !== 'MP' && onShareOrder && (
              <button
                type="button"
                onClick={() => createOrderAndMaybeDispatch('share')}
                className="px-3.5 py-2 font-bold text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Crear y Cierre Digital
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
            >
              Crear Orden
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
