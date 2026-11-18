/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, stripUndefinedDeep } from '../firebase';
import {
  Cliente,
  Equipo,
  FrecuenciaConfig,
  Instrumento,
  MovimientoRepuesto,
  OrdenCalibracion,
  OrdenCorrectivo,
  OrdenTrabajoOT,
  RegistroHistorialMP,
  Repuesto,
  Sistema,
  Tecnico,
} from '../types';
import { formatFechaYYYYMMDD, parseFecha } from '../utils/maintenanceEngine';
import { makeSafeDocId } from '../utils/rbac';

export type ModuloDatosName =
  | 'equipos'
  | 'instrumentos'
  | 'historial'
  | 'correctivos'
  | 'ordenesTrabajo'
  | 'calibraciones'
  | 'repuestos'
  | 'movimientosRepuestos';

export const MODULOS_DATOS: ModuloDatosName[] = [
  'equipos',
  'instrumentos',
  'historial',
  'correctivos',
  'ordenesTrabajo',
  'calibraciones',
  'repuestos',
  'movimientosRepuestos',
];

export const FIRESTORE_SOFT_WARN_BYTES = 750_000;
export const FIRESTORE_HARD_LIMIT_BYTES = 960_000;
export const FIRESTORE_MAX_MODULO_ITEMS = 2500;

export const LEGACY_STORAGE_KEYS = {
  CLIENTES: 'prodexus_clientes',
  SISTEMAS: 'prodexus_sistemas',
  FRECUENCIAS: 'prodexus_frecuencias',
  TECNICOS: 'prodexus_tecnicos',
  EQUIPOS: 'prodexus_equipos',
  HISTORIAL: 'prodexus_historial',
  CORRECTIVOS: 'prodexus_correctivos',
  ORDENES_TRABAJO: 'prodexus_ordenes_trabajo',
  CALIBRACIONES: 'prodexus_calibraciones',
  INSTRUMENTOS: 'prodexus_instrumentos',
  REPUESTOS: 'prodexus_repuestos',
  MOVIMIENTOS_REPUESTOS: 'prodexus_movimientos_repuestos',
  SELECTED_CLIENTE: 'prodexus_selected_cliente',
  SELECTED_ANIO: 'prodexus_selected_anio',
};

function loadLegacyStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function estimatePayloadBytes(value: unknown): number {
  try {
    const json = JSON.stringify(value) ?? '';
    return new TextEncoder().encode(json).length;
  } catch {
    return 0;
  }
}

export function checkModuloCapacity(
  items: unknown[],
  label: string,
  onWarn?: (msg: string) => void
): void {
  if (items.length > FIRESTORE_MAX_MODULO_ITEMS) {
    throw new Error(
      `El módulo "${label}" superó el límite de ${FIRESTORE_MAX_MODULO_ITEMS} registros por documento.`
    );
  }
  const bytes = estimatePayloadBytes(items);
  if (bytes > FIRESTORE_HARD_LIMIT_BYTES) {
    throw new Error(
      `El módulo "${label}" (${Math.round(bytes / 1024)} KB) se acerca al límite máximo de 1 MiB en Firestore. Archive registros históricos antiguos antes de continuar.`
    );
  }
  if (bytes > FIRESTORE_SOFT_WARN_BYTES && onWarn) {
    onWarn(
      `Advertencia de capacidad: "${label}" ocupa ${Math.round(bytes / 1024)} KB (cerca del límite de 1 MiB de Firestore).`
    );
  }
}

