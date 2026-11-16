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
  Phone
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { hasActionAccess } from '../utils/rbac';
import { calcularKpisTecnicos } from '../utils/maintenanceEngine';
import { Tecnico } from '../types';

export const TecnicosView: React.FC = () => {
  const {
    tecnicos,
    correctivos,
    ordenesTrabajo,
    addTecnico,
    updateTecnico,
    deleteTecnico,
    confirmAction,
    addToast
  } = useMaintenance();
  const { userProfile } = useAuth();
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

  const kpis = calcularKpisTecnicos(tecnicos, correctivos, ordenesTrabajo);
  const kpiMap = new Map(kpis.map(k => [k.codigo_tec, k]));

  const filteredTecnicos = tecnicos.filter(t => {
    return t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.codigo_tec.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.especialidad.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingCodigo(null);
    setCodigo(`TEC-${String(tecnicos.length + 1).padStart(2, '0')}`);
    setNombre('');
    setEspecialidad('');
    setEstado('Activo');
    setTelefono('');
    setCorreo('');
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      addToast('El nombre del técnico es obligatorio.', 'warning');
      return;
    }

    const data: Tecnico = {
      codigo_tec: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      especialidad: especialidad.trim() || 'Mantenimiento General',
      estado,
      telefono: telefono.trim(),
      correo: correo.trim()
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
            Registro de personal técnico, especialidades, carga de trabajo y tasa de cumplimiento histórico.
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
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] flex items-center justify-between gap-3 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o especialidad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 prodexus:bg-[#F3F6F8] border border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6] w-64"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
          {tecnicos.filter(t => t.estado === 'Activo').length} Activos · {tecnicos.filter(t => t.estado === 'Inactivo').length} Inactivos
        </span>
      </div>

      {/* Technicians Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredTecnicos.map(tec => {
          const kpi = kpiMap.get(tec.codigo_tec);
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
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEdit(tec)}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 prodexus:hover:text-[#2F7CF6] rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(tec)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-sm mt-2">
                  {tec.nombre}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5 font-medium">
                  {tec.especialidad}
                </p>

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

      {/* Modal Alta / Modificar */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] max-w-md w-full p-6 space-y-4">
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
                    onChange={(e) => setEstado(e.target.value as any)}
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
