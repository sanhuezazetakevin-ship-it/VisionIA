import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { BEVCalibration, Point2D, ROIZone } from '../../lib/types';
import { solveHomographyMatrix, projectPointBEV, calculateResidualErrorCm } from '../../lib/homographyMath';
import { Crosshair, Move, CheckCircle2, RotateCcw, Save, ShieldCheck, Ruler, Grid } from 'lucide-react';

interface BevCalibrationConsoleProps {
  calibration: BEVCalibration;
  rois: ROIZone[];
  onSaveCalibration: (updated: BEVCalibration) => void;
  canEditCalibration?: boolean;
}

export const BevCalibrationConsole: React.FC<BevCalibrationConsoleProps> = ({
  calibration,
  onSaveCalibration,
  canEditCalibration = true,
}) => {
  const [quad, setQuad] = useState<[Point2D, Point2D, Point2D, Point2D]>(calibration.source_quad);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [probePoint, setProbePoint] = useState<Point2D>({ x: 0.5, y: 0.65 });
  const [tableDimensions, setTableDimensions] = useState(calibration.table_dimensions_m);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const computeHomography = useCallback(() => {
    const dstQuad: [Point2D, Point2D, Point2D, Point2D] = [
      { x: 0, y: 0 },
      { x: tableDimensions.length, y: 0 },
      { x: tableDimensions.length, y: tableDimensions.width },
      { x: 0, y: tableDimensions.width },
    ];

    const H = solveHomographyMatrix(quad, dstQuad);
    const residualCm = calculateResidualErrorCm(H, quad, dstQuad);

    return { H, residualCm };
  }, [quad, tableDimensions]);

  const { H: currentH, residualCm } = computeHomography();
  const projectedProbe = projectPointBEV(currentH, probePoint);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = leftCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    let foundIndex: number | null = null;
    let minDistance = 0.06;

    quad.forEach((pt, idx) => {
      const dist = Math.hypot(pt.x - clickX, pt.y - clickY);
      if (dist < minDistance) {
        minDistance = dist;
        foundIndex = idx;
      }
    });

    if (foundIndex !== null) {
      setSelectedPointIndex(foundIndex);
    } else {
      setProbePoint({ x: clickX, y: clickY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = leftCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const currentY = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));

    if (selectedPointIndex !== null) {
      const newQuad = [...quad] as [Point2D, Point2D, Point2D, Point2D];
      newQuad[selectedPointIndex] = { x: currentX, y: currentY };
      setQuad(newQuad);
    } else if (e.buttons === 1) {
      setProbePoint({ x: currentX, y: currentY });
    }
  };

  const handleMouseUp = () => {
    setSelectedPointIndex(null);
  };

  useEffect(() => {
    const canvas = leftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0f131b';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(quad[0].x * w, quad[0].y * h);
    ctx.lineTo(quad[1].x * w, quad[1].y * h);
    ctx.lineTo(quad[2].x * w, quad[2].y * h);
    ctx.lineTo(quad[3].x * w, quad[3].y * h);
    ctx.closePath();

    ctx.fillStyle = 'rgba(59, 130, 246, 0.14)';
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.stroke();

    const pointLabels = ['P1 (0, 0)', 'P2 (L, 0)', 'P3 (L, W)', 'P4 (0, W)'];
    quad.forEach((pt, idx) => {
      const px = pt.x * w;
      const py = pt.y * h;
      const isSelected = selectedPointIndex === idx;

      ctx.beginPath();
      ctx.arc(px, py, isSelected ? 10 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#93c5fd' : '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 19, 28, 0.9)';
      ctx.fillRect(px + 12, py - 11, 74, 18);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 10px JetBrains Mono, monospace';
      ctx.fillText(pointLabels[idx], px + 16, py + 2);
    });

    const probeX = probePoint.x * w;
    const probeY = probePoint.y * h;
    ctx.beginPath();
    ctx.arc(probeX, probeY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(153, 27, 27, 0.9)';
    ctx.fillRect(probeX + 10, probeY - 12, 84, 18);
    ctx.fillStyle = '#fef2f2';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.fillText('Punto de prueba', probeX + 14, probeY);
  }, [quad, selectedPointIndex, probePoint]);

  useEffect(() => {
    const canvas = rightCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0f131b';
    ctx.fillRect(0, 0, w, h);

    const margin = 40;
    const gridW = w - margin * 2;
    const gridH = h - margin * 2;
    const scalePxPerM = Math.min(gridW / 3.0, gridH / 2.0);

    const originX = margin + 20;
    const originY = margin + 20;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let mx = 0; mx <= 3.0; mx += 0.5) {
      const gx = originX + mx * scalePxPerM;
      ctx.beginPath();
      ctx.moveTo(gx, margin);
      ctx.lineTo(gx, h - margin);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${mx.toFixed(1)}m`, gx - 10, h - margin + 15);
    }

    for (let my = 0; my <= 2.0; my += 0.5) {
      const gy = originY + my * scalePxPerM;
      ctx.beginPath();
      ctx.moveTo(margin, gy);
      ctx.lineTo(w - margin, gy);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${my.toFixed(1)}m`, margin - 34, gy + 3);
    }

    const tablePxW = tableDimensions.length * scalePxPerM;
    const tablePxH = tableDimensions.width * scalePxPerM;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.16)';
    ctx.fillRect(originX, originY, tablePxW, tablePxH);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.strokeRect(originX, originY, tablePxW, tablePxH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 10px JetBrains Mono, monospace';
    ctx.fillText(
      `Mesa: ${tableDimensions.length.toFixed(2)}m x ${tableDimensions.width.toFixed(2)}m`,
      originX + 10,
      originY + 20
    );

    if (projectedProbe) {
      const projX = originX + projectedProbe.x * scalePxPerM;
      const projY = originY + projectedProbe.y * scalePxPerM;

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(projX, originY);
      ctx.lineTo(projX, projY);
      ctx.lineTo(originX, projY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(projX, projY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const label = `X=${projectedProbe.x.toFixed(2)}m, Y=${projectedProbe.y.toFixed(2)}m`;
      ctx.fillStyle = 'rgba(15, 19, 28, 0.95)';
      ctx.fillRect(projX + 10, projY - 10, 140, 20);
      ctx.fillStyle = '#93c5fd';
      ctx.font = '600 10px JetBrains Mono, monospace';
      ctx.fillText(label, projX + 14, projY + 4);
    }
  }, [tableDimensions, projectedProbe]);

  const handleSave = () => {
    const updated: BEVCalibration = {
      ...calibration,
      source_quad: quad,
      homography_matrix: currentH,
      residual_error_cm: residualCm,
      table_dimensions_m: tableDimensions,
      updated_at: new Date().toISOString(),
    };
    onSaveCalibration(updated);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleReset = () => {
    setQuad(calibration.source_quad);
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#171c26] border border-[#262d3b] rounded-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#262d3b] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Calibración Espacial (Proyección Cenital)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Ajuste homográfico de 4 puntos para mapeo métrico real de la superficie de trabajo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border ${
              residualCm < 5.0
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-red-950/40 text-red-300 border-red-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              Error residual: <span className="font-mono tabular-nums">{residualCm} cm</span>
            </span>
          </div>

          <button
            onClick={handleReset}
            disabled={!canEditCalibration}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#1e2430] text-slate-300 border border-[#2d3646] hover:bg-[#252c3b] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>

          <button
            onClick={handleSave}
            disabled={!canEditCalibration}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar calibración</span>
          </button>
        </div>
      </div>

      {!canEditCalibration && (
        <div className="px-3.5 py-2.5 rounded-md bg-[#131720] border border-[#262d3b] text-xs text-slate-400">
          Vista en modo consulta. Solo el Administrador puede guardar cambios en la calibración espacial.
        </div>
      )}

      {isSavedNotice && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-md flex items-center gap-2 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Matriz de transformación espacial guardada correctamente.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="flex flex-col bg-[#131720] border border-[#232936] rounded-lg p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-blue-400" />
              Perspectiva de cámara (arrastrar P1..P4)
            </span>
            <span className="text-[11px] text-slate-400">Clic para mover punto de prueba</span>
          </div>

          <div className="relative aspect-[16/9] bg-[#0b0e14] rounded overflow-hidden border border-[#232936]">
            <canvas
              ref={leftCanvasRef}
              width={640}
              height={360}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="w-full h-full cursor-crosshair"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px] font-mono tabular-nums">
            {quad.map((pt, i) => (
              <div key={i} className="p-2 bg-[#0f131b] rounded border border-[#232936] text-slate-400">
                <span className="text-blue-400 font-semibold">P{i + 1}: </span>
                {(pt.x * 100).toFixed(0)}%, {(pt.y * 100).toFixed(0)}%
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col bg-[#131720] border border-[#232936] rounded-lg p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-blue-400" />
              Proyección cenital en metros
            </span>
            <span className="text-[11px] text-slate-400">Escala real 1:1</span>
          </div>

          <div className="relative aspect-[16/9] bg-[#0b0e14] rounded overflow-hidden border border-[#232936]">
            <canvas ref={rightCanvasRef} width={640} height={360} className="w-full h-full" />
          </div>

          <div className="mt-3 p-2.5 bg-[#0f131b] rounded border border-[#232936] text-xs">
            <div className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between">
              <span className="font-semibold text-slate-300">Matriz Homográfica (3x3)</span>
              <span className="text-slate-500 font-mono">DLT 8x8</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums">
              {currentH.flat().map((val, idx) => (
                <div key={idx} className="bg-[#171c26] py-1 rounded text-[11px] text-slate-300 border border-[#232936]">
                  {val.toFixed(4)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3.5 bg-[#131720] border border-[#232936] rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Ruler className="w-4 h-4 text-blue-400" />
          <span>Dimensiones físicas de la mesa</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-slate-400">Largo (m):</label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="5.0"
              value={tableDimensions.length}
              onChange={e =>
                setTableDimensions({ ...tableDimensions, length: parseFloat(e.target.value) || 2.4 })
              }
              className="w-20 px-2 py-1 bg-[#0f131b] border border-[#2d3646] rounded text-slate-100 text-center font-mono tabular-nums focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-400">Ancho (m):</label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="3.0"
              value={tableDimensions.width}
              onChange={e =>
                setTableDimensions({ ...tableDimensions, width: parseFloat(e.target.value) || 1.2 })
              }
              className="w-20 px-2 py-1 bg-[#0f131b] border border-[#2d3646] rounded text-slate-100 text-center font-mono tabular-nums focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
