/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCircle2, ClipboardCheck, ShieldAlert, X } from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { useAuth } from '../context/AuthContext';
import { DigitalOrderTarget, OrderTipo } from '../utils/digitalOrderLink';
import { canValidateDigitalOrder } from '../utils/rbac';
import {
  PendingSupervisorValidationItem,
  getPendingSupervisorValidations
} from '../utils/supervisorValidations';

interface SupervisorValidationBellProps {
  onSelectOrder?: (target: DigitalOrderTarget) => void;
}

const TIPO_BADGE_CLASS: Record<OrderTipo, string> = {
  MP: 'bg-blue-100 text-blue-800 border-blue-200',
  MC: 'bg-amber-100 text-amber-800 border-amber-200',
  OT: 'bg-slate-100 text-slate-800 border-slate-200',
  CAL: 'bg-indigo-100 text-indigo-800 border-indigo-200'
};

export const SupervisorValidationBell: React.FC<SupervisorValidationBellProps> = ({
  onSelectOrder
}) => {
  const {
    clientes,
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    calibraciones,
    cloudLoading,
    addToast
  } = useMaintenance();
  const { userProfile } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const seenKeysRef = useRef<Set<string>>(new Set());

  const isSupervisor = canValidateDigitalOrder(userProfile);

  const pendingItems: PendingSupervisorValidationItem[] = useMemo(() => {
    if (!isSupervisor) return [];
    return getPendingSupervisorValidations({
      userProfile,
      clientes,
      equipos,
      historial,
      correctivos,
      ordenesTrabajo,
      calibraciones
    });
  }, [
    isSupervisor,
    userProfile,
    clientes,
    equipos,
    historial,
    correctivos,
    ordenesTrabajo,
    calibraciones
  ]);

  // Live toast when a technician closes an order digitally in real time
  useEffect(() => {
    if (!isSupervisor || cloudLoading) return;

    const currentKeys = new Set(pendingItems.map((i) => i.key));

    if (!initializedRef.current) {
      seenKeysRef.current = currentKeys;
      initializedRef.current = true;
      return;
    }

    for (const item of pendingItems) {
      if (!seenKeysRef.current.has(item.key)) {
        addToast(
          `Orden ${item.tipo} ${item.folio} cerrada digitalmente por ${item.tecnico}. Requiere validación del supervisor.`,
          'warning'
        );
      }
    }
    seenKeysRef.current = currentKeys;
  }, [isSupervisor, cloudLoading, pendingItems, addToast]);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isSupervisor) return null;

  const count = pendingItems.length;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notificaciones de validación (${count} pendientes)`}
        title={
          count > 0
            ? `${count} orden${count === 1 ? '' : 'es'} cerrada${count === 1 ? '' : 's'} digitalmente esperando validación`
            : 'Notificaciones de validación de órdenes digitales'
        }
        className={`relative p-2 rounded-lg border transition-colors ${
          count > 0
            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
            : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50'
        }`}
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold font-mono flex items-center justify-center shadow-xs">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[400px] bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className={`w-4 h-4 shrink-0 ${count > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  Validación de Cierres Digitales
                </p>
                <p className="text-[11px] text-slate-500">
                  {count > 0
                    ? `${count} orden${count === 1 ? '' : 'es'} cerrada${count === 1 ? '' : 's'} por revisar`
                    : 'Bandeja al día'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              aria-label="Cerrar notificaciones"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {pendingItems.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-800">
                  No hay órdenes digitales pendientes de validación
                </p>
                <p className="text-[11px] text-slate-500">
                  Cuando un técnico cierre una orden desde su enlace digital, aparecerá aquí para su aprobación y firma.
                </p>
              </div>
            ) : (
              pendingItems.map((item) => (
                <div key={item.key} className="p-3.5 hover:bg-slate-50/90 transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${TIPO_BADGE_CLASS[item.tipo]}`}
                        >
                          {item.tipo}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {item.folio}
                        </span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[11px] font-medium text-slate-600 truncate max-w-[140px]">
                          {item.cliente}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {item.nombreActivo}{' '}
                        <span className="font-mono text-[11px] text-slate-500">({item.codigoEq})</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                    {item.resumen}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="text-[10px] text-slate-500 truncate">
                      <span>Técnico: </span>
                      <strong className="text-slate-700">{item.tecnico}</strong>
                      <span> · {item.fechaFirmaDigital || item.fechaReal}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onSelectOrder?.(item.target);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 transition-colors shadow-2xs"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Validar</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
