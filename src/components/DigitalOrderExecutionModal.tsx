/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  CheckCircle2,
  CheckSquare,
  Printer,
  Share2,
  AlertTriangle,
  ClipboardList,
  Compass,
  PenTool,
  Lock,
  Check,
  ShieldCheck,
  ShieldAlert,
  ClipboardCheck
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { canValidateDigitalOrder, hasActionAccess } from '../utils/rbac';
import {
  addFrequencyStep,
  formatFechaDDMMYYYY,
  parseFecha
} from '../utils/maintenanceEngine';
import { Equipo, OrdenCalibracion, PuntoCalibracion } from '../types';
import { DigitalOrderTarget } from '../utils/digitalOrderLink';
import { RepuestosConsumoSelector, SelectedRepuestoConsumo } from './RepuestosConsumoSelector';
import { SignaturePad } from './SignaturePad';
import { PrintableDocument } from './PrintModal';

interface DigitalOrderExecutionModalProps {
  target: DigitalOrderTarget;
  onClose: () => void;
  onOpenPrint?: (doc: PrintableDocument) => void;
  onOpenShare?: (target: DigitalOrderTarget) => void;
}

const DEFAULT_CAL_PUNTOS: PuntoCalibracion[] = [
  { punto_nominal: '0% FS', lectura_patron: '0.00', lectura_instrumento: '0.0', error_calculado: '0.00%', conforme: true },
  { punto_nominal: '25% FS', lectura_patron: '25.00', lectura_instrumento: '25.0', error_calculado: '0.00%', conforme: true },
  { punto_nominal: '50% FS', lectura_patron: '50.00', lectura_instrumento: '50.0', error_calculado: '0.00%', conforme: true },
  { punto_nominal: '75% FS', lectura_patron: '75.00', lectura_instrumento: '75.0', error_calculado: '0.00%', conforme: true },
  { punto_nominal: '100% FS', lectura_patron: '100.00', lectura_instrumento: '100.0', error_calculado: '0.00%', conforme: true }
];

