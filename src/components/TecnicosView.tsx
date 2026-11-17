/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users2,
  Plus,
  Edit2,
  Trash2,
  Search,
  Mail,
  Phone,
  Building2,
  Globe,
  Check,
  Lock
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { hasActionAccess } from '../utils/rbac';
import {
  calcularKpisTecnicos,
  TODAS_LAS_EMPRESAS,
  isTecnicoDeTodasLasEmpresas,
  tecnicoPerteneceAEmpresa
} from '../utils/maintenanceEngine';
import { Tecnico } from '../types';

export const TecnicosView: React.FC = () => {
  const {
    clientes,
    selectedCliente,
    tecnicos,
    correctivos,
    ordenesTrabajo,
    addTecnico,
    updateTecnico,
    deleteTecnico,
    confirmAction,
    addToast
  } = useMaintenance();
  const { userProfile, isSuperAdmin } = useAuth();
  const canEdit = hasActionAccess(userProfile, 'crear_editar');
  const canDelete = hasActionAccess(userProfile, 'eliminar');

  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);

  // Form states
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [estado, setEstado] = useState<'Activo' | 'Inactivo'>('Activo');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [esTodasEmpresas, setEsTodasEmpresas] = useState(false);
  const [empresasAsignadas, setEmpresasAsignadas] = useState<string[]>([]);

  const tecnicosScope = tecnicos.filter(t => tecnicoPerteneceAEmpresa(t, selectedCliente));
  const correctivosScope = selectedCliente === 'Todos'
    ? correctivos
    : correctivos.filter(c => c.cliente.trim() === selectedCliente.trim());
  const ordenesScope = selectedCliente === 'Todos'
    ? ordenesTrabajo
    : ordenesTrabajo.filter(o => o.cliente.trim() === selectedCliente.trim());

  const kpis = calcularKpisTecnicos(tecnicosScope, correctivosScope, ordenesScope);
  const kpiMap = new Map(kpis.map(k => [k.codigo_tec, k]));

  const filteredTecnicos = tecnicosScope.filter(t => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const empMatch = isTecnicoDeTodasLasEmpresas(t)
      ? 'todas las empresas'.includes(q)
      : (t.empresas || []).some(e => e.toLowerCase().includes(q));
    return (
      t.nombre.toLowerCase().includes(q) ||
      t.codigo_tec.toLowerCase().includes(q) ||
      t.especialidad.toLowerCase().includes(q) ||
      empMatch
    );
  });

  const canManageTechnician = (t: Tecnico) => {
    if (isSuperAdmin) return true;
    return (
      !isTecnicoDeTodasLasEmpresas(t) &&
      (t.empresas || []).length === 1 &&
      tecnicoPerteneceAEmpresa(t, userProfile?.empresaNombre)
    );
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingCodigo(null);
    let nextNum = tecnicos.length + 1;
    while (tecnicos.some(t => t.codigo_tec === `TEC-${String(nextNum).padStart(2, '0')}`)) {
      nextNum++;
    }
    setCodigo(`TEC-${String(nextNum).padStart(2, '0')}`);
    setNombre('');
    setEspecialidad('');
    setEstado('Activo');
    setTelefono('');
    setCorreo('');

    if (!isSuperAdmin) {
      const ownCompany = userProfile?.empresaNombre || clientes[0]?.nombre || '';
      setEsTodasEmpresas(false);
      setEmpresasAsignadas(ownCompany ? [ownCompany] : []);
    } else if (selectedCliente !== 'Todos') {
      setEsTodasEmpresas(false);
      setEmpresasAsignadas([selectedCliente]);
    } else {
      setEsTodasEmpresas(false);
      setEmpresasAsignadas(clientes.length === 1 ? [clientes[0].nombre] : []);
    }
  };

  const handleOpenEdit = (t: Tecnico) => {
    setModalMode('edit');
    setEditingCodigo(t.codigo_tec);
    setCodigo(t.codigo_tec);
    setNombre(t.nombre);
    setEspecialidad(t.especialidad);
    setEstado(t.estado);
    setTelefono(t.telefono || '');
    setCorreo(t.correo || '');

    const todas = isTecnicoDeTodasLasEmpresas(t);
    setEsTodasEmpresas(todas);
    setEmpresasAsignadas(todas ? [] : [...(t.empresas || [])]);
  };

  const toggleEmpresa = (empresaNombre: string) => {
    setEmpresasAsignadas(prev =>
      prev.includes(empresaNombre)
        ? prev.filter(e => e !== empresaNombre)
        : [...prev, empresaNombre]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      addToast('El nombre del técnico es obligatorio.', 'warning');
      return;
    }

    let empresasFinal: string[];
    if (!isSuperAdmin) {
      const ownCompany = userProfile?.empresaNombre || clientes[0]?.nombre || '';
      empresasFinal = ownCompany ? [ownCompany] : [];
    } else if (esTodasEmpresas) {
      empresasFinal = [TODAS_LAS_EMPRESAS];
    } else {
      empresasFinal = empresasAsignadas;
    }

    if (empresasFinal.length === 0) {
      addToast('Debe asignar al menos una empresa o marcar "Todas las Empresas".', 'warning');
      return;
    }

    const data: Tecnico = {
      codigo_tec: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      especialidad: especialidad.trim() || 'Mantenimiento General',
      estado,
      telefono: telefono.trim(),
      correo: correo.trim(),
      empresas: empresasFinal
    };

    if (modalMode === 'create') {
      if (tecnicos.some(t => t.codigo_tec === data.codigo_tec)) {
        addToast('Ya existe un técnico con este código.', 'warning');
        return;
      }
      addTecnico(data);
    } else if (modalMode === 'edit' && editingCodigo) {
      updateTecnico(editingCodigo, data);
    }

    setModalMode(null);
  };

  const handleDelete = async (t: Tecnico) => {
    const confirmed = await confirmAction({
      title: 'Eliminar Técnico',
      message: `¿Eliminar al técnico "${t.nombre}" de la cuadrilla? (Sus órdenes históricas permanecerán intactas)`,
      confirmText: 'Sí, Eliminar',
      tone: 'danger'
    });
    if (confirmed) {
      deleteTecnico(t.codigo_tec);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] tracking-tight flex items-center gap-2">
            <Users2 className="w-6 h-6 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
            Cuadrilla de Técnicos & Especialistas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5">
            Registro de personal técnico por empresa, especialidades, carga de trabajo y tasa de cumplimiento histórico.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Técnico</span>
            </button>
          </div>
        )}
      </div>

      {/* Search and Summary */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, código, especialidad o empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 prodexus:bg-[#F3F6F8] border border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6] w-full sm:w-72"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
          {tecnicosScope.filter(t => t.estado === 'Activo').length} Activos · {tecnicosScope.filter(t => t.estado === 'Inactivo').length} Inactivos
          {selectedCliente !== 'Todos' ? ` en ${selectedCliente}` : ''}
        </span>
      </div>

      {/* Technicians Grid */}
      {filteredTecnicos.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-10 text-center space-y-2">
          <Users2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36]">
            No hay técnicos registrados para {selectedCliente === 'Todos' ? 'los criterios buscados' : selectedCliente}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
            {canEdit
              ? 'Utilice "Nuevo Técnico" para agregar personal a la plantilla de esta empresa.'
              : 'Consulte con un administrador para asignar técnicos a esta empresa.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredTecnicos.map(tec => {
            const kpi = kpiMap.get(tec.codigo_tec);
            const isAllCompanies = isTecnicoDeTodasLasEmpresas(tec);
            const editable = canManageTechnician(tec);

            return (
              <div
                key={tec.codigo_tec}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-5 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 prodexus:hover:border-[#B9D2FA] transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 prodexus:text-[#132B36] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] px-2 py-0.5 rounded">
                      {tec.codigo_tec}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        tec.estado === 'Activo'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70'
                          : 'bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]'
                      }`}>
                        {tec.estado}
                      </span>
                      {canEdit && editable && (
                        <button
                          onClick={() => handleOpenEdit(tec)}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 prodexus:hover:text-[#2F7CF6] rounded"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && editable && (
                        <button
                          onClick={() => handleDelete(tec)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!editable && (canEdit || canDelete) && (
                        <span
                          className="p-1 text-slate-400 dark:text-slate-500"
                          title="Técnico multi-empresa gestionado por Administración General"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-sm mt-2">
                    {tec.nombre}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5 font-medium">
                    {tec.especialidad}
                  </p>

                  {/* Assigned Companies Badges */}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {isAllCompanies ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 prodexus:bg-[#EEF5FF] text-indigo-700 dark:text-indigo-300 prodexus:text-[#2F7CF6] border border-indigo-200 dark:border-indigo-800/70 prodexus:border-[#B9D2FA]">
                        <Globe className="w-2.5 h-2.5 shrink-0" />
                        Todas las Empresas
                      </span>
                    ) : (
                      (tec.empresas || []).map(emp => (
                        <span
                          key={emp}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 prodexus:bg-[#EEF5FF] text-blue-700 dark:text-blue-300 prodexus:text-[#132B36] border border-blue-200 dark:border-blue-800/70 prodexus:border-[#B9D2FA] max-w-full truncate"
                          title={emp}
                        >
                          <Building2 className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{emp}</span>
                        </span>
                      ))
                    )}
                  </div>

                  {(tec.correo || tec.telefono) && (
                    <div className="mt-2.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976]">
                      {tec.correo && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] shrink-0" />
                          <span className="truncate font-mono">{tec.correo}</span>
                        </div>
                      )}
                      {tec.telefono && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] shrink-0" />
                          <span className="truncate font-mono">{tec.telefono}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* KPI Performance Box */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                    <span>Asignadas (MC + OT):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{kpi?.asignadas_total || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                    <span>Pendientes en curso:</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{kpi?.pendientes || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                    <span>Efectividad a tiempo:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {kpi ? `${kpi.cumplimiento_pct.toFixed(1)}%` : '0.0%'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Alta / Modificar */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                {modalMode === 'create' ? 'Registrar Nuevo Técnico' : `Modificar ${codigo}`}
              </h2>
              <button
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 prodexus:hover:text-[#132B36] font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    Código Técnico *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'edit'}
                    placeholder="TEC-01"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="w-full font-mono font-semibold uppercase text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6] disabled:bg-slate-100 dark:disabled:bg-slate-800 prodexus:disabled:bg-[#F3F6F8]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    Estado *
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as 'Activo' | 'Inactivo')}
                    className="w-full font-semibold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ing. Carlos Mendoza"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                  Especialidad Principal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Mecánica Térmica, Refrigeración, HVAC, Electricidad..."
                  value={especialidad}
                  onChange={(e) => setEspecialidad(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                />
              </div>

              {/* Company Assignment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36]">
                    Empresas a las que Pertenece *
                  </label>
                  {isSuperAdmin && (
                    <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                      {esTodasEmpresas
                        ? 'Todas las empresas'
                        : empresasAsignadas.length === 0
                        ? 'Ninguna seleccionada'
                        : empresasAsignadas.length === 1
                        ? '1 empresa seleccionada'
                        : `${empresasAsignadas.length} empresas seleccionadas`}
                    </span>
                  )}
                </div>

                {isSuperAdmin ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] rounded-lg space-y-2.5">
                    {/* Toggle Todas las Empresas */}
                    <button
                      type="button"
                      onClick={() => setEsTodasEmpresas(prev => !prev)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                        esTodasEmpresas
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 prodexus:bg-[#EEF5FF] border-indigo-400 dark:border-indigo-700 prodexus:border-[#2F7CF6] text-indigo-800 dark:text-indigo-200 prodexus:text-[#132B36] ring-1 ring-indigo-300/60'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE] text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className={`w-4 h-4 shrink-0 ${esTodasEmpresas ? 'text-indigo-600 dark:text-indigo-400 prodexus:text-[#2F7CF6]' : 'text-slate-400'}`} />
                        <div>
                          <span className="font-bold block">Todas las Empresas</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] block">
                            Disponible en la plantilla de todas las plantas registradas
                          </span>
                        </div>
                      </div>
                      <span className={`w-4 h-4 rounded flex items-center justify-center border ${
                        esTodasEmpresas
                          ? 'bg-indigo-600 prodexus:bg-[#2F7CF6] border-indigo-600 prodexus:border-[#2F7CF6] text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950'
                      }`}>
                        {esTodasEmpresas && <Check className="w-3 h-3" />}
                      </span>
                    </button>

                    {/* Individual / Multi Company List */}
                    {!esTodasEmpresas && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {clientes.length === 0 ? (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 py-2 text-center">
                            No hay empresas registradas aún.
                          </p>
                        ) : (
                          clientes.map(cli => {
                            const checked = empresasAsignadas.includes(cli.nombre);
                            return (
                              <button
                                key={cli.codigo}
                                type="button"
                                onClick={() => toggleEmpresa(cli.nombre)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                                  checked
                                    ? 'bg-blue-50 dark:bg-blue-950/50 prodexus:bg-[#EEF5FF] border-blue-400 dark:border-blue-700 prodexus:border-[#2F7CF6] text-blue-900 dark:text-blue-200 prodexus:text-[#132B36] font-semibold'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE] text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] hover:border-blue-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Building2 className={`w-3.5 h-3.5 shrink-0 ${checked ? 'text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]' : 'text-slate-400'}`} />
                                  <span className="truncate">{cli.nombre}</span>
                                </div>
                                <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                  checked
                                    ? 'bg-blue-600 prodexus:bg-[#2F7CF6] border-blue-600 prodexus:border-[#2F7CF6] text-white'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950'
                                }`}>
                                  {checked && <Check className="w-3 h-3" />}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 prodexus:bg-[#F3F6F8] border border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] font-semibold">
                    <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] shrink-0" />
                    <span className="truncate">{empresasAsignadas[0] || userProfile?.empresaNombre || 'Empresa Asignada'}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    Teléfono Móvil
                  </label>
                  <input
                    type="text"
                    placeholder="+56 9 8450 1122"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="tecnico@empresa.com"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 prodexus:hover:bg-[#D5E0E6] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
                >
                  {modalMode === 'create' ? 'Guardar Técnico' : 'Actualizar Técnico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
