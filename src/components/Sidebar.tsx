/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  FileCheck2,
  ClipboardList,
  Cpu,
  Building2,
  Users2,
  Settings2,
  AlertTriangle,
  Compass,
  Boxes,
  ShieldCheck,
  Lock,
  BookOpen
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { hasModuleAccess } from '../utils/rbac';
import { ModuloKey } from '../types';
import { APP_VERSION } from '../utils/versionControl';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: ModuloKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const {
    clientes,
    selectedCliente,
    setSelectedCliente,
    selectedAnio,
    setSelectedAnio,
    availableYears,
    equipos,
    correctivos,
    ordenesTrabajo,
    calibraciones,
    instrumentos,
    repuestos
  } = useMaintenance();
  const { userProfile, isSuperAdmin } = useAuth();

  const repuestosFiltrados = selectedCliente === 'Todos'
    ? repuestos
    : repuestos.filter(r => r.cliente.trim() === selectedCliente.trim() || r.cliente === 'Todas las Plantas');

  const repuestosBajoStock = repuestosFiltrados.filter(r => r.stock_actual <= r.stock_minimo).length;

  const equiposFiltrados = selectedCliente === 'Todos'
    ? equipos
    : equipos.filter(e => e.cliente.trim() === selectedCliente.trim());

  const instrumentosActivos = (selectedCliente === 'Todos'
    ? instrumentos
    : instrumentos.filter(i => i.cliente.trim() === selectedCliente.trim())
  ).filter(i => i.estado === 'Activo');

  const correctivosPendientes = (selectedCliente === 'Todos'
    ? correctivos
    : correctivos.filter(c => c.cliente.trim() === selectedCliente.trim())
  ).filter(c => c.estado === 'Pendiente').length;

  const otPendientes = (selectedCliente === 'Todos'
    ? ordenesTrabajo
    : ordenesTrabajo.filter(o => o.cliente.trim() === selectedCliente.trim())
  ).filter(o => o.estado === 'Pendiente').length;

  const calPendientes = (selectedCliente === 'Todos'
    ? calibraciones
    : calibraciones.filter(c => c.cliente.trim() === selectedCliente.trim())
  ).filter(c => c.estado === 'Pendiente').length;

  const currentClienteObj = clientes.find(c => c.nombre === selectedCliente);

  const navItems: NavSection[] = [
    {
      group: 'OPERACIÓN & AUDITORÍA',
      items: [
        { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
        { id: 'plan', label: `Plan Maestro ${selectedAnio}`, icon: CalendarDays },
        {
          id: 'calibracion',
          label: 'Plan & Calibración (CAL)',
          icon: Compass,
          badge: calPendientes > 0 ? String(calPendientes) : undefined,
          badgeColor: 'text-indigo-700 bg-indigo-50'
        },
        { id: 'preventivos', label: 'Preventivos (MP)', icon: FileCheck2 },
        {
          id: 'correctivos',
          label: 'Correctivos (MC)',
          icon: AlertTriangle,
          badge: correctivosPendientes > 0 ? String(correctivosPendientes) : undefined,
          badgeColor: 'text-amber-700 bg-amber-50'
        },
        {
          id: 'ordenes',
          label: 'Trabajos & OT',
          icon: ClipboardList,
          badge: otPendientes > 0 ? String(otPendientes) : undefined,
          badgeColor: 'text-blue-700 bg-blue-50'
        }
      ]
    },
    {
      group: 'ACTIVOS Y RECURSOS',
      items: [
        {
          id: 'equipos',
          label: 'Equipos & Maquinaria',
          icon: Cpu,
          badge: String(equiposFiltrados.length)
        },
        {
          id: 'instrumentos',
          label: 'Instrumentos (Metrología)',
          icon: Compass,
          badge: String(instrumentosActivos.length),
          badgeColor: 'text-indigo-700 bg-indigo-50'
        },
        {
          id: 'repuestos',
          label: 'Repuestos & Insumos',
          icon: Boxes,
          badge: repuestosBajoStock > 0 ? `! ${repuestosBajoStock}` : String(repuestosFiltrados.length),
          badgeColor: repuestosBajoStock > 0 ? 'text-amber-800 bg-amber-100 font-bold' : 'text-slate-700 bg-slate-100'
        },
        { id: 'clientes', label: isSuperAdmin ? 'Plantas y Clientes' : 'Mi Empresa / Planta', icon: Building2 },
        { id: 'tecnicos', label: 'Cuadrilla Técnica', icon: Users2 },
        { id: 'configuracion', label: 'Sistemas & Ajustes', icon: Settings2 },
        { id: 'usuarios', label: 'Acceso & Usuarios', icon: ShieldCheck }
      ]
    },
    {
      group: 'AYUDA Y DOCUMENTACIÓN',
      items: [
        { id: 'manual', label: 'Manual de Uso (PDF)', icon: BookOpen }
      ]
    }
  ];

  const visibleSections = navItems
    .map(sec => ({
      ...sec,
      items: sec.items.filter(item => hasModuleAccess(userProfile, item.id))
    }))
    .filter(sec => sec.items.length > 0);

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 prodexus:bg-[#132B36] border-r border-slate-200 dark:border-slate-800 prodexus:border-[#1E4050] flex flex-col justify-between p-4 no-print min-h-[calc(100vh-4rem)] transition-colors">
      <div className="space-y-6">
        {/* Plant / Facility Switcher Card */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/70 prodexus:bg-[#1B3A48] rounded-xl border border-slate-200 dark:border-slate-700 prodexus:border-[#295468]">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 prodexus:text-[#8FB4C4] uppercase tracking-wider">
              Empresa / Planta Activa
            </label>
            {!isSuperAdmin && (
              <span title="Empresa asignada" className="inline-flex items-center">
                <Lock className="w-3 h-3 text-slate-400 prodexus:text-[#8FB4C4]" />
              </span>
            )}
          </div>

          {isSuperAdmin ? (
            <select
              value={selectedCliente}
              onChange={(e) => setSelectedCliente(e.target.value)}
              className="w-full text-xs font-semibold text-slate-900 dark:text-slate-100 prodexus:text-white bg-white dark:bg-slate-900 prodexus:bg-[#132B36] border border-slate-200 dark:border-slate-700 prodexus:border-[#295468] rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Todos">Todas las Plantas (Global)</option>
              {clientes.map(c => (
                <option key={c.codigo} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full text-xs font-bold text-slate-900 dark:text-slate-100 prodexus:text-white bg-white dark:bg-slate-900 prodexus:bg-[#132B36] border border-slate-200 dark:border-slate-700 prodexus:border-[#295468] rounded-lg p-2 truncate">
              {selectedCliente}
            </div>
          )}

          <div className="mt-2.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 prodexus:text-[#8FB4C4] uppercase tracking-wider mb-1">
              Año de Planificación
            </label>
            <select
              value={selectedAnio}
              onChange={(e) => setSelectedAnio(Number(e.target.value))}
              className="w-full text-xs font-bold text-blue-900 dark:text-blue-300 prodexus:text-white bg-white dark:bg-slate-900 prodexus:bg-[#132B36] border border-blue-200 dark:border-slate-700 prodexus:border-[#2F7CF6]/50 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  Plan {yr}
                </option>
              ))}
            </select>
          </div>

          {currentClienteObj && (
            <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 prodexus:border-[#295468] text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#A5C3D0] space-y-1.5">
              {currentClienteObj.logo && (
                <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-white/95 prodexus:bg-white/95 rounded-lg ring-1 ring-slate-200/80 dark:ring-white/20 prodexus:ring-white/20 shadow-2xs">
                  <div className="h-6 w-14 flex items-center justify-center shrink-0">
                    <img
                      src={currentClienteObj.logo}
                      alt={`Logo ${currentClienteObj.nombre}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 truncate">
                    Logo Activo
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>RUT:</span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200 prodexus:text-white">{currentClienteObj.rut}</span>
              </div>
              <div className="flex justify-between">
                <span>Equipos protegidos:</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#1FB85C]">{equiposFiltrados.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="space-y-5">
          {visibleSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 prodexus:text-[#7FA5B5] uppercase tracking-wider">
                {sec.group}
              </p>
              {sec.items.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/60 prodexus:bg-[#1E4050] text-blue-700 dark:text-blue-300 prodexus:text-white prodexus:ring-1 prodexus:ring-[#2F7CF6]/45 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 prodexus:text-slate-200 hover:text-slate-900 dark:hover:text-white prodexus:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/70 prodexus:hover:bg-[#1B3A48]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400 prodexus:text-[#1FB85C]' : 'text-slate-400 dark:text-slate-400 prodexus:text-[#8FB4C4]'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[11px] font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded shrink-0 ${item.badgeColor || 'bg-slate-100 dark:bg-slate-800 prodexus:bg-[#132B36] text-slate-600 dark:text-slate-300 prodexus:text-slate-200'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 prodexus:border-[#1E4050] text-[11px] text-slate-400 prodexus:text-[#8FB4C4] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="h-9 max-w-[140px] px-2 py-0.5 bg-transparent dark:bg-white/95 prodexus:bg-white/95 rounded-lg dark:ring-1 dark:ring-white/20 prodexus:ring-1 prodexus:ring-white/20 dark:shadow-xs prodexus:shadow-xs flex items-center justify-center">
            <img
              src="/assets/aistudio/prodexus_921c729e.jpeg"
              alt="Prodexus Logo"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <span className="font-mono tabular-nums text-[11px] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#1B3A48] text-slate-700 dark:text-slate-200 prodexus:text-white px-2 py-1 rounded-md font-bold shrink-0">v{APP_VERSION}</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#8FB4C4] font-medium">CMMS Industrial Cloud · ISO 55001</p>
      </div>
    </aside>
  );
};
