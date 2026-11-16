/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Cliente,
  Equipo,
  ModuloKey,
  OrdenCalibracion,
  OrdenCorrectivo,
  OrdenTrabajoOT,
  RegistroHistorialMP,
  UserProfile
} from '../types';
import { DigitalOrderTarget, OrderTipo } from './digitalOrderLink';
import { canValidateDigitalOrder, hasModuleAccess } from './rbac';
import { parseFecha } from './maintenanceEngine';

export interface PendingSupervisorValidationItem {
  key: string;
  tipo: OrderTipo;
  folio: string;
  cliente: string;
  codigoEq: string;
  nombreActivo: string;
  tecnico: string;
  fechaReal: string;
  fechaFirmaDigital?: string;
  resumen: string;
  target: DigitalOrderTarget;
  sortTimestamp: number;
}

function tipoToModulo(tipo: OrderTipo): ModuloKey {
  if (tipo === 'MP') return 'preventivos';
  if (tipo === 'MC') return 'correctivos';
  if (tipo === 'OT') return 'ordenes';
  return 'calibracion';
}

function parseFirmaTimestamp(fechaFirma?: string, fechaReal?: string): number {
  if (fechaFirma) {
    const [datePart, timePart] = fechaFirma.trim().split(' ');
    const d = parseFecha(datePart);
    if (d) {
      if (timePart && timePart.includes(':')) {
        const [hh, mm] = timePart.split(':').map(Number);
        if (!isNaN(hh) && !isNaN(mm)) {
          d.setHours(hh, mm, 0, 0);
        }
      }
      return d.getTime();
    }
  }
  const dReal = parseFecha(fechaReal);
  return dReal ? dReal.getTime() : 0;
}

