/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Cliente,
  Equipo,
  FrecuenciaConfig,
  Instrumento,
  OrdenCalibracion,
  OrdenCorrectivo,
  OrdenTrabajoOT,
  RegistroHistorialMP
} from '../types';
import {
  calcularOcurrenciasEquipo,
  calcularOcurrenciasInstrumento,
  formatFechaDDMMYYYY,
  formatFechaYYYYMMDD,
  generarMapaFoliosAnual,
  obtenerFrecuenciaConfig
} from './maintenanceEngine';

export type OrderTipo = 'MP' | 'MC' | 'OT' | 'CAL';

export interface DigitalOrderTarget {
  tipo: OrderTipo;
  folio: string;
  cliente: string;
  empresaCodigo?: string;
  codigoEq: string;
  nombreActivo: string;
  fechaProgramada?: string;
  mes_n?: number;
  anio?: number;
  frecuencia?: string;
  tecnicoSugerido?: string;
  equipo?: Equipo;
  historialMP?: RegistroHistorialMP;
  correctivo?: OrdenCorrectivo;
  ordenTrabajo?: OrdenTrabajoOT;
  calibracion?: OrdenCalibracion;
  isProjectedCal?: boolean;
}

export interface DeepLinkOrderQuery {
  tipo: OrderTipo;
  folio: string;
  emp?: string;
  mes?: number;
  anio?: number;
  eq?: string;
  eqid?: string;
  act?: string;
  fecha?: string;
  freq?: string;
}

const PENDING_ORDER_STORAGE_KEY = 'prodexus_pending_digital_order';

export function buildDigitalOrderUrl(target: DigitalOrderTarget, clientes: Cliente[]): string {
  const empMatched =
    target.empresaCodigo ||
    clientes.find(c => c.nombre.trim().toLowerCase() === target.cliente.trim().toLowerCase())?.codigo ||
    '';

  const params = new URLSearchParams();
  params.set('orden', target.tipo);
  params.set('folio', target.folio);
  if (empMatched) params.set('emp', empMatched);
  if (target.mes_n) params.set('mes', String(target.mes_n));
  if (target.anio) params.set('anio', String(target.anio));
  if (target.codigoEq) params.set('eq', target.codigoEq);
  if (target.equipo?.id) params.set('eqid', target.equipo.id);
  if (target.nombreActivo) params.set('act', target.nombreActivo);
  if (target.fechaProgramada) params.set('fecha', target.fechaProgramada);
  if (target.frecuencia) params.set('freq', target.frecuencia);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const queryStr = params.toString().replace(/\+/g, '%20');
  return `${origin}/?${queryStr}`;
}

export function getOrderTipoLabel(tipo: OrderTipo): string {
  return tipo === 'MP'
    ? 'Mantenimiento Preventivo (MP)'
    : tipo === 'MC'
    ? 'Mantenimiento Correctivo (MC)'
    : tipo === 'OT'
    ? 'Orden de Trabajo (OT)'
    : 'Calibración Metrológica (CAL)';
}

