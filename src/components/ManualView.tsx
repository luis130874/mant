/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  FileDown,
  Loader2,
  Printer,
  Search,
  CheckCircle2,
  CalendarDays,
  Compass,
  Smartphone,
  ShieldCheck,
  Building2,
  Image as ImageIcon
} from 'lucide-react';
import { useMaintenance } from '../context/MaintenanceContext';
import { exportElementToPDF } from '../utils/pdfGenerator';
import { APP_VERSION } from '../utils/versionControl';

import capturaDashboardImg from '../assets/images/manual_real_dashboard.png';
import capturaEmpresasImg from '../assets/images/manual_real_empresas.png';
import capturaPlanImg from '../assets/images/manual_real_plan.png';
import capturaDigitalImg from '../assets/images/manual_real_digital.png';
import capturaCalibracionImg from '../assets/images/manual_real_calibracion.png';

interface ManualStep {
  titulo: string;
  detalle: string;
}

interface ManualChapter {
  id: string;
  numero: string;
  titulo: string;
  subtitulo: string;
  modulos: string;
  imagen: string;
  imagenAlt: string;
  imagenPie: string;
  icon: React.ComponentType<{ className?: string }>;
  introduccion: string;
  pasos: ManualStep[];
  consejos: string[];
}

const CHAPTERS: ManualChapter[] = [
  {
    id: 'inicio',
    numero: '01',
    titulo: 'Acceso, Navegación y Control General',
    subtitulo: 'Inicio de sesión, selector de planta/año, indicadores KPI y permisos por rol',
    modulos: 'Panel de Control · Barra Superior · Acceso & Usuarios',
    imagen: capturaDashboardImg,
    imagenAlt: 'Captura real del Panel de Control e Indicadores de Prodexus CMMS',
    imagenPie: 'Captura real del programa: Panel de Indicadores, selector de planta/año y notificaciones de supervisión.',
    icon: ShieldCheck,
    introduccion:
      'Prodexus CMMS centraliza el mantenimiento preventivo, correctivo, metrológico e inventario de repuestos por planta. Al ingresar con su correo autorizado, el sistema asigna automáticamente su empresa o habilita el selector global para administradores generales.',
    pasos: [
      {
        titulo: '1. Selección de Planta y Año de Planificación',
        detalle:
          'En la barra lateral izquierda elija la Empresa / Planta activa y el Año de Planificación. Todas las matrices, órdenes e indicadores se recalculan al instante según esa selección.'
      },
      {
        titulo: '2. Lectura del Panel de Control (KPIs)',
        detalle:
          'Revise el porcentaje de cumplimiento mensual y anual frente a la meta operacional del 95%, correctivos abiertos en atención, equipos protegidos y el rendimiento individual por técnico.'
      },
      {
        titulo: '3. Emisión Rápida (+ Nueva Orden)',
        detalle:
          'Desde el botón superior "+ Nueva Orden" puede emitir en cualquier momento una orden Correctiva (MC) por falla imprevista o una Orden de Trabajo (OT) para mejoras o instalaciones.'
      },
      {
        titulo: '4. Gestión de Acceso y Roles',
        detalle:
          'En "Acceso & Usuarios" invite colaboradores por correo electrónico y asigne perfiles predefinidos (Admin de Empresa, Supervisor, Técnico Ejecutor, Metrólogo, Pañolero o Auditor).'
      }
    ],
    consejos: [
      'Use el botón "Auditoría Mensual" o "Evolución Gráfica (12 Meses)" en el Dashboard para detectar meses con atrasos antes de auditorías ISO 9001 / 55001.',
      'Solo el Administrador General puede alternar entre múltiples empresas; los usuarios de planta ven únicamente los datos de su planta asignada.'
    ]
  },
  {
    id: 'configuracion',
    numero: '02',
    titulo: 'Empresas, Terceros, Cuadrilla y Ajustes',
    subtitulo: 'Configuración inicial de plantas, logo corporativo, servicios a terceros y catálogos base',
    modulos: 'Plantas y Clientes · Cuadrilla Técnica · Sistemas & Ajustes',
    imagen: capturaEmpresasImg,
    imagenAlt: 'Captura real de la pantalla Plantas y Clientes con configuración de terceros en Prodexus CMMS',
    imagenPie: 'Captura real del programa: gestión de fichas de empresa, logotipo corporativo y opción para terceros.',
    icon: Building2,
    introduccion:
      'Antes de cargar equipos conviene configurar la ficha de la empresa, los sistemas operativos de planta y el catálogo de técnicos. Esto garantiza que cada orden impresa o enviada lleve la imagen corporativa correcta y los datos de contacto del responsable.',
    pasos: [
      {
        titulo: '1. Ficha de Empresa y Logo Corporativo',
        detalle:
          'En "Plantas y Clientes" registre razón social, RUT, dirección y cargue el logotipo de la empresa. Todos los planes anuales, listados y órdenes incluirán automáticamente el logo de Prodexus junto al de la planta activa.'
      },
      {
        titulo: '2. Habilitar Mantenimiento a Terceros',
        detalle:
          'Si la empresa presta servicios de mantenimiento a clientes externos, marque "Sí" en la opción "¿Trabaja para terceros?". Al activarlo, la pestaña Equipos habilitará el campo "Empresa" y el Plan Maestro permitirá filtrar por empresa cliente.'
      },
      {
        titulo: '3. Cuadrilla de Técnicos y Contacto',
        detalle:
          'En "Cuadrilla Técnica" dé de alta a cada técnico con su especialidad, teléfono WhatsApp y correo electrónico. Estos datos se completan automáticamente al compartir una orden digital.'
      },
      {
        titulo: '4. Sistemas y Tolerancias de Frecuencia',
        detalle:
          'En "Sistemas & Ajustes" administre los sistemas de planta (Frío, Neumática, Eléctrico, HVAC, etc.) y defina los días de tolerancia permitidos para considerar un mantenimiento "A tiempo".'
      }
    ],
    consejos: [
      'Mantenga actualizado el correo electrónico de cada técnico en Cuadrilla Técnica para enviar órdenes digitales en un clic sin tener que escribir el mail manualmente.',
      'Desde Sistemas & Ajustes puede exportar o restaurar copias de seguridad completas de configuración.'
    ]
  },
  {
    id: 'preventivos',
    numero: '03',
    titulo: 'Equipos, Plan Maestro Anual y Preventivos (MP)',
    subtitulo: 'Padrón de activos, proyección de calendario a 12 meses y control de cumplimiento MP',
    modulos: 'Equipos & Maquinaria · Plan Maestro Anual · Preventivos (MP)',
    imagen: capturaPlanImg,
    imagenAlt: 'Captura real de la matriz del Plan Maestro Anual de Mantenimiento en Prodexus CMMS',
    imagenPie: 'Captura real del programa: matriz anual de mantenimiento preventivo (MP) con folios y estados por mes.',
    icon: CalendarDays,
    introduccion:
      'El núcleo preventivo calcula automáticamente todas las intervenciones del año a partir de la frecuencia y fecha base de cada equipo, asignando folios correlativos mensuales y respetando los desfases reales cuando un cierre ocurre fuera de fecha.',
    pasos: [
      {
        titulo: '1. Carga de Equipos y Protocolos',
        detalle:
          'En "Equipos & Maquinaria" registre código, nombre, sistema, marca/modelo, criticidad, frecuencia (Diaria, Semanal, Mensual, Trimestral, Semestral, Anual, etc.) y escriba el protocolo de tareas línea por línea.'
      },
      {
        titulo: '2. Emisión de Listado de Equipos',
        detalle:
          'Utilice el botón "Listado de Equipos" para generar un reporte consolidado imprimible o descargable en PDF con filtros por sistema o empresa tercera (si está habilitada).'
      },
      {
        titulo: '3. Matriz del Plan Maestro Anual',
        detalle:
          'En "Plan Maestro" visualice los 12 meses con fecha prevista, fecha real y folio MP. Haga clic sobre cualquier celda para inspeccionar detalles o emita el plan completo en PDF apaisado con firmas al pie.'
      },
      {
        titulo: '4. Emisión y Cierre Mensual (MP)',
        detalle:
          'En "Preventivos (MP)" seleccione el mes y año para emitir órdenes individuales o por lote completo. Al cerrar una orden, marque las tareas ejecutadas, horas invertidas, técnico y repuestos consumidos.'
      }
    ],
    consejos: [
      'Si un mismo equipo requiere dos rutinas distintas (ej. limpieza semanal y revisión anual), cree dos planes usando el mismo código de equipo con diferente frecuencia.',
      'El Plan Maestro proyecta automáticamente los años siguientes tomando como ancla la última ejecución real registrada.'
    ]
  },
  {
    id: 'hibrido',
    numero: '04',
    titulo: 'Flujo Híbrido (Papel / Digital), Validación y Repuestos',
    subtitulo: 'Impresión en papel o cierre digital con firma táctil, validación del supervisor e inventario',
    modulos: 'Compartir Orden · Ejecución Digital · Validación Supervisor · Repuestos',
    imagen: capturaDigitalImg,
    imagenAlt: 'Captura real de la ventana de ejecución y firma digital de órdenes en Prodexus CMMS',
    imagenPie: 'Captura real del programa: cierre digital en terreno con lista de chequeo, repuestos y firma táctil.',
    icon: Smartphone,
    introduccion:
      'Prodexus CMMS convive sin fricciones entre plantas que prefieren imprimir órdenes en papel y equipos técnicos que operan 100% digital desde el teléfono o tablet. Ambos flujos comparten exactamente la misma trazabilidad y formatos de auditoría.',
    pasos: [
      {
        titulo: '1. Flujo Tradicional en Papel / PDF',
        detalle:
          'Pulse "Imprimir" en cualquier orden (MP, MC, OT o CAL) para generar la hoja de trabajo con casillas de verificación, logos institucionales y recuadros de firma al pie de página. Descargue el PDF o envíe directo a impresora.'
      },
      {
        titulo: '2. Compartir Orden Digital por Mail o WhatsApp',
        detalle:
          'Pulse "Compartir" para abrir el panel de envío. El sistema precarga el correo y teléfono del técnico asignado; puede enviar por Mail (cliente de correo o Gmail Web), abrir WhatsApp con el enlace directo o copiar la URL.'
      },
      {
        titulo: '3. Cierre Digital y Notificación al Supervisor',
        detalle:
          'Al abrir el enlace, el técnico completa los pasos, registra hallazgos/repuestos y firma en pantalla. Al guardar, aparece automáticamente una notificación en la campana superior y en el Panel de Control para que el supervisor revise y firme su validación.'
      },
      {
        titulo: '4. Correctivos (MC), OT e Inventario de Repuestos',
        detalle:
          'Al cerrar cualquier MP, MC o OT puede seleccionar repuestos del pañol; el sistema descuenta automáticamente el stock actual, registra la salida vinculada al folio y alerta cuando un ítem cae bajo el stock mínimo.'
      }
    ],
    consejos: [
      'Desde la vista de "Repuestos & Insumos" puede registrar entradas por compra, ajustes de inventario y emitir el listado valorizado de stock en PDF.',
      'Solo los usuarios con rol de Supervisor o Administrador visualizan la campana de validación para aprobar digitalmente los cierres realizados por técnicos.'
    ]
  },
  {
    id: 'calibracion',
    numero: '05',
    titulo: 'Metrología, Instrumentos y Calibraciones (CAL)',
    subtitulo: 'Control metrológico, puntos de verificación, dictamen técnico y certificados PDF',
    modulos: 'Instrumentos (Metrología) · Plan & Calibración (CAL)',
    imagen: capturaCalibracionImg,
    imagenAlt: 'Captura real del módulo Plan y Calibración Metrológica (CAL) en Prodexus CMMS',
    imagenPie: 'Captura real del programa: calendario anual de calibraciones, tolerancias EMP y emisión de certificados.',
    icon: Compass,
    introduccion:
      'El módulo metrológico gestiona el ciclo completo de manómetros, sensores de temperatura, balanzas, caudalímetros y válvulas de seguridad: desde el alta técnica hasta la matriz anual de calibraciones y emisión del certificado con trazabilidad de patrón.',
    pasos: [
      {
        titulo: '1. Alta en Padrón de Instrumentos',
        detalle:
          'En "Instrumentos (Metrología)" cargue el código (ej. MAN-01), variable de medición, rango de operación, Error Máximo Permisible (EMP), equipo asociado, patrón habitual, frecuencia y fecha inicial.'
      },
      {
        titulo: '2. Plan Anual de Calibraciones (CAL)',
        detalle:
          'En "Plan & Calibración (CAL)" consulte el calendario de 12 meses. Desde aquí puede emitir órdenes mensuales en lote, abrir órdenes individuales o exportar el listado de instrumentos y plan anual en PDF.'
      },
      {
        titulo: '3. Registro de Puntos y Dictamen Técnico',
        detalle:
          'Al cerrar o completar digitalmente una orden CAL, ingrese las lecturas del patrón vs. instrumento en cada punto (0% a 100% FS), error máximo hallado, número de certificado y dictamen (Conforme, Ajustado y Conforme o No Conforme).'
      },
      {
        titulo: '4. Certificados y Bajas Metrológicas',
        detalle:
          'Cada calibración cerrada permite imprimir o descargar su Certificado de Calibración formal. Si un instrumento sale de servicio, regístrelo como Baja con fecha y motivo conservando su historial intacto.'
      }
    ],
    consejos: [
      'Defina la trazabilidad del patrón utilizado en cada cierre CAL para facilitar auditorías de aseguramiento metrológico.',
      'Las órdenes de calibración proyectadas también pueden compartirse por Mail o WhatsApp y certificarse digitalmente con firma en pantalla.'
    ]
  }
];

