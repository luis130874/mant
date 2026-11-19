/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, PenTool, CheckCircle2 } from 'lucide-react';
import {
  SIGNATURE_VIEWBOX_HEIGHT,
  SIGNATURE_VIEWBOX_WIDTH,
  StrokePoint,
  strokesToSvgDataUrl,
} from '../utils/signatureVector';

interface SignaturePadProps {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (dataUrl: string) => void;
  required?: boolean;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  sublabel,
  value,
  onChange,
  required = false,
  disabled = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasStrokeRef = useRef(Boolean(value));
  const strokesRef = useRef<StrokePoint[][]>([]);
  const activeStrokeRef = useRef<StrokePoint[] | null>(null);
  const lastCanvasPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(Boolean(value));

  const setupCanvasContext = (canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(rect.width || 360, 260);
    const cssHeight = Math.max(rect.height || 152, 128);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#0f172a';
    }
    return { cssWidth, cssHeight, ctx };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { cssWidth, cssHeight, ctx } = setupCanvasContext(canvas);

    if (value && ctx) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
      };
      img.src = value;
      hasStrokeRef.current = true;
      setHasSignature(true);
    } else if (!value) {
      hasStrokeRef.current = false;
      strokesRef.current = [];
      setHasSignature(false);
    }
  }, []);

  useEffect(() => {
    if (!value && hasStrokeRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width || canvas.width, rect.height || canvas.height);
      }
      hasStrokeRef.current = false;
      strokesRef.current = [];
      activeStrokeRef.current = null;
      setHasSignature(false);
    }
  }, [value]);

  const getPoints = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    return {
      canvasPt: { x: cx, y: cy },
      normPt: {
        x: (cx / width) * SIGNATURE_VIEWBOX_WIDTH,
        y: (cy / height) * SIGNATURE_VIEWBOX_HEIGHT,
      },
    };
  };

  const exportVectorSvg = () => {
    if (!hasStrokeRef.current || strokesRef.current.length === 0) {
      onChange('');
      return;
    }
    onChange(strokesToSvgDataUrl(strokesRef.current));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { canvasPt, normPt } = getPoints(e);
    isDrawingRef.current = true;
    lastCanvasPointRef.current = canvasPt;
    const stroke: StrokePoint[] = [normPt];
    activeStrokeRef.current = stroke;
    strokesRef.current = [...strokesRef.current, stroke];

    ctx.beginPath();
    ctx.arc(canvasPt.x, canvasPt.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    if (!hasStrokeRef.current) {
      hasStrokeRef.current = true;
      setHasSignature(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastCanvasPointRef.current) return;

    const { canvasPt, normPt } = getPoints(e);
    ctx.beginPath();
    ctx.moveTo(lastCanvasPointRef.current.x, lastCanvasPointRef.current.y);
    ctx.lineTo(canvasPt.x, canvasPt.y);
    ctx.stroke();
    lastCanvasPointRef.current = canvasPt;

    if (activeStrokeRef.current) {
      activeStrokeRef.current.push(normPt);
    }
  };

  const finishStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastCanvasPointRef.current = null;
    activeStrokeRef.current = null;
    exportVectorSvg();
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    if (ctx) {
      ctx.clearRect(0, 0, rect.width || canvas.width, rect.height || canvas.height);
    }
    hasStrokeRef.current = false;
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setHasSignature(false);
    onChange('');
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 prodexus:text-[#132B36]">
            {label} {required && <span className="text-rose-600 dark:text-rose-400">*</span>}
          </label>
          {sublabel && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 prodexus:text-[#4D6976]">{sublabel}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasSignature ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Capturada</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 prodexus:text-[#4D6976]">
              <PenTool className="w-3 h-3" />
              <span>Pendiente</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || !hasSignature}
            className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200 prodexus:text-[#132B36] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#F3F6F8] hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      <div className="relative rounded-xl border border-slate-300 dark:border-slate-700 prodexus:border-[#C5D5DE] bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className={`w-full h-40 sm:h-36 block touch-none select-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-crosshair'}`}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-5 border-b border-dashed border-slate-300" />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center">
            <span className="text-xs font-medium text-slate-400 select-none">
              Firme con su dedo o puntero sobre esta área
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