export async function persistEmpresaModuloRepo(
  empId: string,
  modulo: ModuloDatosName,
  items: unknown[],
  uid: string,
  onWarn?: (msg: string) => void
): Promise<void> {
  const docPath = `empresas/${empId}/datos/${modulo}`;
  checkModuloCapacity(items, modulo, onWarn);

  const docRef = doc(db, 'empresas', empId, 'datos', modulo);
  const snap = await getDoc(docRef);
  const payload = stripUndefinedDeep({
    empresaCodigo: empId,
    modulo,
    items,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  if (snap.exists()) {
    await updateDoc(docRef, {
      items: payload.items,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } else {
    await setDoc(docRef, payload);
  }
  void docPath;
}

export async function persistCatalogoRepo(
  catalogo: 'sistemas' | 'frecuencias' | 'tecnicos' | 'empresas_index',
  items: unknown[],
  uid: string,
  onWarn?: (msg: string) => void
): Promise<void> {
  const bytes = estimatePayloadBytes(items);
  if (bytes > FIRESTORE_HARD_LIMIT_BYTES) {
    throw new Error(
      `El catálogo "${catalogo}" (${Math.round(bytes / 1024)} KB) supera el límite seguro de 1 MiB.`
    );
  }
  if (bytes > FIRESTORE_SOFT_WARN_BYTES && onWarn) {
    onWarn(
      `El catálogo "${catalogo}" ocupa ${Math.round(bytes / 1024)} KB (cerca del límite de 1 MiB).`
    );
  }

  const docRef = doc(db, 'catalogos', catalogo);
  const snap = await getDoc(docRef);
  const cleanItems = stripUndefinedDeep(items);
  if (snap.exists()) {
    await updateDoc(docRef, {
      items: cleanItems,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } else {
    await setDoc(docRef, {
      catalogo,
      items: cleanItems,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  }
}

async function upsertEmpresaDocument(cli: Cliente): Promise<string> {
  const empId = makeSafeDocId(cli.codigo);
  const empRef = doc(db, 'empresas', empId);
  const empSnap = await getDoc(empRef);
  const empUpdateFields = stripUndefinedDeep({
    nombre: cli.nombre,
    rut: cli.rut || '',
    direccion: cli.direccion || '',
    telefono: cli.telefono || '',
    correo: cli.correo || '',
    trabaja_terceros: Boolean(cli.trabaja_terceros),
    ...(cli.logo ? { logo: cli.logo } : {}),
    updatedAt: serverTimestamp(),
  });

  if (empSnap.exists()) {
    const existingEmp = empSnap.data();
    if (existingEmp?.createdAt && existingEmp?.codigo === empId) {
      await updateDoc(empRef, empUpdateFields);
    } else {
      await deleteDoc(empRef);
      await setDoc(empRef, {
        codigo: empId,
        ...empUpdateFields,
        createdAt: serverTimestamp(),
      });
    }
  } else {
    await setDoc(empRef, {
      codigo: empId,
      ...empUpdateFields,
      createdAt: serverTimestamp(),
    });
  }

  return empId;
}

async function writeCompanyBuckets(params: {
  cli: Cliente;
  empId: string;
  isFirstCompany: boolean;
  uid: string;
  equipos: Equipo[];
  instrumentos: Instrumento[];
  historial: RegistroHistorialMP[];
  correctivos: OrdenCorrectivo[];
  ordenesTrabajo: OrdenTrabajoOT[];
  calibraciones: OrdenCalibracion[];
  repuestos: Repuesto[];
  movimientosRepuestos: MovimientoRepuesto[];
  onPathChange?: (path: string) => void;
}): Promise<void> {
  const { cli, empId, isFirstCompany, uid, onPathChange } = params;
  const eqEmp = params.equipos.filter((e) => e.cliente.trim() === cli.nombre.trim());
  const eqCodes = new Set(eqEmp.map((e) => e.codigo_eq.trim().toUpperCase()));
  const instEmp = params.instrumentos.filter((ins) => ins.cliente.trim() === cli.nombre.trim());
  const histEmp = params.historial.filter((h) => eqCodes.has(h.codigo_eq.trim().toUpperCase()));
  const mcEmp = params.correctivos.filter((c) => c.cliente.trim() === cli.nombre.trim());
  const otEmp = params.ordenesTrabajo.filter((o) => o.cliente.trim() === cli.nombre.trim());
  const calEmp = params.calibraciones.filter((c) => c.cliente.trim() === cli.nombre.trim());
  const repEmp = params.repuestos.filter(
    (r) =>
      r.cliente.trim() === cli.nombre.trim() ||
      (isFirstCompany && r.cliente === 'Todas las Plantas')
  );
  const repIds = new Set(repEmp.map((r) => r.id));
  const movEmp = params.movimientosRepuestos.filter((m) => repIds.has(m.repuesto_id));

  const buckets: Record<ModuloDatosName, unknown[]> = {
    equipos: eqEmp,
    instrumentos: instEmp,
    historial: histEmp,
    correctivos: mcEmp,
    ordenesTrabajo: otEmp,
    calibraciones: calEmp,
    repuestos: repEmp,
    movimientosRepuestos: movEmp,
  };

  for (const mod of MODULOS_DATOS) {
    onPathChange?.(`empresas/${empId}/datos/${mod}`);
    const modRef = doc(db, 'empresas', empId, 'datos', mod);
    const modSnap = await getDoc(modRef);
    const cleanItems = stripUndefinedDeep(buckets[mod]);
    if (
      modSnap.exists() &&
      modSnap.data()?.empresaCodigo === empId &&
      modSnap.data()?.modulo === mod
    ) {
      await updateDoc(modRef, {
        items: cleanItems,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    } else {
      await setDoc(modRef, {
        empresaCodigo: empId,
        modulo: mod,
        items: cleanItems,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    }
  }
}

export async function seedFirestoreIfEmptyRepo(uid: string): Promise<void> {
  const idxRef = doc(db, 'catalogos', 'empresas_index');
  const idxSnap = await getDoc(idxRef);
  if (idxSnap.exists()) return;

  // Lazy-load initial seed data so it never inflates the main bundle
  const initial = await import('../utils/initialData');

  const rawClientes = loadLegacyStorage<Cliente[]>(
    LEGACY_STORAGE_KEYS.CLIENTES,
    initial.INITIAL_CLIENTES
  ).map((c) => {
    if (!c.logo) {
      const initMatch = initial.INITIAL_CLIENTES.find(
        (ic) => ic.codigo === c.codigo || ic.nombre.trim() === c.nombre.trim()
      );
      if (initMatch?.logo) return { ...c, logo: initMatch.logo };
    }
    return c;
  });
  const rawSistemas = loadLegacyStorage<Sistema[]>(
    LEGACY_STORAGE_KEYS.SISTEMAS,
    initial.INITIAL_SISTEMAS
  );
  const rawFrecuencias = loadLegacyStorage<FrecuenciaConfig[]>(
    LEGACY_STORAGE_KEYS.FRECUENCIAS,
    initial.INITIAL_FRECUENCIAS
  );
  const rawTecnicos = loadLegacyStorage<Tecnico[]>(
    LEGACY_STORAGE_KEYS.TECNICOS,
    initial.INITIAL_TECNICOS
  );
  const rawEquipos = loadLegacyStorage<Equipo[]>(
    LEGACY_STORAGE_KEYS.EQUIPOS,
    initial.INITIAL_EQUIPOS
  ).map((eq, idx) => ({
    ...eq,
    id: eq.id || `${eq.codigo_eq}___${eq.frecuencia.trim()}` || `eq_${idx}`,
  }));
  const rawHistorial = loadLegacyStorage<RegistroHistorialMP[]>(
    LEGACY_STORAGE_KEYS.HISTORIAL,
    initial.INITIAL_HISTORIAL
  );
  const rawCorrectivos = loadLegacyStorage<OrdenCorrectivo[]>(
    LEGACY_STORAGE_KEYS.CORRECTIVOS,
    initial.INITIAL_CORRECTIVOS
  );
  const rawOT = loadLegacyStorage<OrdenTrabajoOT[]>(
    LEGACY_STORAGE_KEYS.ORDENES_TRABAJO,
    initial.INITIAL_ORDENES_TRABAJO
  );
  const rawCal = loadLegacyStorage<OrdenCalibracion[]>(
    LEGACY_STORAGE_KEYS.CALIBRACIONES,
    initial.INITIAL_CALIBRACIONES
  );
  const rawInst = loadLegacyStorage<Instrumento[]>(
    LEGACY_STORAGE_KEYS.INSTRUMENTOS,
    initial.INITIAL_INSTRUMENTOS
  ).map((inst) => {
    if (inst.fecha_proxima) return inst;
    const initMatch = initial.INITIAL_INSTRUMENTOS.find((i) => i.codigo_inst === inst.codigo_inst);
    if (initMatch?.fecha_proxima) return { ...inst, fecha_proxima: initMatch.fecha_proxima };
    return {
      ...inst,
      fecha_proxima: formatFechaYYYYMMDD(parseFecha(inst.fecha_alta) || new Date()),
    };
  });
  const rawRepuestos = loadLegacyStorage<Repuesto[]>(
    LEGACY_STORAGE_KEYS.REPUESTOS,
    initial.INITIAL_REPUESTOS
  );
  const rawMovs = loadLegacyStorage<MovimientoRepuesto[]>(
    LEGACY_STORAGE_KEYS.MOVIMIENTOS_REPUESTOS,
    initial.INITIAL_MOVIMIENTOS_REPUESTOS
  );

  await setDoc(
    doc(db, 'catalogos', 'sistemas'),
    stripUndefinedDeep({
      catalogo: 'sistemas',
      items: rawSistemas,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    })
  );
  await setDoc(
    doc(db, 'catalogos', 'frecuencias'),
    stripUndefinedDeep({
      catalogo: 'frecuencias',
      items: rawFrecuencias,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    })
  );
  await setDoc(
    doc(db, 'catalogos', 'tecnicos'),
    stripUndefinedDeep({
      catalogo: 'tecnicos',
      items: rawTecnicos,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    })
  );

  const empresaIds: string[] = [];
  for (let i = 0; i < rawClientes.length; i++) {
    const cli = rawClientes[i];
    const empId = await upsertEmpresaDocument(cli);
    empresaIds.push(empId);
    await writeCompanyBuckets({
      cli,
      empId,
      isFirstCompany: i === 0,
      uid,
      equipos: rawEquipos,
      instrumentos: rawInst,
      historial: rawHistorial,
      correctivos: rawCorrectivos,
      ordenesTrabajo: rawOT,
      calibraciones: rawCal,
      repuestos: rawRepuestos,
      movimientosRepuestos: rawMovs,
    });
  }

  await setDoc(idxRef, {
    catalogo: 'empresas_index',
    items: empresaIds,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function resetAllDataRepo(existingClientes: Cliente[], uid: string): Promise<string> {
  const initial = await import('../utils/initialData');
  let currentPath = 'catalogos/sistemas';

  try {
    currentPath = 'catalogos/sistemas';
    await persistCatalogoRepo('sistemas', initial.INITIAL_SISTEMAS, uid);
    currentPath = 'catalogos/frecuencias';
    await persistCatalogoRepo('frecuencias', initial.INITIAL_FRECUENCIAS, uid);
    currentPath = 'catalogos/tecnicos';
    await persistCatalogoRepo('tecnicos', initial.INITIAL_TECNICOS, uid);

    const initIds = initial.INITIAL_CLIENTES.map((c) => makeSafeDocId(c.codigo));
    const existingExtraIds = existingClientes
      .map((c) => makeSafeDocId(c.codigo))
      .filter((id) => !initIds.includes(id));

    for (let i = 0; i < initial.INITIAL_CLIENTES.length; i++) {
      const cli = initial.INITIAL_CLIENTES[i];
      currentPath = `empresas/${makeSafeDocId(cli.codigo)}`;
      const empId = await upsertEmpresaDocument(cli);
      await writeCompanyBuckets({
        cli,
        empId,
        isFirstCompany: i === 0,
        uid,
        equipos: initial.INITIAL_EQUIPOS,
        instrumentos: initial.INITIAL_INSTRUMENTOS,
        historial: initial.INITIAL_HISTORIAL,
        correctivos: initial.INITIAL_CORRECTIVOS,
        ordenesTrabajo: initial.INITIAL_ORDENES_TRABAJO,
        calibraciones: initial.INITIAL_CALIBRACIONES,
        repuestos: initial.INITIAL_REPUESTOS,
        movimientosRepuestos: initial.INITIAL_MOVIMIENTOS_REPUESTOS,
        onPathChange: (p) => {
          currentPath = p;
        },
      });
    }

    currentPath = 'catalogos/empresas_index';
    await persistCatalogoRepo('empresas_index', initIds, uid);

    for (const id of existingExtraIds) {
      for (const mod of MODULOS_DATOS) {
        try {
          await deleteDoc(doc(db, 'empresas', id, 'datos', mod));
        } catch {
          // ignore
        }
      }
      try {
        await deleteDoc(doc(db, 'empresas', id, 'config', 'usuarios'));
      } catch {
        // ignore
      }
      try {
        currentPath = `empresas/${id}`;
        await deleteDoc(doc(db, 'empresas', id));
      } catch {
        // ignore
      }
    }

    return initial.INITIAL_CLIENTES[0]?.nombre || 'Todos';
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, currentPath);
  }
}

export async function importBackupRepo(
  backup: Record<string, unknown>,
  existingClientes: Cliente[],
  uid: string
): Promise<void> {
  let currentPath = 'catalogos/sistemas';
  try {
    if (Array.isArray(backup.sistemas)) {
      currentPath = 'catalogos/sistemas';
      await persistCatalogoRepo('sistemas', backup.sistemas, uid);
    }
    if (Array.isArray(backup.frecuencias)) {
      currentPath = 'catalogos/frecuencias';
      await persistCatalogoRepo('frecuencias', backup.frecuencias, uid);
    }
    if (Array.isArray(backup.tecnicos)) {
      currentPath = 'catalogos/tecnicos';
      await persistCatalogoRepo('tecnicos', backup.tecnicos, uid);
    }

    const bClientes = Array.isArray(backup.clientes)
      ? (backup.clientes as Cliente[])
      : existingClientes;
    const bEquipos = Array.isArray(backup.equipos) ? (backup.equipos as Equipo[]) : [];
    const bInst = Array.isArray(backup.instrumentos) ? (backup.instrumentos as Instrumento[]) : [];
    const bHist = Array.isArray(backup.historial)
      ? (backup.historial as RegistroHistorialMP[])
      : [];
    const bMc = Array.isArray(backup.correctivos) ? (backup.correctivos as OrdenCorrectivo[]) : [];
    const bOt = Array.isArray(backup.ordenesTrabajo)
      ? (backup.ordenesTrabajo as OrdenTrabajoOT[])
      : [];
    const bCal = Array.isArray(backup.calibraciones)
      ? (backup.calibraciones as OrdenCalibracion[])
      : [];
    const bRep = Array.isArray(backup.repuestos) ? (backup.repuestos as Repuesto[]) : [];
    const bMov = Array.isArray(backup.movimientosRepuestos)
      ? (backup.movimientosRepuestos as MovimientoRepuesto[])
      : [];

    const ids: string[] = [];
    for (let i = 0; i < bClientes.length; i++) {
      const cli = bClientes[i];
      currentPath = `empresas/${makeSafeDocId(cli.codigo)}`;
      const empId = await upsertEmpresaDocument(cli);
      ids.push(empId);
      await writeCompanyBuckets({
        cli,
        empId,
        isFirstCompany: i === 0,
        uid,
        equipos: bEquipos,
        instrumentos: bInst,
        historial: bHist,
        correctivos: bMc,
        ordenesTrabajo: bOt,
        calibraciones: bCal,
        repuestos: bRep,
        movimientosRepuestos: bMov,
        onPathChange: (p) => {
          currentPath = p;
        },
      });
    }
    currentPath = 'catalogos/empresas_index';
    await persistCatalogoRepo('empresas_index', ids, uid);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, currentPath);
  }
}
