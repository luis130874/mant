/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, LogIn, Lock, RefreshCw, LogOut, AlertTriangle, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { authStatus, authError, firebaseUser, signInWithGoogle, signOut, refreshAccess } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // Error surfaced via authError
    } finally {
      setSigningIn(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 prodexus:bg-[#132B36] flex flex-col items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="inline-flex p-2 bg-white rounded-xl border border-slate-100 mx-auto">
            <img
              src="/assets/aistudio/prodexus_921c729e.jpeg"
              alt="Prodexus Logo"
              className="h-14 mx-auto object-contain"
            />
          </div>
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] pt-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
            <span>Verificando credenciales y permisos de empresa...</span>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthorized' || authStatus === 'inactive') {
    const isInactive = authStatus === 'inactive';
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 prodexus:bg-[#132B36] flex flex-col items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xl p-8 max-w-lg w-full space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 prodexus:border-[#D5E0E6] pb-4">
            <div className="p-1.5 bg-white rounded-lg border border-slate-100">
              <img
                src="/assets/aistudio/prodexus_921c729e.jpeg"
                alt="Prodexus Logo"
                className="h-11 object-contain"
              />
            </div>
            <span className="font-mono text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded bg-slate-900 dark:bg-blue-600 prodexus:bg-[#1FB85C] text-white">
              CMMS
            </span>
          </div>

          <div className="p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {isInactive
                  ? 'Cuenta de Usuario Suspendida'
                  : 'Usuario sin Acceso Asignado'}
              </h2>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                {isInactive
                  ? `La cuenta "${firebaseUser?.email}" se encuentra temporalmente desactivada. Contacte al Administrador de su Empresa o al Administrador General.`
                  : `El correo "${firebaseUser?.email}" aún no ha sido autorizado por un Administrador General o Administrador de Empresa para ingresar a una planta.`}
              </p>
            </div>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="break-all">{authError}</span>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/70 prodexus:bg-[#F3F6F8] rounded-xl p-4 border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] text-xs text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976] space-y-1.5">
            <p className="font-bold text-slate-800 dark:text-slate-100 prodexus:text-[#132B36] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 prodexus:text-[#2F7CF6]" />
              ¿Cómo obtener acceso?
            </p>
            <p>
              Solicite a su <strong>Administrador de Empresa</strong> o al <strong>Administrador General</strong> que registre su correo electrónico en el módulo <em>Acceso & Usuarios</em> con los permisos de su planta.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={refreshAccess}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] hover:bg-blue-700 prodexus:hover:bg-[#2566D1] rounded-xl transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar Verificación</span>
            </button>
            <button
              onClick={signOut}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 prodexus:text-[#132B36] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#E4ECF0] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión / Cambiar Cuenta</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 prodexus:from-[#132B36] prodexus:via-[#193846] prodexus:to-[#0F232C] flex flex-col items-center justify-center p-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 prodexus:border-[#D5E0E6] shadow-xl p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
            <img
              src="/assets/aistudio/prodexus_921c729e.jpeg"
              alt="Prodexus Logo"
              className="h-12 w-auto object-contain"
            />
            <span className="font-mono text-xs font-black tracking-wider uppercase px-2 py-1 rounded bg-slate-900 prodexus:bg-[#132B36] text-white">
              CMMS
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 prodexus:text-[#132B36] tracking-tight">
            Control de Acceso Corporativo
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976] leading-relaxed">
            Plataforma Multi-Empresa de Mantenimiento Preventivo, Correctivo, Metrología e Inventario Crítico.
          </p>
        </div>

        <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/70 prodexus:bg-[#F3F6F8] p-4 rounded-xl border border-slate-200 dark:border-slate-700 prodexus:border-[#D5E0E6] text-xs text-slate-600 dark:text-slate-300 prodexus:text-[#4D6976]">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 prodexus:text-[#132B36] font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 prodexus:text-[#1FB85C] shrink-0" />
            <span>Aislamiento Estricto por Empresa y Roles</span>
          </div>
          <ul className="space-y-1 pl-6 list-disc text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">
            <li>Administrador General con gestión global de empresas y usuarios.</li>
            <li>Administradores y operadores restringidos exclusivamente a su planta.</li>
            <li>Permisos granulares por módulo y acción operativa.</li>
          </ul>
        </div>

        {authError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-bold text-white bg-blue-600 prodexus:bg-[#2F7CF6] hover:bg-blue-700 prodexus:hover:bg-[#2566D1] disabled:opacity-60 rounded-xl transition-all shadow-sm cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>{signingIn ? 'Conectando...' : 'Ingresar con Cuenta Google'}</span>
        </button>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 prodexus:text-[#6B8592]">
          Acceso protegido mediante autenticación verificada e infraestructura Cloud ISO 55001.
        </p>
      </div>
    </div>
  );
};
