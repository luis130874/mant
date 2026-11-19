/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Cliente,
  Sistema,
  FrecuenciaConfig,
  Tecnico,
  Equipo,
  RegistroHistorialMP,
  OrdenCorrectivo,
  OrdenTrabajoOT,
  OrdenCalibracion,
  EstadoOrden,
  EstadoCalibracion,
  PuntoCalibracion,
  Instrumento,
  Repuesto,
  MovimientoRepuesto,
  AccionKey
} from '../types';
import {
  formatFechaDDMMYYYY,
  parseFecha,
  addFrequencyStep,
  isTecnicoDeTodasLasEmpresas,
  tecnicoPerteneceAEmpresa
} from '../utils/maintenanceEngine';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  stripUndefinedDeep
} from '../firebase';
import {
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { canValidateDigitalOrder, hasActionAccess, makeSafeDocId } from '../utils/rbac';
import { devError } from '../utils/logger';
import {
  importBackupRepo,
  LEGACY_STORAGE_KEYS,
  MODULOS_DATOS,
  ModuloDatosName,
  mutateCatalogoTransactionRepo,
  mutateEmpresaModuloTransactionRepo,
  persistCatalogoRepo,
  persistEmpresaModuloRepo,
  resetAllDataRepo,
  seedFirestoreIfEmptyRepo
} from '../services/firestoreRepository';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'warning' | 'info';
}

interface MaintenanceContextType {
  clientes: Cliente[];
  sistemas: Sistema[];
  frecuencias: FrecuenciaConfig[];
  tecnicos: Tecnico[];
  equipos: Equipo[];
  historial: RegistroHistorialMP[];
  correctivos: OrdenCorrectivo[];
  ordenesTrabajo: OrdenTrabajoOT[];
  calibraciones: OrdenCalibracion[];
  instrumentos: Instrumento[];
  selectedCliente: string;
  setSelectedCliente: (cliente: string) => void;
  selectedAnio: number;
  setSelectedAnio: (anio: number) => void;
  availableYears: number[];
  cloudLoading: boolean;
  toasts: ToastMessage[];
  addToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;

  // Clientes
  addCliente: (cliente: Cliente) => void;
  updateCliente: (codigo: string, updated: Cliente) => void;
  deleteCliente: (codigo: string, nombre: string) => void;

  // Sistemas
  addSistema: (sistema: Sistema) => void;
  updateSistema: (codigo_sis: string, updated: Sistema) => void;
  deleteSistema: (codigo_sis: string) => void;

  // Frecuencias
  addFrecuencia: (freq: FrecuenciaConfig) => void;
  updateFrecuencia: (nombre: string, updated: FrecuenciaConfig) => void;
  deleteFrecuencia: (nombre: string) => void;

  // Tecnicos
  addTecnico: (tec: Tecnico) => void;
  updateTecnico: (codigo_tec: string, updated: Tecnico) => void;
  deleteTecnico: (codigo_tec: string) => void;

  // Equipos
  addEquipo: (eq: Equipo) => void;
  updateEquipo: (keyOrCodigo: string, updated: Equipo) => void;
  deleteEquipo: (codigo_eq: string, frecuencia?: string) => void;

  // Instrumentos Metrológicos
  addInstrumento: (inst: Instrumento) => void;
  updateInstrumento: (codigo_inst: string, updated: Instrumento) => void;
  darDeBajaInstrumento: (codigo_inst: string, fecha_baja: string, motivo_baja: string) => void;
  reactivarInstrumento: (codigo_inst: string) => void;
  deleteInstrumento: (codigo_inst: string) => void;

  // Preventivos
  registrarCierrePreventivo: (data: {
    codigo_eq: string;
    mes_n: number;
    fecha_real: string;
    id_ot: string;
    comentarios: string;
    tecnico: string;
    duracion_horas?: number;
    repuestos_utilizados?: string;
    tareas_completadas?: string[];
    frecuencia?: string;
    firma_tecnico?: string;
    firma_supervisor?: string;
    firmado_por?: string;
    firmado_supervisor_por?: string;
    fecha_firma_digital?: string;
    ejecucion_digital?: boolean;
  }) => void;

  // Correctivos
  crearCorrectivo: (data: Omit<OrdenCorrectivo, 'id_ot' | 'estado' | 'fecha_real' | 'acciones_realizadas'> & {
    id_ot?: string;
  }) => string;
  cerrarCorrectivo: (id_ot: string, data: {
    fecha_real: string;
    tecnico: string;
    acciones_realizadas: string;
    repuestos_utilizados?: string;
    firma_tecnico?: string;
    firma_supervisor?: string;
    firmado_por?: string;
    firmado_supervisor_por?: string;
    fecha_firma_digital?: string;
    ejecucion_digital?: boolean;
  }) => void;
  deleteCorrectivo: (id_ot: string) => void;

  // Ordenes de Trabajo
  crearOrdenTrabajo: (data: Omit<OrdenTrabajoOT, 'id_ot' | 'estado' | 'fecha_real' | 'acciones_realizadas'> & {
    id_ot?: string;
  }) => string;
  cerrarOrdenTrabajo: (id_ot: string, data: {
    fecha_real: string;
    tecnico: string;
    acciones_realizadas: string;
    materiales_utilizados?: string;
    firma_tecnico?: string;
    firma_supervisor?: string;
    firmado_por?: string;
    firmado_supervisor_por?: string;
    fecha_firma_digital?: string;
    ejecucion_digital?: boolean;
  }) => void;
  deleteOrdenTrabajo: (id_ot: string) => void;

  // Calibraciones
  crearOrdenCalibracion: (data: Omit<OrdenCalibracion, 'id_ot' | 'estado' | 'fecha_real'> & {
    id_ot?: string;
  }) => string;
  crearOrdenesCalibracionLote: (
    orders: Array<Omit<OrdenCalibracion, 'id_ot' | 'estado' | 'fecha_real'> & {
      id_ot?: string;
      mes_objetivo?: number;
      anio_objetivo?: number;
    }>
  ) => OrdenCalibracion[];
  cerrarOrdenCalibracion: (id_ot: string, data: {
    fecha_real: string;
    dictamen: 'Conforme' | 'Ajustado y Conforme' | 'No Conforme';
    error_max_hallado: string;
    patron_utilizado?: string;
    trazabilidad_patron?: string;
    metrologo_laboratorio: string;
    puntos_calibracion?: PuntoCalibracion[];
    magnitud?: string;
    unidad_medida?: string;
    rango_min?: number;
    rango_max?: number;
    puntos_prueba?: number;
    variable_medicion?: string;
    rango_operacion?: string;
    tolerancia_emp?: string;
    observaciones?: string;
    repuestos_utilizados?: string;
    numero_certificado?: string;
    proxima_calibracion?: string;
    firma_tecnico?: string;
    firma_supervisor?: string;
    firmado_por?: string;
    firmado_supervisor_por?: string;
    fecha_firma_digital?: string;
    ejecucion_digital?: boolean;
  }) => void;
  certificarCalibracionProyectada: (
    orderData: Omit<OrdenCalibracion, 'id_ot' | 'estado' | 'fecha_real'> & {
      id_ot?: string;
      mes_objetivo?: number;
      anio_objetivo?: number;
    },
    cierreData: {
      fecha_real: string;
      dictamen: 'Conforme' | 'Ajustado y Conforme' | 'No Conforme';
      error_max_hallado: string;
      patron_utilizado?: string;
      trazabilidad_patron?: string;
      metrologo_laboratorio: string;
      puntos_calibracion?: PuntoCalibracion[];
      magnitud?: string;
      unidad_medida?: string;
      rango_min?: number;
      rango_max?: number;
      puntos_prueba?: number;
      variable_medicion?: string;
      rango_operacion?: string;
      tolerancia_emp?: string;
      observaciones?: string;
      repuestos_utilizados?: string;
      numero_certificado?: string;
      proxima_calibracion?: string;
      firma_tecnico?: string;
      firma_supervisor?: string;
      firmado_por?: string;
      firmado_supervisor_por?: string;
      fecha_firma_digital?: string;
      ejecucion_digital?: boolean;
    }
  ) => string;
  deleteOrdenCalibracion: (id_ot: string) => void;
  validarOrdenDigitalSupervisor: (params: {
    tipo: 'MP' | 'MC' | 'OT' | 'CAL';
    id_ot: string;
    cliente: string;
    historialId?: string;
    codigo_eq?: string;
    mes_n?: number;
    firmado_supervisor_por: string;
    firma_supervisor: string;
    fecha_validacion_supervisor: string;
    observacion_supervisor?: string;
  }) => void;

  // Gestión de Repuestos & Stock
  repuestos: Repuesto[];
  movimientosRepuestos: MovimientoRepuesto[];
  addRepuesto: (rep: Repuesto) => void;
  updateRepuesto: (id: string, updated: Repuesto) => void;
  deleteRepuesto: (id: string) => void;
  registrarMovimientoStock: (mov: {
    repuesto_id: string;
    tipo: 'Entrada' | 'Salida' | 'Ajuste';
    cantidad: number;
    motivo: string;
    ot_asociada?: string;
    equipo_asociado?: string;
    proveedor?: string;
    numero_factura?: string;
    solicitante: string;
  }) => void;
  registrarSalidasStockBatch: (
    items: Array<{ repuesto_id: string; cantidad: number }>,
    meta: {
      motivo: string;
      ot_asociada?: string;
      equipo_asociado?: string;
      solicitante: string;
    }
  ) => string[];

  // System
  resetAllData: () => Promise<void>;
  importBackup: (backup: Record<string, unknown>) => void;
}

export const MaintenanceContext = createContext<MaintenanceContextType | null>(null);