const QUICK_REFERENCE_TABLE = [
  { codigo: 'MP', nombre: 'Mantenimiento Preventivo', origen: 'Automático según frecuencia del equipo', cierre: 'Protocolo de tareas + horas + repuestos + firma' },
  { codigo: 'MC', nombre: 'Mantenimiento Correctivo', origen: 'Manual ante falla o incidencia imprevista', cierre: 'Acciones correctivas + repuestos + firma' },
  { codigo: 'OT', nombre: 'Orden de Trabajo', origen: 'Manual para mejoras, montajes o servicios', cierre: 'Trabajos ejecutados + materiales + firma' },
  { codigo: 'CAL', nombre: 'Calibración Metrológica', origen: 'Plan anual de instrumentos o emisión en lote', cierre: 'Puntos 0-100% FS + patrón + dictamen + certificado' }
];

const ManualIllustration: React.FC<{
  src: string;
  alt: string;
  caption: string;
  className?: string;
}> = ({ src, alt, caption, className = '' }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <figure className="space-y-1.5">
      <div className={`w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-1.5 shadow-2xs ${className}`}>
        {!imgError ? (
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain rounded-lg border border-slate-100 bg-white"
          />
        ) : (
          <div className="w-full min-h-[200px] flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500 p-4 text-center">
            <ImageIcon className="w-7 h-7 text-slate-400" />
            <span className="text-xs font-medium">{alt}</span>
          </div>
        )}
      </div>
      <figcaption className="text-[11px] text-slate-500 leading-snug">
        {caption}
      </figcaption>
    </figure>
  );
};

