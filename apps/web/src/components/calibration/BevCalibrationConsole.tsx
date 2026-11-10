import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { BEVCalibration, Point2D, ROIZone } from '../../lib/types';
import { solveHomographyMatrix, projectPointBEV, calculateResidualErrorCm } from '../../lib/homographyMath';
import { Crosshair, Move, CheckCircle2, RotateCcw, Save, ShieldCheck, Ruler, Grid } from 'lucide-react';

interface BevCalibrationConsoleProps {
  calibration: BEVCalibration;
  rois: ROIZone[];
  onSaveCalibration: (updated: BEVCalibration) => void;
}

export const BevCalibrationConsole: React.FC<BevCalibrationConsoleProps> = ({
  calibration,
  onSaveCalibration,
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
      { x: 0, y: tableDimensions.width }
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

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
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

    ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const pointLabels = ['P1: Noroeste (0,0)', 'P2: Noreste (L,0)', 'P3: Sureste (L,W)', 'P4: Suroeste (0,W)'];
    quad.forEach((pt, idx) => {
      const px = pt.x * w;
      const py = pt.y * h;
      const isSelected = selectedPointIndex === idx;

      ctx.beginPath();
      ctx.arc(px, py, isSelected ? 12 : 9, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#38bdf8' : '#06b6d4';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(px + 12, py - 12, 130, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
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

    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.fillRect(probeX + 10, probeY - 14, 110, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('PUNTO DE PRUEBA', probeX + 14, probeY - 2);

  }, [quad, selectedPointIndex, probePoint]);

  useEffect(() => {
    const canvas = rightCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#070c16';
    ctx.fillRect(0, 0, w, h);

    const margin = 40;
    const gridW = w - margin * 2;
    const gridH = h - margin * 2;
    const scalePxPerM = Math.min(gridW / 3.0, gridH / 2.0);

    const originX = margin + 20;
    const originY = margin + 20;

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 1;
    for (let mx = 0; mx <= 3.0; mx += 0.5) {
      const gx = originX + mx * scalePxPerM;
      ctx.beginPath();
      ctx.moveTo(gx, margin);
      ctx.lineTo(gx, h - margin);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`${mx.toFixed(1)}m`, gx - 10, h - margin + 14);
    }

    for (let my = 0; my <= 2.0; my += 0.5) {
      const gy = originY + my * scalePxPerM;
      ctx.beginPath();
      ctx.moveTo(margin, gy);
      ctx.lineTo(w - margin, gy);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`${my.toFixed(1)}m`, margin - 32, gy + 3);
    }

    const tablePxW = tableDimensions.length * scalePxPerM;
    const tablePxH = tableDimensions.width * scalePxPerM;

    ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
    ctx.fillRect(originX, originY, tablePxW, tablePxH);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(originX, originY, tablePxW, tablePxH);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`MESA: ${tableDimensions.length.toFixed(2)}m x ${tableDimensions.width.toFixed(2)}m`, originX + 10, originY + 20);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(originX - 10, originY - 10, tablePxW + 20, tablePxH + 20);
    ctx.setLineDash([]);

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
      ctx.arc(projX, projY, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const label = `BEV: X=${projectedProbe.x.toFixed(2)}m, Y=${projectedProbe.y.toFixed(2)}m`;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(projX + 12, projY - 10, 160, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(label, projX + 16, projY + 4);
    }
  }, [tableDimensions, projectedProbe]);

  const handleSave = () => {
    const updated: BEVCalibration = {
      ...calibration,
      source_quad: quad,
      homography_matrix: currentH,
      residual_error_cm: residualCm,
      table_dimensions_m: tableDimensions,
      updated_at: new Date().toISOString()
    };
    onSaveCalibration(updated);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleReset = () => {
    setQuad(calibration.source_quad);
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#0b121e] border border-slate-800 rounded-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100 font-mono tracking-wide">
              M03. CONSOLA DE CALIBRACIÓN ESPACIAL (BIRD'S EYE VIEW - BEV)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Transformación homográfica cenital 3x3 para corrección angular y medición métrica real (&lt; 2.5m).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold ${
            residualCm < 5.0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}>
            <ShieldCheck className="w-4 h-4" />
            <span>Error Residual: {residualCm} cm (Criterio Sec. 15: &lt; 5.0 cm)</span>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Matriz Homográfica</span>
          </button>
        </div>
      </div>

      {isSavedNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-lg flex items-center gap-2 text-emerald-300 text-xs font-mono animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Matriz de homografía 3x3 persistida exitosamente vía POST /api/v1/cameras/CAM-01/calibrate-bev.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-cyan-400" />
              1. PERSPECTIVA DE CÁMARA (ARRASTRAR 4 PUNTOS P1..P4)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Haz clic para mover punto de prueba</span>
          </div>

          <div className="relative aspect-[16/9] bg-black rounded overflow-hidden border border-slate-800">
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

          <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] font-mono">
            {quad.map((pt, i) => (
              <div key={i} className="p-1.5 bg-slate-950 rounded border border-slate-800 text-slate-400">
                <span className="text-cyan-400 font-bold">P{i+1}: </span>
                X: {(pt.x * 100).toFixed(1)}%, Y: {(pt.y * 100).toFixed(1)}%
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-cyan-400" />
              2. PROYECCIÓN CENITAL MÉTRICA REAL (BIRD'S EYE VIEW)
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">Escala 1:1 en Metros</span>
          </div>

          <div className="relative aspect-[16/9] bg-black rounded overflow-hidden border border-slate-800">
            <canvas
              ref={rightCanvasRef}
              width={640}
              height={360}
              className="w-full h-full"
            />
          </div>

          <div className="mt-3 p-2 bg-slate-950 rounded border border-slate-800 text-xs font-mono">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
              <span className="font-bold text-cyan-400">MATRIZ HOMOGRÁFICA H (3x3):</span>
              <span className="text-slate-500">DLT Gaussian 8x8 Solver</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-slate-300 bg-slate-900/70 p-1.5 rounded">
              {currentH.flat().map((val, idx) => (
                <div key={idx} className="bg-slate-800/60 py-0.5 rounded text-[11px] text-cyan-200">
                  {val.toFixed(4)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-mono">
          <Ruler className="w-4 h-4 text-cyan-400" />
          <span>Dimensiones de la Mesa:</span>
        </div>

        <div className="flex items-center gap-4 font-mono">
          <div className="flex items-center gap-1.5">
            <label className="text-slate-400">Largo (m):</label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="5.0"
              value={tableDimensions.length}
              onChange={e => setTableDimensions({ ...tableDimensions, length: parseFloat(e.target.value) || 2.4 })}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-cyan-300 text-center font-bold focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-slate-400">Ancho (m):</label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="3.0"
              value={tableDimensions.width}
              onChange={e => setTableDimensions({ ...tableDimensions, width: parseFloat(e.target.value) || 1.2 })}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-cyan-300 text-center font-bold focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