export const MaintenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isSuperAdmin, isCompanyAdmin, syncEmpresaNombreEnRoster } = useAuth();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [frecuencias, setFrecuencias] = useState<FrecuenciaConfig[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [historial, setHistorial] = useState<RegistroHistorialMP[]>([]);
  const [correctivos, setCorrectivos] = useState<OrdenCorrectivo[]>([]);
  const [ordenesTrabajo, setOrdenesTrabajo] = useState<OrdenTrabajoOT[]>([]);
  const [calibraciones, setCalibraciones] = useState<OrdenCalibracion[]>([]);
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  const [repuestos, setRepuestos] = useState<Repuesto[]>([]);
  const [movimientosRepuestos, setMovimientosRepuestos] = useState<MovimientoRepuesto[]>([]);
  const [cloudLoading, setCloudLoading] = useState<boolean>(true);

  const [selectedCliente, setSelectedClienteState] = useState<string>(() => {
    return localStorage.getItem(LEGACY_STORAGE_KEYS.SELECTED_CLIENTE) || 'Todos';
  });

  const [selectedAnio, setSelectedAnioState] = useState<number>(() => {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEYS.SELECTED_ANIO);
    const parsed = saved ? parseInt(saved, 10) : NaN;
    if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) return parsed;
    return new Date().getFullYear();
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<{
    options: ConfirmOptions;
    resolve: (result: boolean) => void;
  } | null>(null);

  // Refs for atomic multi-step batch writes
  const stateRef = useRef({
    clientes,
    sistemas,
    frecuencias,
    tecnicos,
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    calibraciones,
    instrumentos,
    repuestos,
    movimientosRepuestos
  });
  stateRef.current = {
    clientes,
    sistemas,
    frecuencias,
    tecnicos,
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    calibraciones,
    instrumentos,
    repuestos,
    movimientosRepuestos
  };

  // Per-company store maps for real-time aggregation
  const empresasMapRef = useRef<Record<string, Cliente>>({});
  const modulesMapRef = useRef<Record<string, Partial<Record<ModuloDatosName, unknown[]>>>>({});
  const globalSistemasRef = useRef<Sistema[]>([]);
  const globalTecnicosRef = useRef<Tecnico[]>([]);
  const backfilledTecnicosEmpRef = useRef<Set<string>>(new Set());
  const isSuperAdminRef = useRef<boolean>(isSuperAdmin);
  isSuperAdminRef.current = isSuperAdmin;

  const recomputeAggregatedState = useCallback(() => {
    const empList = Object.values(empresasMapRef.current).sort((a, b) =>
      a.codigo.localeCompare(b.codigo)
    );
    setClientes(empList);

    const mergeMod = <T,>(mod: ModuloDatosName): T[] => {
      const out: T[] = [];
      for (const emp of empList) {
        const empId = makeSafeDocId(emp.codigo);
        const arr = modulesMapRef.current[empId]?.[mod];
        if (Array.isArray(arr)) {
          out.push(...(arr as T[]));
        }
      }
      return out;
    };

    setEquipos(mergeMod<Equipo>('equipos'));
    setInstrumentos(mergeMod<Instrumento>('instrumentos'));
    setHistorial(mergeMod<RegistroHistorialMP>('historial'));
    setCorrectivos(mergeMod<OrdenCorrectivo>('correctivos'));
    setOrdenesTrabajo(mergeMod<OrdenTrabajoOT>('ordenesTrabajo'));
    setCalibraciones(mergeMod<OrdenCalibracion>('calibraciones'));
    setRepuestos(mergeMod<Repuesto>('repuestos'));
    setMovimientosRepuestos(mergeMod<MovimientoRepuesto>('movimientosRepuestos'));

    // Per-company isolated technicians (plus global mirror merge only for super_admin)
    const tecMap = new Map<string, Tecnico>();
    for (const emp of empList) {
      const empId = makeSafeDocId(emp.codigo);
      const arr = modulesMapRef.current[empId]?.tecnicos;
      if (Array.isArray(arr)) {
        for (const t of arr as Tecnico[]) {
          if (!isSuperAdminRef.current && !tecnicoPerteneceAEmpresa(t, emp.nombre)) continue;
          const key = t.codigo_tec.trim().toUpperCase();
          if (!tecMap.has(key)) {
            tecMap.set(key, t);
          }
        }
      }
    }
    if (isSuperAdminRef.current) {
      for (const t of globalTecnicosRef.current) {
        const key = t.codigo_tec.trim().toUpperCase();
        if (!tecMap.has(key)) {
          tecMap.set(key, t);
        }
      }
    }
    setTecnicos(
      Array.from(tecMap.values()).sort((a, b) => a.codigo_tec.localeCompare(b.codigo_tec))
    );

    // Company-level systems override when non-empty; otherwise fall back to global systems
    if (!isSuperAdminRef.current && empList.length > 0) {
      const ownEmpId = makeSafeDocId(empList[0].codigo);
      const ownSis = modulesMapRef.current[ownEmpId]?.sistemas as Sistema[] | undefined;
      if (Array.isArray(ownSis) && ownSis.length > 0) {
        setSistemas(ownSis);
      } else {
        setSistemas(globalSistemasRef.current);
      }
    } else {
      setSistemas(globalSistemasRef.current);
    }
  }, []);

  const addToast = useCallback(
    (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const confirmAction = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmRequest({ options, resolve });
    });
  };

  const handleConfirmResolve = (result: boolean) => {
    if (confirmRequest) {
      confirmRequest.resolve(result);
      setConfirmRequest(null);
    }
  };

  const setSelectedCliente = useCallback(
    (c: string) => {
      if (!isSuperAdmin && userProfile?.empresaNombre) {
        setSelectedClienteState(userProfile.empresaNombre);
        return;
      }
      setSelectedClienteState(c);
      localStorage.setItem(LEGACY_STORAGE_KEYS.SELECTED_CLIENTE, c);
    },
    [isSuperAdmin, userProfile]
  );

  // Enforce locked company selection for non-super-admin users
  useEffect(() => {
    if (!userProfile) return;
    if (!isSuperAdmin) {
      const matched = clientes.find(
        (c) => makeSafeDocId(c.codigo) === makeSafeDocId(userProfile.empresaCodigo)
      );
      const lockedName = matched?.nombre || userProfile.empresaNombre;
      if (lockedName && selectedCliente !== lockedName) {
        setSelectedClienteState(lockedName);
      }
    } else if (selectedCliente !== 'Todos' && clientes.length > 0 && !clientes.some((c) => c.nombre === selectedCliente)) {
      setSelectedClienteState(clientes[0].nombre);
    }
  }, [userProfile, isSuperAdmin, clientes, selectedCliente]);

  const setSelectedAnio = (anio: number) => {
    setSelectedAnioState(anio);
    localStorage.setItem(LEGACY_STORAGE_KEYS.SELECTED_ANIO, String(anio));
  };

  // Seed initial or localStorage-migrated dataset into Firestore if empresas_index doesn't exist yet
  const seedFirestoreIfEmpty = useCallback(async () => {
    if (!isSuperAdmin || !auth.currentUser) return;
    await seedFirestoreIfEmptyRepo(auth.currentUser.uid);
  }, [isSuperAdmin]);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (!userProfile || !userProfile.activo) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const companyUnsubs = new Map<string, Array<() => void>>();

    empresasMapRef.current = {};
    modulesMapRef.current = {};
    globalSistemasRef.current = [];
    globalTecnicosRef.current = [];
    backfilledTecnicosEmpRef.current.clear();
    setCloudLoading(true);

    const tryBackfillCompanyTecnicos = (empId: string) => {
      if (!isSuperAdmin || !auth.currentUser) return;
      if (backfilledTecnicosEmpRef.current.has(empId)) return;
      const emp = empresasMapRef.current[empId];
      const existingBucket = modulesMapRef.current[empId]?.tecnicos;
      if (!emp || existingBucket === undefined) return;
      if (existingBucket.length > 0 || globalTecnicosRef.current.length === 0) return;

      const scoped = globalTecnicosRef.current.filter((t) =>
        tecnicoPerteneceAEmpresa(t, emp.nombre)
      );
      if (scoped.length === 0) {
        backfilledTecnicosEmpRef.current.add(empId);
        return;
      }
      backfilledTecnicosEmpRef.current.add(empId);
      void persistEmpresaModuloRepo(empId, 'tecnicos', scoped, auth.currentUser.uid).catch(() => {
        backfilledTecnicosEmpRef.current.delete(empId);
      });
    };

    const attachCompanyListeners = (empId: string) => {
      if (companyUnsubs.has(empId)) return;
      const subs: Array<() => void> = [];

      subs.push(
        onSnapshot(
          doc(db, 'empresas', empId),
          (snap) => {
            if (snap.exists()) {
              empresasMapRef.current[empId] = snap.data() as Cliente;
              tryBackfillCompanyTecnicos(empId);
            } else {
              delete empresasMapRef.current[empId];
            }
            recomputeAggregatedState();
            setCloudLoading(false);
          },
          (err) => {
            setCloudLoading(false);
            handleFirestoreError(err, OperationType.GET, `empresas/${empId}`);
          }
        )
      );

      if (!modulesMapRef.current[empId]) modulesMapRef.current[empId] = {};

      for (const mod of MODULOS_DATOS) {
        subs.push(
          onSnapshot(
            doc(db, 'empresas', empId, 'datos', mod),
            (snap) => {
              if (!modulesMapRef.current[empId]) modulesMapRef.current[empId] = {};
              modulesMapRef.current[empId][mod] = snap.exists()
                ? ((snap.data().items as unknown[]) || [])
                : [];
              if (mod === 'tecnicos' && !snap.exists()) {
                tryBackfillCompanyTecnicos(empId);
              }
              recomputeAggregatedState();
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, `empresas/${empId}/datos/${mod}`);
            }
          )
        );
      }

      companyUnsubs.set(empId, subs);
    };

    const detachCompanyListeners = (empId: string) => {
      const subs = companyUnsubs.get(empId);
      if (subs) {
        subs.forEach((u) => u());
        companyUnsubs.delete(empId);
      }
      delete empresasMapRef.current[empId];
      delete modulesMapRef.current[empId];
    };

    const startSync = async () => {
      try {
        if (isSuperAdmin) {
          await seedFirestoreIfEmpty();
        }
        if (cancelled) return;

        // Global Catalogs (sistemas & frecuencias readable by all verified users)
        unsubs.push(
          onSnapshot(
            doc(db, 'catalogos', 'sistemas'),
            (snap) => {
              if (snap.exists()) {
                globalSistemasRef.current = (snap.data().items as Sistema[]) || [];
                recomputeAggregatedState();
              }
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, 'catalogos/sistemas');
            }
          )
        );
        unsubs.push(
          onSnapshot(
            doc(db, 'catalogos', 'frecuencias'),
            (snap) => {
              if (snap.exists()) setFrecuencias((snap.data().items as FrecuenciaConfig[]) || []);
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, 'catalogos/frecuencias');
            }
          )
        );

        // Global technicians mirror is strictly super_admin-only to prevent cross-company PII leaks
        if (isSuperAdmin) {
          unsubs.push(
            onSnapshot(
              doc(db, 'catalogos', 'tecnicos'),
              (snap) => {
                globalTecnicosRef.current = snap.exists()
                  ? ((snap.data().items as Tecnico[]) || [])
                  : [];
                for (const empId of Object.keys(empresasMapRef.current)) {
                  tryBackfillCompanyTecnicos(empId);
                }
                recomputeAggregatedState();
              },
              (err) => {
                handleFirestoreError(err, OperationType.GET, 'catalogos/tecnicos');
              }
            )
          );

          unsubs.push(
            onSnapshot(
              doc(db, 'catalogos', 'empresas_index'),
              (snap) => {
                const ids = snap.exists() ? ((snap.data().items as string[]) || []) : [];
                const idSet = new Set(ids);
                for (const existingId of Array.from(companyUnsubs.keys())) {
                  if (!idSet.has(existingId)) {
                    detachCompanyListeners(existingId);
                  }
                }
                for (const id of ids) {
                  attachCompanyListeners(id);
                }
                if (ids.length === 0) {
                  recomputeAggregatedState();
                  setCloudLoading(false);
                }
              },
              (err) => {
                handleFirestoreError(err, OperationType.GET, 'catalogos/empresas_index');
              }
            )
          );
        } else if (userProfile.empresaCodigo) {
          attachCompanyListeners(makeSafeDocId(userProfile.empresaCodigo));
        } else {
          setCloudLoading(false);
        }
      } catch (err) {
        devError('Error initializing cloud sync:', err);
        setCloudLoading(false);
      }
    };

    void startSync();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      for (const subs of companyUnsubs.values()) {
        subs.forEach((u) => u());
      }
      companyUnsubs.clear();
    };
  }, [userProfile, isSuperAdmin, seedFirestoreIfEmpty, recomputeAggregatedState]);

  // Helper to resolve which company ID owns a record
  const resolveEmpresaId = useCallback(
    (clienteName?: string): string => {
      if (!isSuperAdmin && userProfile?.empresaCodigo) {
        return makeSafeDocId(userProfile.empresaCodigo);
      }
      if (clienteName) {
        const match = stateRef.current.clientes.find(
          (c) =>
            c.nombre.trim().toLowerCase() === clienteName.trim().toLowerCase() ||
            makeSafeDocId(c.codigo) === makeSafeDocId(clienteName)
        );
        if (match) return makeSafeDocId(match.codigo);
      }
      const first = stateRef.current.clientes[0];
      return first ? makeSafeDocId(first.codigo) : '';
    },
    [isSuperAdmin, userProfile]
  );

  const guardAction = useCallback(
    (accion: AccionKey, deniedMsg = 'No tiene permisos para realizar esta acción.'): boolean => {
      if (!auth.currentUser || !userProfile?.activo) {
        addToast('Sesión inactiva o no autenticada.', 'error');
        return false;
      }
      if (!hasActionAccess(userProfile, accion)) {
        addToast(deniedMsg, 'error');
        return false;
      }
      return true;
    },
    [userProfile, addToast]
  );

  const mutateEmpresaModulo = useCallback(
    async <T,>(
      empId: string,
      modulo: ModuloDatosName,
      mutator: (currentItems: T[]) => T[],
      optimisticItems?: T[]
    ): Promise<T[] | null> => {
      if (!empId || !auth.currentUser) return null;
      if (!modulesMapRef.current[empId]) modulesMapRef.current[empId] = {};
      if (optimisticItems) {
        modulesMapRef.current[empId][modulo] = optimisticItems;
        recomputeAggregatedState();
      }

      const docPath = `empresas/${empId}/datos/${modulo}`;
      try {
        const committed = await mutateEmpresaModuloTransactionRepo<T>(
          empId,
          modulo,
          auth.currentUser.uid,
          mutator,
          (warnMsg) => addToast(warnMsg, 'warning')
        );
        modulesMapRef.current[empId][modulo] = committed;
        recomputeAggregatedState();
        return committed;
      } catch (err) {
        addToast(
          err instanceof Error && err.message.includes('1 MiB')
            ? err.message
            : 'Error de permisos o concurrencia al guardar en la nube.',
          'error'
        );
        handleFirestoreError(err, OperationType.WRITE, docPath);
        return null;
      }
    },
    [recomputeAggregatedState, addToast]
  );

  const persistCatalogo = useCallback(
    async (catalogo: 'sistemas' | 'frecuencias' | 'tecnicos' | 'empresas_index', items: unknown[]) => {
      if (!auth.currentUser) return;
      const docPath = `catalogos/${catalogo}`;
      try {
        await persistCatalogoRepo(catalogo, items, auth.currentUser.uid, (warnMsg) => {
          addToast(warnMsg, 'warning');
        });
      } catch (err) {
        addToast('Error de permisos al guardar catálogo global.', 'error');
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }
    },
    [addToast]
  );

  const mutateCatalogo = useCallback(
    async <T,>(
      catalogo: 'sistemas' | 'frecuencias' | 'tecnicos' | 'empresas_index',
      mutator: (currentItems: T[]) => T[]
    ): Promise<T[] | null> => {
      if (!auth.currentUser) return null;
      const docPath = `catalogos/${catalogo}`;
      try {
        return await mutateCatalogoTransactionRepo<T>(
          catalogo,
          auth.currentUser.uid,
          mutator,
          (warnMsg) => addToast(warnMsg, 'warning')
        );
      } catch (err) {
        addToast('Error de permisos al actualizar catálogo global.', 'error');
        handleFirestoreError(err, OperationType.WRITE, docPath);
        return null;
      }
    },
    [addToast]
  );

  // Available years
  const currentYearNow = new Date().getFullYear();
  const availableYears = React.useMemo(() => {
    const yearSet = new Set<number>();
    for (let y = currentYearNow - 1; y <= currentYearNow + 5; y++) {
      yearSet.add(y);
    }
    yearSet.add(selectedAnio);
    for (const eq of equipos) {
      const d = parseFecha(eq.fecha_proxima);
      if (d && d.getFullYear() >= 2020 && d.getFullYear() <= 2100) yearSet.add(d.getFullYear());
    }
    for (const inst of instrumentos) {
      const d = parseFecha(inst.fecha_proxima);
      if (d && d.getFullYear() >= 2020 && d.getFullYear() <= 2100) yearSet.add(d.getFullYear());
    }
    for (const cal of calibraciones) {
      const d = parseFecha(cal.fecha_programada || cal.fecha_real);
      if (d && d.getFullYear() >= 2020 && d.getFullYear() <= 2100) yearSet.add(d.getFullYear());
    }
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [currentYearNow, selectedAnio, equipos, instrumentos, calibraciones]);

  // Client actions
  const addCliente = (c: Cliente) => {
    if (!isSuperAdmin || !auth.currentUser) {
      addToast('Solo el Administrador General puede crear nuevas empresas.', 'error');
      return;
    }
    const empId = makeSafeDocId(c.codigo);
    const clienteClean: Cliente = { ...c, codigo: empId };
    const uid = auth.currentUser.uid;

    void (async () => {
      try {
        await setDoc(
          doc(db, 'empresas', empId),
          stripUndefinedDeep({
            codigo: empId,
            nombre: clienteClean.nombre,
            rut: clienteClean.rut || '',
            direccion: clienteClean.direccion || '',
            telefono: clienteClean.telefono || '',
            correo: clienteClean.correo || '',
            trabaja_terceros: Boolean(clienteClean.trabaja_terceros),
            ...(clienteClean.logo ? { logo: clienteClean.logo } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        );
        for (const mod of MODULOS_DATOS) {
          await setDoc(doc(db, 'empresas', empId, 'datos', mod), {
            empresaCodigo: empId,
            modulo: mod,
            items: [],
            updatedAt: serverTimestamp(),
            updatedBy: uid
          });
        }
        const nextIds = Array.from(
          new Set([...stateRef.current.clientes.map((cl) => makeSafeDocId(cl.codigo)), empId])
        );
        await persistCatalogo('empresas_index', nextIds);
        addToast(`Empresa "${c.nombre}" creada exitosamente.`);
      } catch (err) {
        addToast('No se pudo crear la empresa en Firestore.', 'error');
        handleFirestoreError(err, OperationType.CREATE, `empresas/${empId}`);
      }
    })();
  };

  const updateCliente = (codigo: string, updated: Cliente) => {
    if (!isCompanyAdmin) {
      addToast('Sin permisos para modificar datos de empresa.', 'error');
      return;
    }
    const empId = makeSafeDocId(codigo);
    const oldCliente = stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === empId);

    void (async () => {
      try {
        await updateDoc(
          doc(db, 'empresas', empId),
          stripUndefinedDeep({
            nombre: updated.nombre,
            rut: updated.rut || '',
            direccion: updated.direccion || '',
            telefono: updated.telefono || '',
            correo: updated.correo || '',
            trabaja_terceros: Boolean(updated.trabaja_terceros),
            ...(updated.logo !== undefined ? { logo: updated.logo } : {}),
            updatedAt: serverTimestamp()
          })
        );

        // Propagate company rename across its own module items & user roster
        if (oldCliente && oldCliente.nombre !== updated.nombre) {
          const modsToRename: ModuloDatosName[] = [
            'equipos',
            'instrumentos',
            'correctivos',
            'ordenesTrabajo',
            'calibraciones',
            'repuestos'
          ];
          for (const mod of modsToRename) {
            void mutateEmpresaModulo<Record<string, unknown>>(empId, mod, (currentArr) =>
              currentArr.map((item) =>
                item.cliente === oldCliente.nombre ? { ...item, cliente: updated.nombre } : item
              )
            );
          }
          await syncEmpresaNombreEnRoster(empId, updated.nombre);

          // Update company-scoped technicians atomically
          void mutateEmpresaModulo<Tecnico>(empId, 'tecnicos', (currentTecs) =>
            currentTecs.map((t) => ({
              ...t,
              empresas: t.empresas?.map((emp) => (emp === oldCliente.nombre ? updated.nombre : emp))
            }))
          );

          // Update global mirror only if super_admin
          if (isSuperAdmin) {
            void mutateCatalogo<Tecnico>('tecnicos', (currentTecs) =>
              currentTecs.map((t) => ({
                ...t,
                empresas: t.empresas?.map((emp) => (emp === oldCliente.nombre ? updated.nombre : emp))
              }))
            );
          }

          if (selectedCliente === oldCliente.nombre) {
            setSelectedClienteState(updated.nombre);
          }
        }
        addToast(`Empresa "${updated.nombre}" actualizada.`);
      } catch (err) {
        addToast('No se pudo actualizar la empresa.', 'error');
        handleFirestoreError(err, OperationType.UPDATE, `empresas/${empId}`);
      }
    })();
  };

  const deleteCliente = (codigo: string, nombre: string) => {
    if (!isSuperAdmin) {
      addToast('Solo el Administrador General puede eliminar empresas.', 'error');
      return;
    }
    const empId = makeSafeDocId(codigo);
    void (async () => {
      try {
        for (const mod of MODULOS_DATOS) {
          try {
            await deleteDoc(doc(db, 'empresas', empId, 'datos', mod));
          } catch {
            // Ignore if module doc doesn't exist
          }
        }
        try {
          await deleteDoc(doc(db, 'empresas', empId, 'config', 'usuarios'));
        } catch {
          // Ignore if no roster
        }
        await deleteDoc(doc(db, 'empresas', empId));
        const nextIds = stateRef.current.clientes
          .map((cl) => makeSafeDocId(cl.codigo))
          .filter((id) => id !== empId);
        await persistCatalogo('empresas_index', nextIds);

        if (selectedCliente === nombre) {
          const rest = stateRef.current.clientes.filter((c) => makeSafeDocId(c.codigo) !== empId);
          setSelectedCliente(rest.length > 0 ? rest[0].nombre : 'Todos');
        }
        addToast(`Empresa "${nombre}" y sus datos asociados fueron eliminados.`, 'warning');
      } catch (err) {
        addToast('Error al eliminar la empresa.', 'error');
        handleFirestoreError(err, OperationType.DELETE, `empresas/${empId}`);
      }
    })();
  };

  // Systems (super_admin updates global catalog; company users isolate into empresas/{empId}/datos/sistemas)
  const addSistema = (s: Sistema) => {
    if (!guardAction('crear_editar', 'Sin permisos para crear sistemas.')) return;
    if (isSuperAdmin) {
      globalSistemasRef.current = [...globalSistemasRef.current, s];
      setSistemas(globalSistemasRef.current);
      void mutateCatalogo<Sistema>('sistemas', (curr) => [
        ...curr.filter((item) => item.codigo_sis !== s.codigo_sis),
        s
      ]);
    } else {
      const empId = resolveEmpresaId();
      const base = stateRef.current.sistemas;
      const next = [...base.filter((item) => item.codigo_sis !== s.codigo_sis), s];
      void mutateEmpresaModulo<Sistema>(
        empId,
        'sistemas',
        (curr) => {
          const seed = curr.length > 0 ? curr : globalSistemasRef.current;
          return [...seed.filter((item) => item.codigo_sis !== s.codigo_sis), s];
        },
        next
      );
    }
    addToast(`Sistema "${s.nombre}" agregado.`);
  };

  const updateSistema = (codigo: string, updated: Sistema) => {
    if (!guardAction('crear_editar', 'Sin permisos para editar sistemas.')) return;
    if (isSuperAdmin) {
      const next = globalSistemasRef.current.map((s) => (s.codigo_sis === codigo ? updated : s));
      globalSistemasRef.current = next;
      setSistemas(next);
      void mutateCatalogo<Sistema>('sistemas', (curr) =>
        curr.map((s) => (s.codigo_sis === codigo ? updated : s))
      );
    } else {
      const empId = resolveEmpresaId();
      const next = stateRef.current.sistemas.map((s) => (s.codigo_sis === codigo ? updated : s));
      void mutateEmpresaModulo<Sistema>(
        empId,
        'sistemas',
        (curr) => {
          const seed = curr.length > 0 ? curr : globalSistemasRef.current;
          return seed.map((s) => (s.codigo_sis === codigo ? updated : s));
        },
        next
      );
    }
    addToast(`Sistema "${updated.nombre}" actualizado.`);
  };

  const deleteSistema = (codigo: string) => {
    if (!guardAction('eliminar', 'Sin permisos para eliminar sistemas.')) return;
    if (isSuperAdmin) {
      const next = globalSistemasRef.current.filter((s) => s.codigo_sis !== codigo);
      globalSistemasRef.current = next;
      setSistemas(next);
      void mutateCatalogo<Sistema>('sistemas', (curr) =>
        curr.filter((s) => s.codigo_sis !== codigo)
      );
    } else {
      const empId = resolveEmpresaId();
      const next = stateRef.current.sistemas.filter((s) => s.codigo_sis !== codigo);
      void mutateEmpresaModulo<Sistema>(
        empId,
        'sistemas',
        (curr) => {
          const seed = curr.length > 0 ? curr : globalSistemasRef.current;
          return seed.filter((s) => s.codigo_sis !== codigo);
        },
        next
      );
    }
    addToast(`Sistema eliminado.`, 'info');
  };

  // Frequencies (global standard, super_admin-only writes)
  const addFrecuencia = (f: FrecuenciaConfig) => {
    if (!isSuperAdmin) {
      addToast('Solo el Administrador General puede modificar frecuencias globales.', 'error');
      return;
    }
    const next = [...stateRef.current.frecuencias, f];
    setFrecuencias(next);
    void mutateCatalogo<FrecuenciaConfig>('frecuencias', (curr) => [
      ...curr.filter((item) => item.nombre_freq !== f.nombre_freq),
      f
    ]);
    addToast(`Frecuencia "${f.nombre_freq}" configurada.`);
  };

  const updateFrecuencia = (nombre: string, updated: FrecuenciaConfig) => {
    if (!isSuperAdmin) {
      addToast('Solo el Administrador General puede modificar frecuencias globales.', 'error');
      return;
    }
    const next = stateRef.current.frecuencias.map((f) => (f.nombre_freq === nombre ? updated : f));
    setFrecuencias(next);
    void mutateCatalogo<FrecuenciaConfig>('frecuencias', (curr) =>
      curr.map((f) => (f.nombre_freq === nombre ? updated : f))
    );
    addToast(`Frecuencia "${updated.nombre_freq}" actualizada.`);
  };

  const deleteFrecuencia = (nombre: string) => {
    if (!isSuperAdmin) {
      addToast('Solo el Administrador General puede eliminar frecuencias globales.', 'error');
      return;
    }
    const next = stateRef.current.frecuencias.filter((f) => f.nombre_freq !== nombre);
    setFrecuencias(next);
    void mutateCatalogo<FrecuenciaConfig>('frecuencias', (curr) =>
      curr.filter((f) => f.nombre_freq !== nombre)
    );
    addToast(`Frecuencia eliminada.`, 'info');
  };

  // Technicians (strictly isolated per company under empresas/{empId}/datos/tecnicos)
  const addTecnico = (t: Tecnico) => {
    if (!guardAction('crear_editar', 'Sin permisos para registrar técnicos.')) return;

    if (!isSuperAdmin) {
      const ownEmpId = resolveEmpresaId();
      const ownCompany =
        stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === ownEmpId)?.nombre ||
        userProfile?.empresaNombre ||
        '';
      const scopedTec: Tecnico = {
        ...t,
        empresas: ownCompany ? [ownCompany] : []
      };
      const curr = (modulesMapRef.current[ownEmpId]?.tecnicos as Tecnico[]) || [];
      void mutateEmpresaModulo<Tecnico>(
        ownEmpId,
        'tecnicos',
        (latest) => [...latest.filter((x) => x.codigo_tec !== scopedTec.codigo_tec), scopedTec],
        [...curr.filter((x) => x.codigo_tec !== scopedTec.codigo_tec), scopedTec]
      );
      addToast(`Técnico "${scopedTec.nombre}" dado de alta.`);
      return;
    }

    // Super Admin: update target companies + global mirror atomically
    globalTecnicosRef.current = [
      ...globalTecnicosRef.current.filter((x) => x.codigo_tec !== t.codigo_tec),
      t
    ];
    void mutateCatalogo<Tecnico>('tecnicos', (curr) => [
      ...curr.filter((x) => x.codigo_tec !== t.codigo_tec),
      t
    ]);
    for (const cli of stateRef.current.clientes) {
      if (tecnicoPerteneceAEmpresa(t, cli.nombre)) {
        const empId = makeSafeDocId(cli.codigo);
        const curr = (modulesMapRef.current[empId]?.tecnicos as Tecnico[]) || [];
        void mutateEmpresaModulo<Tecnico>(
          empId,
          'tecnicos',
          (latest) => [...latest.filter((x) => x.codigo_tec !== t.codigo_tec), t],
          [...curr.filter((x) => x.codigo_tec !== t.codigo_tec), t]
        );
      }
    }
    addToast(`Técnico "${t.nombre}" dado de alta.`);
  };

  const updateTecnico = (codigo: string, updated: Tecnico) => {
    if (!guardAction('crear_editar', 'Sin permisos para editar técnicos.')) return;
    const existing = stateRef.current.tecnicos.find((t) => t.codigo_tec === codigo);

    if (!isSuperAdmin) {
      const ownEmpId = resolveEmpresaId();
      const ownCompany =
        stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === ownEmpId)?.nombre ||
        userProfile?.empresaNombre ||
        '';
      if (
        existing &&
        (isTecnicoDeTodasLasEmpresas(existing) ||
          (existing.empresas || []).length > 1 ||
          !tecnicoPerteneceAEmpresa(existing, ownCompany))
      ) {
        addToast('No puede modificar técnicos compartidos con otras empresas.', 'error');
        return;
      }
      const scopedUpdated: Tecnico = {
        ...updated,
        empresas: ownCompany ? [ownCompany] : []
      };
      const curr = (modulesMapRef.current[ownEmpId]?.tecnicos as Tecnico[]) || [];
      void mutateEmpresaModulo<Tecnico>(
        ownEmpId,
        'tecnicos',
        (latest) => latest.map((t) => (t.codigo_tec === codigo ? scopedUpdated : t)),
        curr.map((t) => (t.codigo_tec === codigo ? scopedUpdated : t))
      );
      addToast(`Técnico "${updated.nombre}" actualizado.`);
      return;
    }

    globalTecnicosRef.current = globalTecnicosRef.current.map((t) =>
      t.codigo_tec === codigo ? updated : t
    );
    void mutateCatalogo<Tecnico>('tecnicos', (curr) =>
      curr.map((t) => (t.codigo_tec === codigo ? updated : t))
    );
    for (const cli of stateRef.current.clientes) {
      const empId = makeSafeDocId(cli.codigo);
      const belongsNow = tecnicoPerteneceAEmpresa(updated, cli.nombre);
      const curr = (modulesMapRef.current[empId]?.tecnicos as Tecnico[]) || [];
      const hadBefore = curr.some((t) => t.codigo_tec === codigo);
      if (belongsNow || hadBefore) {
        const nextArr = belongsNow
          ? [...curr.filter((t) => t.codigo_tec !== codigo), updated]
          : curr.filter((t) => t.codigo_tec !== codigo);
        void mutateEmpresaModulo<Tecnico>(
          empId,
          'tecnicos',
          (latest) =>
            belongsNow
              ? [...latest.filter((t) => t.codigo_tec !== codigo), updated]
              : latest.filter((t) => t.codigo_tec !== codigo),
          nextArr
        );
      }
    }
    addToast(`Técnico "${updated.nombre}" actualizado.`);
  };

  const deleteTecnico = (codigo: string) => {
    if (!guardAction('eliminar', 'Sin permisos para eliminar técnicos.')) return;
    const existing = stateRef.current.tecnicos.find((t) => t.codigo_tec === codigo);

    if (!isSuperAdmin) {
      const ownEmpId = resolveEmpresaId();
      const ownCompany =
        stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === ownEmpId)?.nombre ||
        userProfile?.empresaNombre ||
        '';
      if (
        existing &&
        (isTecnicoDeTodasLasEmpresas(existing) ||
          (existing.empresas || []).length > 1 ||
          !tecnicoPerteneceAEmpresa(existing, ownCompany))
      ) {
        addToast('No puede eliminar técnicos compartidos con otras empresas.', 'error');
        return;
      }
      const curr = (modulesMapRef.current[ownEmpId]?.tecnicos as Tecnico[]) || [];
      void mutateEmpresaModulo<Tecnico>(
        ownEmpId,
        'tecnicos',
        (latest) => latest.filter((t) => t.codigo_tec !== codigo),
        curr.filter((t) => t.codigo_tec !== codigo)
      );
      addToast(`Técnico eliminado de la lista de activos.`, 'info');
      return;
    }

    globalTecnicosRef.current = globalTecnicosRef.current.filter((t) => t.codigo_tec !== codigo);
    void mutateCatalogo<Tecnico>('tecnicos', (curr) =>
      curr.filter((t) => t.codigo_tec !== codigo)
    );
    for (const cli of stateRef.current.clientes) {
      const empId = makeSafeDocId(cli.codigo);
      const curr = (modulesMapRef.current[empId]?.tecnicos as Tecnico[]) || [];
      if (curr.some((t) => t.codigo_tec === codigo)) {
        void mutateEmpresaModulo<Tecnico>(
          empId,
          'tecnicos',
          (latest) => latest.filter((t) => t.codigo_tec !== codigo),
          curr.filter((t) => t.codigo_tec !== codigo)
        );
      }
    }
    addToast(`Técnico eliminado de la lista de activos.`, 'info');
  };

  // Equipment
  const addEquipo = (e: Equipo) => {
    if (!guardAction('crear_editar', 'Sin permisos para registrar equipos.')) return;
    const empId = resolveEmpresaId(e.cliente);
    const clienteObj = stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === empId);
    const equipoConId: Equipo = {
      ...e,
      cliente: clienteObj?.nombre || e.cliente,
      id: e.id || `${e.codigo_eq}___${e.frecuencia.trim()}`
    };
    const currentEmpItems = (modulesMapRef.current[empId]?.equipos as Equipo[]) || [];
    void mutateEmpresaModulo<Equipo>(
      empId,
      'equipos',
      (latest) => [...latest.filter((item) => item.id !== equipoConId.id), equipoConId],
      [...currentEmpItems.filter((item) => item.id !== equipoConId.id), equipoConId]
    );
    addToast(`Equipo "${e.nombre}" (${e.codigo_eq} - ${e.frecuencia}) registrado con éxito.`);
  };

  const updateEquipo = (keyOrCodigo: string, updated: Equipo) => {
    if (!guardAction('crear_editar', 'Sin permisos para editar equipos.')) return;
    const target = stateRef.current.equipos.find(
      (e) =>
        (e.id && e.id === keyOrCodigo) ||
        `${e.codigo_eq}___${e.frecuencia}` === keyOrCodigo ||
        (e.codigo_eq === keyOrCodigo && (!e.id || e.frecuencia === updated.frecuencia))
    );
    const empId = resolveEmpresaId(updated.cliente || target?.cliente);
    const matchEquipo = (e: Equipo) =>
      Boolean(
        (e.id && e.id === keyOrCodigo) ||
          `${e.codigo_eq}___${e.frecuencia}` === keyOrCodigo ||
          (e.codigo_eq === keyOrCodigo && (!e.id || e.frecuencia === updated.frecuencia))
      );
    const currentEmpItems = (modulesMapRef.current[empId]?.equipos as Equipo[]) || [];
    const nextEmpItems = currentEmpItems.map((e) =>
      matchEquipo(e) ? { ...updated, id: updated.id || e.id || keyOrCodigo } : e
    );
    void mutateEmpresaModulo<Equipo>(
      empId,
      'equipos',
      (latest) =>
        latest.map((e) =>
          matchEquipo(e) ? { ...updated, id: updated.id || e.id || keyOrCodigo } : e
        ),
      nextEmpItems
    );
    addToast(`Equipo "${updated.nombre}" (${updated.frecuencia}) actualizado.`);
  };

  const deleteEquipo = (codigo_eq: string, frecuencia?: string) => {
    if (!guardAction('eliminar', 'Sin permisos para eliminar equipos.')) return;
    const target = stateRef.current.equipos.find(
      (e) =>
        (e.id && e.id === codigo_eq) ||
        `${e.codigo_eq}___${e.frecuencia.trim()}` === codigo_eq ||
        (frecuencia
          ? e.codigo_eq.toUpperCase() === codigo_eq.toUpperCase() &&
            e.frecuencia.trim().toLowerCase() === frecuencia.trim().toLowerCase()
          : e.codigo_eq === codigo_eq)
    );
    const empId = resolveEmpresaId(target?.cliente);
    const keepEquipo = (e: Equipo) => {
      if (e.id && e.id === codigo_eq) return false;
      if (`${e.codigo_eq}___${e.frecuencia.trim()}` === codigo_eq) return false;
      if (frecuencia) {
        return !(
          e.codigo_eq.toUpperCase() === codigo_eq.toUpperCase() &&
          e.frecuencia.trim().toLowerCase() === frecuencia.trim().toLowerCase()
        );
      }
      return e.codigo_eq !== codigo_eq;
    };
    const currentEmpItems = (modulesMapRef.current[empId]?.equipos as Equipo[]) || [];
    void mutateEmpresaModulo<Equipo>(
      empId,
      'equipos',
      (latest) => latest.filter(keepEquipo),
      currentEmpItems.filter(keepEquipo)
    );
    addToast(`Registro de mantenimiento para el equipo eliminado.`, 'info');
  };

  // Instrumentos Metrológicos
  const addInstrumento = (inst: Instrumento) => {
    if (!guardAction('crear_editar', 'Sin permisos para registrar instrumentos.')) return;
    const empId = resolveEmpresaId(inst.cliente);
    const clienteObj = stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === empId);
    const instClean = { ...inst, cliente: clienteObj?.nombre || inst.cliente };
    const currentEmpItems = (modulesMapRef.current[empId]?.instrumentos as Instrumento[]) || [];
    void mutateEmpresaModulo<Instrumento>(
      empId,
      'instrumentos',
      (latest) => [...latest.filter((i) => i.codigo_inst !== instClean.codigo_inst), instClean],
      [...currentEmpItems.filter((i) => i.codigo_inst !== instClean.codigo_inst), instClean]
    );
    addToast(`Instrumento "${inst.nombre}" (${inst.codigo_inst}) registrado exitosamente.`);
  };

  const updateInstrumento = (codigo_inst: string, updated: Instrumento) => {
    if (!guardAction('crear_editar', 'Sin permisos para editar instrumentos.')) return;
    const target = stateRef.current.instrumentos.find((i) => i.codigo_inst === codigo_inst);
    const empId = resolveEmpresaId(updated.cliente || target?.cliente);
    const currentEmpItems = (modulesMapRef.current[empId]?.instrumentos as Instrumento[]) || [];
    void mutateEmpresaModulo<Instrumento>(
      empId,
      'instrumentos',
      (latest) => latest.map((i) => (i.codigo_inst === codigo_inst ? updated : i)),
      currentEmpItems.map((i) => (i.codigo_inst === codigo_inst ? updated : i))
    );
    addToast(`Instrumento "${updated.nombre}" actualizado.`);
  };

  const darDeBajaInstrumento = (codigo_inst: string, fecha_baja: string, motivo_baja: string) => {
    if (!guardAction('eliminar', 'Sin permisos para dar de baja instrumentos.')) return;
    const target = stateRef.current.instrumentos.find((i) => i.codigo_inst === codigo_inst);
    const empId = resolveEmpresaId(target?.cliente);
    const currentEmpItems = (modulesMapRef.current[empId]?.instrumentos as Instrumento[]) || [];
    const mapFn = (i: Instrumento) =>
      i.codigo_inst === codigo_inst
        ? { ...i, estado: 'Baja' as const, fecha_baja, motivo_baja }
        : i;
    void mutateEmpresaModulo<Instrumento>(
      empId,
      'instrumentos',
      (latest) => latest.map(mapFn),
      currentEmpItems.map(mapFn)
    );
    addToast(`Instrumento "${codigo_inst}" dado de baja del servicio activo.`, 'warning');
  };

  const reactivarInstrumento = (codigo_inst: string) => {
    if (!guardAction('crear_editar', 'Sin permisos para reactivar instrumentos.')) return;
    const target = stateRef.current.instrumentos.find((i) => i.codigo_inst === codigo_inst);
    const empId = resolveEmpresaId(target?.cliente);
    const currentEmpItems = (modulesMapRef.current[empId]?.instrumentos as Instrumento[]) || [];
    const mapFn = (i: Instrumento) => {
      if (i.codigo_inst === codigo_inst) {
        const { fecha_baja: _fb, motivo_baja: _mb, ...rest } = i;
        return { ...rest, estado: 'Activo' as const };
      }
      return i;
    };
    void mutateEmpresaModulo<Instrumento>(
      empId,
      'instrumentos',
      (latest) => latest.map(mapFn),
      currentEmpItems.map(mapFn)
    );
    addToast(`Instrumento "${codigo_inst}" reactivado a estado Activo.`, 'success');
  };

  const deleteInstrumento = (codigo_inst: string) => {
    if (!guardAction('eliminar', 'Sin permisos para eliminar instrumentos.')) return;
    const target = stateRef.current.instrumentos.find((i) => i.codigo_inst === codigo_inst);
    const empId = resolveEmpresaId(target?.cliente);
    const currentEmpItems = (modulesMapRef.current[empId]?.instrumentos as Instrumento[]) || [];
    void mutateEmpresaModulo<Instrumento>(
      empId,
      'instrumentos',
      (latest) => latest.filter((i) => i.codigo_inst !== codigo_inst),
      currentEmpItems.filter((i) => i.codigo_inst !== codigo_inst)
    );
    addToast(`Instrumento "${codigo_inst}" eliminado permanentemente.`, 'info');
  };

  // Preventivos close
  const registrarCierrePreventivo = (data: {
    codigo_eq: string;
    mes_n: number;
    fecha_real: string;
    id_ot: string;
    comentarios: string;
    tecnico: string;
    duracion_horas?: number;
    repuestos_utilizados?: string;
    tareas_completadas?: string[];
    frecuencia?: string;
    firma_tecnico?: string;
    firma_supervisor?: string;
    firmado_por?: string;
    firmado_supervisor_por?: string;
    fecha_firma_digital?: string;
    ejecucion_digital?: boolean;
  }) => {
    if (!guardAction('cerrar_ordenes', 'Sin permisos para cerrar órdenes preventivas.')) return;
    const eqMatch = stateRef.current.equipos.find(
      (e) =>
        e.codigo_eq.trim().toUpperCase() === data.codigo_eq.trim().toUpperCase() &&
        (!data.frecuencia || e.frecuencia.trim().toLowerCase() === data.frecuencia.trim().toLowerCase())
    ) || stateRef.current.equipos.find(
      (e) => e.codigo_eq.trim().toUpperCase() === data.codigo_eq.trim().toUpperCase()
    );
    const empId = resolveEmpresaId(eqMatch?.cliente || (selectedCliente !== 'Todos' ? selectedCliente : undefined));
    const currentEmpItems = (modulesMapRef.current[empId]?.historial as RegistroHistorialMP[]) || [];
    const nuevoRegistro: RegistroHistorialMP = {
      id: `h_${Date.now()}`,
      ...data,
      ...(data.firma_supervisor
        ? {
            validado_supervisor: true,
            fecha_validacion_supervisor: data.fecha_firma_digital || data.fecha_real
          }
        : {})
    };
    const upsertHistorial = (list: RegistroHistorialMP[]) => {
      const filtered = list.filter(
        (h) =>
          !(
            h.id_ot.trim().toLowerCase() === data.id_ot.trim().toLowerCase() &&
            h.codigo_eq.trim().toUpperCase() === data.codigo_eq.trim().toUpperCase() &&
            h.mes_n === data.mes_n
          )
      );
      return [...filtered, nuevoRegistro];
    };
    void mutateEmpresaModulo<RegistroHistorialMP>(
      empId,
      'historial',
      upsertHistorial,
      upsertHistorial(currentEmpItems)
    );
    addToast(
      `Cierre preventivo de ${data.id_ot} registrado. El plan del año actual permanece inalterado; la fecha real ajustará el plan del año siguiente.`
    );
  };

  // Correctivos
  const crearCorrectivo = (
    data: Omit<OrdenCorrectivo, 'id_ot' | 'estado' | 'fecha_real' | 'acciones_realizadas'> & {
      id_ot?: string;
    }
  ): string => {
    if (!guardAction('emitir_ordenes', 'Sin permisos para emitir órdenes correctivas.')) return '';
    const dateObj = parseFecha(data.fecha_emision) || new Date();
    const mes = dateObj.getMonth() + 1;
    const anio = dateObj.getFullYear();
    const prefix = `MC-${anio}-${String(mes).padStart(2, '0')}-`;
    const existingSet = new Set(stateRef.current.correctivos.map((c) => c.id_ot));
    let seq = stateRef.current.correctivos.filter((c) => c.id_ot.startsWith(prefix)).length + 1;
    while (existingSet.has(`${prefix}${String(seq).padStart(4, '0')}`)) {
      seq++;
    }
    const folio = data.id_ot || `${prefix}${String(seq).padStart(4, '0')}`;

    const empId = resolveEmpresaId(data.cliente);
    const clienteObj = stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === empId);
    const nuevaOrden: OrdenCorrectivo = {
      ...data,
      cliente: clienteObj?.nombre || data.cliente,
      id_ot: folio,
      estado: 'Pendiente',
      fecha_real: '',
      acciones_realizadas: ''
    };
    const currentEmpItems = (modulesMapRef.current[empId]?.correctivos as OrdenCorrectivo[]) || [];
    void mutateEmpresaModulo<OrdenCorrectivo>(
      empId,
      'correctivos',
      (latest) => [nuevaOrden, ...latest.filter((c) => c.id_ot !== folio)],
      [nuevaOrden, ...currentEmpItems.filter((c) => c.id_ot !== folio)]
    );
    addToast(`Orden Correctiva ${folio} emitida.`);
    return folio;
  };

  const cerrarCorrectivo = (
    id_ot: string,
    data: {
      fecha_real: string;
      tecnico: string;
      acciones_realizadas: string;
      repuestos_utilizados?: string;
      firma_tecnico?: string;
      firma_supervisor?: string;
      firmado_por?: string;
      firmado_supervisor_por?: string;
      fecha_firma_digital?: string;
      ejecucion_digital?: boolean;
    }
  ) => {
    if (!guardAction('cerrar_ordenes', 'Sin permisos para cerrar órdenes correctivas.')) return;
    const target = stateRef.current.correctivos.find((c) => c.id_ot === id_ot);
    const empId = resolveEmpresaId(target?.cliente);
    const transform = (list: OrdenCorrectivo[]) =>
      list.map((c) => {
        if (c.id_ot === id_ot) {
          const fTent = parseFecha(c.fecha_tentativa);
          const fReal = parseFecha(data.fecha_real) || new Date();
          let nuevoEstado: EstadoOrden = 'Cerrada (A tiempo)';
          if (fTent) {
            fTent.setHours(0, 0, 0, 0);
            fReal.setHours(0, 0, 0, 0);
            const diffDays = Math.round((fReal.getTime() - fTent.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > c.dias_tolerancia) {
              nuevoEstado = 'Cerrada (Fuera de término)';
            }
          }
          return {
            ...c,
            estado: nuevoEstado,
            fecha_real: data.fecha_real,
            tecnico: data.tecnico,
            acciones_realizadas: data.acciones_realizadas,
            repuestos_utilizados: data.repuestos_utilizados || c.repuestos_utilizados,
            ...(data.firma_tecnico !== undefined ? { firma_tecnico: data.firma_tecnico } : {}),
            ...(data.firma_supervisor !== undefined ? { firma_supervisor: data.firma_supervisor } : {}),
            ...(data.firmado_por !== undefined ? { firmado_por: data.firmado_por } : {}),
            ...(data.firmado_supervisor_por !== undefined ? { firmado_supervisor_por: data.firmado_supervisor_por } : {}),
            ...(data.fecha_firma_digital !== undefined ? { fecha_firma_digital: data.fecha_firma_digital } : {}),
            ...(data.ejecucion_digital !== undefined ? { ejecucion_digital: data.ejecucion_digital } : {}),
            ...(data.firma_supervisor
              ? {
                  validado_supervisor: true,
                  fecha_validacion_supervisor: data.fecha_firma_digital || data.fecha_real
                }
              : {})
          };
        }
        return c;
      });
    const currentEmpItems = (modulesMapRef.current[empId]?.correctivos as OrdenCorrectivo[]) || [];
    void mutateEmpresaModulo<OrdenCorrectivo>(
      empId,
      'correctivos',
      transform,
      transform(currentEmpItems)
    );
    addToast(`Orden ${id_ot} cerrada.`);
  };

  const deleteCorrectivo = (id_ot: string) => {
    if (!guardAction('eliminar', 'Sin permisos para eliminar órdenes correctivas.')) return;
    const target = stateRef.current.correctivos.find((c) => c.id_ot === id_ot);
    const empId = resolveEmpresaId(target?.cliente);
    const currentEmpItems = (modulesMapRef.current[empId]?.correctivos as OrdenCorrectivo[]) || [];
    void mutateEmpresaModulo<OrdenCorrectivo>(
      empId,
      'correctivos',
      (latest) => latest.filter((c) => c.id_ot !== id_ot),
      currentEmpItems.filter((c) => c.id_ot !== id_ot)
    );
    addToast(`Orden Correctiva ${id_ot} eliminada.`, 'info');
  };

  // Ordenes de Trabajo
  const crearOrdenTrabajo = (
    data: Omit<OrdenTrabajoOT, 'id_ot' | 'estado' | 'fecha_real' | 'acciones_realizadas'> & {
      id_ot?: string;
    }
  ): string => {
    if (!guardAction('emitir_ordenes', 'Sin permisos para emitir órdenes de trabajo.')) return '';
    const dateObj = parseFecha(data.fecha_emision) || new Date();
    const mes = dateObj.getMonth() + 1;
    const anio = dateObj.getFullYear();
    const prefix = `OT-${anio}-${String(mes).padStart(2, '0')}-`;
    const existingSet = new Set(stateRef.current.ordenesTrabajo.map((o) => o.id_ot));
    let seq = stateRef.current.ordenesTrabajo.filter((o) => o.id_ot.startsWith(prefix)).length + 1;
    while (existingSet.has(`${prefix}${String(seq).padStart(4, '0')}`)) {
      seq++;
    }
    const folio = data.id_ot || `${prefix}${String(seq).padStart(4, '0')}`;

    const empId = resolveEmpresaId(data.cliente);
    const clienteObj = stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === empId);
    const nuevaOrden: OrdenTrabajoOT = {
      ...data,
      cliente: clienteObj?.nombre || data.cliente,
      id_ot: folio,
      estado: 'Pendiente',
      fecha_real: '',
      acciones_realizadas: ''
    };
    const currentEmpItems = (modulesMapRef.current[empId]?.ordenesTrabajo as OrdenTrabajoOT[]) || [];
    void mutateEmpresaModulo<OrdenTrabajoOT>(
      empId,
      'ordenesTrabajo',
      (latest) => [nuevaOrden, ...latest.filter((o) => o.id_ot !== folio)],
      [nuevaOrden, ...currentEmpItems.filter((o) => o.id_ot !== folio)]
    );
    addToast(`Orden de Trabajo ${folio} emitida.`);
    return folio;
  };

  const cerrarOrdenTrabajo = (
    id_ot: string,
    data: {
      fecha_real: string;
      tecnico: string;
      acciones_realizadas: string;
      materiales_utilizados?: string;
      firma_tecnico?: string;
      firma_supervisor?: string;
      firmado_por?: string;
      firmado_supervisor_por?: string;
      fecha_firma_digital?: string;
      ejecucion_digital?: boolean;
    }
  ) => {
    if (!guardAction('cerrar_ordenes', 'Sin permisos para cerrar órdenes de trabajo.')) return;
    const target = stateRef.current.ordenesTrabajo.find((o) => o.id_ot === id_ot);
    const empId = resolveEmpresaId(target?.cliente);
    const transform = (list: OrdenTrabajoOT[]) =>
      list.map((o) => {
        if (o.id_ot === id_ot) {
          const fTent = parseFecha(o.fecha_tentativa);
          const fReal = parseFecha(data.fecha_real) || new Date();
          let nuevoEstado: EstadoOrden = 'Cerrada (A tiempo)';
          if (fTent) {
            fTent.setHours(0, 0, 0, 0);
            fReal.setHours(0, 0, 0, 0);
            const diffDays = Math.round((fReal.getTime() - fTent.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > o.dias_tolerancia) {
              nuevoEstado = 'Cerrada (Fuera de término)';
            }
          }
          return {
            ...o,
            estado: nuevoEstado,
            fecha_real: data.fecha_real,
            tecnico: data.tecnico,
            acciones_realizadas: data.acciones_realizadas,
            materiales_utilizados: data.materiales_utilizados || o.materiales_utilizados,
            ...(data.firma_tecnico !== undefined ? { firma_tecnico: data.firma_tecnico } : {}),
            ...(data.firma_supervisor !== undefined ? { firma_supervisor: data.firma_supervisor } : {}),
            ...(data.firmado_por !== undefined ? { firmado_por: data.firmado_por } : {}),
            ...(data.firmado_supervisor_por !== undefined ? { firmado_supervisor_por: data.firmado_supervisor_por } : {}),
            ...(data.fecha_firma_digital !== undefined ? { fecha_firma_digital: data.fecha_firma_digital } : {}),
            ...(data.ejecucion_digital !== undefined ? { ejecucion_digital: data.ejecucion_digital } : {}),
            ...(data.firma_supervisor
              ? {
                  validado_supervisor: true,
                  fecha_validacion_supervisor: data.fecha_firma_digital || data.fecha_real
                }
              : {})
          };
        }
        return o;
      });
    const currentEmpItems = (modulesMapRef.current[empId]?.ordenesTrabajo as OrdenTrabajoOT[]) || [];
    void mutateEmpresaModulo<OrdenTrabajoOT>(
      empId,
      'ordenesTrabajo',
      transform,
      transform(currentEmpItems)
    );
    addToast(`Orden de Trabajo ${id_ot} finalizada.`);
  };

  const deleteOrdenTrabajo = (id_ot: string) => {
    if (!guardAction('eliminar', 'Sin permisos para eliminar órdenes de trabajo.')) return;
    const target = stateRef.current.ordenesTrabajo.find((o) => o.id_ot === id_ot);
    const empId = resolveEmpresaId(target?.cliente);
    const currentEmpItems = (modulesMapRef.current[empId]?.ordenesTrabajo as OrdenTrabajoOT[]) || [];
    void mutateEmpresaModulo<OrdenTrabajoOT>(
      empId,
      'ordenesTrabajo',
      (latest) => latest.filter((o) => o.id_ot !== id_ot),
      currentEmpItems.filter((o) => o.id_ot !== id_ot)
    );
    addToast(`Orden de Trabajo ${id_ot} eliminada.`, 'info');
  };

  // Calibraciones
  const crearOrdenCalibracion = (
    data: Omit<OrdenCalibracion, 'id_ot' | 'estado' | 'fecha_real'> & {
      id_ot?: string;
    }
  ): string => {
    if (!guardAction('emitir_ordenes', 'Sin permisos para emitir órdenes de calibración.')) return '';
    const dateObj = parseFecha(data.fecha_programada) || parseFecha(data.fecha_emision) || new Date();
    const mes = dateObj.getMonth() + 1;
    const anio = dateObj.getFullYear();
    const prefix = `CAL-${anio}-${String(mes).padStart(2, '0')}-`;
    const existingSet = new Set(stateRef.current.calibraciones.map((c) => c.id_ot));
    let seq = stateRef.current.calibraciones.filter((c) => c.id_ot.startsWith(prefix)).length + 1;
    while (existingSet.has(`${prefix}${String(seq).padStart(4, '0')}`)) {
      seq++;
    }
    const folio = data.id_ot || `${prefix}${String(seq).padStart(4, '0')}`;

    const empId = resolveEmpresaId(data.cliente);
    const clienteObj = stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === empId);
    const nuevaCal: OrdenCalibracion = {
      ...data,
      cliente: clienteObj?.nombre || data.cliente,
      id_ot: folio,
      estado: 'Pendiente',
      fecha_real: ''
    };
    const currentEmpItems = (modulesMapRef.current[empId]?.calibraciones as OrdenCalibracion[]) || [];
    void mutateEmpresaModulo<OrdenCalibracion>(
      empId,
      'calibraciones',
      (latest) => [nuevaCal, ...latest.filter((c) => c.id_ot !== folio)],
      [nuevaCal, ...currentEmpItems.filter((c) => c.id_ot !== folio)]
    );
    addToast(`Orden de Calibración ${folio} emitida.`);
    return folio;
  };

  const crearOrdenesCalibracionLote = (
    orders: Array<
      Omit<OrdenCalibracion, 'id_ot' | 'estado' | 'fecha_real'> & {
        id_ot?: string;
        mes_objetivo?: number;
        anio_objetivo?: number;
      }
    >
  ): OrdenCalibracion[] => {
    if (!guardAction('emitir_ordenes', 'Sin permisos para emitir lotes de calibración.')) return [];
    if (!orders.length) return [];

    const existingSet = new Set(stateRef.current.calibraciones.map((c) => c.id_ot));
    const nuevasOrdenes: OrdenCalibracion[] = [];

    for (const item of orders) {
      const dateObj = parseFecha(item.fecha_programada) || parseFecha(item.fecha_emision) || new Date();
      const mes = item.mes_objetivo || dateObj.getMonth() + 1;
      const anio = item.anio_objetivo || dateObj.getFullYear() || selectedAnio;
      const prefix = `CAL-${anio}-${String(mes).padStart(2, '0')}-`;

      let seq = 1;
      while (existingSet.has(`${prefix}${String(seq).padStart(4, '0')}`)) {
        seq++;
      }
      const folio = item.id_ot || `${prefix}${String(seq).padStart(4, '0')}`;
      existingSet.add(folio);

      const { mes_objetivo: _m, anio_objetivo: _a, ...rest } = item;
      nuevasOrdenes.push({
        ...rest,
        id_ot: folio,
        estado: 'Pendiente',
        fecha_real: ''
      });
    }

    const byEmp = new Map<string, OrdenCalibracion[]>();
    for (const ord of nuevasOrdenes) {
      const empId = resolveEmpresaId(ord.cliente);
      if (!byEmp.has(empId)) byEmp.set(empId, []);
      byEmp.get(empId)!.push(ord);
    }

    for (const [empId, list] of byEmp.entries()) {
      const newIds = new Set(list.map((o) => o.id_ot));
      const currentEmpItems = (modulesMapRef.current[empId]?.calibraciones as OrdenCalibracion[]) || [];
      void mutateEmpresaModulo<OrdenCalibracion>(
        empId,
        'calibraciones',
        (latest) => [...list, ...latest.filter((c) => !newIds.has(c.id_ot))],
        [...list, ...currentEmpItems.filter((c) => !newIds.has(c.id_ot))]
      );
    }

    addToast(
      `Se emitieron ${nuevasOrdenes.length} orden${nuevasOrdenes.length === 1 ? '' : 'es'} de calibración para el mes seleccionado.`,
      'success'
    );
    return nuevasOrdenes;
  };

  const cerrarOrdenCalibracion = (
    id_ot: string,
    data: {
      fecha_real: string;
      dictamen: 'Conforme' | 'Ajustado y Conforme' | 'No Conforme';
      error_max_hallado: string;
      patron_utilizado?: string;
      trazabilidad_patron?: string;
      metrologo_laboratorio: string;
      puntos_calibracion?: PuntoCalibracion[];
      magnitud?: string;
      unidad_medida?: string;
      rango_min?: number;
      rango_max?: number;
      puntos_prueba?: number;
      variable_medicion?: string;
      rango_operacion?: string;
      tolerancia_emp?: string;
      observaciones?: string;
      repuestos_utilizados?: string;
      numero_certificado?: string;
      proxima_calibracion?: string;
      firma_tecnico?: string;
      firma_supervisor?: string;
      firmado_por?: string;
      firmado_supervisor_por?: string;
      fecha_firma_digital?: string;
      ejecucion_digital?: boolean;
    }
  ) => {
    if (!guardAction('cerrar_ordenes', 'Sin permisos para certificar calibraciones.')) return;
    const target = stateRef.current.calibraciones.find((c) => c.id_ot === id_ot);
    const empId = resolveEmpresaId(target?.cliente);
    const transform = (list: OrdenCalibracion[]) =>
      list.map((c) => {
        if (c.id_ot === id_ot) {
          const fTent = parseFecha(c.fecha_tentativa);
          const fReal = parseFecha(data.fecha_real) || new Date();
          let nuevoEstado: EstadoCalibracion = 'Conforme (A tiempo)';
          if (data.dictamen === 'No Conforme') {
            nuevoEstado = 'No Conforme / Fuera de Tolerancia';
          } else if (fTent) {
            fTent.setHours(0, 0, 0, 0);
            fReal.setHours(0, 0, 0, 0);
            const diffDays = Math.round((fReal.getTime() - fTent.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > c.dias_tolerancia) {
              nuevoEstado = 'Conforme (Fuera de término)';
            }
          }
          const calcNextDate = addFrequencyStep(fReal, c.frecuencia_calibracion, stateRef.current.frecuencias, fReal.getDate());
          const nextCalStr = data.proxima_calibracion || formatFechaDDMMYYYY(calcNextDate);

          return {
            ...c,
            estado: nuevoEstado,
            fecha_real: data.fecha_real,
            dictamen: data.dictamen,
            error_max_hallado: data.error_max_hallado,
            patron_utilizado: data.patron_utilizado || c.patron_utilizado,
            trazabilidad_patron: data.trazabilidad_patron || c.trazabilidad_patron,
            metrologo_laboratorio: data.metrologo_laboratorio,
            puntos_calibracion: data.puntos_calibracion || c.puntos_calibracion,
            ...(data.magnitud !== undefined ? { magnitud: data.magnitud } : {}),
            ...(data.unidad_medida !== undefined ? { unidad_medida: data.unidad_medida } : {}),
            ...(data.rango_min !== undefined ? { rango_min: data.rango_min } : {}),
            ...(data.rango_max !== undefined ? { rango_max: data.rango_max } : {}),
            ...(data.puntos_prueba !== undefined ? { puntos_prueba: data.puntos_prueba } : {}),
            ...(data.variable_medicion !== undefined ? { variable_medicion: data.variable_medicion } : {}),
            ...(data.rango_operacion !== undefined ? { rango_operacion: data.rango_operacion } : {}),
            ...(data.tolerancia_emp !== undefined ? { tolerancia_emp: data.tolerancia_emp } : {}),
            observaciones: data.observaciones || c.observaciones,
            repuestos_utilizados: data.repuestos_utilizados || c.repuestos_utilizados,
            numero_certificado: data.numero_certificado || `CERT-${id_ot.replace('CAL-', '')}`,
            proxima_calibracion: nextCalStr,
            ...(data.firma_tecnico !== undefined ? { firma_tecnico: data.firma_tecnico } : {}),
            ...(data.firma_supervisor !== undefined ? { firma_supervisor: data.firma_supervisor } : {}),
            ...(data.firmado_por !== undefined ? { firmado_por: data.firmado_por } : {}),
            ...(data.firmado_supervisor_por !== undefined ? { firmado_supervisor_por: data.firmado_supervisor_por } : {}),
            ...(data.fecha_firma_digital !== undefined ? { fecha_firma_digital: data.fecha_firma_digital } : {}),
            ...(data.ejecucion_digital !== undefined ? { ejecucion_digital: data.ejecucion_digital } : {}),
            ...(data.firma_supervisor
              ? {
                  validado_supervisor: true,
                  fecha_validacion_supervisor: data.fecha_firma_digital || data.fecha_real
                }
              : {})
          };
        }
        return c;
      });
    const currentEmpItems = (modulesMapRef.current[empId]?.calibraciones as OrdenCalibracion[]) || [];
    void mutateEmpresaModulo<OrdenCalibracion>(
      empId,
      'calibraciones',
      transform,
      transform(currentEmpItems)
    );
    addToast(
      `Calibración ${id_ot} certificada (${data.dictamen}). El plan del año en curso se mantiene inalterado; la fecha real ajustará el plan del próximo año.`
    );
  };

  const certificarCalibracionProyectada = (
    orderData: Omit<OrdenCalibracion, 'id_ot' | 'estado' | 'fecha_real'> & {
      id_ot?: string;
      mes_objetivo?: number;
      anio_objetivo?: number;
    },
    cierreData: {
      fecha_real: string;
      dictamen: 'Conforme' | 'Ajustado y Conforme' | 'No Conforme';
      error_max_hallado: string;
      patron_utilizado?: string;
      trazabilidad_patron?: string;
      metrologo_laboratorio: string;
      puntos_calibracion?: PuntoCalibracion[];
      magnitud?: string;
      unidad_medida?: string;
      rango_min?: number;
      rango_max?: number;
      puntos_prueba?: number;
      variable_medicion?: string;
      rango_operacion?: string;
      tolerancia_emp?: string;
      observaciones?: string;
      repuestos_utilizados?: string;
      numero_certificado?: string;
      proxima_calibracion?: string;
      firma_tecnico?: string;
      firma_supervisor?: string;
      firmado_por?: string;
      firmado_supervisor_por?: string;
      fecha_firma_digital?: string;
      ejecucion_digital?: boolean;
    }
  ): string => {
    if (!guardAction('cerrar_ordenes', 'Sin permisos para certificar calibraciones proyectadas.')) return '';
    const dateObj = parseFecha(orderData.fecha_programada) || parseFecha(orderData.fecha_emision) || new Date();
    const mes = orderData.mes_objetivo || dateObj.getMonth() + 1;
    const anio = orderData.anio_objetivo || dateObj.getFullYear() || selectedAnio;
    const prefix = `CAL-${anio}-${String(mes).padStart(2, '0')}-`;
    const existingSet = new Set(stateRef.current.calibraciones.map((c) => c.id_ot));
    let seq = stateRef.current.calibraciones.filter((c) => c.id_ot.startsWith(prefix)).length + 1;
    while (existingSet.has(`${prefix}${String(seq).padStart(4, '0')}`)) {
      seq++;
    }
    const folio = orderData.id_ot || `${prefix}${String(seq).padStart(4, '0')}`;

    const fTent = parseFecha(orderData.fecha_tentativa);
    const fReal = parseFecha(cierreData.fecha_real) || new Date();
    let nuevoEstado: EstadoCalibracion = 'Conforme (A tiempo)';
    if (cierreData.dictamen === 'No Conforme') {
      nuevoEstado = 'No Conforme / Fuera de Tolerancia';
    } else if (fTent) {
      fTent.setHours(0, 0, 0, 0);
      fReal.setHours(0, 0, 0, 0);
      const diffDays = Math.round((fReal.getTime() - fTent.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > orderData.dias_tolerancia) {
        nuevoEstado = 'Conforme (Fuera de término)';
      }
    }

    const calcNextDate = addFrequencyStep(
      fReal,
      orderData.frecuencia_calibracion,
      stateRef.current.frecuencias,
      fReal.getDate()
    );
    const nextCalStr = cierreData.proxima_calibracion || formatFechaDDMMYYYY(calcNextDate);
    const { mes_objetivo: _m, anio_objetivo: _a, ...restOrder } = orderData;

    const empId = resolveEmpresaId(restOrder.cliente);
    const clienteObj = stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === empId);

    const nuevaCertificada: OrdenCalibracion = {
      ...restOrder,
      cliente: clienteObj?.nombre || restOrder.cliente,
      id_ot: folio,
      estado: nuevoEstado,
      fecha_real: cierreData.fecha_real,
      dictamen: cierreData.dictamen,
      error_max_hallado: cierreData.error_max_hallado,
      patron_utilizado: cierreData.patron_utilizado || restOrder.patron_utilizado,
      trazabilidad_patron: cierreData.trazabilidad_patron || restOrder.trazabilidad_patron,
      metrologo_laboratorio: cierreData.metrologo_laboratorio,
      puntos_calibracion: cierreData.puntos_calibracion,
      ...(cierreData.magnitud !== undefined ? { magnitud: cierreData.magnitud } : {}),
      ...(cierreData.unidad_medida !== undefined ? { unidad_medida: cierreData.unidad_medida } : {}),
      ...(cierreData.rango_min !== undefined ? { rango_min: cierreData.rango_min } : {}),
      ...(cierreData.rango_max !== undefined ? { rango_max: cierreData.rango_max } : {}),
      ...(cierreData.puntos_prueba !== undefined ? { puntos_prueba: cierreData.puntos_prueba } : {}),
      ...(cierreData.variable_medicion !== undefined ? { variable_medicion: cierreData.variable_medicion } : {}),
      ...(cierreData.rango_operacion !== undefined ? { rango_operacion: cierreData.rango_operacion } : {}),
      ...(cierreData.tolerancia_emp !== undefined ? { tolerancia_emp: cierreData.tolerancia_emp } : {}),
      observaciones: cierreData.observaciones || restOrder.observaciones,
      repuestos_utilizados: cierreData.repuestos_utilizados,
      numero_certificado: cierreData.numero_certificado || `CAL-CERT-${folio.replace('CAL-', '')}`,
      proxima_calibracion: nextCalStr,
      ...(cierreData.firma_tecnico !== undefined ? { firma_tecnico: cierreData.firma_tecnico } : {}),
      ...(cierreData.firma_supervisor !== undefined ? { firma_supervisor: cierreData.firma_supervisor } : {}),
      ...(cierreData.firmado_por !== undefined ? { firmado_por: cierreData.firmado_por } : {}),
      ...(cierreData.firmado_supervisor_por !== undefined ? { firmado_supervisor_por: cierreData.firmado_supervisor_por } : {}),
      ...(cierreData.fecha_firma_digital !== undefined ? { fecha_firma_digital: cierreData.fecha_firma_digital } : {}),
      ...(cierreData.ejecucion_digital !== undefined ? { ejecucion_digital: cierreData.ejecucion_digital } : {}),
      ...(cierreData.firma_supervisor
        ? {
            validado_supervisor: true,
            fecha_validacion_supervisor: cierreData.fecha_firma_digital || cierreData.fecha_real
          }
        : {})
    };

    const currentEmpItems = (modulesMapRef.current[empId]?.calibraciones as OrdenCalibracion[]) || [];
    void mutateEmpresaModulo<OrdenCalibracion>(
      empId,
      'calibraciones',
      (latest) => [nuevaCertificada, ...latest.filter((c) => c.id_ot !== folio)],
      [nuevaCertificada, ...currentEmpItems.filter((c) => c.id_ot !== folio)]
    );
    addToast(
      `Calibración ${folio} certificada (${cierreData.dictamen}). El plan actual permanece intacto; la fecha real ajustará el plan del año siguiente.`
    );
    return folio;
  };

  const deleteOrdenCalibracion = (id_ot: string) => {
    if (!guardAction('eliminar', 'Sin permisos para eliminar órdenes de calibración.')) return;
    const target = stateRef.current.calibraciones.find((c) => c.id_ot === id_ot);
    const empId = resolveEmpresaId(target?.cliente);
    const currentEmpItems = (modulesMapRef.current[empId]?.calibraciones as OrdenCalibracion[]) || [];
    void mutateEmpresaModulo<OrdenCalibracion>(
      empId,
      'calibraciones',
      (latest) => latest.filter((c) => c.id_ot !== id_ot),
      currentEmpItems.filter((c) => c.id_ot !== id_ot)
    );
    addToast(`Orden de Calibración ${id_ot} eliminada.`, 'info');
  };

  const validarOrdenDigitalSupervisor = (params: {
    tipo: 'MP' | 'MC' | 'OT' | 'CAL';
    id_ot: string;
    cliente: string;
    historialId?: string;
    codigo_eq?: string;
    mes_n?: number;
    firmado_supervisor_por: string;
    firma_supervisor: string;
    fecha_validacion_supervisor: string;
    observacion_supervisor?: string;
  }) => {
    if (!canValidateDigitalOrder(userProfile)) {
      addToast('Solo supervisión o administradores autorizados pueden validar órdenes.', 'error');
      return;
    }
    const empId = resolveEmpresaId(params.cliente);
    if (!empId) {
      addToast('No se pudo identificar la empresa de la orden para validar.', 'error');
      return;
    }

    const obsClean = params.observacion_supervisor?.trim() || undefined;
    const validationPatch = {
      validado_supervisor: true,
      firma_supervisor: params.firma_supervisor,
      firmado_supervisor_por: params.firmado_supervisor_por.trim(),
      fecha_validacion_supervisor: params.fecha_validacion_supervisor,
      ...(obsClean ? { observacion_supervisor: obsClean } : {})
    };

    if (params.tipo === 'MP') {
      const current = (modulesMapRef.current[empId]?.historial as RegistroHistorialMP[]) || [];
      const existsLocal = current.some(
        (h) =>
          (params.historialId && h.id === params.historialId) ||
          (!params.historialId &&
            h.id_ot.trim().toLowerCase() === params.id_ot.trim().toLowerCase() &&
            (!params.codigo_eq || h.codigo_eq.trim().toUpperCase() === params.codigo_eq.trim().toUpperCase()) &&
            (!params.mes_n || h.mes_n === params.mes_n))
      );
      if (!existsLocal) {
        addToast(`No se encontró el registro MP ${params.id_ot} para validar.`, 'warning');
        return;
      }
      const transform = (list: RegistroHistorialMP[]) =>
        list.map((h) => {
          const isMatch =
            (params.historialId && h.id === params.historialId) ||
            (!params.historialId &&
              h.id_ot.trim().toLowerCase() === params.id_ot.trim().toLowerCase() &&
              (!params.codigo_eq || h.codigo_eq.trim().toUpperCase() === params.codigo_eq.trim().toUpperCase()) &&
              (!params.mes_n || h.mes_n === params.mes_n));
          return isMatch ? { ...h, ...validationPatch } : h;
        });
      void mutateEmpresaModulo<RegistroHistorialMP>(empId, 'historial', transform, transform(current));
    } else if (params.tipo === 'MC') {
      const current = (modulesMapRef.current[empId]?.correctivos as OrdenCorrectivo[]) || [];
      if (!current.some((c) => c.id_ot.trim().toLowerCase() === params.id_ot.trim().toLowerCase())) {
        addToast(`No se encontró la orden correctiva ${params.id_ot} para validar.`, 'warning');
        return;
      }
      const transform = (list: OrdenCorrectivo[]) =>
        list.map((c) =>
          c.id_ot.trim().toLowerCase() === params.id_ot.trim().toLowerCase()
            ? { ...c, ...validationPatch }
            : c
        );
      void mutateEmpresaModulo<OrdenCorrectivo>(empId, 'correctivos', transform, transform(current));
    } else if (params.tipo === 'OT') {
      const current = (modulesMapRef.current[empId]?.ordenesTrabajo as OrdenTrabajoOT[]) || [];
      if (!current.some((o) => o.id_ot.trim().toLowerCase() === params.id_ot.trim().toLowerCase())) {
        addToast(`No se encontró la orden de trabajo ${params.id_ot} para validar.`, 'warning');
        return;
      }
      const transform = (list: OrdenTrabajoOT[]) =>
        list.map((o) =>
          o.id_ot.trim().toLowerCase() === params.id_ot.trim().toLowerCase()
            ? { ...o, ...validationPatch }
            : o
        );
      void mutateEmpresaModulo<OrdenTrabajoOT>(empId, 'ordenesTrabajo', transform, transform(current));
    } else if (params.tipo === 'CAL') {
      const current = (modulesMapRef.current[empId]?.calibraciones as OrdenCalibracion[]) || [];
      if (!current.some((c) => c.id_ot.trim().toLowerCase() === params.id_ot.trim().toLowerCase())) {
        addToast(`No se encontró la orden de calibración ${params.id_ot} para validar.`, 'warning');
        return;
      }
      const transform = (list: OrdenCalibracion[]) =>
        list.map((c) =>
          c.id_ot.trim().toLowerCase() === params.id_ot.trim().toLowerCase()
            ? { ...c, ...validationPatch }
            : c
        );
      void mutateEmpresaModulo<OrdenCalibracion>(empId, 'calibraciones', transform, transform(current));
    }

    addToast(
      `Orden ${params.id_ot} validada y aprobada por supervisión (${params.firmado_supervisor_por}).`,
      'success'
    );
  };

  // Gestión de Repuestos & Stock Crítico
  const addRepuesto = (rep: Repuesto) => {
    if (!guardAction('crear_editar', 'Sin permisos para crear repuestos.')) return;
    const empId = resolveEmpresaId(rep.cliente);
    const clienteObj = stateRef.current.clientes.find((c) => makeSafeDocId(c.codigo) === empId);
    const nuevoRepuesto: Repuesto = {
      ...rep,
      cliente: rep.cliente === 'Todas las Plantas' && isSuperAdmin ? rep.cliente : (clienteObj?.nombre || rep.cliente),
      id: rep.id || `REP-${Date.now()}`
    };

    const currentRepItems = (modulesMapRef.current[empId]?.repuestos as Repuesto[]) || [];
    void mutateEmpresaModulo<Repuesto>(
      empId,
      'repuestos',
      (latest) => [nuevoRepuesto, ...latest.filter((r) => r.id !== nuevoRepuesto.id)],
      [nuevoRepuesto, ...currentRepItems.filter((r) => r.id !== nuevoRepuesto.id)]
    );

    if (nuevoRepuesto.stock_actual > 0) {
      const hoy = new Date();
      const movInicial: MovimientoRepuesto = {
        id: `MOV-${Date.now()}`,
        repuesto_id: nuevoRepuesto.id,
        codigo_repuesto: nuevoRepuesto.codigo_repuesto,
        nombre_repuesto: nuevoRepuesto.nombre,
        tipo: 'Entrada',
        cantidad: nuevoRepuesto.stock_actual,
        stock_anterior: 0,
        stock_nuevo: nuevoRepuesto.stock_actual,
        fecha: `${formatFechaDDMMYYYY(hoy)} ${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}`,
        motivo: 'Inventario inicial al dar de alta el repuesto',
        solicitante: userProfile?.nombre || 'Administrador de Almacén'
      };
      const currentMovs = (modulesMapRef.current[empId]?.movimientosRepuestos as MovimientoRepuesto[]) || [];
      void mutateEmpresaModulo<MovimientoRepuesto>(
        empId,
        'movimientosRepuestos',
        (latest) => [movInicial, ...latest],
        [movInicial, ...currentMovs]
      );
    }

    addToast(`Repuesto "${nuevoRepuesto.nombre}" (${nuevoRepuesto.codigo_repuesto}) ingresado al inventario.`);
  };

  const updateRepuesto = (id: string, updated: Repuesto) => {
    if (!guardAction('crear_editar', 'Sin permisos para modificar repuestos.')) return;
    const target = stateRef.current.repuestos.find((r) => r.id === id || r.codigo_repuesto === id);
    const empId = resolveEmpresaId(target?.cliente || updated.cliente);
    const currentRepItems = (modulesMapRef.current[empId]?.repuestos as Repuesto[]) || [];
    const hoy = new Date();
    const fechaStr = `${formatFechaDDMMYYYY(hoy)} ${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}`;

    void (async () => {
      let ajusteMov: MovimientoRepuesto | null = null;
      const committed = await mutateEmpresaModulo<Repuesto>(
        empId,
        'repuestos',
        (latest) => {
          ajusteMov = null;
          return latest.map((r) => {
            if (r.id === id || r.codigo_repuesto === id) {
              if (updated.stock_actual !== r.stock_actual) {
                const dif = updated.stock_actual - r.stock_actual;
                ajusteMov = {
                  id: `MOV-${Date.now()}`,
                  repuesto_id: r.id,
                  codigo_repuesto: updated.codigo_repuesto,
                  nombre_repuesto: updated.nombre,
                  tipo: 'Ajuste',
                  cantidad: Math.abs(dif),
                  stock_anterior: r.stock_actual,
                  stock_nuevo: updated.stock_actual,
                  fecha: fechaStr,
                  motivo: 'Ajuste manual de inventario en modificación de ficha',
                  solicitante: userProfile?.nombre || 'Control de Almacén'
                };
              }
              return { ...updated, id: r.id };
            }
            return r;
          });
        },
        currentRepItems.map((r) => (r.id === id || r.codigo_repuesto === id ? { ...updated, id: r.id } : r))
      );

      if (committed && ajusteMov) {
        const mov = ajusteMov;
        await mutateEmpresaModulo<MovimientoRepuesto>(empId, 'movimientosRepuestos', (latest) => [
          mov,
          ...latest
        ]);
      }
    })();

    addToast(`Ficha del repuesto "${updated.nombre}" actualizada.`);
  };

  const deleteRepuesto = (id: string) => {
    if (!guardAction('eliminar', 'Sin permisos para eliminar repuestos.')) return;
    const target = stateRef.current.repuestos.find((r) => r.id === id || r.codigo_repuesto === id);
    const empId = resolveEmpresaId(target?.cliente);
    const currentRepItems = (modulesMapRef.current[empId]?.repuestos as Repuesto[]) || [];
    void mutateEmpresaModulo<Repuesto>(
      empId,
      'repuestos',
      (latest) => latest.filter((r) => r.id !== id && r.codigo_repuesto !== id),
      currentRepItems.filter((r) => r.id !== id && r.codigo_repuesto !== id)
    );
    addToast(`Repuesto eliminado del catálogo de almacén.`, 'info');
  };

  const registrarMovimientoStock = (data: {
    repuesto_id: string;
    tipo: 'Entrada' | 'Salida' | 'Ajuste';
    cantidad: number;
    motivo: string;
    ot_asociada?: string;
    equipo_asociado?: string;
    proveedor?: string;
    numero_factura?: string;
    solicitante: string;
  }) => {
    if (!guardAction('gestionar_stock', 'Sin permisos para registrar movimientos de stock.')) return;
    const target = stateRef.current.repuestos.find(
      (r) => r.id === data.repuesto_id || r.codigo_repuesto === data.repuesto_id
    );
    if (!target) {
      addToast('No se encontró el repuesto para registrar el movimiento.', 'error');
      return;
    }

    const empId = resolveEmpresaId(target.cliente);
    const hoy = new Date();
    const fechaStr = `${formatFechaDDMMYYYY(hoy)} ${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}`;
    const fechaCompra = formatFechaDDMMYYYY(hoy);

    void (async () => {
      let createdMov: MovimientoRepuesto | null = null;
      let finalStock = target.stock_actual;
      let finalMinimo = target.stock_minimo;

      const committed = await mutateEmpresaModulo<Repuesto>(empId, 'repuestos', (latest) => {
        createdMov = null;
        return latest.map((r) => {
          if (r.id === target.id || r.codigo_repuesto === target.codigo_repuesto) {
            const stockAnterior = r.stock_actual;
            let stockNuevo = stockAnterior;
            if (data.tipo === 'Entrada') stockNuevo = stockAnterior + Math.max(0, data.cantidad);
            else if (data.tipo === 'Salida') stockNuevo = Math.max(0, stockAnterior - Math.max(0, data.cantidad));
            else if (data.tipo === 'Ajuste') stockNuevo = Math.max(0, data.cantidad);

            finalStock = stockNuevo;
            finalMinimo = r.stock_minimo;
            createdMov = {
              id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              repuesto_id: r.id,
              codigo_repuesto: r.codigo_repuesto,
              nombre_repuesto: r.nombre,
              tipo: data.tipo,
              cantidad: data.cantidad,
              stock_anterior: stockAnterior,
              stock_nuevo: stockNuevo,
              fecha: fechaStr,
              motivo: data.motivo,
              ot_asociada: data.ot_asociada,
              equipo_asociado: data.equipo_asociado,
              proveedor: data.proveedor,
              numero_factura: data.numero_factura,
              solicitante: data.solicitante
            };

            return {
              ...r,
              stock_actual: stockNuevo,
              fecha_ultima_compra: data.tipo === 'Entrada' ? fechaCompra : r.fecha_ultima_compra
            };
          }
          return r;
        });
      });

      if (committed && createdMov) {
        const mov = createdMov;
        await mutateEmpresaModulo<MovimientoRepuesto>(empId, 'movimientosRepuestos', (latest) => [
          mov,
          ...latest
        ]);
        if (finalStock <= finalMinimo) {
          addToast(
            `Movimiento registrado. ¡ALERTA! El stock de ${target.nombre} está en ${finalStock} (Mínimo: ${finalMinimo}).`,
            'warning'
          );
        } else {
          addToast(
            `Movimiento de ${data.tipo} (${data.cantidad}) registrado. Nuevo stock: ${finalStock} ${target.unidad_medida}.`,
            'success'
          );
        }
      }
    })();
  };

  const registrarSalidasStockBatch = (
    items: Array<{ repuesto_id: string; cantidad: number }>,
    meta: {
      motivo: string;
      ot_asociada?: string;
      equipo_asociado?: string;
      solicitante: string;
    }
  ): string[] => {
    if (
      !auth.currentUser ||
      !userProfile?.activo ||
      (!hasActionAccess(userProfile, 'cerrar_ordenes') &&
        !hasActionAccess(userProfile, 'gestionar_stock'))
    ) {
      addToast('Sin permisos para descontar repuestos del stock.', 'error');
      return [];
    }

    const validItems = items.filter((i) => i.cantidad > 0);
    if (validItems.length === 0) return [];

    const qtyById = new Map<string, number>();
    for (const item of validItems) {
      qtyById.set(item.repuesto_id, (qtyById.get(item.repuesto_id) || 0) + item.cantidad);
    }

    const hoy = new Date();
    const fechaStr = `${formatFechaDDMMYYYY(hoy)} ${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}`;
    const summaryLabels: string[] = [];
    const lowStockAlerts: string[] = [];
    const qtyByEmpAndRep = new Map<string, Map<string, number>>();

    for (const [repId, qty] of qtyById.entries()) {
      const target = stateRef.current.repuestos.find((r) => r.id === repId || r.codigo_repuesto === repId);
      if (!target) continue;
      const empId = resolveEmpresaId(target.cliente);
      const stockNuevoEst = Math.max(0, target.stock_actual - qty);

      summaryLabels.push(`[${target.codigo_repuesto}] ${target.nombre} (x${qty} ${target.unidad_medida})`);
      if (stockNuevoEst <= target.stock_minimo) {
        lowStockAlerts.push(`${target.nombre} (${stockNuevoEst} ${target.unidad_medida})`);
      }

      if (!qtyByEmpAndRep.has(empId)) qtyByEmpAndRep.set(empId, new Map());
      qtyByEmpAndRep.get(empId)!.set(target.id, qty);
    }

    for (const [empId, repQtyMap] of qtyByEmpAndRep.entries()) {
      void (async () => {
        let txMovs: MovimientoRepuesto[] = [];
        const committed = await mutateEmpresaModulo<Repuesto>(empId, 'repuestos', (latest) => {
          txMovs = [];
          return latest.map((r) => {
            const qty = repQtyMap.get(r.id);
            if (!qty) return r;
            const stockAnterior = r.stock_actual;
            const stockNuevo = Math.max(0, stockAnterior - qty);
            txMovs.push({
              id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              repuesto_id: r.id,
              codigo_repuesto: r.codigo_repuesto,
              nombre_repuesto: r.nombre,
              tipo: 'Salida',
              cantidad: qty,
              stock_anterior: stockAnterior,
              stock_nuevo: stockNuevo,
              fecha: fechaStr,
              motivo: meta.motivo,
              ot_asociada: meta.ot_asociada,
              equipo_asociado: meta.equipo_asociado,
              solicitante: meta.solicitante
            });
            return { ...r, stock_actual: stockNuevo };
          });
        });
        if (committed && txMovs.length > 0) {
          const movsToAdd = txMovs;
          await mutateEmpresaModulo<MovimientoRepuesto>(
            empId,
            'movimientosRepuestos',
            (latest) => [...movsToAdd, ...latest]
          );
        }
      })();
    }

    if (summaryLabels.length > 0) {
      if (lowStockAlerts.length > 0) {
        addToast(
          `Stock descontado (${summaryLabels.length} ítem${summaryLabels.length > 1 ? 's' : ''}). ¡ALERTA STOCK BAJO!: ${lowStockAlerts.join(', ')}.`,
          'warning'
        );
      } else {
        addToast(
          `Se descontaron ${summaryLabels.length} repuesto${summaryLabels.length > 1 ? 's' : ''} del inventario de almacén.`,
          'info'
        );
      }
    }

    return summaryLabels;
  };

  const resetAllData = async (): Promise<void> => {
    if (!isSuperAdmin || !auth.currentUser) {
      addToast('Solo el Administrador General puede restablecer los datos globales.', 'error');
      return;
    }
    try {
      const nextSelected = await resetAllDataRepo(stateRef.current.clientes, auth.currentUser.uid);
      setSelectedCliente(nextSelected);
      addToast('Sistema restaurado a datos iniciales de fábrica en la nube.', 'info');
    } catch (err) {
      addToast('Error al restablecer datos en la nube.', 'error');
      throw err;
    }
  };

  const importBackup = (backup: Record<string, unknown>) => {
    if (!isSuperAdmin || !auth.currentUser) {
      addToast('Solo el Administrador General puede restaurar respaldos globales.', 'error');
      return;
    }
    const uid = auth.currentUser.uid;
    void (async () => {
      try {
        await importBackupRepo(backup, stateRef.current.clientes, uid);
        addToast('Copia de seguridad importada con éxito a la nube.', 'success');
      } catch {
        addToast('Error al importar copia de seguridad.', 'error');
      }
    })();
  };

  if (cloudLoading && clientes.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 prodexus:bg-[#F3F6F8] flex flex-col items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="inline-flex p-2 bg-white rounded-xl border border-slate-100 mx-auto">
            <img
              src="/assets/aistudio/prodexus_921c729e.jpeg"
              alt="Prodexus Logo"
              className="h-12 mx-auto object-contain"
            />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 prodexus:text-[#132B36]">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
            <span>
              Cargando entorno {isSuperAdmin ? 'multiempresa' : userProfile?.empresaNombre}...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MaintenanceContext.Provider
      value={{
        clientes,
        sistemas,
        frecuencias,
        tecnicos,
        equipos,
        historial,
        correctivos,
        ordenesTrabajo,
        calibraciones,
        instrumentos,
        repuestos,
        movimientosRepuestos,
        selectedCliente,
        setSelectedCliente,
        selectedAnio,
        setSelectedAnio,
        availableYears,
        cloudLoading,
        toasts,
        addToast,
        removeToast,
        confirmAction,
        addCliente,
        updateCliente,
        deleteCliente,
        addSistema,
        updateSistema,
        deleteSistema,
        addFrecuencia,
        updateFrecuencia,
        deleteFrecuencia,
        addTecnico,
        updateTecnico,
        deleteTecnico,
        addEquipo,
        updateEquipo,
        deleteEquipo,
        addInstrumento,
        updateInstrumento,
        darDeBajaInstrumento,
        reactivarInstrumento,
        deleteInstrumento,
        addRepuesto,
        updateRepuesto,
        deleteRepuesto,
        registrarMovimientoStock,
        registrarSalidasStockBatch,
        registrarCierrePreventivo,
        crearCorrectivo,
        cerrarCorrectivo,
        deleteCorrectivo,
        crearOrdenTrabajo,
        cerrarOrdenTrabajo,
        deleteOrdenTrabajo,
        crearOrdenCalibracion,
        crearOrdenesCalibracionLote,
        cerrarOrdenCalibracion,
        certificarCalibracionProyectada,
        deleteOrdenCalibracion,
        validarOrdenDigitalSupervisor,
        resetAllData,
        importBackup
      }}
    >
      {children}
      {confirmRequest && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] max-w-md w-full p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  confirmRequest.options.tone === 'warning'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                    : confirmRequest.options.tone === 'info'
                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                  {confirmRequest.options.title || 'Confirmar Acción'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] leading-relaxed whitespace-pre-line">
                  {confirmRequest.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <button
                type="button"
                onClick={() => handleConfirmResolve(false)}
                className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {confirmRequest.options.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmResolve(true)}
                className={`px-4 py-2 font-bold text-white rounded-lg transition-colors shadow-xs ${
                  confirmRequest.options.tone === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : confirmRequest.options.tone === 'info'
                    ? 'bg-blue-600 prodexus:bg-[#2F7CF6] hover:bg-blue-700 prodexus:hover:bg-[#2566D1]'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmRequest.options.confirmText || 'Confirmar y Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
};
