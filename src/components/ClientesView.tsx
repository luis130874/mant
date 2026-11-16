/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Search,
  Phone,
  Mail,
  MapPin,
  Upload,
  Image as ImageIcon,
  X,
  FileText
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { hasActionAccess } from '../utils/rbac';
import { Cliente } from '../types';

export const ClientesView: React.FC = () => {
  const {
    clientes,
    equipos,
    addCliente,
    updateCliente,
    deleteCliente,
    confirmAction,
    addToast
  } = useMaintenance();
  const { userProfile, isSuperAdmin, isCompanyAdmin } = useAuth();
  const canEditEmpresa = isSuperAdmin || (isCompanyAdmin && hasActionAccess(userProfile, 'crear_editar'));

  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);

  // Form states
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [logo, setLogo] = useState('');
  const [trabajaTerceros, setTrabajaTerceros] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredClientes = clientes.filter(c => {
    return c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.rut.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleOpenCreate = () => {
    if (!isSuperAdmin) {
      addToast('Solo el Administrador General puede crear nuevas empresas.', 'warning');
      return;
    }
    setModalMode('create');
    setEditingCodigo(null);
    setCodigo(`CLI-${String(clientes.length + 1).padStart(2, '0')}`);
    setNombre('');
    setRut('');
    setDireccion('');
    setTelefono('');
    setCorreo('');
    setLogo('');
    setTrabajaTerceros(false);
  };

  const handleOpenEdit = (c: Cliente) => {
    if (!canEditEmpresa) return;
    setModalMode('edit');
    setEditingCodigo(c.codigo);
    setCodigo(c.codigo);
    setNombre(c.nombre);
    setRut(c.rut);
    setDireccion(c.direccion);
    setTelefono(c.telefono);
    setCorreo(c.correo);
    setLogo(c.logo || '');
    setTrabajaTerceros(Boolean(c.trabaja_terceros));
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Por favor seleccione un archivo de imagen válido (PNG, JPG, SVG, WebP).', 'warning');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      addToast('La imagen no debe superar 4 MB de tamaño.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      if (rawDataUrl.length <= 320000) {
        setLogo(rawDataUrl);
        return;
      }
      // Compress via canvas so it fits comfortably under Firestore limits
      const img = new Image();
      img.onload = () => {
        const maxW = 520;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setLogo(compressed);
        } else {
          setLogo(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogo('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      addToast('El nombre de la empresa/planta es obligatorio.', 'warning');
      return;
    }

    const data: Cliente = {
      codigo: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      rut: rut.trim(),
      direccion: direccion.trim(),
      telefono: telefono.trim(),
      correo: correo.trim(),
      logo: logo.trim() || undefined,
      trabaja_terceros: trabajaTerceros
    };

    if (modalMode === 'create') {
      if (!isSuperAdmin) return;
      if (clientes.some(c => c.codigo === data.codigo)) {
        addToast('Ya existe un cliente con este código.', 'warning');
        return;
      }
      addCliente(data);
    } else if (modalMode === 'edit' && editingCodigo) {
      updateCliente(editingCodigo, data);
    }

    setModalMode(null);
  };

  const handleDelete = async (c: Cliente) => {
    if (!isSuperAdmin) {
      addToast('Solo el Administrador General puede eliminar empresas.', 'warning');
      return;
    }
    const equiposAsociados = equipos.filter(e => e.cliente.trim() === c.nombre.trim()).length;
    const msg = equiposAsociados > 0
      ? `ATENCIÓN: La empresa "${c.nombre}" tiene ${equiposAsociados} equipo(s) e historial asociado. Al eliminarla se borrarán en cascada. ¿Desea continuar?`
      : `¿Está seguro de eliminar la empresa "${c.nombre}"?`;

    const confirmed = await confirmAction({
      title: 'Eliminar Empresa / Planta',
      message: msg,
      confirmText: 'Sí, Eliminar',
      tone: 'danger'
    });

    if (confirmed) {
      deleteCliente(c.codigo, c.nombre);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
            {isSuperAdmin ? 'Plantas Industriales & Clientes' : 'Mi Empresa / Planta Industrial'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5">
            {isSuperAdmin
              ? 'Gestión global de empresas clientes, ubicaciones físicas y logotipos corporativos.'
              : 'Información corporativa y logotipo oficial de su planta asignada.'}
          </p>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Empresa</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] flex items-center justify-between gap-3 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 prodexus:bg-[#F3F6F8] border border-slate-200 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6] w-64"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
          {filteredClientes.length} Empresa{filteredClientes.length === 1 ? '' : 's'} Visible{filteredClientes.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Grid of Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClientes.map(c => {
          const eqCount = equipos.filter(e => e.cliente.trim() === c.nombre.trim()).length;
          return (
            <div
              key={c.codigo}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] p-5 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 prodexus:hover:border-[#B9D2FA] transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    {c.logo ? (
                      <div className="w-16 h-12 bg-white rounded-lg border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] p-1 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={c.logo}
                          alt={`Logo ${c.nombre}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] flex items-center justify-center text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] shrink-0">
                        <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-mono text-[10.5px] font-bold text-blue-600 dark:text-blue-300 prodexus:text-[#2F7CF6] bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#EEF5FF] px-2 py-0.5 rounded">
                        {c.codigo}
                      </span>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-sm mt-1 leading-snug truncate" title={c.nombre}>
                        {c.nombre}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">RUT: {c.rut}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {canEditEmpresa && (
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 prodexus:hover:text-[#2F7CF6] rounded transition-colors"
                        title="Modificar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDelete(c)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                        title="Eliminar Empresa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] shrink-0" />
                    <span className="truncate">{c.direccion || 'Dirección no especificada'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] shrink-0" />
                    <span>{c.telefono || 'Sin teléfono'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] shrink-0" />
                    <span className="truncate">{c.correo || 'Sin correo'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6] flex items-center justify-between text-xs gap-2">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                  {c.trabaja_terceros ? 'Servicio: Mantenimiento a terceros' : 'Modalidad: Planta propia'}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] font-medium">Equipos:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] px-2 py-0.5 rounded">{eqCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Alta / Modificar */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6]">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
                <span>{modalMode === 'create' ? 'Registrar Nueva Planta / Cliente' : `Modificar ${codigo}`}</span>
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
                    Código *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'edit'}
                    placeholder="CLI-01"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="w-full font-mono font-semibold uppercase text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6] disabled:bg-slate-100 dark:disabled:bg-slate-800 prodexus:disabled:bg-[#F3F6F8]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    RUT / Tax ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="76.452.190-8"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                  Razón Social / Nombre de Planta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. TermoIndustrial del Sur S.A."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                />
              </div>

              {/* Logotipo Oficial del Cliente */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] rounded-xl border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36]">
                    Logotipo Oficial de la Planta / Empresa
                  </label>
                  {logo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Quitar logo
                    </button>
                  )}
                </div>

                {logo ? (
                  <div className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6]">
                    <img
                      src={logo}
                      alt="Vista previa logo"
                      className="h-12 max-w-[140px] object-contain rounded border border-slate-100 bg-white p-1"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">✓ Logo cargado</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">Se incluirá en membretes de órdenes y planes.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] hover:bg-slate-200 dark:hover:bg-slate-700 prodexus:hover:bg-[#D5E0E6] rounded transition-colors"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] hover:border-blue-500 prodexus:hover:border-[#2F7CF6] bg-white dark:bg-slate-950 p-3 rounded-lg text-center cursor-pointer transition-colors"
                  >
                    <Upload className="w-5 h-5 text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] mx-auto mb-1" />
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36]">
                      Haga clic para cargar imagen de logotipo (PNG, JPG, SVG, WebP)
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976] mt-0.5">
                      Máx. 2.5 MB · Tamaño recomendado: rectangular horizontal
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />

                <p className="text-[10px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] leading-tight">
                  ℹ️ <strong>Trazabilidad Documental:</strong> Este logo aparecerá en el encabezado de todas las órdenes de mantenimiento (MP, MC, OT), certificados de calibración y hojas del Plan Maestro Anual correspondientes a este cliente.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  placeholder="Parque Industrial #120"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    placeholder="+56 2 2840 9200"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
                    Correo Operaciones
                  </label>
                  <input
                    type="email"
                    placeholder="operaciones@empresa.com"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    className="w-full font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 prodexus:focus:ring-[#2F7CF6]"
                  />
                </div>
              </div>

              {/* Opción de servicio a terceros */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] rounded-xl border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] space-y-2">
                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]">
                    ¿Trabaja para terceros?
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] mt-0.5 leading-snug">
                    Habilítelo si esta empresa vende servicios de mantenimiento a otras empresas clientes. Activará el campo y filtro <strong>Empresa</strong> en Equipos y en el Plan Maestro.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setTrabajaTerceros(false)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      !trabajaTerceros
                        ? 'bg-white dark:bg-slate-900 border-slate-900 dark:border-slate-300 prodexus:border-[#132B36] text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] text-slate-600 dark:text-slate-400 prodexus:text-[#4D6976] hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    NO · Planta propia
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrabajaTerceros(true)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      trabajaTerceros
                        ? 'bg-blue-600 prodexus:bg-[#2F7CF6] border-blue-600 prodexus:border-[#2F7CF6] text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] text-slate-600 dark:text-slate-400 prodexus:text-[#4D6976] hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    SÍ · Mantenimiento a terceros
                  </button>
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
                  {modalMode === 'create' ? 'Guardar Cliente' : 'Actualizar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