export const ManualView: React.FC = () => {
  const { addToast } = useMaintenance();
  const pdfSheetsRef = useRef<HTMLDivElement>(null);

  const [activeChapterId, setActiveChapterId] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CHAPTERS.filter(ch => {
      if (activeChapterId !== 'todos' && ch.id !== activeChapterId) return false;
      if (!q) return true;
      const hay = [
        ch.titulo,
        ch.subtitulo,
        ch.modulos,
        ch.introduccion,
        ...ch.pasos.map(p => `${p.titulo} ${p.detalle}`),
        ...ch.consejos
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeChapterId, searchQuery]);

  const handleDownloadPDF = async () => {
    if (!pdfSheetsRef.current) return;
    try {
      setIsGeneratingPDF(true);
      addToast('Generando Manual de Uso en PDF...', 'info');
      await exportElementToPDF(pdfSheetsRef.current, 'Manual_de_Uso_Prodexus_CMMS', 'portrait');
      addToast('Manual PDF descargado exitosamente.', 'success');
    } catch (err) {
      console.error('Error generating manual PDF:', err);
      addToast('No se pudo generar el PDF del manual. Intente nuevamente.', 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      void handleDownloadPDF();
    }
  };

  const todayFormatted = useMemo(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 no-print">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-11 px-2.5 py-1 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
            <img
              src="/assets/aistudio/prodexus_921c729e.jpeg"
              alt="Prodexus Logo"
              className="h-8 w-auto max-w-[130px] object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
              <span>Manual de Uso del Programa</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Guía operativa ilustrada con capturas reales para operar todos los módulos de Prodexus CMMS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 whitespace-nowrap"
          >
            {isGeneratingPDF ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>{isGeneratingPDF ? 'Generando PDF...' : 'Generar PDF del Manual'}</span>
          </button>
        </div>
      </div>

      {/* Hero Overview + Quick Chapter Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5 no-print">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-blue-700">
                Documentación Operativa · 5 Capítulos Ilustrados · Exportable a PDF A4
              </p>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                Domine el ciclo completo de mantenimiento preventivo, correctivo, inventario y metrología.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Consulte cualquier sección en pantalla o descargue el manual completo en formato PDF A4 con portada corporativa, capturas técnicas e instrucciones detalladas para capacitar supervisores y técnicos.
              </p>
            </div>

            {/* Quick Order Taxonomy Strip */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Documento</th>
                    <th className="py-2 px-3">Generación</th>
                    <th className="py-2 px-3">Datos de Cierre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {QUICK_REFERENCE_TABLE.map(row => (
                    <tr key={row.codigo}>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700">{row.codigo}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">{row.nombre}</td>
                      <td className="py-2 px-3 text-slate-600">{row.origen}</td>
                      <td className="py-2 px-3 text-slate-600">{row.cierre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center">
            <ManualIllustration
              src={capturaDashboardImg}
              alt="Captura real del Panel de Control Prodexus CMMS"
              caption="Captura real del programa: supervisión de planta, cumplimiento mensual/anual e indicadores KPI."
              className="w-full"
            />
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveChapterId('todos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeChapterId === 'todos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos los capítulos (5)
            </button>
            {CHAPTERS.map(ch => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChapterId(ch.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  activeChapterId === ch.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ch.numero}. {ch.titulo.split(',')[0]}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tema (ej. firma, terceros, CAL)..."
              className="w-full pl-8 pr-3 py-2 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Chapters Content (Interactive Screen View) */}
      <div className="space-y-6 no-print">
        {filteredChapters.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
            <BookOpen className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              No se encontraron temas que coincidan con "{searchQuery}"
            </p>
            <p className="text-xs text-slate-500">
              Pruebe con otro término o restablezca los filtros para ver los 5 capítulos completos.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveChapterId('todos');
              }}
              className="mt-2 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Mostrar Todo el Manual
            </button>
          </div>
        ) : (
          filteredChapters.map((ch) => {
            const Icon = ch.icon;
            return (
              <article
                key={ch.id}
                className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5"
              >
                {/* Chapter Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">
                        Capítulo {ch.numero} · {ch.modulos}
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        {ch.numero}. {ch.titulo}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ch.subtitulo}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chapter Body: 2-Column Split */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7 space-y-4">
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {ch.introduccion}
                    </p>

                    <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                      {ch.pasos.map((paso, idx) => (
                        <div key={idx} className="py-3 space-y-1">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                            {paso.titulo}
                          </h3>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {paso.detalle}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-4">
                    <ManualIllustration
                      src={ch.imagen}
                      alt={ch.imagenAlt}
                      caption={ch.imagenPie}
                      className="w-full"
                    />

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Buenas Prácticas Operativas</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
                        {ch.consejos.map((c, cIdx) => (
                          <li key={cIdx} className="flex items-start gap-2">
                            <span className="font-mono text-slate-400 shrink-0">•</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Dedicated A4 Multi-Page PDF / Print Layout (offscreen on screen, visible on print) */}
      <div
        ref={pdfSheetsRef}
        className="fixed -left-[12000px] top-0 w-[794px] print:static print:left-0 print:w-full space-y-8 bg-white text-slate-900"
      >
        {CHAPTERS.map((ch, pageIdx) => (
          <section
            key={`pdf_${ch.id}`}
            className="print-sheet bg-white px-8 py-7 border border-slate-200 print:border-none flex flex-col justify-between"
            style={{ width: '794px', minHeight: '1122px', boxSizing: 'border-box' }}
          >
            <div className="space-y-5">
              {/* Institutional Header: Strictly Prodexus Logo Only */}
              <header className="flex items-center justify-between gap-4 pb-3 border-b-2 border-slate-900">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-36 flex items-center justify-start">
                    <img
                      src="/assets/aistudio/prodexus_921c729e.jpeg"
                      alt="Prodexus Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    Manual Oficial de Usuario · CMMS Industrial
                  </div>
                  <div className="text-xs font-extrabold text-slate-900">
                    PRODEXUS ENTERPRISE CMMS
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Emisión: {todayFormatted} · Versión v{APP_VERSION} · Documentación Oficial Prodexus
                  </div>
                </div>
              </header>

              {/* Chapter Title Block */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                  Capítulo {ch.numero} de {String(CHAPTERS.length).padStart(2, '0')} · {ch.modulos}
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {ch.numero}. {ch.titulo}
                </h2>
                <p className="text-xs text-slate-600">{ch.subtitulo}</p>
              </div>

              {/* Chapter Real Program Screenshot */}
              <div className="space-y-1.5">
                <div className="w-full h-[250px] rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-1.5 flex items-center justify-center">
                  <img
                    src={ch.imagen}
                    alt={ch.imagenAlt}
                    className="max-h-full max-w-full object-contain rounded border border-slate-100 bg-white"
                  />
                </div>
                <p className="text-[10px] text-slate-500 italic">{ch.imagenPie}</p>
              </div>

              {/* Introduction */}
              <p className="text-xs text-slate-800 leading-relaxed">
                {ch.introduccion}
              </p>

              {/* Step-by-step Table / Cards */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  Procedimiento Operativo Paso a Paso
                </h3>
                <div className="space-y-2.5">
                  {ch.pasos.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1"
                    >
                      <div className="text-xs font-bold text-slate-900">{p.titulo}</div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">{p.detalle}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Reference Table on Page 1, Tips on All Pages */}
              {pageIdx === 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[10px]">
                    <thead className="bg-slate-900 text-white font-bold">
                      <tr>
                        <th className="py-1.5 px-2.5">Tipo</th>
                        <th className="py-1.5 px-2.5">Orden / Documento</th>
                        <th className="py-1.5 px-2.5">Origen</th>
                        <th className="py-1.5 px-2.5">Registro de Cierre</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {QUICK_REFERENCE_TABLE.map(row => (
                        <tr key={row.codigo}>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-blue-700">{row.codigo}</td>
                          <td className="py-1.5 px-2.5 font-semibold text-slate-900">{row.nombre}</td>
                          <td className="py-1.5 px-2.5 text-slate-600">{row.origen}</td>
                          <td className="py-1.5 px-2.5 text-slate-600">{row.cierre}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-1">
                <div className="text-[11px] font-bold text-emerald-900">
                  Recomendaciones y Buenas Prácticas
                </div>
                <ul className="space-y-1 text-[10.5px] text-slate-700">
                  {ch.consejos.map((c, idx) => (
                    <li key={idx}>• {c}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <footer className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 mt-4">
              <span>PRODEXUS Enterprise CMMS · Manual de Operación del Usuario</span>
              <span className="font-mono font-semibold text-slate-700">
                Página {pageIdx + 1} de {CHAPTERS.length}
              </span>
            </footer>
          </section>
        ))}
      </div>
    </div>
  );
};
