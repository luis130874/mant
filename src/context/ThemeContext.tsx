/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppTheme = 'classic' | 'dark' | 'prodexus';

export const THEME_STORAGE_KEY = 'prodexus_theme';

export interface ThemeOptionMeta {
  id: AppTheme;
  name: string;
  subtitle: string;
  description: string;
  swatches: {
    canvas: string;
    chrome: string;
    surface: string;
    primary: string;
    secondary: string;
  };
}

export const THEME_OPTIONS: ThemeOptionMeta[] = [
  {
    id: 'classic',
    name: 'Colores Actuales',
    subtitle: 'Clásico Industrial',
    description: 'Lienzo claro en pizarra suave, tarjetas blancas de alto contraste y acentos azul ingeniería.',
    swatches: {
      canvas: '#f8fafc',
      chrome: '#ffffff',
      surface: '#ffffff',
      primary: '#2563eb',
      secondary: '#059669'
    }
  },
  {
    id: 'dark',
    name: 'Modo Oscuro',
    subtitle: 'Nocturno Técnico',
    description: 'Superficies oscuras de baja fatiga visual, tipografía optimizada y contraste AA para turnos nocturnos.',
    swatches: {
      canvas: '#020617',
      chrome: '#0f172a',
      surface: '#0f172a',
      primary: '#3b82f6',
      secondary: '#10b981'
    }
  },
  {
    id: 'prodexus',
    name: 'Paleta Logo Prodexus',
    subtitle: 'Identidad Corporativa',
    description: 'Inspirada en el isotipo oficial Prodexus: Azul Petróleo profundo (#132B36), Azul Prodexus (#2F7CF6) y Verde Esmeralda (#1FB85C).',
    swatches: {
      canvas: '#f3f6f8',
      chrome: '#132b36',
      surface: '#ffffff',
      primary: '#2f7cf6',
      secondary: '#1fb85c'
    }
  }
];

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'classic';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'prodexus' || saved === 'classic') {
      return saved;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return 'classic';
}

export function applyDocumentTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = 'light';
  }
}

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (next: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const initial = readStoredTheme();
    applyDocumentTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyDocumentTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme]);

  const setTheme = (next: AppTheme) => {
    applyDocumentTheme(next);
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
