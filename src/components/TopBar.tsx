/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Building2, Calendar, LogOut, ShieldCheck } from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { getRoleLabel, hasActionAccess, hasModuleAccess } from '../utils/rbac';
import { ModuloKey } from '../types';
import { DigitalOrderTarget } from '../utils/digitalOrderLink';
import { SupervisorValidationBell } from './SupervisorValidationBell';

interface TopBarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenNewOrder: () => void;
  onOpenPrintMasterPlan?: () => void;
  onOpenDigitalValidation?: (target: DigitalOrderTarget) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onTabChange,
  onOpenNewOrder,
  onOpenDigitalValidation
}) => {
  const {
    clientes,
    selectedCliente,
    setSelectedCliente,
    selectedAnio,
    setSelectedAnio,
    availableYears
  } = useMaintenance();
  const { userProfile, isSuperAdmin, signOut } = useAuth();

  const navLinks: Array<{ id: ModuloKey; label: string }> = [
    { id: 'dashboard', label: 'Indicadores' },
    { id: 'plan', label: 'Plan Maestro' },
    { id: 'calibracion', label: 'Calibración (CAL)' },
    { id: 'preventivos', label: 'Preventivos (MP)' },
    { id: 'correctivos', label: 'Correctivos (MC)' },
    { id: 'ordenes', label: 'Trabajos (OT)' },
    { id: 'equipos', label: 'Equipos' },
    { id: 'repuestos', label: 'Repuestos' }
  ];

  const visibleLinks = navLinks.filter((l) => hasModuleAccess(userProfile, l.id));
  const canEmitir = hasActionAccess(userProfile, 'emitir_ordenes');

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 prodexus:bg-[#132B36] border-b border-slate-200 dark:border-slate-800 prodexus:border-[#1E4050] no-print transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark with Official Prodexus Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-11 px-2.5 py-1 bg-white rounded-lg border border-slate-200 dark:border-slate-700 prodexus:border-white/20 shadow-xs flex items-center justify-center hover:border-slate-300 transition-colors">
            <img
              src="/assets/aistudio/prodexus_921c729e.jpeg"
              alt="Prodexus Logo"
              className="h-9 w-auto max-w-[170px] object-contain"
            />
          </div>
          <span className="font-mono text-[11px] font-black tracking-wider uppercase px-2 py-1 rounded-md bg-slate-900 dark:bg-blue-600 prodexus:bg-[#1FB85C] text-white shadow-2xs">
            CMMS
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1">
          {visibleLinks.map(link => {
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onTabChange(link.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 prodexus:bg-[#1E4050] text-blue-600 dark:text-blue-400 prodexus:text-[#1FB85C] font-semibold'
                    : 'text-slate-600 dark:text-slate-300 prodexus:text-slate-200 hover:text-slate-900 dark:hover:text-white prodexus:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 prodexus:hover:bg-[#1B3A48]'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Year, Facility Selector, Primary Action & User Session */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-slate-800 prodexus:bg-[#1B3A48] border border-blue-200 dark:border-slate-700 prodexus:border-[#295468] rounded-lg px-2 py-1.5 text-xs text-blue-800 dark:text-blue-300 prodexus:text-white">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 prodexus:text-[#1FB85C] shrink-0" />
            <select
              value={selectedAnio}
              onChange={(e) => setSelectedAnio(Number(e.target.value))}
              aria-label="Seleccionar año del plan"
              className="bg-transparent border-none text-xs font-extrabold text-blue-900 dark:text-slate-100 prodexus:text-white focus:outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  Año {yr}
                </option>
              ))}
            </select>
          </div>

          {isSuperAdmin ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 prodexus:bg-[#1B3A48] border border-slate-200 dark:border-slate-700 prodexus:border-[#295468] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 prodexus:text-white">
              <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 prodexus:text-[#7FA5B5] shrink-0" />
              <select
                value={selectedCliente}
                onChange={(e) => setSelectedCliente(e.target.value)}
                aria-label="Seleccionar empresa o planta activa"
                className="bg-transparent border-none text-xs font-semibold text-slate-800 dark:text-slate-100 prodexus:text-white focus:outline-none cursor-pointer max-w-[165px] truncate"
              >
                <option value="Todos">Todas las Plantas</option>
                {clientes.map(c => (
                  <option key={c.codigo} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 prodexus:bg-[#1B3A48] border border-slate-200 dark:border-slate-700 prodexus:border-[#295468] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 prodexus:text-white max-w-[185px]">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 prodexus:text-[#1FB85C] shrink-0" />
              <span className="font-semibold truncate" title={selectedCliente}>
                {selectedCliente}
              </span>
            </div>
          )}

          {canEmitir && (
            <button
              onClick={onOpenNewOrder}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 prodexus:bg-[#2F7CF6] rounded-lg hover:bg-blue-700 prodexus:hover:bg-[#2566D1] transition-colors shadow-sm whitespace-nowrap shrink-0 active:scale-98"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Nueva Orden</span>
            </button>
          )}

          {/* Supervisor Digital Closure Validation Notifications */}
          <SupervisorValidationBell onSelectOrder={onOpenDigitalValidation} />

          {/* Active User & Sign Out */}
          {userProfile && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700 prodexus:border-[#295468]">
              <div className="hidden md:block text-right leading-tight max-w-[150px]">
                <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 prodexus:text-white truncate">
                  {userProfile.nombre}
                </p>
                <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 prodexus:text-[#1FB85C] flex items-center justify-end gap-1 truncate">
                  <ShieldCheck className="w-3 h-3 shrink-0" />
                  <span>{getRoleLabel(userProfile.role)}</span>
                </p>
              </div>
              <button
                onClick={() => void signOut()}
                title={`Cerrar sesión (${userProfile.email})`}
                className="p-2 text-slate-500 dark:text-slate-300 prodexus:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 prodexus:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 prodexus:hover:bg-rose-950/40 rounded-lg border border-slate-200 dark:border-slate-700 prodexus:border-[#295468] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
