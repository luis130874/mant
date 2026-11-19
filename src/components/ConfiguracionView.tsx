/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings2,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Palette,
  Check
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_OPTIONS } from '../context/ThemeContext';
import { hasActionAccess } from '../utils/rbac';
import { exportBackupJSON } from '../utils/exportUtils';
import { Sistema, FrecuenciaConfig } from '../types';

export const ConfiguracionView: React.FC = () => {
  const {
    sistemas,
    frecuencias,
    addSistema,
    updateSistema,
    deleteSistema,
    addFrecuencia,
    updateFrecuencia,
    deleteFrecuencia,
    clientes,
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    tecnicos,
    resetAllData,
    importBackup,
    confirmAction,
    addToast
  } = useMaintenance();
  const { userProfile, isSuperAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const canEdit = hasActionAccess(userProfile, 'crear_editar');
  const canDelete = hasActionAccess(userProfile, 'eliminar');

  const [activeTab, setActiveTab] = useState<'apariencia' | 'sistemas' | 'frecuencias' | 'backup'>('sistemas');
  const [isResetting, setIsResetting] = useState(false);

  // Modal states for Sistemas
  const [modalSis, setModalSis] = useState<'create' | 'edit' | null>(null);
  const [sisCodigo, setSisCodigo] = useState('');
  const [sisNombre, setSisNombre] = useState('');
  const [sisDesc, setSisDesc] = useState('');
  const [editSisId, setEditSisId] = useState<string | null>(null);

  // Modal states for Frecuencias
  const [modalFreq, setModalFreq] = useState<'create' | 'edit' | null>(null);
  const [freqNombre, setFreqNombre] = useState('');
  const [freqTol, setFreqTol] = useState(4);
  const [freqPaso, setFreqPaso] = useState(1);
  const [editFreqName, setEditFreqName] = useState<string | null>(null);

  // Handlers for Sistemas
  const handleOpenSisCreate = () => {
    setModalSis('create');
    setEditSisId(null);
    setSisCodigo(`SIS-${String(sistemas.length + 1).padStart(2, '0')}`);
    setSisNombre('');
    setSisDesc('');
  };

  const handleOpenSisEdit = (s: Sistema) => {
    setModalSis('edit');
    setEditSisId(s.codigo_sis);
    setSisCodigo(s.codigo_sis);
    setSisNombre(s.nombre);
    setSisDesc(s.descripcion);
  };

  const handleSisSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sisNombre.trim()) {
      addToast('El nombre del sistema es obligatorio.', 'warning');
      return;
    }
    const data: Sistema = {
      codigo_sis: sisCodigo.trim().toUpperCase(),
      nombre: sisNombre.trim(),
      descripcion: sisDesc.trim()
    };
    if (modalSis === 'create') {
      addSistema(data);
    } else if (modalSis === 'edit' && editSisId) {
      updateSistema(editSisId, data);
    }
    setModalSis(null);
  };

  // Handlers for Frecuencias
  const handleOpenFreqCreate = () => {
    setModalFreq('create');
    setEditFreqName(null);
    setFreqNombre('');
    setFreqTol(4);
    setFreqPaso(1);
  };

  const handleOpenFreqEdit = (f: FrecuenciaConfig) => {
    setModalFreq('edit');
    setEditFreqName(f.nombre_freq);
    setFreqNombre(f.nombre_freq);
    setFreqTol(f.dias_tolerancia);
    setFreqPaso(f.paso_meses);
  };

  const handleFreqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!freqNombre.trim()) {
      addToast('El nombre de la frecuencia es obligatorio.', 'warning');
      return;
    }
    const data: FrecuenciaConfig = {
      nombre_freq: freqNombre.trim(),
      dias_tolerancia: freqTol,
      paso_meses: freqPaso
    };
    if (modalFreq === 'create') {
      addFrecuencia(data);
    } else if (modalFreq === 'edit' && editFreqName) {
      updateFrecuencia(editFreqName, data);
    }
    setModalFreq(null);
  };

  // Backup / Export
  const handleDownloadBackup = () => {
    const fullBackup = {
      clientes,
      sistemas,
      frecuencias,
      tecnicos,
      equipos,
      historial,
      correctivos,
      ordenesTrabajo,
      exportDate: new Date().toISOString()
    };
    exportBackupJSON(fullBackup, 'prodexus_cmms_backup');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const confirmed = await confirmAction({
          title: 'Restaurar Copia de Seguridad',
          message: '¿Restaurar los datos de esta copia de seguridad? Se reemplazarán los datos globales en la nube.',
          confirmText: 'Sí, Restaurar',
          tone: 'warning'
        });
        if (confirmed) {
          importBackup(parsed);
        }
      } catch {
        addToast('El archivo no tiene un formato JSON válido.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] tracking-tight flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
            Configuración & Parámetros del CMMS
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5">
            Apariencia visual, sistemas funcionales de planta, tolerancias de frecuencias y copias de seguridad.
          </p>
        </div>

        {/* Subtabs */}
        <div className="inline-flex flex-wrap p-1 bg-slate-100 dark:bg-slate-800/80 prodexus:bg-[#E4ECF0] rounded-lg shrink-0 self-start sm:self-auto gap-0.5">
          <button
            onClick={() => setActiveTab('sistemas')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'sistemas'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white prodexus:hover:text-[#132B36]'
            }`}
          >
            Sistemas ({sistemas.length})
          </button>
          <button
            onClick={() => setActiveTab('frecuencias')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'frecuencias'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white prodexus:hover:text-[#132B36]'
            }`}
          >
            Frecuencias & Tolerancias ({frecuencias.length})
          </button>
          <button
            onClick={() => setActiveTab('apariencia')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'apariencia'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white prodexus:hover:text-[#132B36]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Apariencia & Tema</span>
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'backup'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] hover:text-slate-900 dark:hover:text-white prodexus:hover:text-[#132B36]'
              }`}
            >
              Respaldos & Datos
            </button>
          )}
        </div>
      </div>

      {/* TAB 0: Apariencia & Tema de Colores */}
      {activeTab === 'apariencia' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#EBF3FF] text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                  Tema Visual y Paleta de Colores
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5">
                  Elija la combinación cromática de la plataforma. El cambio se aplica al instante y se guarda en este navegador; los documentos A4 para impresión/PDF mantienen siempre fondo blanco limpio.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 prodexus:bg-[#132B36] text-slate-700 dark:text-slate-200 prodexus:text-white shrink-0 self-start sm:self-center">
              Activo: {THEME_OPTIONS.find((t) => t.id === theme)?.name}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {THEME_OPTIONS.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTheme(opt.id);
                    addToast(`Tema cambiado a "${opt.name}".`, 'success');
                  }}
                  className={`text-left rounded-2xl border-2 p-5 transition-all flex flex-col justify-between gap-4 cursor-pointer bg-white dark:bg-slate-900 ${
                    isSelected
                      ? 'border-blue-600 dark:border-blue-500 prodexus:border-[#2F7CF6] ring-2 ring-blue-500/20 prodexus:ring-[#2F7CF6]/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] hover:border-slate-300 dark:hover:border-slate-700 prodexus:hover:border-[#9EB5C2] shadow-xs'
                  }`}
                >
                  <div className="space-y-4 w-full">
                    {/* Live Mini UI Preview */}
                    <div
                      className="rounded-xl border overflow-hidden shadow-xs"
                      style={{
                        backgroundColor: opt.swatches.canvas,
                        borderColor: opt.id === 'dark' ? '#1e293b' : opt.id === 'prodexus' ? '#D5E0E6' : '#e2e8f0'
                      }}
                    >
                      {/* Mini TopBar */}
                      <div
                        className="h-7 px-2.5 flex items-center justify-between border-b"
                        style={{
                          backgroundColor: opt.swatches.chrome,
                          borderColor: opt.id === 'dark' ? '#1e293b' : opt.id === 'prodexus' ? '#1E4050' : '#e2e8f0'
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-black"
                            style={{
                              backgroundColor: opt.id === 'prodexus' ? '#ffffff' : opt.swatches.primary,
                              color: opt.id === 'prodexus' ? '#132B36' : '#ffffff'
                            }}
                          >
                            P
                          </span>
                          <span
                            className="h-2 w-12 rounded-xs opacity-75"
                            style={{
                              backgroundColor: opt.id === 'classic' ? '#0f172a' : '#f1f5f9'
                            }}
                          />
                        </div>
                        <span
                          className="h-3.5 w-10 rounded-sm"
                          style={{ backgroundColor: opt.swatches.primary }}
                        />
                      </div>

                      {/* Mini Body (Sidebar + Content) */}
                      <div className="flex h-24">
                        <div
                          className="w-14 p-2 space-y-1.5 border-r shrink-0"
                          style={{
                            backgroundColor: opt.swatches.chrome,
                            borderColor: opt.id === 'dark' ? '#1e293b' : opt.id === 'prodexus' ? '#1E4050' : '#e2e8f0'
                          }}
                        >
                          <div
                            className="h-2.5 rounded-xs"
                            style={{ backgroundColor: opt.swatches.primary, opacity: 0.9 }}
                          />
                          <div
                            className="h-2 rounded-xs opacity-35"
                            style={{ backgroundColor: opt.id === 'classic' ? '#64748b' : '#cbd5e1' }}
                          />
                          <div
                            className="h-2 rounded-xs opacity-35"
                            style={{ backgroundColor: opt.id === 'classic' ? '#64748b' : '#cbd5e1' }}
                          />
                        </div>

                        <div className="flex-1 p-2.5 grid grid-cols-2 gap-2 items-start">
                          <div
                            className="rounded-md p-2 border space-y-1.5"
                            style={{
                              backgroundColor: opt.swatches.surface,
                              borderColor: opt.id === 'dark' ? '#1e293b' : opt.id === 'prodexus' ? '#D5E0E6' : '#e2e8f0'
                            }}
                          >
                            <div
                              className="h-1.5 w-8 rounded-xs opacity-50"
                              style={{ backgroundColor: opt.id === 'dark' ? '#94a3b8' : '#64748b' }}
                            />
                            <div
                              className="h-3 w-10 rounded-xs"
                              style={{ backgroundColor: opt.swatches.primary }}
                            />
                          </div>
                          <div
                            className="rounded-md p-2 border space-y-1.5"
                            style={{
                              backgroundColor: opt.swatches.surface,
                              borderColor: opt.id === 'dark' ? '#1e293b' : opt.id === 'prodexus' ? '#D5E0E6' : '#e2e8f0'
                            }}
                          >
                            <div
                              className="h-1.5 w-8 rounded-xs opacity-50"
                              style={{ backgroundColor: opt.id === 'dark' ? '#94a3b8' : '#64748b' }}
                            />
                            <div
                              className="h-3 w-10 rounded-xs"
                              style={{ backgroundColor: opt.swatches.secondary }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Title & Subtitle */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976]">
                          {opt.subtitle}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                          {opt.name}
                        </h3>
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600 prodexus:bg-[#2F7CF6] text-white text-[10px] font-bold shrink-0">
                          <Check className="w-3 h-3" />
                          Activo
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 prodexus:text-[#4D6976] leading-relaxed">
                      {opt.description}
                    </p>
                  </div>

                  {/* Color Swatches */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6] w-full flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: 'Fondo', hex: opt.swatches.canvas },
                        { label: 'Navegación', hex: opt.swatches.chrome },
                        { label: 'Primario', hex: opt.swatches.primary },
                        { label: 'Secundario', hex: opt.swatches.secondary }
                      ].map((sw) => (
                        <span
                          key={sw.label}
                          title={`${sw.label}: ${sw.hex}`}
                          className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-700 shadow-2xs"
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]">
                      {isSelected ? 'Seleccionado' : 'Aplicar tema'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: Sistemas */}
      {activeTab === 'sistemas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976]">
              Categorías de sistemas de ingeniería (Chillers, Calderas, Neumática, Eléctrico, etc.)
            </span>
            {canEdit && (
              <button
                onClick={handleOpenSisCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Sistema</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sistemas.map(s => (
              <div
                key={s.codigo_sis}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-5 space-y-3 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#EBF3FF] px-2 py-0.5 rounded">
                      {s.codigo_sis}
                    </span>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenSisEdit(s)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={async () => {
                            const confirmed = await confirmAction({
                              title: 'Eliminar Sistema',
                              message: `¿Está seguro de eliminar el sistema "${s.nombre}"?`,
                              confirmText: 'Sí, Eliminar',
                              tone: 'danger'
                            });
                            if (confirmed) {
                              deleteSistema(s.codigo_sis);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-sm mt-2">{s.nombre}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-1 leading-relaxed">{s.descripcion || 'Sin descripción'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Frecuencias */}
      {activeTab === 'frecuencias' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976]">
              Periodicidades y días de tolerancia permitidos antes de catalogar una orden como "Fuera de término"
            </span>
            {isSuperAdmin && canEdit && (
              <button
                onClick={handleOpenFreqCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Frecuencia</span>
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 prodexus:bg-[#F3F6F8] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                <tr>
                  <th className="py-3 px-4">Frecuencia</th>
                  <th className="py-3 px-4 text-center">Tolerancia Permisible (Días ±)</th>
                  <th className="py-3 px-4 text-center">Paso en Meses</th>
                  <th className="py-3 px-4">Regla de Cálculo</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 prodexus:divide-[#E6EEF2]">
                {frecuencias.map(f => (
                  <tr key={f.nombre_freq} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                      {f.nombre_freq}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]">
                      ±{f.dias_tolerancia} días
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-slate-700 dark:text-slate-200">
                      {f.paso_meses === 0 ? 'Sub-mensual (días)' : `Cada ${f.paso_meses} mes(es)`}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {f.paso_meses === 0
                        ? 'Ocurrencias repetitivas por día o semana'
                        : `Ocurrencia fija en el mes programado con ventana de ±${f.dias_tolerancia} días`}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isSuperAdmin && canEdit && (
                          <button
                            onClick={() => handleOpenFreqEdit(f)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && canDelete && (
                          <button
                            onClick={async () => {
                              const confirmed = await confirmAction({
                                title: 'Eliminar Frecuencia',
                                message: `¿Está seguro de eliminar la frecuencia "${f.nombre_freq}"?`,
                                confirmText: 'Sí, Eliminar',
                                tone: 'danger'
                              });
                              if (confirmed) {
                                deleteFrecuencia(f.nombre_freq);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#EBF3FF] text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6] rounded-lg">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                  Exportar Respaldo Completo (JSON)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                  Descarga una copia íntegra con todos los clientes, equipos, historial, órdenes de trabajo y técnicos.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadBackup}
              className="w-full py-2.5 px-4 font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs text-xs flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Archivo de Respaldo (.json)</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] rounded-lg">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                  Importar y Restaurar Respaldo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                  Cargue un archivo JSON previamente exportado para recuperar toda la información.
                </p>
              </div>
            </div>

            <label className="block w-full py-3 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-xl text-center text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:border-blue-500 transition-colors">
              <span className="font-semibold text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]">Haga clic aquí para seleccionar archivo JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-rose-200 dark:border-rose-900/70 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                  Restablecer a Datos de Demostración Industrial
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                  Restaura los equipos industriales de ejemplo (Chiller Trane, Caldera Cleaver Brooks, Compresor Atlas Copco, etc.).
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isResetting}
              onClick={async () => {
                const confirmed = await confirmAction({
                  title: 'Restablecer Valores Iniciales',
                  message: '¿Restablecer toda la base de datos a los valores de demostración iniciales? Se perderán los cambios actuales.',
                  confirmText: 'Sí, Restablecer',
                  tone: 'danger'
                });
                if (confirmed) {
                  setIsResetting(true);
                  try {
                    await resetAllData();
                  } catch {
                    // Error toast and logging already handled inside resetAllData
                  } finally {
                    setIsResetting(false);
                  }
                }
              }}
              className="py-2 px-4 font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors text-xs inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isResetting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isResetting ? 'Restableciendo en la nube...' : 'Restablecer Valores Iniciales'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Sistema */}
      {modalSis && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                {modalSis === 'create' ? 'Nuevo Sistema Industrial' : `Modificar Sistema ${sisCodigo}`}
              </h2>
              <button
                onClick={() => setModalSis(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSisSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Código de Sistema *
                </label>
                <input
                  type="text"
                  required
                  disabled={modalSis === 'edit'}
                  placeholder="Ej. SIS-HVAC"
                  value={sisCodigo}
                  onChange={(e) => setSisCodigo(e.target.value)}
                  className="w-full font-mono font-semibold uppercase text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Nombre del Sistema *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Climatización Central & Chiller"
                  value={sisNombre}
                  onChange={(e) => setSisNombre(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  placeholder="Alcance técnico del sistema..."
                  value={sisDesc}
                  onChange={(e) => setSisDesc(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                <button
                  type="button"
                  onClick={() => setModalSis(null)}
                  className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
                >
                  Guardar Sistema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Frecuencia */}
      {modalFreq && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">
                {modalFreq === 'create' ? 'Nueva Frecuencia de Mantenimiento' : `Modificar Frecuencia ${freqNombre}`}
              </h2>
              <button
                onClick={() => setModalFreq(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFreqSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                  Nombre de Frecuencia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cuatrimestral"
                  value={freqNombre}
                  onChange={(e) => setFreqNombre(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                    Días Tolerancia (±) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={freqTol}
                    onChange={(e) => setFreqTol(Number(e.target.value))}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] mb-1">
                    Paso en Meses (0 = submensual) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={freqPaso}
                    onChange={(e) => setFreqPaso(Number(e.target.value))}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                <button
                  type="button"
                  onClick={() => setModalFreq(null)}
                  className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
                >
                  Guardar Frecuencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