export const DigitalOrderExecutionModal: React.FC<DigitalOrderExecutionModalProps> = ({
  target,
  onClose,
  onOpenPrint,
  onOpenShare
}) => {
  const {
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    calibraciones,
    tecnicos,
    frecuencias,
    selectedAnio,
    registrarCierrePreventivo,
    cerrarCorrectivo,
    cerrarOrdenTrabajo,
    cerrarOrdenCalibracion,
    certificarCalibracionProyectada,
    registrarSalidasStockBatch,
    validarOrdenDigitalSupervisor,
    addToast
  } = useMaintenance();
  const { userProfile } = useAuth();
  const canClose = hasActionAccess(userProfile, 'cerrar_ordenes');
  const canPrint = hasActionAccess(userProfile, 'imprimir_pdf');
  const canValidate = canValidateDigitalOrder(userProfile);

  const [justCertifiedCalFolio, setJustCertifiedCalFolio] = useState<string | null>(null);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    fechaReal: string;
    tecnico: string;
    notas: string;
    repuestos: string;
    tareasCompletadas?: string[];
    firmaTecnico: string;
    firmadoPor: string;
    firmaSupervisor?: string;
    firmadoSupervisorPor?: string;
    fechaFirma: string;
    fechaValidacionSupervisor?: string;
    observacionSupervisor?: string;
    calSnapshot?: OrdenCalibracion;
  } | null>(null);

  // Resolve live state of order from context so submission immediately shows closed state
  const liveHistorialMP = useMemo(() => {
    if (target.tipo !== 'MP') return undefined;
    if (target.historialMP) {
      return historial.find(h => h.id === target.historialMP!.id) || target.historialMP;
    }
    const targetFolio = target.folio.trim().toLowerCase();
    const targetEq = target.codigoEq.trim().toLowerCase();
    const targetFreq = target.frecuencia?.trim().toLowerCase();
    return historial.find(h => {
      if (h.id_ot.trim().toLowerCase() !== targetFolio) return false;
      if (h.codigo_eq.trim().toLowerCase() !== targetEq) return false;
      if (target.mes_n && h.mes_n !== target.mes_n) return false;
      if (targetFreq && h.frecuencia && h.frecuencia.trim().toLowerCase() !== targetFreq) return false;
      if (target.anio) {
        const dReal = parseFecha(h.fecha_real);
        if (dReal && dReal.getFullYear() !== target.anio) return false;
      }
      return true;
    });
  }, [target, historial]);

  const liveCorrectivo = useMemo(() => {
    if (target.tipo !== 'MC') return undefined;
    const targetFolio = target.folio.trim().toLowerCase();
    const targetCli = target.cliente.trim().toLowerCase();
    return (
      correctivos.find(
        c => c.id_ot.trim().toLowerCase() === targetFolio && c.cliente.trim().toLowerCase() === targetCli
      ) ||
      correctivos.find(c => c.id_ot.trim().toLowerCase() === targetFolio) ||
      target.correctivo
    );
  }, [target, correctivos]);

  const liveOT = useMemo(() => {
    if (target.tipo !== 'OT') return undefined;
    const targetFolio = target.folio.trim().toLowerCase();
    const targetCli = target.cliente.trim().toLowerCase();
    return (
      ordenesTrabajo.find(
        o => o.id_ot.trim().toLowerCase() === targetFolio && o.cliente.trim().toLowerCase() === targetCli
      ) ||
      ordenesTrabajo.find(o => o.id_ot.trim().toLowerCase() === targetFolio) ||
      target.ordenTrabajo
    );
  }, [target, ordenesTrabajo]);

  const liveCal = useMemo(() => {
    if (target.tipo !== 'CAL') return undefined;
    const targetFolio = target.folio.trim().toLowerCase();
    const targetCli = target.cliente.trim().toLowerCase();
    const exact =
      calibraciones.find(
        c => c.id_ot.trim().toLowerCase() === targetFolio && c.cliente.trim().toLowerCase() === targetCli
      ) || calibraciones.find(c => c.id_ot.trim().toLowerCase() === targetFolio);
    if (exact) return exact;
    if (justCertifiedCalFolio) {
      return (
        calibraciones.find(
          c => c.id_ot === justCertifiedCalFolio && c.cliente.trim().toLowerCase() === targetCli
        ) || target.calibracion
      );
    }
    return target.calibracion;
  }, [target, calibraciones, justCertifiedCalFolio]);

  const resolvedCal = justCertifiedCalFolio
    ? calibraciones.find(
        c => c.id_ot === justCertifiedCalFolio && c.cliente.trim().toLowerCase() === target.cliente.trim().toLowerCase()
      ) || submittedSnapshot?.calSnapshot || liveCal
    : liveCal;

  const isCerrada = Boolean(
    submittedSnapshot ||
      (target.tipo === 'MP' && liveHistorialMP) ||
      (target.tipo === 'MC' && liveCorrectivo && liveCorrectivo.estado !== 'Pendiente') ||
      (target.tipo === 'OT' && liveOT && liveOT.estado !== 'Pendiente') ||
      (target.tipo === 'CAL' && resolvedCal && resolvedCal.estado !== 'Pendiente')
  );

  const isEjecucionDigital = Boolean(
    (target.tipo === 'MP' && liveHistorialMP?.ejecucion_digital) ||
      (target.tipo === 'MC' && liveCorrectivo?.ejecucion_digital) ||
      (target.tipo === 'OT' && liveOT?.ejecucion_digital) ||
      (target.tipo === 'CAL' && resolvedCal?.ejecucion_digital) ||
      submittedSnapshot?.firmaTecnico
  );

  const isValidadaSupervisor = Boolean(
    (target.tipo === 'MP' && (liveHistorialMP?.validado_supervisor || liveHistorialMP?.firma_supervisor)) ||
      (target.tipo === 'MC' && (liveCorrectivo?.validado_supervisor || liveCorrectivo?.firma_supervisor)) ||
      (target.tipo === 'OT' && (liveOT?.validado_supervisor || liveOT?.firma_supervisor)) ||
      (target.tipo === 'CAL' && (resolvedCal?.validado_supervisor || resolvedCal?.firma_supervisor)) ||
      submittedSnapshot?.firmaSupervisor
  );

  const isPendingSupervisorValidation = isCerrada && isEjecucionDigital && !isValidadaSupervisor;

  const fechaValidacionSup =
    liveHistorialMP?.fecha_validacion_supervisor ||
    liveCorrectivo?.fecha_validacion_supervisor ||
    liveOT?.fecha_validacion_supervisor ||
    resolvedCal?.fecha_validacion_supervisor ||
    submittedSnapshot?.fechaValidacionSupervisor;

  const obsValidacionSup =
    liveHistorialMP?.observacion_supervisor ||
    liveCorrectivo?.observacion_supervisor ||
    liveOT?.observacion_supervisor ||
    resolvedCal?.observacion_supervisor ||
    submittedSnapshot?.observacionSupervisor;

  const equipoObj: Equipo = useMemo(() => {
    if (target.equipo) return target.equipo;
    const eqUp = target.codigoEq.trim().toUpperCase();
    const cliLow = target.cliente.trim().toLowerCase();
    const actLow = target.nombreActivo.trim().toLowerCase();
    const found =
      equipos.find(
        e =>
          e.codigo_eq.trim().toUpperCase() === eqUp &&
          e.cliente.trim().toLowerCase() === cliLow &&
          e.nombre.trim().toLowerCase() === actLow
      ) ||
      equipos.find(
        e =>
          e.codigo_eq.trim().toUpperCase() === eqUp &&
          e.cliente.trim().toLowerCase() === cliLow
      ) ||
      equipos.find(e => e.codigo_eq.trim().toUpperCase() === eqUp);

    if (found) return found;
    return {
      codigo_eq: target.codigoEq,
      cliente: target.cliente,
      nombre: target.nombreActivo,
      sistema: target.tipo === 'CAL' ? 'Metrología' : 'General',
      marca: 'N/A',
      modelo: 'N/A',
      frecuencia: target.frecuencia || 'N/A',
      tareas: '',
      tecnico: target.tecnicoSugerido || '',
      fecha_proxima: ''
    };
  }, [target, equipos]);

  const protocolSteps = useMemo(() => {
    return (equipoObj.tareas || '')
      .split('\n')
      .map(t => t.trim())
      .filter(Boolean);
  }, [equipoObj.tareas]);

  const activeTecnicos = useMemo(() => tecnicos.filter(t => t.estado === 'Activo'), [tecnicos]);

  const defaultTechName = useMemo(() => {
    if (target.tecnicoSugerido && target.tecnicoSugerido !== 'Por asignar') {
      return target.tecnicoSugerido;
    }
    if (userProfile?.nombre) {
      const matched = activeTecnicos.find(
        t => t.nombre.trim().toLowerCase() === userProfile.nombre.trim().toLowerCase()
      );
      if (matched) return matched.nombre;
    }
    return activeTecnicos[0]?.nombre || userProfile?.nombre || '';
  }, [target.tecnicoSugerido, userProfile, activeTecnicos]);

  // Shared execution form states
  const [fechaReal, setFechaReal] = useState(new Date().toISOString().slice(0, 10));
  const [tecnico, setTecnico] = useState(defaultTechName);
  const [duracionHoras, setDuracionHoras] = useState<number>(2);
  const [notasAcciones, setNotasAcciones] = useState('');
  const [manualRepuestos, setManualRepuestos] = useState('');
  const [stockConsumido, setStockConsumido] = useState<SelectedRepuestoConsumo[]>([]);
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});

  // Calibration-specific states
  const [calDictamen, setCalDictamen] = useState<'Conforme' | 'Ajustado y Conforme' | 'No Conforme'>('Conforme');
  const [calPatron, setCalPatron] = useState(resolvedCal?.patron_utilizado || 'Patrón Certificado de Laboratorio');
  const [calTrazabilidad, setCalTrazabilidad] = useState(resolvedCal?.trazabilidad_patron || '');
  const [calErrorMax, setCalErrorMax] = useState('+0.20%');
  const [calCertNo, setCalCertNo] = useState(() => {
    if (target.folio.includes('PROY')) return `CAL-CERT-${selectedAnio}-0001`;
    return `CAL-CERT-${target.folio.replace('CAL-', '')}`;
  });
  const [calPuntos, setCalPuntos] = useState<PuntoCalibracion[]>(DEFAULT_CAL_PUNTOS);

  // Digital signature states
  const [firmaTecnico, setFirmaTecnico] = useState('');
  const [firmadoPor, setFirmadoPor] = useState(defaultTechName || userProfile?.nombre || '');
  const [includeSupervisorSign, setIncludeSupervisorSign] = useState(false);
  const [firmaSupervisor, setFirmaSupervisor] = useState('');
  const [firmadoSupervisorPor, setFirmadoSupervisorPor] = useState(userProfile?.nombre || '');

  // Post-closure supervisor validation states
  const [valSupervisorName, setValSupervisorName] = useState(userProfile?.nombre || '');
  const [valSupervisorSignature, setValSupervisorSignature] = useState('');
  const [valSupervisorObs, setValSupervisorObs] = useState('');

  useEffect(() => {
    if (tecnico && !firmadoPor) {
      setFirmadoPor(tecnico);
    }
  }, [tecnico, firmadoPor]);

  useEffect(() => {
    if (userProfile?.nombre && !valSupervisorName) {
      setValSupervisorName(userProfile.nombre);
    }
  }, [userProfile?.nombre, valSupervisorName]);

  const handleSelectAllTasks = () => {
    const all: Record<number, boolean> = {};
    protocolSteps.forEach((_, idx) => {
      all[idx] = true;
    });
    setCheckedMap(all);
  };

  const buildPrintDocFromCurrentState = (): PrintableDocument => {
    if (target.tipo === 'MP') {
      const reg = liveHistorialMP;
      const compTasks =
        reg?.tareas_completadas ||
        submittedSnapshot?.tareasCompletadas;
      const fTec = reg?.firma_tecnico || submittedSnapshot?.firmaTecnico;
      const fSup = reg?.firma_supervisor || submittedSnapshot?.firmaSupervisor;
      return {
        tipo: 'MP',
        folio: target.folio,
        equipo: equipoObj,
        fechaProgramada: target.fechaProgramada,
        protocolo: protocolSteps,
        tecnico: reg?.tecnico || submittedSnapshot?.tecnico || equipoObj.tecnico,
        isCerrada,
        fechaReal: reg?.fecha_real || submittedSnapshot?.fechaReal,
        duracionHoras: reg?.duracion_horas,
        accionesRealizadas: reg?.comentarios || submittedSnapshot?.notas,
        repuestos: reg?.repuestos_utilizados || submittedSnapshot?.repuestos,
        tareasCompletadas: compTasks,
        firmaTecnico: fTec,
        firmaSupervisor: fSup,
        firmadoPor: reg?.firmado_por || submittedSnapshot?.firmadoPor || reg?.tecnico,
        firmadoSupervisorPor: reg?.firmado_supervisor_por || submittedSnapshot?.firmadoSupervisorPor,
        fechaFirmaDigital: reg?.fecha_firma_digital || submittedSnapshot?.fechaFirma,
        fechaValidacionSupervisor: reg?.fecha_validacion_supervisor || submittedSnapshot?.fechaValidacionSupervisor,
        observacionSupervisor: reg?.observacion_supervisor || submittedSnapshot?.observacionSupervisor,
        ejecucionDigital: reg?.ejecucion_digital ?? Boolean(fTec)
      };
    }

    if (target.tipo === 'MC') {
      const mc = liveCorrectivo!;
      const fTec = mc.firma_tecnico || submittedSnapshot?.firmaTecnico;
      const fSup = mc.firma_supervisor || submittedSnapshot?.firmaSupervisor;
      return {
        tipo: 'MC',
        folio: mc.id_ot,
        equipo: equipoObj,
        fechaEmision: mc.fecha_emision,
        fechaTentativa: mc.fecha_tentativa,
        diasTolerancia: mc.dias_tolerancia,
        falla: mc.falla_reportada,
        tecnico: mc.tecnico || submittedSnapshot?.tecnico,
        isCerrada,
        fechaReal: mc.fecha_real || submittedSnapshot?.fechaReal,
        accionesRealizadas: mc.acciones_realizadas || submittedSnapshot?.notas,
        repuestos: mc.repuestos_utilizados || submittedSnapshot?.repuestos,
        firmaTecnico: fTec,
        firmaSupervisor: fSup,
        firmadoPor: mc.firmado_por || submittedSnapshot?.firmadoPor || mc.tecnico,
        firmadoSupervisorPor: mc.firmado_supervisor_por || submittedSnapshot?.firmadoSupervisorPor,
        fechaFirmaDigital: mc.fecha_firma_digital || submittedSnapshot?.fechaFirma,
        fechaValidacionSupervisor: mc.fecha_validacion_supervisor || submittedSnapshot?.fechaValidacionSupervisor,
        observacionSupervisor: mc.observacion_supervisor || submittedSnapshot?.observacionSupervisor,
        ejecucionDigital: mc.ejecucion_digital ?? Boolean(fTec)
      };
    }

    if (target.tipo === 'OT') {
      const ot = liveOT!;
      const fTec = ot.firma_tecnico || submittedSnapshot?.firmaTecnico;
      const fSup = ot.firma_supervisor || submittedSnapshot?.firmaSupervisor;
      return {
        tipo: 'OT',
        folio: ot.id_ot,
        equipo: equipoObj,
        fechaEmision: ot.fecha_emision,
        fechaTentativa: ot.fecha_tentativa,
        diasTolerancia: ot.dias_tolerancia,
        trabajo: ot.trabajo_solicitado,
        tecnico: ot.tecnico || submittedSnapshot?.tecnico,
        isCerrada,
        fechaReal: ot.fecha_real || submittedSnapshot?.fechaReal,
        accionesRealizadas: ot.acciones_realizadas || submittedSnapshot?.notas,
        repuestos: ot.materiales_utilizados || submittedSnapshot?.repuestos,
        firmaTecnico: fTec,
        firmaSupervisor: fSup,
        firmadoPor: ot.firmado_por || submittedSnapshot?.firmadoPor || ot.tecnico,
        firmadoSupervisorPor: ot.firmado_supervisor_por || submittedSnapshot?.firmadoSupervisorPor,
        fechaFirmaDigital: ot.fecha_firma_digital || submittedSnapshot?.fechaFirma,
        fechaValidacionSupervisor: ot.fecha_validacion_supervisor || submittedSnapshot?.fechaValidacionSupervisor,
        observacionSupervisor: ot.observacion_supervisor || submittedSnapshot?.observacionSupervisor,
        ejecucionDigital: ot.ejecucion_digital ?? Boolean(fTec)
      };
    }

    const cal = resolvedCal!;
    return {
      tipo: 'CAL',
      folio: cal.id_ot,
      equipo: equipoObj,
      calibracion: cal,
      isCerrada: cal.estado !== 'Pendiente',
      fechaReal: cal.fecha_real,
      firmaTecnico: cal.firma_tecnico || submittedSnapshot?.firmaTecnico,
      firmaSupervisor: cal.firma_supervisor || submittedSnapshot?.firmaSupervisor,
      firmadoPor: cal.firmado_por || submittedSnapshot?.firmadoPor || cal.metrologo_laboratorio,
      firmadoSupervisorPor: cal.firmado_supervisor_por || submittedSnapshot?.firmadoSupervisorPor,
      fechaFirmaDigital: cal.fecha_firma_digital || submittedSnapshot?.fechaFirma,
      fechaValidacionSupervisor: cal.fecha_validacion_supervisor || submittedSnapshot?.fechaValidacionSupervisor,
      observacionSupervisor: cal.observacion_supervisor || submittedSnapshot?.observacionSupervisor,
      ejecucionDigital: cal.ejecucion_digital ?? Boolean(cal.firma_tecnico)
    };
  };

  const handleValidateBySupervisor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canValidate) {
      addToast('Su perfil no tiene permisos de supervisión para validar órdenes.', 'error');
      return;
    }
    const supName = valSupervisorName.trim() || userProfile?.nombre || 'Supervisor';
    if (!valSupervisorSignature) {
      addToast('Registre su firma digital de supervisor para aprobar el cierre.', 'warning');
      return;
    }

    const now = new Date();
    const fechaValStr = `${formatFechaDDMMYYYY(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const folioEfectivo = resolvedCal?.id_ot || target.folio;

    validarOrdenDigitalSupervisor({
      tipo: target.tipo,
      id_ot: folioEfectivo,
      cliente: target.cliente,
      historialId: liveHistorialMP?.id,
      codigo_eq: equipoObj.codigo_eq,
      mes_n: liveHistorialMP?.mes_n || target.mes_n,
      firmado_supervisor_por: supName,
      firma_supervisor: valSupervisorSignature,
      fecha_validacion_supervisor: fechaValStr,
      observacion_supervisor: valSupervisorObs.trim() || undefined
    });

    if (submittedSnapshot) {
      setSubmittedSnapshot((prev) =>
        prev
          ? {
              ...prev,
              firmaSupervisor: valSupervisorSignature,
              firmadoSupervisorPor: supName,
              fechaValidacionSupervisor: fechaValStr,
              observacionSupervisor: valSupervisorObs.trim() || undefined
            }
          : prev
      );
    }
  };

  const handleSubmitDigitalClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canClose) {
      addToast('Su perfil no tiene permiso para cerrar órdenes.', 'error');
      return;
    }
    if (!tecnico.trim()) {
      addToast('Seleccione o indique el técnico responsable.', 'warning');
      return;
    }
    if (!firmaTecnico) {
      addToast('Se requiere la firma digital del técnico en pantalla para completar la orden.', 'warning');
      return;
    }
    if ((target.tipo === 'MC' || target.tipo === 'OT') && !notasAcciones.trim()) {
      addToast('Describa los trabajos y acciones realizadas.', 'warning');
      return;
    }
    if (includeSupervisorSign && !firmaSupervisor) {
      addToast('Complete la firma del supervisor o desmarque la casilla de firma presencial.', 'warning');
      return;
    }

    const now = new Date();
    const dReal = parseFecha(fechaReal) || now;
    const fechaRealStr = formatFechaDDMMYYYY(dReal);
    const fechaFirmaStr = `${formatFechaDDMMYYYY(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const deductedLabels =
      stockConsumido.length > 0
        ? registrarSalidasStockBatch(
            stockConsumido.map(item => ({ repuesto_id: item.repuestoId, cantidad: item.cantidad })),
            {
              motivo: `Ejecución Digital ${target.tipo} ${target.folio}`,
              ot_asociada: target.isProjectedCal ? undefined : target.folio,
              equipo_asociado: target.codigoEq,
              solicitante: tecnico
            }
          )
        : [];

    const repuestosFinal = [...deductedLabels, manualRepuestos.trim()].filter(Boolean).join(' | ');
    const signerName = firmadoPor.trim() || tecnico.trim();
    const supervisorName = includeSupervisorSign ? (firmadoSupervisorPor.trim() || userProfile?.nombre || 'Supervisor') : undefined;

    if (target.tipo === 'MP') {
      const completedTasks = protocolSteps.filter((_, idx) => Boolean(checkedMap[idx]));
      const mesMatch = target.folio.match(/^MP-\d{4}-(\d{2})-/);
      const mesN = target.mes_n || (mesMatch ? Number(mesMatch[1]) : dReal.getMonth() + 1);
      const comentariosFinal = notasAcciones.trim() || 'Mantenimiento ejecutado y firmado digitalmente en terreno.';

      registrarCierrePreventivo({
        codigo_eq: equipoObj.codigo_eq,
        mes_n: mesN,
        fecha_real: fechaRealStr,
        id_ot: target.folio,
        comentarios: comentariosFinal,
        tecnico,
        duracion_horas: duracionHoras,
        repuestos_utilizados: repuestosFinal,
        tareas_completadas: completedTasks,
        frecuencia: target.frecuencia || equipoObj.frecuencia,
        firma_tecnico: firmaTecnico,
        firma_supervisor: includeSupervisorSign ? firmaSupervisor : undefined,
        firmado_por: signerName,
        firmado_supervisor_por: supervisorName,
        fecha_firma_digital: fechaFirmaStr,
        ejecucion_digital: true
      });

      setSubmittedSnapshot({
        fechaReal: fechaRealStr,
        tecnico,
        notas: comentariosFinal,
        repuestos: repuestosFinal,
        tareasCompletadas: completedTasks,
        firmaTecnico,
        firmadoPor: signerName,
        firmaSupervisor: includeSupervisorSign ? firmaSupervisor : undefined,
        firmadoSupervisorPor: supervisorName,
        fechaFirma: fechaFirmaStr
      });
      return;
    }

    if (target.tipo === 'MC' && liveCorrectivo) {
      cerrarCorrectivo(liveCorrectivo.id_ot, {
        fecha_real: fechaRealStr,
        tecnico,
        acciones_realizadas: notasAcciones.trim(),
        repuestos_utilizados: repuestosFinal,
        firma_tecnico: firmaTecnico,
        firma_supervisor: includeSupervisorSign ? firmaSupervisor : undefined,
        firmado_por: signerName,
        firmado_supervisor_por: supervisorName,
        fecha_firma_digital: fechaFirmaStr,
        ejecucion_digital: true
      });

      setSubmittedSnapshot({
        fechaReal: fechaRealStr,
        tecnico,
        notas: notasAcciones.trim(),
        repuestos: repuestosFinal,
        firmaTecnico,
        firmadoPor: signerName,
        firmaSupervisor: includeSupervisorSign ? firmaSupervisor : undefined,
        firmadoSupervisorPor: supervisorName,
        fechaFirma: fechaFirmaStr
      });
      return;
    }

    if (target.tipo === 'OT' && liveOT) {
      cerrarOrdenTrabajo(liveOT.id_ot, {
        fecha_real: fechaRealStr,
        tecnico,
        acciones_realizadas: notasAcciones.trim(),
        materiales_utilizados: repuestosFinal,
        firma_tecnico: firmaTecnico,
        firma_supervisor: includeSupervisorSign ? firmaSupervisor : undefined,
        firmado_por: signerName,
        firmado_supervisor_por: supervisorName,
        fecha_firma_digital: fechaFirmaStr,
        ejecucion_digital: true
      });

      setSubmittedSnapshot({
        fechaReal: fechaRealStr,
        tecnico,
        notas: notasAcciones.trim(),
        repuestos: repuestosFinal,
        firmaTecnico,
        firmadoPor: signerName,
        firmaSupervisor: includeSupervisorSign ? firmaSupervisor : undefined,
        firmadoSupervisorPor: supervisorName,
        fechaFirma: fechaFirmaStr
      });
      return;
    }

    if (target.tipo === 'CAL' && liveCal) {
      const nextDate = addFrequencyStep(
        dReal,
        liveCal.frecuencia_calibracion || 'Semestral',
        frecuencias,
        dReal.getDate()
      );
      const nextCalStr = formatFechaDDMMYYYY(nextDate);

      if (target.isProjectedCal) {
        const { id_ot: _ignore, estado: _st, fecha_real: _fr, ...orderBase } = liveCal;
        const nuevoFolio = certificarCalibracionProyectada(
          {
            ...orderBase,
            mes_objetivo: target.mes_n || dReal.getMonth() + 1,
            anio_objetivo: target.anio || selectedAnio
          },
          {
            fecha_real: fechaRealStr,
            dictamen: calDictamen,
            error_max_hallado: calErrorMax.trim() || 'Dentro de EMP',
            patron_utilizado: calPatron.trim(),
            trazabilidad_patron: calTrazabilidad.trim(),
            metrologo_laboratorio: tecnico,
            puntos_calibracion: calPuntos,
            observaciones: notasAcciones.trim(),
            repuestos_utilizados: repuestosFinal,
            numero_certificado: calCertNo.trim() || undefined,
            proxima_calibracion: nextCalStr,
            firma_tecnico: firmaTecnico,
            firma_supervisor: includeSupervisorSign ? firmaSupervisor : undefined,
            firmado_por: signerName,
            firmado_supervisor_por: supervisorName,
            fecha_firma_digital: fechaFirmaStr,
            ejecucion_digital: true
          }
        );
        setJustCertifiedCalFolio(nuevoFolio);
        setSubmittedSnapshot({
          fechaReal: fechaRealStr,
          tecnico,
          notas: notasAcciones.trim(),
          repuestos: repuestosFinal,
          firmaTecnico,
          firmadoPor: signerName,
          firmaSupervisor: includeSupervisorSign ? firmaSupervisor : undefined,
          firmadoSupervisorPor: supervisorName,
          fechaFirma: fechaFirmaStr,
          calSnapshot: {
            ...liveCal,
            id_ot: nuevoFolio,
            estado: calDictamen === 'No Conforme' ? 'No Conforme / Fuera de Tolerancia' : 'Conforme (A tiempo)',
            fecha_real: fechaRealStr,
            dictamen: calDictamen,
            error_max_hallado: calErrorMax.trim() || 'Dentro de EMP',
            patron_utilizado: calPatron.trim(),
            trazabilidad_patron: calTrazabilidad.trim(),
            metrologo_laboratorio: tecnico,
            puntos_calibracion: calPuntos,
            observaciones: notasAcciones.trim(),
            repuestos_utilizados: repuestosFinal,
            numero_certificado: calCertNo.trim() || `CAL-CERT-${nuevoFolio.replace('CAL-', '')}`,
            proxima_calibracion: nextCalStr,
            firma_tecnico: firmaTecnico,
            firma_supervisor: includeSupervisorSign ? firmaSupervisor : undefined,
            firmado_por: signerName,
            firmado_supervisor_por: supervisorName,
            fecha_firma_digital: fechaFirmaStr,
            ejecucion_digital: true
          }
        });
      } else {
        cerrarOrdenCalibracion(liveCal.id_ot, {
          fecha_real: fechaRealStr,
          dictamen: calDictamen,
          error_max_hallado: calErrorMax.trim() || 'Dentro de EMP',
          patron_utilizado: calPatron.trim(),
          trazabilidad_patron: calTrazabilidad.trim(),
          metrologo_laboratorio: tecnico,
          puntos_calibracion: calPuntos,
          observaciones: notasAcciones.trim(),
          repuestos_utilizados: repuestosFinal,
          numero_certificado: calCertNo.trim() || `CAL-CERT-${selectedAnio}-${liveCal.id_ot.replace(/CAL-\d+-/g, '')}`,
          proxima_calibracion: nextCalStr,
          firma_tecnico: firmaTecnico,
          firma_supervisor: includeSupervisorSign ? firmaSupervisor : undefined,
          firmado_por: signerName,
          firmado_supervisor_por: supervisorName,
          fecha_firma_digital: fechaFirmaStr,
          ejecucion_digital: true
        });
        setSubmittedSnapshot({
          fechaReal: fechaRealStr,
          tecnico,
          notas: notasAcciones.trim(),
          repuestos: repuestosFinal,
          firmaTecnico,
          firmadoPor: signerName,
          firmaSupervisor: includeSupervisorSign ? firmaSupervisor : undefined,
          firmadoSupervisorPor: supervisorName,
          fechaFirma: fechaFirmaStr
        });
      }
    }
  };

  const tipoMeta =
    target.tipo === 'MP'
      ? { title: 'Orden Preventiva Digital', accent: 'text-blue-700 dark:text-blue-300 prodexus:text-[#2F7CF6]', bg: 'bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#EEF5FF]', Icon: CheckSquare }
      : target.tipo === 'MC'
      ? { title: 'Orden Correctiva Digital', accent: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/60', Icon: AlertTriangle }
      : target.tipo === 'OT'
      ? { title: 'Orden de Trabajo Digital', accent: 'text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]', bg: 'bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0]', Icon: ClipboardList }
      : { title: 'Calibración Metrológica Digital', accent: 'text-indigo-700 dark:text-indigo-300 prodexus:text-[#2F7CF6]', bg: 'bg-indigo-50 dark:bg-indigo-950/60 prodexus:bg-[#EEF5FF]', Icon: Compass };

  const HeaderIcon = tipoMeta.Icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 overflow-hidden no-print">
      <div className="bg-slate-50 dark:bg-slate-950 prodexus:bg-[#F3F6F8] w-full max-w-2xl h-[94dvh] sm:h-auto sm:max-h-[92vh] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-2xl flex flex-col overflow-hidden">
        {/* Sticky Compact Mobile-Friendly Header (<=15% viewport height) */}
        <div className="bg-white dark:bg-slate-900 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl ${tipoMeta.bg} ${tipoMeta.accent} flex items-center justify-center shrink-0`}>
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                <span className="font-semibold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] truncate">{tipoMeta.title}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{resolvedCal?.id_ot || target.folio}</span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] truncate">
                {target.nombreActivo}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenShare && (
              <button
                type="button"
                onClick={() => onOpenShare(target)}
                className="min-h-[40px] min-w-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE] bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 prodexus:hover:bg-[#E4ECF0] text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] flex items-center justify-center gap-1 text-xs font-semibold"
                title="Compartir enlace"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Compartir</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] hover:bg-slate-100 dark:hover:bg-slate-800 prodexus:hover:bg-[#E4ECF0] hover:text-slate-900 dark:hover:text-slate-100 prodexus:hover:text-[#132B36]"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Asset Context Strip */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Planta / Empresa</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{target.cliente}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Código Activo</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{target.codigoEq}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Fecha Programada</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]">{target.fechaProgramada || 'Inmediata'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Estado Actual</span>
              <span className={`font-bold ${isCerrada ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400 prodexus:text-[#2F7CF6]'}`}>
                {isCerrada ? 'Ejecutada / Cerrada' : 'Pendiente de Ejecución'}
              </span>
            </div>
          </div>

          {isCerrada ? (
            /* COMPLETED / SIGNED VIEW */
            <div className="space-y-4">
              <div
                className={`rounded-xl p-4 flex items-start gap-3 border ${
                  isPendingSupervisorValidation
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/70'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/70'
                }`}
              >
                {isPendingSupervisorValidation ? (
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <p
                    className={`font-bold text-sm ${
                      isPendingSupervisorValidation ? 'text-amber-900 dark:text-amber-200' : 'text-emerald-900 dark:text-emerald-200'
                    }`}
                  >
                    {isPendingSupervisorValidation
                      ? 'Cierre Digital Pendiente de Validación del Supervisor'
                      : isValidadaSupervisor
                      ? 'Orden Completada y Validada por Supervisión'
                      : 'Orden Completada y Registrada'}
                  </p>
                  <p className={isPendingSupervisorValidation ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}>
                    Fecha real: <strong className="font-mono">{
                      liveHistorialMP?.fecha_real ||
                      liveCorrectivo?.fecha_real ||
                      liveOT?.fecha_real ||
                      resolvedCal?.fecha_real ||
                      submittedSnapshot?.fechaReal
                    }</strong> · Ejecutó: <strong>{
                      liveHistorialMP?.tecnico ||
                      liveCorrectivo?.tecnico ||
                      liveOT?.tecnico ||
                      resolvedCal?.metrologo_laboratorio ||
                      submittedSnapshot?.tecnico
                    }</strong>
                  </p>
                  {isValidadaSupervisor && (
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 pt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Validada por{' '}
                        <strong>
                          {liveHistorialMP?.firmado_supervisor_por ||
                            liveCorrectivo?.firmado_supervisor_por ||
                            liveOT?.firmado_supervisor_por ||
                            resolvedCal?.firmado_supervisor_por ||
                            submittedSnapshot?.firmadoSupervisorPor ||
                            'Supervisor'}
                        </strong>
                        {fechaValidacionSup ? ` · ${fechaValidacionSup}` : ''}
                      </span>
                    </p>
                  )}
                  {obsValidacionSup && (
                    <p className="text-[11px] text-emerald-900 dark:text-emerald-200 bg-white/70 dark:bg-slate-900/70 border border-emerald-200 dark:border-emerald-800/70 rounded-lg px-2.5 py-1.5 mt-1">
                      <strong>Obs. Supervisión:</strong> {obsValidacionSup}
                    </p>
                  )}
                </div>
              </div>

              {/* Details summary */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-4 space-y-3 text-xs">
                {target.tipo === 'MP' && protocolSteps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-bold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]">Protocolo de Tareas</p>
                    <div className="space-y-1">
                      {protocolSteps.map((step, i) => {
                        const completedList = liveHistorialMP?.tareas_completadas || submittedSnapshot?.tareasCompletadas;
                        const wasChecked = completedList ? completedList.includes(step) : true;
                        return (
                          <div key={i} className="flex items-start gap-2 py-1 border-b border-slate-100 dark:border-slate-800 prodexus:border-[#E4ECF0] last:border-b-0">
                            <span className={`font-mono font-bold ${wasChecked ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976]'}`}>
                              {wasChecked ? '[✓]' : '[ ]'}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 prodexus:text-[#132B36]">{step}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {target.tipo === 'CAL' && resolvedCal && (
                  <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100 dark:border-slate-800 prodexus:border-[#E4ECF0]">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Dictamen</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{resolvedCal.dictamen || 'Conforme'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Error Máx. Hallado</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{resolvedCal.error_max_hallado || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">N° Certificado</span>
                      <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 prodexus:text-[#2F7CF6]">{resolvedCal.numero_certificado || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Próxima Calibración</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]">{resolvedCal.proxima_calibracion || '-'}</span>
                    </div>
                  </div>
                )}

                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] block mb-1">
                    {target.tipo === 'MP' ? 'Hallazgos & Observaciones' : target.tipo === 'CAL' ? 'Observaciones Metrológicas' : 'Acciones Realizadas'}
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] bg-slate-50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                    {liveHistorialMP?.comentarios ||
                      liveCorrectivo?.acciones_realizadas ||
                      liveOT?.acciones_realizadas ||
                      resolvedCal?.observaciones ||
                      submittedSnapshot?.notas ||
                      'Sin observaciones adicionales.'}
                  </p>
                </div>

                {(liveHistorialMP?.repuestos_utilizados ||
                  liveCorrectivo?.repuestos_utilizados ||
                  liveOT?.materiales_utilizados ||
                  resolvedCal?.repuestos_utilizados ||
                  submittedSnapshot?.repuestos) && (
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] block mb-1">Repuestos / Materiales Utilizados</span>
                    <p className="text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] bg-slate-50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                      {liveHistorialMP?.repuestos_utilizados ||
                        liveCorrectivo?.repuestos_utilizados ||
                        liveOT?.materiales_utilizados ||
                        resolvedCal?.repuestos_utilizados ||
                        submittedSnapshot?.repuestos}
                    </p>
                  </div>
                )}

                {/* Digital Signatures Preview */}
                {(liveHistorialMP?.firma_tecnico ||
                  liveCorrectivo?.firma_tecnico ||
                  liveOT?.firma_tecnico ||
                  resolvedCal?.firma_tecnico ||
                  submittedSnapshot?.firmaTecnico) && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                    <p className="font-bold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36] mb-2">Firmas Digitales Registradas</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] rounded-xl p-3 bg-white text-center">
                        <img
                          src={
                            liveHistorialMP?.firma_tecnico ||
                            liveCorrectivo?.firma_tecnico ||
                            liveOT?.firma_tecnico ||
                            resolvedCal?.firma_tecnico ||
                            submittedSnapshot?.firmaTecnico
                          }
                          alt="Firma Digital Técnico"
                          className="h-20 mx-auto object-contain"
                        />
                        <div className="border-t border-slate-200 mt-2 pt-1.5">
                          <p className="font-bold text-slate-900">
                            {liveHistorialMP?.firmado_por ||
                              liveCorrectivo?.firmado_por ||
                              liveOT?.firmado_por ||
                              resolvedCal?.firmado_por ||
                              submittedSnapshot?.firmadoPor}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Técnico / Ejecutor · {liveHistorialMP?.fecha_firma_digital || liveCorrectivo?.fecha_firma_digital || liveOT?.fecha_firma_digital || resolvedCal?.fecha_firma_digital || submittedSnapshot?.fechaFirma}
                          </p>
                        </div>
                      </div>

                      {(liveHistorialMP?.firma_supervisor ||
                        liveCorrectivo?.firma_supervisor ||
                        liveOT?.firma_supervisor ||
                        resolvedCal?.firma_supervisor ||
                        submittedSnapshot?.firmaSupervisor) && (
                        <div className="border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] rounded-xl p-3 bg-white text-center">
                          <img
                            src={
                              liveHistorialMP?.firma_supervisor ||
                              liveCorrectivo?.firma_supervisor ||
                              liveOT?.firma_supervisor ||
                              resolvedCal?.firma_supervisor ||
                              submittedSnapshot?.firmaSupervisor
                            }
                            alt="Firma Digital Supervisor"
                            className="h-20 mx-auto object-contain"
                          />
                          <div className="border-t border-slate-200 mt-2 pt-1.5">
                            <p className="font-bold text-slate-900">
                              {liveHistorialMP?.firmado_supervisor_por ||
                                liveCorrectivo?.firmado_supervisor_por ||
                                liveOT?.firmado_supervisor_por ||
                                resolvedCal?.firmado_supervisor_por ||
                                submittedSnapshot?.firmadoSupervisorPor}
                            </p>
                            <p className="text-[10px] text-slate-500">Conformidad / Supervisión Planta</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Supervisor Validation Form when pending */}
              {isPendingSupervisorValidation && canValidate && (
                <form
                  id="supervisor-validation-form"
                  onSubmit={handleValidateBySupervisor}
                  className="bg-white dark:bg-slate-900 rounded-xl border-2 border-amber-300 dark:border-amber-700 p-4 space-y-3.5 text-xs shadow-xs"
                >
                  <div className="flex items-start gap-2.5 pb-2 border-b border-amber-100 dark:border-amber-900/60">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <ClipboardCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-sm">
                        Validación y Firma Digital del Supervisor
                      </h3>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 prodexus:text-[#4D6976]">
                        Revise el trabajo ejecutado y firme para aprobar oficialmente el cierre digital en planta.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                      Nombre del Supervisor Validador *
                    </label>
                    <input
                      type="text"
                      required
                      value={valSupervisorName}
                      onChange={(e) => setValSupervisorName(e.target.value)}
                      placeholder="Nombre completo del supervisor"
                      className="w-full min-h-[42px] font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                      Observaciones de Supervisión (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={valSupervisorObs}
                      onChange={(e) => setValSupervisorObs(e.target.value)}
                      placeholder="Comentarios de conformidad, verificación en terreno o notas de auditoría..."
                      className="w-full text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <SignaturePad
                    label="Firma Digital del Supervisor *"
                    sublabel="Se estampará en la orden oficial y cerrará la notificación pendiente."
                    value={valSupervisorSignature}
                    onChange={setValSupervisorSignature}
                    required
                  />
                </form>
              )}
            </div>
          ) : !canClose ? (
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 rounded-xl p-5 text-center space-y-2 text-xs">
              <Lock className="w-7 h-7 text-amber-600 dark:text-amber-400 mx-auto" />
              <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">Vista de Solo Lectura</h3>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                Su usuario no posee el permiso <strong>Cerrar / Completar Órdenes</strong> para firmar y cerrar esta orden digitalmente. Solicite acceso a su Administrador de Empresa.
              </p>
            </div>
          ) : (
            /* INTERACTIVE MOBILE DIGITAL EXECUTION FORM */
            <form id="digital-exec-form" onSubmit={handleSubmitDigitalClose} className="space-y-4 text-xs">
              {/* Order Context Description for MC / OT / CAL */}
              {target.tipo === 'MC' && liveCorrectivo && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 rounded-xl p-4 space-y-1">
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">Falla Reportada</span>
                  <p className="text-amber-900 dark:text-amber-300 leading-relaxed">{liveCorrectivo.falla_reportada}</p>
                </div>
              )}

              {target.tipo === 'OT' && liveOT && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] rounded-xl p-4 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] block">Alcance del Trabajo Solicitado</span>
                  <p className="text-slate-700 dark:text-slate-300 prodexus:text-[#4D6976] leading-relaxed">{liveOT.trabajo_solicitado}</p>
                </div>
              )}

              {target.tipo === 'CAL' && liveCal && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Variable</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{liveCal.variable_medicion}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">Rango</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]">{liveCal.rango_operacion}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">EMP Permitido</span>
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 prodexus:text-[#2F7CF6]">{liveCal.tolerancia_emp}</span>
                  </div>
                </div>
              )}

              {/* MP Checklist */}
              {target.tipo === 'MP' && protocolSteps.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-sm">Lista de Verificación del Protocolo</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">Toque cada paso realizado en terreno</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectAllTasks}
                      className="min-h-[36px] px-3 py-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 prodexus:text-[#2F7CF6] bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#EEF5FF] hover:bg-blue-100 dark:hover:bg-blue-900/60 prodexus:hover:bg-[#E4ECF0] rounded-lg transition-colors shrink-0"
                    >
                      Marcar Todas
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 prodexus:divide-[#E4ECF0]">
                    {protocolSteps.map((step, idx) => {
                      const checked = Boolean(checkedMap[idx]);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCheckedMap(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          className="w-full min-h-[46px] py-2.5 px-2 text-left flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 prodexus:hover:bg-[#F3F6F8] rounded-lg transition-colors"
                        >
                          <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            checked
                              ? 'bg-emerald-600 prodexus:bg-[#1FB85C] border-emerald-600 prodexus:border-[#1FB85C] text-white'
                              : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] text-transparent'
                          }`}>
                            <Check className="w-4 h-4" />
                          </div>
                          <span className={`text-xs leading-snug ${checked ? 'text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] font-semibold' : 'text-slate-700 dark:text-slate-300 prodexus:text-[#4D6976]'}`}>
                            {step}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Execution Date & Responsible Technician */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-4 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-sm">Datos de Ejecución</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                      Fecha Real de Ejecución *
                    </label>
                    <input
                      type="date"
                      required
                      value={fechaReal}
                      onChange={(e) => setFechaReal(e.target.value)}
                      className="w-full min-h-[44px] font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                      {target.tipo === 'CAL' ? 'Metrólogo / Laboratorio *' : 'Técnico Ejecutor *'}
                    </label>
                    {activeTecnicos.length > 0 ? (
                      <select
                        required
                        value={tecnico}
                        onChange={(e) => {
                          setTecnico(e.target.value);
                          setFirmadoPor(e.target.value);
                        }}
                        className="w-full min-h-[44px] font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                      >
                        <option value="">-- Seleccionar Responsable --</option>
                        {activeTecnicos.map(t => (
                          <option key={t.codigo_tec} value={t.nombre}>
                            {t.nombre} ({t.especialidad})
                          </option>
                        ))}
                        {tecnico && !activeTecnicos.some(t => t.nombre === tecnico) && (
                          <option value={tecnico}>{tecnico}</option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={tecnico}
                        onChange={(e) => {
                          setTecnico(e.target.value);
                          setFirmadoPor(e.target.value);
                        }}
                        className="w-full min-h-[44px] font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                      />
                    )}
                  </div>
                </div>

                {target.tipo === 'MP' && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                      Duración de la Intervención (Horas)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={duracionHoras}
                      onChange={(e) => setDuracionHoras(Number(e.target.value))}
                      className="w-full min-h-[44px] font-mono font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                    />
                  </div>
                )}

                {target.tipo === 'CAL' && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">Dictamen Metrológico *</label>
                        <select
                          value={calDictamen}
                          onChange={(e) => setCalDictamen(e.target.value as any)}
                          className="w-full min-h-[44px] font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 prodexus:focus:ring-[#2F7CF6]"
                        >
                          <option value="Conforme">Conforme (Apto para uso)</option>
                          <option value="Ajustado y Conforme">Ajustado y Conforme</option>
                          <option value="No Conforme">No Conforme (Fuera de Tolerancia)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">Error Máximo Hallado *</label>
                        <input
                          type="text"
                          required
                          value={calErrorMax}
                          onChange={(e) => setCalErrorMax(e.target.value)}
                          placeholder="Ej. +0.20% FS"
                          className="w-full min-h-[44px] font-mono font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 prodexus:focus:ring-[#2F7CF6]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">Patrón de Referencia *</label>
                        <input
                          type="text"
                          required
                          value={calPatron}
                          onChange={(e) => setCalPatron(e.target.value)}
                          className="w-full min-h-[44px] text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 prodexus:focus:ring-[#2F7CF6]"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">N° Certificado Emitido</label>
                        <input
                          type="text"
                          value={calCertNo}
                          onChange={(e) => setCalCertNo(e.target.value)}
                          className="w-full min-h-[44px] font-mono font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 prodexus:focus:ring-[#2F7CF6]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">Certificado de Trazabilidad del Patrón</label>
                      <input
                        type="text"
                        placeholder="Ej. CERT-TRAZ-INN-2026-104"
                        value={calTrazabilidad}
                        onChange={(e) => setCalTrazabilidad(e.target.value)}
                        className="w-full min-h-[44px] text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 prodexus:focus:ring-[#2F7CF6]"
                      />
                    </div>

                    {/* Points table */}
                    <div className="border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] space-y-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36] block">Puntos de Contraste</span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] border-b border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6]">
                              <th className="py-1.5 px-1.5 text-left">Punto</th>
                              <th className="py-1.5 px-1.5 text-left">Patrón</th>
                              <th className="py-1.5 px-1.5 text-left">Instrumento</th>
                              <th className="py-1.5 px-1.5 text-left">Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calPuntos.map((p, idx) => (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/60 prodexus:border-[#E4ECF0] last:border-b-0">
                                <td className="py-1.5 px-1.5 font-mono font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{p.punto_nominal}</td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    value={p.lectura_patron}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCalPuntos(prev => prev.map((it, i) => i === idx ? { ...it, lectura_patron: val } : it));
                                    }}
                                    className="w-20 min-h-[36px] bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg px-2 font-mono"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    value={p.lectura_instrumento}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCalPuntos(prev => prev.map((it, i) => i === idx ? { ...it, lectura_instrumento: val } : it));
                                    }}
                                    className="w-20 min-h-[36px] bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg px-2 font-mono"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    value={p.error_calculado}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCalPuntos(prev => prev.map((it, i) => i === idx ? { ...it, error_calculado: val } : it));
                                    }}
                                    className="w-20 min-h-[36px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg px-2 font-mono font-bold text-emerald-700 dark:text-emerald-400"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    {target.tipo === 'MP'
                      ? 'Hallazgos, Mediciones y Observaciones'
                      : target.tipo === 'CAL'
                      ? 'Observaciones Metrológicas y Precintos'
                      : 'Diagnóstico, Acciones Realizadas y Pruebas *'}
                  </label>
                  <textarea
                    rows={3}
                    required={target.tipo === 'MC' || target.tipo === 'OT'}
                    placeholder={
                      target.tipo === 'MP'
                        ? 'Parámetros medidos (amperaje, presión, temperatura), recomendaciones...'
                        : target.tipo === 'CAL'
                        ? 'Etiqueta adherida, número de precinto, condiciones ambientales...'
                        : 'Detalle la reparación, ajustes y pruebas de funcionamiento realizadas...'
                    }
                    value={notasAcciones}
                    onChange={(e) => setNotasAcciones(e.target.value)}
                    className="w-full text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                  />
                </div>
              </div>

              {/* Spare Parts Consumption */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-4">
                <RepuestosConsumoSelector
                  clienteNombre={target.cliente}
                  equipoCodigo={target.codigoEq}
                  selectedItems={stockConsumido}
                  onChangeItems={setStockConsumido}
                  manualText={manualRepuestos}
                  onChangeManualText={setManualRepuestos}
                  manualLabel="Repuestos / Insumos Adicionales (Texto Libre)"
                  manualPlaceholder="Ej. Filtro, lubricante, sellos, material eléctrico..."
                />
              </div>

              {/* Touch Digital Signature Section */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-sm">Firmas Digitales de Conformidad</h3>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    Nombre Completo quien Firma (Ejecutor) *
                  </label>
                  <input
                    type="text"
                    required
                    value={firmadoPor}
                    onChange={(e) => setFirmadoPor(e.target.value)}
                    placeholder="Nombre del técnico / metrólogo"
                    className="w-full min-h-[44px] font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                  />
                </div>

                <SignaturePad
                  label={target.tipo === 'CAL' ? 'Firma del Metrólogo Ejecutor' : 'Firma del Técnico Ejecutor'}
                  sublabel="Quedará estampada en el PDF y certificado oficial de la orden."
                  value={firmaTecnico}
                  onChange={setFirmaTecnico}
                  required
                />

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-3">
                  <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeSupervisorSign}
                      onChange={(e) => setIncludeSupervisorSign(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]">
                      Agregar firma de recepción / supervisor de planta ahora (opcional)
                    </span>
                  </label>

                  {includeSupervisorSign && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                          Nombre del Supervisor / Receptor en Planta
                        </label>
                        <input
                          type="text"
                          value={firmadoSupervisorPor}
                          onChange={(e) => setFirmadoSupervisorPor(e.target.value)}
                          placeholder="Nombre y cargo de quien recibe conforme"
                          className="w-full min-h-[44px] font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                        />
                      </div>

                      <SignaturePad
                        label="Firma Digital Supervisor / Calidad"
                        value={firmaSupervisor}
                        onChange={setFirmaSupervisor}
                        required={includeSupervisorSign}
                      />
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Sticky Ergonomic CTA Bar */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] px-4 sm:px-6 py-3 flex items-center justify-between gap-2.5 shrink-0">
          {isCerrada ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] hover:bg-slate-200 dark:hover:bg-slate-700 prodexus:hover:bg-[#D5E0E6] transition-colors"
              >
                Cerrar
              </button>
              <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                {canPrint && onOpenPrint && (
                  <button
                    type="button"
                    onClick={() => onOpenPrint(buildPrintDocFromCurrentState())}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-xs text-slate-800 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] hover:bg-slate-50 dark:hover:bg-slate-800 prodexus:hover:bg-[#E4ECF0] flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Ver / Descargar PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                )}
                {isPendingSupervisorValidation && canValidate && (
                  <button
                    type="submit"
                    form="supervisor-validation-form"
                    className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Validar Cierre Digital</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] hover:bg-slate-200 dark:hover:bg-slate-700 prodexus:hover:bg-[#D5E0E6] transition-colors"
              >
                Cancelar
              </button>
              {canClose && (
                <button
                  type="submit"
                  form="digital-exec-form"
                  className="flex-1 min-h-[46px] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 prodexus:bg-[#1FB85C] hover:bg-emerald-700 prodexus:hover:bg-[#189B4C] flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Completar y Firmar Orden Digitalmente</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
