/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PackageMinus, Plus, Trash2, AlertTriangle, Boxes } from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';

export interface SelectedRepuestoConsumo {
  repuestoId: string;
  cantidad: number;
}

interface RepuestosConsumoSelectorProps {
  clienteNombre?: string;
  equipoCodigo?: string;
  selectedItems: SelectedRepuestoConsumo[];
  onChangeItems: (items: SelectedRepuestoConsumo[]) => void;
  manualText: string;
  onChangeManualText: (val: string) => void;
  manualLabel?: string;
  manualPlaceholder?: string;
}

export const RepuestosConsumoSelector: React.FC<RepuestosConsumoSelectorProps> = ({
  clienteNombre,
  equipoCodigo,
  selectedItems,
  onChangeItems,
  manualText,
  onChangeManualText,
  manualLabel = 'Repuestos / Insumos No Registrados o Adicionales (Texto Libre)',
  manualPlaceholder = 'Ej. Consumibles menores, tornillería no inventariada, sellador, repuesto externo...'
}) => {
  const { repuestos } = useMaintenance();

  const [pickedId, setPickedId] = useState('');
  const [pickedQty, setPickedQty] = useState(1);

  // Filter repuestos available for the client (or 'Todas las Plantas')
  // Sort so items linked to the specific equipment appear first, then in-stock items
  const availableRepuestos = useMemo(() => {
    const filtered = repuestos.filter(r => {
      if (!clienteNombre || clienteNombre === 'Todos') return true;
      return r.cliente.trim() === clienteNombre.trim() || r.cliente === 'Todas las Plantas';
    });

    return [...filtered].sort((a, b) => {
      const aLinked = equipoCodigo && a.equipos_asociados.includes(equipoCodigo) ? 1 : 0;
      const bLinked = equipoCodigo && b.equipos_asociados.includes(equipoCodigo) ? 1 : 0;
      if (aLinked !== bLinked) return bLinked - aLinked;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [repuestos, clienteNombre, equipoCodigo]);

  const handleAddRepuesto = () => {
    if (!pickedId) return;
    const qty = Math.max(1, Number(pickedQty) || 1);

    const existing = selectedItems.find(item => item.repuestoId === pickedId);
    if (existing) {
      onChangeItems(
        selectedItems.map(item =>
          item.repuestoId === pickedId
            ? { ...item, cantidad: item.cantidad + qty }
            : item
        )
      );
    } else {
      onChangeItems([...selectedItems, { repuestoId: pickedId, cantidad: qty }]);
    }

    setPickedId('');
    setPickedQty(1);
  };

  const handleUpdateQty = (repuestoId: string, newQty: number) => {
    const safeQty = Math.max(1, Number(newQty) || 1);
    onChangeItems(
      selectedItems.map(item =>
        item.repuestoId === repuestoId ? { ...item, cantidad: safeQty } : item
      )
    );
  };

  const handleRemove = (repuestoId: string) => {
    onChangeItems(selectedItems.filter(item => item.repuestoId !== repuestoId));
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 prodexus:bg-[#F3F6F8] border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] rounded-xl space-y-3.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-950/60 prodexus:bg-[#EEF5FF] text-blue-700 dark:text-blue-300 prodexus:text-[#2F7CF6] rounded-md">
            <Boxes className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] text-xs">
              Consumo y Baja de Repuestos del Inventario (Stock)
            </h4>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
              Seleccione repuestos del almacén para descontar automáticamente al cerrar la orden, o ingrese ítems no registrados abajo.
            </p>
          </div>
        </div>
        {selectedItems.length > 0 && (
          <span className="px-2 py-0.5 rounded bg-blue-600 prodexus:bg-[#2F7CF6] text-white font-bold text-[10px] shrink-0">
            {selectedItems.length} por descontar
          </span>
        )}
      </div>

      {/* Selector Row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
          className="flex-1 min-h-[44px] font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Seleccionar repuesto registrado en stock --</option>
          {availableRepuestos.map(rep => {
            const isLinked = equipoCodigo && rep.equipos_asociados.includes(equipoCodigo);
            return (
              <option key={rep.id} value={rep.id}>
                {isLinked ? '★ ' : ''}[{rep.codigo_repuesto}] {rep.nombre} — Stock: {rep.stock_actual} {rep.unidad_medida}
                {rep.stock_actual === 0 ? ' (AGOTADO)' : rep.stock_actual <= rep.stock_minimo ? ' (STOCK BAJO)' : ''}
              </option>
            );
          })}
        </select>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 min-h-[44px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg px-2.5 py-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">Cant:</span>
            <input
              type="number"
              min="1"
              value={pickedQty}
              onChange={(e) => setPickedQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 min-h-[36px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-transparent text-center focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleAddRepuesto}
            disabled={!pickedId}
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] hover:bg-blue-700 prodexus:hover:bg-[#2566D1] disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Dar de baja</span>
          </button>
        </div>
      </div>

      {/* Selected Items Table / List */}
      {selectedItems.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {selectedItems.map(item => {
            const rep = repuestos.find(r => r.id === item.repuestoId);
            if (!rep) return null;
            const nuevoSaldo = Math.max(0, rep.stock_actual - item.cantidad);
            const excedeStock = item.cantidad > rep.stock_actual;
            const quedaBajo = nuevoSaldo <= rep.stock_minimo;

            return (
              <div
                key={item.repuestoId}
                className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border bg-white dark:bg-slate-900 ${
                  excedeStock ? 'border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PackageMinus className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36]">{rep.codigo_repuesto}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36] truncate">{rep.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
                    <span>
                      Stock actual: <strong className="font-mono tabular-nums text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]">{rep.stock_actual}</strong> → Nuevo saldo:{' '}
                      <strong className={`font-mono tabular-nums ${quedaBajo ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {nuevoSaldo} {rep.unidad_medida}
                      </strong>
                    </span>
                    {excedeStock && (
                      <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-bold">
                        <AlertTriangle className="w-3 h-3" /> Supera stock disponible (quedará en 0)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">Cant:</label>
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => handleUpdateQty(item.repuestoId, Number(e.target.value))}
                    className="w-16 min-h-[44px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-slate-50 dark:bg-slate-950 prodexus:bg-[#F3F6F8] border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(item.repuestoId)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                    title="Quitar de la lista de baja"
                    aria-label="Quitar repuesto de la lista"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Free-Text Field Preserved */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6]">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 prodexus:text-[#132B36] mb-1">
          {manualLabel}
        </label>
        <input
          type="text"
          placeholder={manualPlaceholder}
          value={manualText}
          onChange={(e) => onChangeManualText(e.target.value)}
          className="w-full min-h-[44px] text-xs font-medium text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};
