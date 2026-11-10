import React, { useRef, useEffect, useState } from 'react';
import type { Detection, Telemetry, ROIZone, BEVCalibration, SanitaryRule } from '../../lib/types';
import { ShieldAlert, Cpu, Activity, Video, Volume2, VolumeX, AlertTriangle, Radio, Wifi, Zap, Sparkles } from 'lucide-react';

interface LiveHudViewerProps {
  detections: Detection[];
  telemetry: Telemetry;
  rois: ROIZone[];
  calibration: BEVCalibration;
  rules: SanitaryRule[];
  activeViolations: {
    ruleCode: string;
    elapsedSec: number;
    targetSec: number;
    severity: 'CRÍTICA' | 'ADVERTENCIA';
    trackId: number;
    isTriggered: boolean;
  }[];
  useLocalWebcam: boolean;
  webcamStream: MediaStream | null;
  onToggleWebcam: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  isBackendConnected?: boolean;
  forcedInfractions?: {
    withoutHairnet: boolean;
    withoutGloves: boolean;
    withoutMask: boolean;
    hasDirtyZone: boolean;
  };
  onToggleForcedInfraction?: (type: 'hairnet' | 'gloves' | 'mask' | 'dirtyZone') => void;
}

export const LiveHudViewer: React.FC<LiveHudViewerProps> = ({
  detections,
  telemetry,
  rois,
  calibration,
  activeViolations,
  useLocalWebcam,
  webcamStream,
  onToggleWebcam,
  isAudioMuted,
  onToggleAudio,
  isBackendConnected = false,
  forcedInfractions = { withoutHairnet: false, withoutGloves: false, withoutMask: false, hasDirtyZone: true },
  onToggleForcedInfraction,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showRois, setShowRois] = useState(true);
  const [showMasks, setShowMasks] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showBevVectors, setShowBevVectors] = useState(true);

  // Conectar stream a video tag oculto si la webcam local está activa
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
      videoRef.current.play().catch(e => console.warn('Error autoplay webcam:', e));
    }
  }, [webcamStream]);

  // Render loop acelerado por hardware a 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Dibujar fondo de video (Webcam real o Cocina en RAM)
      if (useLocalWebcam && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
      } else {
        drawIndustrialKitchenBackground(ctx, width, height);
      }

      // 2. Dibujar Zonas de Interés Sanitario (ROIs)
      if (showRois) {
        rois.forEach(roi => {
          if (roi.polygon_coords.length < 3) return;
          ctx.beginPath();
          ctx.moveTo(roi.polygon_coords[0].x * width, roi.polygon_coords[0].y * height);
          for (let i = 1; i < roi.polygon_coords.length; i++) {
            ctx.lineTo(roi.polygon_coords[i].x * width, roi.polygon_coords[i].y * height);
          }
          ctx.closePath();

          ctx.fillStyle = roi.color === '#06b6d4' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(16, 185, 129, 0.12)';
          ctx.fill();

          ctx.strokeStyle = roi.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Etiqueta de la zona
          const firstPt = roi.polygon_coords[0];
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(firstPt.x * width + 4, firstPt.y * height + 4, 160, 20);
          ctx.fillStyle = roi.color;
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`[ROI] ${roi.name.toUpperCase()}`, firstPt.x * width + 8, firstPt.y * height + 18);
        });
      }

      // 3. Dibujar Máscaras de Segmentación Semántica (YOLO-Seg dirty_zone)
      if (showMasks) {
        detections.forEach(det => {
          if (det.class_name === 'dirty_zone' && det.mask_polygon) {
            ctx.beginPath();
            ctx.moveTo(det.mask_polygon[0].x * width, det.mask_polygon[0].y * height);
            for (let i = 1; i < det.mask_polygon.length; i++) {
              ctx.lineTo(det.mask_polygon[i].x * width, det.mask_polygon[i].y * height);
            }
            ctx.closePath();

            ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
            ctx.fill();

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.stroke();

            const center = det.ground_point;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(center.x * width - 50, center.y * height - 24, 110, 18);
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(`DIRTY_ZONE: ${(det.confidence * 100).toFixed(0)}%`, center.x * width - 44, center.y * height - 12);
          }
        });
      }

      // 4. Dibujar Detecciones de EPP (YOLOv9) y Anonimización Facial en Origen
      detections.forEach(det => {
        const [bx, by, bw, bh] = det.bbox;
        const x = bx * width;
        const y = by * height;
        const w = bw * width;
        const h = bh * height;

        // A. ANONIMIZACIÓN FACIAL EN ORIGEN (RESTRICCIÓN NO NEGOCIABLE: SECCIÓN 1)
        if (det.class_name === 'operator' && det.face_box) {
          const [fx, fy, fw, fh] = det.face_box;
          const faceX = fx > 1 ? fx : fx * width;
          const faceY = fy > 1 ? fy : fy * height;
          const faceW = fw > 1 ? (fw - fx) : fw * width;
          const faceH = fh > 1 ? (fh - fy) : fh * height;

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(faceX + faceW / 2, faceY + faceH / 2, Math.max(10, faceW / 2), Math.max(10, faceH / 2), 0, 0, Math.PI * 2);
          ctx.clip();

          ctx.fillStyle = 'rgba(30, 41, 59, 0.96)';
          ctx.fillRect(faceX, faceY, faceW, faceH);

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.restore();

          ctx.fillStyle = '#0284c7';
          ctx.fillRect(faceX - 10, faceY - 14, 100, 14);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('ANONIMIZADO HACCP', faceX - 6, faceY - 4);
        }

        // B. CAJAS DELIMITADORAS DE EPP (YOLOv9)
        if (showBoxes && det.class_name !== 'dirty_zone') {
          const isCrit = det.violation_code === 'RULE-EPP-001';
          const isWarn = det.violation_code === 'RULE-EPP-002';
          const isNormal = !det.is_violation;

          const boxColor = isCrit ? '#ef4444' : (isWarn ? '#f59e0b' : (isNormal && det.class_name !== 'operator' ? '#10b981' : '#06b6d4'));

          ctx.strokeStyle = boxColor;
          ctx.lineWidth = isCrit ? 2.5 : 1.5;
          ctx.strokeRect(x, y, w, h);

          const cornerLen = 8;
          ctx.fillStyle = boxColor;
          ctx.fillRect(x, y, cornerLen, 3);
          ctx.fillRect(x, y, 3, cornerLen);
          ctx.fillRect(x + w - cornerLen, y, cornerLen, 3);
          ctx.fillRect(x + w - 3, y, 3, cornerLen);

          const label = `${det.label_es} [ID:${det.track_id}] ${(det.confidence * 100).toFixed(0)}%`;
          ctx.fillStyle = boxColor;
          ctx.fillRect(x, y - 16, Math.max(90, label.length * 6.5), 16);
          ctx.fillStyle = isCrit || isWarn ? '#000000' : '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(label, x + 4, y - 4);
        }

        // C. VECTOR ESPACIAL Y PUNTO DE APOYO BEV
        if (showBevVectors && det.bev_point && (det.class_name === 'operator' || det.class_name === 'dirty_zone')) {
          const gx = det.ground_point.x * width;
          const gy = det.ground_point.y * height;

          ctx.beginPath();
          ctx.arc(gx, gy, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fill();

          const bevText = `BEV: (${det.bev_point.x.toFixed(2)}m, ${det.bev_point.y.toFixed(2)}m)`;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(gx + 6, gy - 12, 105, 16);
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 8.5px monospace';
          ctx.fillText(bevText, gx + 9, gy);
        }
      });

      // 5. Alerta de Infracción Crítica en pantalla
      const criticalViolation = activeViolations.find(v => v.severity === 'CRÍTICA' && v.isTriggered);
      if (criticalViolation) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, width - 6, height - 6);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.92)';
        ctx.fillRect(0, 0, width, 32);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`🚨 ALERTA SANITARIA CRÍTICA: ${criticalViolation.ruleCode} | SIRENA 105 dB ACTIVA | RELÉ 24V ACTIVADO`, 16, 21);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [detections, rois, calibration, activeViolations, showRois, showMasks, showBoxes, showBevVectors, useLocalWebcam]);

  const drawIndustrialKitchenBackground = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a101d');
    grad.addColorStop(0.5, '#131e33');
    grad.addColorStop(1, '#0e1726');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.4);
      ctx.lineTo(x * 1.4 - w * 0.2, h);
      ctx.stroke();
    }
    for (let y = h * 0.4; y <= h; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const tableGrad = ctx.createLinearGradient(w * 0.15, h * 0.45, w * 0.85, h * 0.88);
    tableGrad.addColorStop(0, '#334155');
    tableGrad.addColorStop(0.3, '#64748b');
    tableGrad.addColorStop(0.7, '#475569');
    tableGrad.addColorStop(1, '#1e293b');

    ctx.fillStyle = tableGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.44);
    ctx.lineTo(w * 0.82, h * 0.46);
    ctx.lineTo(w * 0.92, h * 0.86);
    ctx.lineTo(w * 0.08, h * 0.84);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.54);
    ctx.lineTo(w * 0.46, h * 0.55);
    ctx.lineTo(w * 0.44, h * 0.76);
    ctx.lineTo(w * 0.22, h * 0.74);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(w * 0.85, h * 0.32);
    ctx.lineTo(w * 0.97, h * 0.34);
    ctx.lineTo(w * 0.96, h * 0.68);
    ctx.lineTo(w * 0.84, h * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.stroke();
  };

  return (
    <div className="relative flex flex-col bg-[#0b121e] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Barra de Telemetría Superior del HUD */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-semibold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>M01. LIVE HUD 60 FPS</span>
          </div>

          <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 border ${
            isBackendConnected 
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' 
              : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isBackendConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
            {isBackendConnected ? 'FASTAPI LIVE (WS)' : 'MODO LOCAL AUTÓNOMO'}
          </div>

          <div className="hidden sm:flex items-center gap-1 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-200 font-mono font-bold">{telemetry.fps.toFixed(1)} FPS</span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Latencia:</span>
            <span className="text-slate-200 font-mono font-semibold">{telemetry.latency_ms.toFixed(1)} ms</span>
          </div>

          <div className="hidden md:flex items-center gap-1 text-slate-400">
            <span>Buffer RAM:</span>
            <span className="text-emerald-400 font-mono font-semibold">{telemetry.ram_buffer_mb} MB</span>
            <span className="text-[10px] text-slate-500">(Queue: {telemetry.queue_size})</span>
          </div>
        </div>

        {/* Controles del HUD y Actuadores */}
        <div className="flex items-center gap-2 mt-1 sm:mt-0">
          <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
            telemetry.relay_24v_active ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse' : 'bg-slate-800 text-slate-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${telemetry.relay_24v_active ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`}></span>
            RELÉ 24V: {telemetry.relay_24v_active ? 'DISPARADO (105 dB)' : 'EN ESPERA'}
          </div>

          <button
            onClick={onToggleAudio}
            title={isAudioMuted ? 'Activar Sirena Acústica' : 'Silenciar Sirena'}
            className={`p-1.5 rounded transition ${isAudioMuted ? 'text-slate-500 hover:text-slate-300 bg-slate-800' : 'text-cyan-400 bg-cyan-950/50 border border-cyan-800'}`}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onToggleWebcam}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition ${
              useLocalWebcam 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Video className="w-3 h-3" />
            <span>{useLocalWebcam ? 'Webcam USB Conectada' : 'Simulador Cocina'}</span>
          </button>
        </div>
      </div>

      {/* Visor Canvas y Overlays */}
      <div className="relative w-full aspect-[16/9] bg-black">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain"
        />

        <video
          ref={videoRef}
          playsInline
          muted
          className="hidden"
        />

        <div className="crt-overlay absolute inset-0 pointer-events-none opacity-30" />

        {activeViolations.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 pointer-events-none">
            {activeViolations.map((v, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono shadow-lg backdrop-blur-md border ${
                  v.isTriggered
                    ? 'bg-red-950/90 text-red-200 border-red-500 animate-pulse'
                    : 'bg-amber-950/90 text-amber-200 border-amber-500/60'
                }`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${v.isTriggered ? 'text-red-400' : 'text-amber-400'}`} />
                <span className="font-bold">{v.ruleCode}:</span>
                <span>
                  Filtro Antirrebote: {v.elapsedSec.toFixed(1)}s / {v.targetSec.toFixed(1)}s
                </span>
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${v.isTriggered ? 'bg-red-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(100, (v.elapsedSec / v.targetSec) * 100)}%` }}
                  />
                </div>
                {v.isTriggered && <span className="text-[10px] font-bold text-red-400">CONFIRMADO</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra de Filtros de Visualización del HUD */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono text-[11px]">CAPAS VISUALES:</span>
          
          <button
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${showBoxes ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-500'}`}
          >
            YOLOv9 EPP Boxes
          </button>

          <button
            onClick={() => setShowMasks(!showMasks)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${showMasks ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-500'}`}
          >
            YOLO-Seg Suciedad
          </button>

          <button
            onClick={() => setShowRois(!showRois)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${showRois ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'}`}
          >
            Polígonos ROI
          </button>

          <button
            onClick={() => setShowBevVectors(!showBevVectors)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${showBevVectors ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-500'}`}
          >
            Vectores Métricos BEV
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono">
          <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
          <span>Anonimización facial irreversible activa (No biométrico)</span>
        </div>
      </div>

      {/* Barra de Pruebas de Sustentación en Vivo (Simulación de Faltas Sanitarias) */}
      {onToggleForcedInfraction && (
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#080d16] border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 font-mono text-[11px] font-bold">DEMO EN VIVO (SENATI 4TO SEMESTRE):</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onToggleForcedInfraction('hairnet')}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 ${
                forcedInfractions.withoutHairnet
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{forcedInfractions.withoutHairnet ? '⚠️ Sin Cofia (Forzado: ON)' : '🧪 Quitar Cofia (Regla 1)'}</span>
            </button>

            <button
              onClick={() => onToggleForcedInfraction('gloves')}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 ${
                forcedInfractions.withoutGloves
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{forcedInfractions.withoutGloves ? '⚠️ Sin Guantes (Forzado: ON)' : '🧪 Quitar Guantes (Regla 2)'}</span>
            </button>

            <button
              onClick={() => onToggleForcedInfraction('mask')}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 ${
                forcedInfractions.withoutMask
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{forcedInfractions.withoutMask ? '⚠️ Sin Mascarilla (Forzado: ON)' : '🧪 Quitar Mascarilla (Regla 3)'}</span>
            </button>

            <button
              onClick={() => onToggleForcedInfraction('dirtyZone')}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 ${
                forcedInfractions.hasDirtyZone
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <span>{forcedInfractions.hasDirtyZone ? 'Mancha en Mesa: ACTIVA' : 'Mesa Limpia'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