export function buildWhatsAppShareHref(params: {
  phone?: string;
  target: DigitalOrderTarget;
  url: string;
}): string {
  const cleanPhone = (params.phone || '').replace(/[^\d]/g, '');
  const tipoLabel = getOrderTipoLabel(params.target.tipo);

  const lines = [
    `*PRODEXUS CMMS · ${tipoLabel}*`,
    `Folio: *${params.target.folio}*`,
    `Planta: ${params.target.cliente}`,
    `Equipo/Activo: ${params.target.nombreActivo} (${params.target.codigoEq})`,
    params.target.fechaProgramada ? `Fecha programada: ${params.target.fechaProgramada}` : '',
    '',
    'Complete la orden y firme digitalmente desde el siguiente enlace:',
    params.url
  ].filter(Boolean);

  const encodedText = encodeURIComponent(lines.join('\n'));
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

export function buildEmailShareContent(params: {
  email?: string;
  technicianName?: string;
  target: DigitalOrderTarget;
  url: string;
}): {
  to: string;
  subject: string;
  body: string;
  mailtoHref: string;
  gmailHref: string;
} {
  const to = (params.email || '').trim().replace(/[?&#\s]/g, '');
  const tipoLabel = getOrderTipoLabel(params.target.tipo);
  const subject = `[PRODEXUS CMMS] ${tipoLabel} · Folio ${params.target.folio} (${params.target.codigoEq})`;

  const greeting = params.technicianName?.trim()
    ? `Estimado/a ${params.technicianName.trim()},`
    : 'Estimado/a Técnico,';

  const bodyLines = [
    greeting,
    '',
    'Se ha compartido la siguiente orden para su ejecución y cierre digital:',
    '',
    `• Tipo de Orden: ${tipoLabel}`,
    `• Folio: ${params.target.folio}`,
    `• Planta / Empresa: ${params.target.cliente}`,
    `• Equipo / Activo: ${params.target.nombreActivo} (${params.target.codigoEq})`,
    params.target.frecuencia ? `• Frecuencia: ${params.target.frecuencia}` : '',
    params.target.fechaProgramada ? `• Fecha programada: ${params.target.fechaProgramada}` : '',
    '',
    'Para completar el protocolo, registrar hallazgos/repuestos y firmar digitalmente en pantalla, ingrese al siguiente enlace:',
    params.url,
    '',
    'Atentamente,',
    'Gestión de Mantenimiento · PRODEXUS CMMS'
  ].filter((line, idx, arr) => {
    if (line !== '') return true;
    return idx === 0 || arr[idx - 1] !== '';
  });

  const body = bodyLines.join('\n');
  const mailtoHref = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { to, subject, body, mailtoHref, gmailHref };
}

export function parseDeepLinkOrderFromWindow(): DeepLinkOrderQuery | null {
  if (typeof window === 'undefined') return null;
  const search = new URLSearchParams(window.location.search);
  const ordenRaw = (search.get('orden') || '').trim().toUpperCase();
  const folio = (search.get('folio') || '').trim();

  if (ordenRaw === 'MP' || ordenRaw === 'MC' || ordenRaw === 'OT' || ordenRaw === 'CAL') {
    if (folio) {
      const parsed: DeepLinkOrderQuery = {
        tipo: ordenRaw,
        folio,
        emp: search.get('emp')?.trim() || undefined,
        mes: search.get('mes') ? Number(search.get('mes')) : undefined,
        anio: search.get('anio') ? Number(search.get('anio')) : undefined,
        eq: search.get('eq')?.trim() || undefined,
        eqid: search.get('eqid')?.trim() || undefined,
        act: search.get('act')?.trim() || undefined,
        fecha: search.get('fecha')?.trim() || undefined,
        freq: search.get('freq')?.trim() || undefined
      };
      try {
        sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore storage restrictions
      }
      return parsed;
    }
  }

  try {
    const saved = sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as DeepLinkOrderQuery;
      if (parsed?.tipo && parsed?.folio) return parsed;
    }
  } catch {
    // Ignore storage parse error
  }
  return null;
}

export function clearDeepLinkOrderStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  } catch {
    // Ignore
  }
  if (window.location.search.includes('orden=')) {
    const url = new URL(window.location.href);
    url.searchParams.delete('orden');
    url.searchParams.delete('folio');
    url.searchParams.delete('emp');
    url.searchParams.delete('mes');
    url.searchParams.delete('anio');
    url.searchParams.delete('eq');
    url.searchParams.delete('eqid');
    url.searchParams.delete('act');
    url.searchParams.delete('fecha');
    url.searchParams.delete('freq');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
}

export function resolveDigitalOrderTarget(
  query: DeepLinkOrderQuery,
  data: {
    clientes: Cliente[];
    equipos: Equipo[];
    historial: RegistroHistorialMP[];
    correctivos: OrdenCorrectivo[];
    ordenesTrabajo: OrdenTrabajoOT[];
    calibraciones: OrdenCalibracion[];
    instrumentos: Instrumento[];
    frecuencias: FrecuenciaConfig[];
    defaultAnio: number;
  }
): DigitalOrderTarget | null {
  const empMatch = query.emp
    ? data.clientes.find(c => c.codigo.trim().toLowerCase() === query.emp!.trim().toLowerCase())
    : undefined;

  const findMatchedEquipo = (codigoEq: string, clienteName: string): Equipo | undefined => {
    const eqNorm = codigoEq.trim().toLowerCase();
    const cliNorm = clienteName.trim().toLowerCase();
    const actNorm = query.act?.trim().toLowerCase();

    if (query.eqid) {
      const byId = data.equipos.find(e => e.id === query.eqid && e.cliente.trim().toLowerCase() === cliNorm);
      if (byId) return byId;
    }
    if (actNorm) {
      const byAct = data.equipos.find(
        e =>
          e.codigo_eq.trim().toLowerCase() === eqNorm &&
          e.cliente.trim().toLowerCase() === cliNorm &&
          e.nombre.trim().toLowerCase() === actNorm
      );
      if (byAct) return byAct;
    }
    return (
      data.equipos.find(e => e.codigo_eq.trim().toLowerCase() === eqNorm && e.cliente.trim().toLowerCase() === cliNorm) ||
      data.equipos.find(e => e.codigo_eq.trim().toLowerCase() === eqNorm)
    );
  };

  if (query.tipo === 'MC') {
    const folioLower = query.folio.trim().toLowerCase();
    const eqLower = query.eq?.trim().toLowerCase();
    const mc =
      data.correctivos.find(
        c =>
          c.id_ot.trim().toLowerCase() === folioLower &&
          (!empMatch || c.cliente.trim().toLowerCase() === empMatch.nombre.trim().toLowerCase()) &&
          (!eqLower || c.codigo_eq.trim().toLowerCase() === eqLower)
      ) ||
      data.correctivos.find(
        c =>
          c.id_ot.trim().toLowerCase() === folioLower &&
          (!empMatch || c.cliente.trim().toLowerCase() === empMatch.nombre.trim().toLowerCase())
      ) ||
      data.correctivos.find(c => c.id_ot.trim().toLowerCase() === folioLower);

    if (!mc) return null;
    const eq = findMatchedEquipo(mc.codigo_eq, mc.cliente);
    return {
      tipo: 'MC',
      folio: mc.id_ot,
      cliente: mc.cliente,
      empresaCodigo: empMatch?.codigo,
      codigoEq: mc.codigo_eq,
      nombreActivo: eq?.nombre || mc.codigo_eq,
      fechaProgramada: mc.fecha_tentativa,
      tecnicoSugerido: mc.tecnico,
      equipo: eq,
      correctivo: mc
    };
  }

  if (query.tipo === 'OT') {
    const folioLower = query.folio.trim().toLowerCase();
    const eqLower = query.eq?.trim().toLowerCase();
    const ot =
      data.ordenesTrabajo.find(
        o =>
          o.id_ot.trim().toLowerCase() === folioLower &&
          (!empMatch || o.cliente.trim().toLowerCase() === empMatch.nombre.trim().toLowerCase()) &&
          (!eqLower || o.codigo_eq.trim().toLowerCase() === eqLower)
      ) ||
      data.ordenesTrabajo.find(
        o =>
          o.id_ot.trim().toLowerCase() === folioLower &&
          (!empMatch || o.cliente.trim().toLowerCase() === empMatch.nombre.trim().toLowerCase())
      ) ||
      data.ordenesTrabajo.find(o => o.id_ot.trim().toLowerCase() === folioLower);

    if (!ot) return null;
    const eq = findMatchedEquipo(ot.codigo_eq, ot.cliente);
    return {
      tipo: 'OT',
      folio: ot.id_ot,
      cliente: ot.cliente,
      empresaCodigo: empMatch?.codigo,
      codigoEq: ot.codigo_eq,
      nombreActivo: eq?.nombre || 'Instalaciones Generales de Planta',
      fechaProgramada: ot.fecha_tentativa,
      tecnicoSugerido: ot.tecnico,
      equipo: eq,
      ordenTrabajo: ot
    };
  }

  if (query.tipo === 'CAL') {
    const folioLower = query.folio.trim().toLowerCase();
    const eqLower = query.eq?.trim().toLowerCase();
    const cal =
      data.calibraciones.find(
        c =>
          c.id_ot.trim().toLowerCase() === folioLower &&
          (!empMatch || c.cliente.trim().toLowerCase() === empMatch.nombre.trim().toLowerCase()) &&
          (!eqLower || c.codigo_eq.trim().toLowerCase() === eqLower)
      ) ||
      data.calibraciones.find(
        c =>
          c.id_ot.trim().toLowerCase() === folioLower &&
          (!empMatch || c.cliente.trim().toLowerCase() === empMatch.nombre.trim().toLowerCase())
      ) ||
      data.calibraciones.find(c => c.id_ot.trim().toLowerCase() === folioLower);

    if (cal) {
      const eq = findMatchedEquipo(cal.codigo_eq, cal.cliente);
      return {
        tipo: 'CAL',
        folio: cal.id_ot,
        cliente: cal.cliente,
        empresaCodigo: empMatch?.codigo,
        codigoEq: cal.codigo_eq,
        nombreActivo: cal.instrumento_nombre,
        fechaProgramada: cal.fecha_programada,
        frecuencia: cal.frecuencia_calibracion,
        tecnicoSugerido: cal.metrologo_laboratorio,
        equipo: eq,
        calibracion: cal,
        isProjectedCal: false
      };
    }

    // Try resolving a projected calibration order if folio contains PROY or eq + mes + anio match
    const targetAnio = query.anio || data.defaultAnio;
    const inst = data.instrumentos.find(i => {
      if (query.eq && i.codigo_inst.trim().toLowerCase() !== query.eq.trim().toLowerCase()) return false;
      if (query.act && i.nombre.trim().toLowerCase() !== query.act.trim().toLowerCase()) return false;
      if (empMatch && i.cliente.trim().toLowerCase() !== empMatch.nombre.trim().toLowerCase()) return false;
      return true;
    }) || data.instrumentos.find(i => {
      if (query.eq && i.codigo_inst.trim().toLowerCase() !== query.eq.trim().toLowerCase()) return false;
      if (empMatch && i.cliente.trim().toLowerCase() !== empMatch.nombre.trim().toLowerCase()) return false;
      return true;
    });

    if (inst) {
      const occurs = calcularOcurrenciasInstrumento(
        inst,
        targetAnio,
        data.frecuencias,
        data.calibraciones.filter(c => c.cliente.trim() === inst.cliente.trim())
      );
      const occ =
        (query.fecha
          ? occurs.find(o => formatFechaDDMMYYYY(o.fecha) === query.fecha!.trim())
          : undefined) ||
        occurs.find(o => !query.mes || o.mes_n === query.mes);
      if (occ) {
        if (occ.ordenMatch) {
          return {
            tipo: 'CAL',
            folio: occ.ordenMatch.id_ot,
            cliente: occ.ordenMatch.cliente,
            empresaCodigo: empMatch?.codigo,
            codigoEq: occ.ordenMatch.codigo_eq,
            nombreActivo: occ.ordenMatch.instrumento_nombre,
            fechaProgramada: occ.ordenMatch.fecha_programada,
            frecuencia: occ.ordenMatch.frecuencia_calibracion,
            tecnicoSugerido: occ.ordenMatch.metrologo_laboratorio,
            calibracion: occ.ordenMatch,
            isProjectedCal: false
          };
        }
        const { tolerancia } = obtenerFrecuenciaConfig(inst.frecuencia, data.frecuencias);
        const dtTent = new Date(occ.fecha);
        dtTent.setDate(dtTent.getDate() + Math.max(3, Math.min(7, tolerancia)));
        const virtualOrder: OrdenCalibracion = {
          id_ot: query.folio,
          codigo_eq: inst.codigo_inst,
          cliente: inst.cliente,
          instrumento_nombre: inst.nombre,
          variable_medicion: inst.variable_medicion,
          rango_operacion: inst.rango_operacion,
          tolerancia_emp: inst.tolerancia_emp,
          frecuencia_calibracion: inst.frecuencia,
          patron_utilizado: inst.patron_habitual,
          fecha_emision: formatFechaDDMMYYYY(new Date()),
          fecha_programada: formatFechaDDMMYYYY(occ.fecha),
          fecha_tentativa: formatFechaDDMMYYYY(dtTent),
          dias_tolerancia: tolerancia,
          estado: 'Pendiente',
          fecha_real: '',
          metrologo_laboratorio: inst.metrologo_habitual || 'Metrología Interna',
          observaciones: inst.notas
        };
        return {
          tipo: 'CAL',
          folio: query.folio,
          cliente: inst.cliente,
          empresaCodigo: empMatch?.codigo,
          codigoEq: inst.codigo_inst,
          nombreActivo: inst.nombre,
          fechaProgramada: virtualOrder.fecha_programada,
          mes_n: occ.mes_n,
          anio: targetAnio,
          frecuencia: inst.frecuencia,
          tecnicoSugerido: virtualOrder.metrologo_laboratorio,
          calibracion: virtualOrder,
          isProjectedCal: true
        };
      }
    }
    return null;
  }

  // MP resolution: ALWAYS resolve against the exact plant/equipment/date/folio occurrence first
  // so repeated folios (e.g. MP-0001 across different months/assets/plants) NEVER resolve to an unrelated closed order.
  const anioFromFolio = query.folio.match(/^MP-(\d{4})-/)?.[1];
  const mesFromFolio = query.folio.match(/^MP-\d{4}-(\d{2})-/)?.[1];
  const targetAnio = query.anio || (anioFromFolio ? Number(anioFromFolio) : data.defaultAnio);
  const targetMes = query.mes || (mesFromFolio ? Number(mesFromFolio) : undefined);

  const scopedEquipos = empMatch
    ? data.equipos.filter(e => e.cliente.trim().toLowerCase() === empMatch.nombre.trim().toLowerCase())
    : data.equipos;

  const mapaFolios = generarMapaFoliosAnual(scopedEquipos, targetAnio, data.frecuencias, data.historial);

  interface MPCandidate {
    score: number;
    folioMatch: boolean;
    fechaMatch: boolean;
    eq: Equipo;
    occ: ReturnType<typeof calcularOcurrenciasEquipo>[number];
    folio: string;
    fechaStr: string;
  }

  const candidates: MPCandidate[] = [];
  const qFolioLower = query.folio.trim().toLowerCase();
  const qEqLower = query.eq?.trim().toLowerCase();
  const qFreqLower = query.freq?.trim().toLowerCase();
  const qActLower = query.act?.trim().toLowerCase();
  const qFecha = query.fecha?.trim();

  for (const eq of scopedEquipos) {
    if (qEqLower && eq.codigo_eq.trim().toLowerCase() !== qEqLower) continue;
    if (qFreqLower && eq.frecuencia.trim().toLowerCase() !== qFreqLower) continue;

    const eqCode = eq.codigo_eq.trim();
    const eqUid = String(eq.id || `${eqCode}__${eq.nombre}`).trim();
    const freq = String(eq.frecuencia || '').trim();
    const occurs = calcularOcurrenciasEquipo(eq, targetAnio, data.frecuencias, data.historial, scopedEquipos);

    const eqidMatch = Boolean(query.eqid && eq.id && eq.id === query.eqid);
    const actMatch = Boolean(qActLower && eq.nombre.trim().toLowerCase() === qActLower);

    for (const occ of occurs) {
      if (targetMes && occ.mes_n !== targetMes) continue;

      const fechaYmd = formatFechaYYYYMMDD(occ.fecha);
      const fechaStr = formatFechaDDMMYYYY(occ.fecha);
      const computedFolio =
        occ.historialMatch?.id_ot?.trim() ||
        mapaFolios.get(`${eqUid}_${freq}_${occ.seq_key}`) ||
        mapaFolios.get(`${eqUid}_${freq}_${fechaYmd}`) ||
        mapaFolios.get(`${eqCode}_${freq}_${occ.seq_key}`) ||
        mapaFolios.get(`${eqCode}_${freq}_${fechaYmd}`) ||
        mapaFolios.get(`${eqCode}_${occ.seq_key}`) ||
        mapaFolios.get(`${eqCode}_${occ.fecha.toISOString().slice(0, 10)}`);

      const folioMatch = Boolean(computedFolio && computedFolio.toLowerCase() === qFolioLower);
      const fechaMatch = Boolean(qFecha && fechaStr === qFecha);

      // Must match either the folio OR the exact scheduled date (for disambiguation if folio shifted across Todos vs single-plant view)
      if (!folioMatch && !fechaMatch) {
        // Legacy deep links without fecha/folio match can only fall back if act+eq+mes match AND there is no closed conflict
        if (!(qEqLower && targetMes && actMatch && !qFecha)) continue;
      }

      let score = 0;
      if (eqidMatch) score += 200;
      if (actMatch) score += 120;
      if (fechaMatch) score += 90;
      if (folioMatch) score += 70;
      if (!occ.historialMatch) score += 5;

      candidates.push({
        score,
        folioMatch,
        fechaMatch,
        eq,
        occ,
        folio: computedFolio || query.folio,
        fechaStr
      });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return {
      tipo: 'MP',
      folio: best.folio,
      cliente: best.eq.cliente,
      empresaCodigo: empMatch?.codigo,
      codigoEq: best.eq.codigo_eq,
      nombreActivo: best.eq.nombre,
      fechaProgramada: best.fechaStr,
      mes_n: best.occ.mes_n,
      anio: targetAnio,
      frecuencia: best.eq.frecuencia,
      tecnicoSugerido: best.eq.tecnico,
      equipo: best.eq,
      historialMP: best.occ.historialMatch
    };
  }

  // Fallback for orphan historical MP records whose equipment schedule slot was removed/altered
  const histMatch = data.historial.find(h => {
    if (h.id_ot.trim().toLowerCase() !== qFolioLower) return false;
    if (qEqLower && h.codigo_eq.trim().toLowerCase() !== qEqLower) return false;
    if (targetMes && h.mes_n !== targetMes) return false;
    if (qFreqLower && h.frecuencia && h.frecuencia.trim().toLowerCase() !== qFreqLower) return false;
    if (empMatch && !scopedEquipos.some(e => e.codigo_eq.trim().toLowerCase() === h.codigo_eq.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  if (histMatch) {
    const eq = findMatchedEquipo(histMatch.codigo_eq, empMatch?.nombre || '');
    return {
      tipo: 'MP',
      folio: histMatch.id_ot,
      cliente: eq?.cliente || empMatch?.nombre || 'Planta',
      empresaCodigo: empMatch?.codigo,
      codigoEq: histMatch.codigo_eq,
      nombreActivo: eq?.nombre || histMatch.codigo_eq,
      fechaProgramada: histMatch.fecha_real,
      mes_n: histMatch.mes_n,
      anio: targetAnio,
      frecuencia: histMatch.frecuencia || eq?.frecuencia,
      tecnicoSugerido: histMatch.tecnico,
      equipo: eq,
      historialMP: histMatch
    };
  }

  return null;
}