export function getPendingSupervisorValidations(params: {
  userProfile: UserProfile | null;
  clientes: Cliente[];
  equipos: Equipo[];
  historial: RegistroHistorialMP[];
  correctivos: OrdenCorrectivo[];
  ordenesTrabajo: OrdenTrabajoOT[];
  calibraciones: OrdenCalibracion[];
}): PendingSupervisorValidationItem[] {
  const {
    userProfile,
    clientes,
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    calibraciones
  } = params;

  if (!canValidateDigitalOrder(userProfile)) return [];

  const canSeeMP = hasModuleAccess(userProfile, tipoToModulo('MP'));
  const canSeeMC = hasModuleAccess(userProfile, tipoToModulo('MC'));
  const canSeeOT = hasModuleAccess(userProfile, tipoToModulo('OT'));
  const canSeeCAL = hasModuleAccess(userProfile, tipoToModulo('CAL'));

  const findEquipoForOrder = (codigoEq: string, clienteName?: string, freq?: string): Equipo | undefined => {
    const eqUp = codigoEq.trim().toUpperCase();
    const cliLow = clienteName?.trim().toLowerCase();
    const freqLow = freq?.trim().toLowerCase();

    return (
      equipos.find(
        (e) =>
          e.codigo_eq.trim().toUpperCase() === eqUp &&
          (!cliLow || e.cliente.trim().toLowerCase() === cliLow) &&
          (!freqLow || e.frecuencia.trim().toLowerCase() === freqLow)
      ) ||
      equipos.find(
        (e) =>
          e.codigo_eq.trim().toUpperCase() === eqUp &&
          (!cliLow || e.cliente.trim().toLowerCase() === cliLow)
      ) ||
      equipos.find((e) => e.codigo_eq.trim().toUpperCase() === eqUp)
    );
  };

  const findEmpresaCodigo = (clienteName: string): string | undefined =>
    clientes.find((c) => c.nombre.trim().toLowerCase() === clienteName.trim().toLowerCase())?.codigo;

  const items: PendingSupervisorValidationItem[] = [];

  if (canSeeMP) {
    for (const h of historial) {
      if (h.ejecucion_digital === true && !h.validado_supervisor && !h.firma_supervisor) {
        const eq = findEquipoForOrder(h.codigo_eq, undefined, h.frecuencia);
        const clienteName = eq?.cliente || clientes[0]?.nombre || 'Planta';
        const dReal = parseFecha(h.fecha_real);
        items.push({
          key: `MP:${h.id}`,
          tipo: 'MP',
          folio: h.id_ot,
          cliente: clienteName,
          codigoEq: h.codigo_eq,
          nombreActivo: eq?.nombre || h.codigo_eq,
          tecnico: h.firmado_por || h.tecnico,
          fechaReal: h.fecha_real,
          fechaFirmaDigital: h.fecha_firma_digital,
          resumen: h.comentarios || 'Mantenimiento preventivo ejecutado digitalmente.',
          sortTimestamp: parseFirmaTimestamp(h.fecha_firma_digital, h.fecha_real),
          target: {
            tipo: 'MP',
            folio: h.id_ot,
            cliente: clienteName,
            empresaCodigo: findEmpresaCodigo(clienteName),
            codigoEq: h.codigo_eq,
            nombreActivo: eq?.nombre || h.codigo_eq,
            fechaProgramada: h.fecha_real,
            mes_n: h.mes_n,
            anio: dReal ? dReal.getFullYear() : undefined,
            frecuencia: h.frecuencia || eq?.frecuencia,
            tecnicoSugerido: h.tecnico,
            equipo: eq,
            historialMP: h
          }
        });
      }
    }
  }

  if (canSeeMC) {
    for (const c of correctivos) {
      if (
        c.estado !== 'Pendiente' &&
        c.ejecucion_digital === true &&
        !c.validado_supervisor &&
        !c.firma_supervisor
      ) {
        const eq = findEquipoForOrder(c.codigo_eq, c.cliente);
        items.push({
          key: `MC:${c.cliente}:${c.id_ot}`,
          tipo: 'MC',
          folio: c.id_ot,
          cliente: c.cliente,
          codigoEq: c.codigo_eq,
          nombreActivo: eq?.nombre || c.codigo_eq,
          tecnico: c.firmado_por || c.tecnico,
          fechaReal: c.fecha_real,
          fechaFirmaDigital: c.fecha_firma_digital,
          resumen: c.acciones_realizadas || c.falla_reportada,
          sortTimestamp: parseFirmaTimestamp(c.fecha_firma_digital, c.fecha_real),
          target: {
            tipo: 'MC',
            folio: c.id_ot,
            cliente: c.cliente,
            empresaCodigo: findEmpresaCodigo(c.cliente),
            codigoEq: c.codigo_eq,
            nombreActivo: eq?.nombre || c.codigo_eq,
            fechaProgramada: c.fecha_tentativa,
            tecnicoSugerido: c.tecnico,
            equipo: eq,
            correctivo: c
          }
        });
      }
    }
  }

  if (canSeeOT) {
    for (const o of ordenesTrabajo) {
      if (
        o.estado !== 'Pendiente' &&
        o.ejecucion_digital === true &&
        !o.validado_supervisor &&
        !o.firma_supervisor
      ) {
        const eq = findEquipoForOrder(o.codigo_eq, o.cliente);
        items.push({
          key: `OT:${o.cliente}:${o.id_ot}`,
          tipo: 'OT',
          folio: o.id_ot,
          cliente: o.cliente,
          codigoEq: o.codigo_eq,
          nombreActivo: eq?.nombre || 'Instalaciones Generales de Planta',
          tecnico: o.firmado_por || o.tecnico,
          fechaReal: o.fecha_real,
          fechaFirmaDigital: o.fecha_firma_digital,
          resumen: o.acciones_realizadas || o.trabajo_solicitado,
          sortTimestamp: parseFirmaTimestamp(o.fecha_firma_digital, o.fecha_real),
          target: {
            tipo: 'OT',
            folio: o.id_ot,
            cliente: o.cliente,
            empresaCodigo: findEmpresaCodigo(o.cliente),
            codigoEq: o.codigo_eq,
            nombreActivo: eq?.nombre || 'Instalaciones Generales de Planta',
            fechaProgramada: o.fecha_tentativa,
            tecnicoSugerido: o.tecnico,
            equipo: eq,
            ordenTrabajo: o
          }
        });
      }
    }
  }

  if (canSeeCAL) {
    for (const cal of calibraciones) {
      if (
        cal.estado !== 'Pendiente' &&
        cal.ejecucion_digital === true &&
        !cal.validado_supervisor &&
        !cal.firma_supervisor
      ) {
        const eq = findEquipoForOrder(cal.codigo_eq, cal.cliente);
        items.push({
          key: `CAL:${cal.cliente}:${cal.id_ot}`,
          tipo: 'CAL',
          folio: cal.id_ot,
          cliente: cal.cliente,
          codigoEq: cal.codigo_eq,
          nombreActivo: cal.instrumento_nombre,
          tecnico: cal.firmado_por || cal.metrologo_laboratorio,
          fechaReal: cal.fecha_real,
          fechaFirmaDigital: cal.fecha_firma_digital,
          resumen: cal.observaciones || `Dictamen: ${cal.dictamen || 'Conforme'}`,
          sortTimestamp: parseFirmaTimestamp(cal.fecha_firma_digital, cal.fecha_real),
          target: {
            tipo: 'CAL',
            folio: cal.id_ot,
            cliente: cal.cliente,
            empresaCodigo: findEmpresaCodigo(cal.cliente),
            codigoEq: cal.codigo_eq,
            nombreActivo: cal.instrumento_nombre,
            fechaProgramada: cal.fecha_programada,
            frecuencia: cal.frecuencia_calibracion,
            tecnicoSugerido: cal.metrologo_laboratorio,
            equipo: eq,
            calibracion: cal,
            isProjectedCal: false
          }
        });
      }
    }
  }

  return items.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
}
