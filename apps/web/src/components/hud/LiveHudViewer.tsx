import React, { useRef, useEffect, useState } from 'react';
import type {
  Camera,
  Detection,
  Telemetry,
  ROIZone,
  BEVCalibration,
  SanitaryRule,
  Point2D,
} from '../../lib/types';
import {
  PERSPECTIVE_LIST,
  SIMULATION_PERSPECTIVES,
  type PerspectivePreset,
  type SimulationPerspective,
} from '../../lib/simulationPerspectives';
import {
  Video,
  Volume2,
  VolumeX,
  AlertTriangle,
  Eye,
  Compass,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';

interface LiveHudViewerProps {
  cameras: Camera[];
  activeCameraId: string;
  onSelectCamera: (id: string) => void;
  canSwitchCamera?: boolean;
  detections: Detection[];
  scenePreset: PerspectivePreset;
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
  perspective: SimulationPerspective;
  onChangePerspective: (p: SimulationPerspective) => void;
  alertsPausedRemainingSec?: number;
  canPauseAlerts?: boolean;
  onPauseAlerts?: (minutes: number) => void;
  onResumeAlerts?: () => void;
  forcedInfractions?: {
    withoutHairnet: boolean;
    withoutGloves: boolean;
    withoutMask: boolean;
    hasDirtyZone: boolean;
  };
  onToggleForcedInfraction?: (type: 'hairnet' | 'gloves' | 'mask' | 'dirtyZone') => void;
}

export const LiveHudViewer: React.FC<LiveHudViewerProps> = ({
  cameras,
  activeCameraId,
  onSelectCamera,
  canSwitchCamera = true,
  detections,
  scenePreset,
  telemetry,
  rois,
  activeViolations,
  useLocalWebcam,
  webcamStream,
  onToggleWebcam,
  isAudioMuted,
  onToggleAudio,
  perspective,
  onChangePerspective,
  alertsPausedRemainingSec = 0,
  canPauseAlerts = true,
  onPauseAlerts,
  onResumeAlerts,
  forcedInfractions = {
    withoutHairnet: false,
    withoutGloves: false,
    withoutMask: false,
    hasDirtyZone: true,
  },
  onToggleForcedInfraction,
}) => {
  const isAlertsPaused = alertsPausedRemainingSec > 0;
  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showRois, setShowRois] = useState(true);
  const [showMasks, setShowMasks] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showBevVectors, setShowBevVectors] = useState(true);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
      videoRef.current.play().catch(e => console.warn('Error autoplay webcam:', e));
    }
  }, [webcamStream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    const activeRois = useLocalWebcam ? rois : scenePreset.rois;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Fondo de escena: cámara web real o simulación interpolada
      if (useLocalWebcam && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
      } else {
        drawSimulationScene(ctx, width, height, scenePreset, detections);
      }

      // 2. Zonas de control sanitario (ROIs)
      if (showRois) {
        activeRois.forEach(roi => {
          if (roi.polygon_coords.length < 3) return;
          ctx.beginPath();
          ctx.moveTo(roi.polygon_coords[0].x * width, roi.polygon_coords[0].y * height);
          for (let i = 1; i < roi.polygon_coords.length; i++) {
            ctx.lineTo(roi.polygon_coords[i].x * width, roi.polygon_coords[i].y * height);
          }
          ctx.closePath();

          ctx.fillStyle =
            roi.zone_type === 'sink'
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(59, 130, 246, 0.08)';
          ctx.fill();

          ctx.strokeStyle = roi.zone_type === 'sink' ? '#10b981' : '#60a5fa';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          const anchor = roi.polygon_coords[0];
          const label = roi.name;
          ctx.font = '600 11px Inter, system-ui, sans-serif';
          const textW = ctx.measureText(label).width;
          const bx = Math.min(width - textW - 20, anchor.x * width + 6);
          const by = Math.max(8, anchor.y * height + 6);

          ctx.fillStyle = 'rgba(15, 19, 28, 0.85)';
          ctx.fillRect(bx, by, textW + 14, 20);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, textW + 14, 20);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(label, bx + 7, by + 14);
        });
      }

      // 3. Áreas con residuos en superficie
      if (showMasks) {
        detections.forEach(det => {
          if (det.class_name === 'dirty_zone' && det.mask_polygon) {
            ctx.beginPath();
            ctx.moveTo(det.mask_polygon[0].x * width, det.mask_polygon[0].y * height);
            for (let i = 1; i < det.mask_polygon.length; i++) {
              ctx.lineTo(det.mask_polygon[i].x * width, det.mask_polygon[i].y * height);
            }
            ctx.closePath();

            ctx.fillStyle = 'rgba(217, 119, 6, 0.28)';
            ctx.fill();

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const center = det.ground_point;
            const label = 'Residuo en superficie';
            ctx.font = '600 10px Inter, system-ui, sans-serif';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(15, 19, 28, 0.9)';
            ctx.fillRect(center.x * width - tw / 2 - 6, center.y * height - 26, tw + 12, 18);
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(label, center.x * width - tw / 2, center.y * height - 13);
          }
        });
      }

      // 4. Indicadores de elementos y privacidad en cámara real
      detections.forEach(det => {
        const [bx, by, bw, bh] = det.bbox;
        const x = bx * width;
        const y = by * height;
        const w = bw * width;
        const h = bh * height;

        if (useLocalWebcam && det.class_name === 'operator' && det.face_box) {
          const [fx, fy, fw, fh] = det.face_box;
          const faceX = fx > 1 ? fx : fx * width;
          const faceY = fy > 1 ? fy : fy * height;
          const faceW = fw > 1 ? fw - fx : fw * width;
          const faceH = fh > 1 ? fh - fy : fh * height;

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(
            faceX + faceW / 2,
            faceY + faceH / 2,
            Math.max(10, faceW / 2),
            Math.max(10, faceH / 2),
            0,
            0,
            Math.PI * 2
          );
          ctx.clip();
          ctx.fillStyle = 'rgba(23, 28, 38, 0.95)';
          ctx.fillRect(faceX, faceY, faceW, faceH);
          ctx.restore();
        }

        if (showBoxes && det.class_name !== 'dirty_zone') {
          const isCrit = det.violation_code === 'RULE-EPP-001';
          const isWarn = det.violation_code === 'RULE-EPP-002' || det.violation_code === 'RULE-EPP-003';
          const isNormal = !det.is_violation;

          const boxColor = isCrit
            ? '#ef4444'
            : isWarn
              ? '#f59e0b'
              : isNormal && det.class_name !== 'operator'
                ? '#10b981'
                : '#60a5fa';

          ctx.strokeStyle = boxColor;
          ctx.lineWidth = isCrit ? 2 : 1.25;
          ctx.strokeRect(x, y, w, h);

          const label = det.label_es;
          ctx.font = '600 10px Inter, system-ui, sans-serif';
          const textWidth = ctx.measureText(label).width;
          const tagY = Math.max(2, y - 18);

          ctx.fillStyle = 'rgba(15, 19, 28, 0.88)';
          ctx.fillRect(x, tagY, textWidth + 10, 17);
          ctx.fillStyle = boxColor;
          ctx.fillRect(x, tagY, 3, 17);
          ctx.fillStyle = '#f1f5f9';
          ctx.fillText(label, x + 7, tagY + 12);
        }

        if (showBevVectors && det.bev_point && (det.class_name === 'operator' || det.class_name === 'dirty_zone')) {
          const gx = det.ground_point.x * width;
          const gy = det.ground_point.y * height;

          ctx.beginPath();
          ctx.arc(gx, gy, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          const bevText = `${det.bev_point.x.toFixed(2)}m, ${det.bev_point.y.toFixed(2)}m`;
          ctx.font = '600 10px JetBrains Mono, monospace';
          const btw = ctx.measureText(bevText).width;
          ctx.fillStyle = 'rgba(15, 19, 28, 0.9)';
          ctx.fillRect(gx + 8, gy - 10, btw + 10, 18);
          ctx.fillStyle = '#93c5fd';
          ctx.fillText(bevText, gx + 13, gy + 3);
        }
      });

      // 5. Alerta crítica en pantalla
      const criticalViolation = activeViolations.find(v => v.severity === 'CRÍTICA' && v.isTriggered);
      if (criticalViolation) {
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, width - 4, height - 4);

        ctx.fillStyle = 'rgba(153, 27, 27, 0.92)';
        ctx.fillRect(0, 0, width, 32);

        ctx.fillStyle = '#fef2f2';
        ctx.font = '600 12px Inter, system-ui, sans-serif';
        ctx.fillText(
          `ALERTA CRÍTICA: ${criticalViolation.ruleCode} — Relé 24V y alarma sonora disparados`,
          16,
          20
        );
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    detections,
    scenePreset,
    rois,
    activeViolations,
    showRois,
    showMasks,
    showBoxes,
    showBevVectors,
    useLocalWebcam,
  ]);

  return (
    <div className="flex flex-col bg-[#171c26] border border-[#262d3b] rounded-lg overflow-hidden">
      {/* Barra superior del visor */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#131720] border-b border-[#262d3b]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={activeCameraId}
            disabled={!canSwitchCamera}
            onChange={e => onSelectCamera(e.target.value)}
            title="Seleccionar cámara"
            className="bg-[#0e1118] border border-[#232936] rounded-md px-2.5 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-60 cursor-pointer"
          >
            {cameras.map(cam => (
              <option key={cam.id} value={cam.id}>
                {cam.id} — {cam.name}
              </option>
            ))}
          </select>

          {!useLocalWebcam && (
            <div className="flex items-center gap-1 bg-[#0e1118] p-0.5 rounded-md border border-[#232936]">
              <Compass className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1 hidden sm:block" />
              {PERSPECTIVE_LIST.map(p => {
                const isCurrent = p.id === perspective;
                return (
                  <button
                    key={p.id}
                    onClick={() => onChangePerspective(p.id)}
                    title={p.label}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                      isCurrent
                        ? 'bg-[#2563eb] text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a202c]'
                    }`}
                  >
                    {p.shortLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canPauseAlerts && onPauseAlerts && onResumeAlerts && (
            isAlertsPaused ? (
              <button
                onClick={onResumeAlerts}
                title="Reanudar monitoreo de alertas"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border bg-amber-950/60 text-amber-200 border-amber-700/70 hover:bg-amber-950 transition"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">
                  Pausa {formatCountdown(alertsPausedRemainingSec)} · Reanudar
                </span>
              </button>
            ) : (
              <button
                onClick={() => onPauseAlerts(5)}
                title="Pausar alertas 5 min para limpieza o cambio de turno"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border bg-[#1a202c] text-slate-300 border-[#283040] hover:bg-[#222938] transition"
              >
                <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Pausar 5m</span>
              </button>
            )
          )}

          <span
            className={`px-2 py-1 rounded text-[11px] font-medium border ${
              telemetry.relay_24v_active
                ? 'bg-red-950/60 text-red-300 border-red-800/70'
                : 'bg-[#1a202c] text-slate-400 border-[#283040]'
            }`}
          >
            Relé 24V: {telemetry.relay_24v_active ? 'Disparado' : 'Normal'}
          </span>

          <button
            onClick={onToggleAudio}
            title={isAudioMuted ? 'Activar alarma sonora' : 'Silenciar alarma'}
            className={`p-1.5 rounded border transition ${
              isAudioMuted
                ? 'bg-[#1a202c] text-slate-500 border-[#283040] hover:text-slate-300'
                : 'bg-blue-950/50 text-blue-400 border-blue-800/60'
            }`}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onToggleWebcam}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition ${
              useLocalWebcam
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                : 'bg-[#1a202c] text-slate-300 border-[#283040] hover:bg-[#222938]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>{useLocalWebcam ? 'Usar Simulador' : 'Cámara USB'}</span>
          </button>
        </div>
      </div>

      {/* Área de Canvas 16:9 */}
      <div className="relative w-full aspect-[16/9] bg-[#0b0e14]">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain"
        />

        <video ref={videoRef} playsInline muted className="hidden" />

        {!useLocalWebcam && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded bg-[#0f131c]/85 border border-[#283040] text-[11px] text-slate-300 pointer-events-none">
            {SIMULATION_PERSPECTIVES[perspective].angleInfo}
          </div>
        )}

        {isAlertsPaused && (
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded bg-amber-950/90 border border-amber-700/80 text-xs text-amber-200 pointer-events-none">
            Monitoreo de alertas en pausa · Limpieza / Mantenimiento ({formatCountdown(alertsPausedRemainingSec)})
          </div>
        )}

        {activeViolations.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 pointer-events-none">
            {activeViolations.map((v, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs border backdrop-blur-sm ${
                  v.isTriggered
                    ? 'bg-red-950/90 text-red-100 border-red-700'
                    : 'bg-[#141923]/90 text-amber-200 border-amber-700/70'
                }`}
              >
                <AlertTriangle
                  className={`w-3.5 h-3.5 ${v.isTriggered ? 'text-red-400' : 'text-amber-400'}`}
                />
                <span className="font-semibold font-mono">{v.ruleCode}</span>
                <span className="text-slate-300 font-mono tabular-nums">
                  {v.elapsedSec.toFixed(1)}s / {v.targetSec.toFixed(1)}s
                </span>
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      v.isTriggered ? 'bg-red-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${Math.min(100, (v.elapsedSec / v.targetSec) * 100)}%` }}
                  />
                </div>
                {v.isTriggered && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-red-300">
                    Confirmado
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra inferior unificada: capas + controles de simulación */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#131720] border-t border-[#262d3b] text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            Capas:
          </span>

          <button
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
              showBoxes
                ? 'bg-[#1e2736] text-slate-200 border-[#364359]'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Contornos
          </button>

          <button
            onClick={() => setShowMasks(!showMasks)}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
              showMasks
                ? 'bg-[#1e2736] text-slate-200 border-[#364359]'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Residuos
          </button>

          <button
            onClick={() => setShowRois(!showRois)}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
              showRois
                ? 'bg-[#1e2736] text-slate-200 border-[#364359]'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Zonas
          </button>

          <button
            onClick={() => setShowBevVectors(!showBevVectors)}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
              showBevVectors
                ? 'bg-[#1e2736] text-slate-200 border-[#364359]'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Coordenadas
          </button>
        </div>

        {onToggleForcedInfraction && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 mr-1">Simular evento:</span>

            <button
              onClick={() => onToggleForcedInfraction('hairnet')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${
                forcedInfractions.withoutHairnet
                  ? 'bg-red-950/80 text-red-200 border-red-700'
                  : 'bg-[#1a202c] text-slate-300 border-[#283040] hover:bg-[#222938]'
              }`}
            >
              Sin cofia
            </button>

            <button
              onClick={() => onToggleForcedInfraction('gloves')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${
                forcedInfractions.withoutGloves
                  ? 'bg-amber-950/80 text-amber-200 border-amber-700'
                  : 'bg-[#1a202c] text-slate-300 border-[#283040] hover:bg-[#222938]'
              }`}
            >
              Sin guantes
            </button>

            <button
              onClick={() => onToggleForcedInfraction('mask')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${
                forcedInfractions.withoutMask
                  ? 'bg-amber-950/80 text-amber-200 border-amber-700'
                  : 'bg-[#1a202c] text-slate-300 border-[#283040] hover:bg-[#222938]'
              }`}
            >
              Sin mascarilla
            </button>

            <button
              onClick={() => onToggleForcedInfraction('dirtyZone')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${
                forcedInfractions.hasDirtyZone
                  ? 'bg-blue-950/70 text-blue-200 border-blue-800/70'
                  : 'bg-[#1a202c] text-slate-400 border-[#283040] hover:bg-[#222938]'
              }`}
            >
              Mancha en mesa
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * Renderizador de escena simulada con interpolación suave de perspectiva
 * ========================================================================== */

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  pts: Point2D[],
  w: number,
  h: number,
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1.5
) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x * w, pts[i].y * h);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawSimulationScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  preset: PerspectivePreset,
  detections: Detection[]
) {
  // Fondo base neutro oscuro profesional
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0f131b');
  bg.addColorStop(1, '#161b26');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Retícula de piso interpolada suavemente
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  preset.gridLines.forEach(line => {
    ctx.beginPath();
    ctx.moveTo(line.x1 * w, line.y1 * h);
    ctx.lineTo(line.x2 * w, line.y2 * h);
    ctx.stroke();
  });

  // Borde inferior de mesa (profundidad interpolada hacia 0 en vista cenital)
  const tq = preset.tableQuad;
  if (preset.skirtDepth > 0.002) {
    fillQuad(
      ctx,
      [
        tq[3],
        tq[2],
        { x: tq[2].x, y: tq[2].y + preset.skirtDepth },
        { x: tq[3].x, y: tq[3].y + preset.skirtDepth },
      ],
      w,
      h,
      '#1e2533',
      '#334155',
      1
    );
  }

  // Superficie de mesa de acero inoxidable
  const tableGrad = ctx.createLinearGradient(
    tq[0].x * w,
    tq[0].y * h,
    tq[2].x * w,
    tq[2].y * h
  );
  tableGrad.addColorStop(0, '#333d4f');
  tableGrad.addColorStop(0.5, '#475569');
  tableGrad.addColorStop(1, '#2b3444');
  fillQuad(ctx, tq, w, h, tableGrad, '#64748b', 1.8);

  // Tabla de corte sanitaria
  fillQuad(ctx, preset.cuttingBoardQuad, w, h, '#cbd5e1', '#94a3b8', 1.5);

  // Lavadero de acero
  const sq = preset.sinkQuad;
  fillQuad(ctx, sq, w, h, '#1e2634', '#475569', 1.5);
  const cx = (sq[0].x + sq[1].x + sq[2].x + sq[3].x) / 4;
  const cy = (sq[0].y + sq[1].y + sq[2].y + sq[3].y) / 4;
  const innerSink = sq.map(p => ({
    x: cx + (p.x - cx) * 0.72,
    y: cy + (p.y - cy) * 0.72,
  }));
  fillQuad(ctx, innerSink, w, h, '#0f172a', '#334155', 1);

  // Utensilio de corte sobre tabla
  const knifeDet = detections.find(d => d.class_name === 'dirty_tool');
  if (knifeDet) {
    const [kx, ky, kw, kh] = knifeDet.bbox;
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(kx * w + kw * w * 0.35, ky * h + kh * h * 0.28, kw * w * 0.62, kh * h * 0.38);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(kx * w + kw * w * 0.04, ky * h + kh * h * 0.25, kw * w * 0.32, kh * h * 0.45);
    ctx.restore();
  }

  // Operario con transformación morfológica continua entre perspectivas
  const op = detections.find(d => d.class_name === 'operator');
  if (op) {
    const hasHairnet = detections.some(d => d.class_name === 'hairnet');
    const hasGloves = detections.some(d => d.class_name === 'gloves');
    const hasMask = detections.some(d => d.class_name === 'mask');

    const [ox, oy, ow, oh] = op.bbox;
    const px = ox * w;
    const py = oy * h;
    const pw = ow * w;
    const ph = oh * h;

    const c = preset.cenitalWeight;
    const lean = preset.lean * (1 - c);

    // Torso / Hombros interpolados
    const torsoCx = px + pw * (0.50 + lean);
    const torsoCy = py + ph * lerpNum(0.58, 0.45, c);
    const torsoRx = pw * lerpNum(0.30, 0.42, c);
    const torsoRy = ph * lerpNum(0.26, 0.21, c);

    ctx.fillStyle = '#2b3648';
    ctx.beginPath();
    ctx.ellipse(torsoCx, torsoCy, torsoRx, torsoRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mandil frontal (se desvanece progresivamente en vista cenital 90°)
    if (c < 0.92) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - c * 1.15);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.roundRect(
        px + pw * (0.28 + lean),
        py + ph * 0.37,
        pw * 0.44,
        ph * lerpNum(0.46, 0.22, c),
        6
      );
      ctx.fill();
      ctx.restore();
    }

    // Brazos y manos interpolados
    const lShoulderX = px + pw * lerpNum(0.24 + preset.lean, 0.20, c);
    const lShoulderY = py + ph * lerpNum(0.38, 0.46, c);
    const rShoulderX = px + pw * lerpNum(0.76 + preset.lean, 0.80, c);
    const rShoulderY = py + ph * lerpNum(0.38, 0.46, c);

    const lHandX = px + pw * lerpNum(0.32 + preset.lean * 1.4, 0.34, c);
    const lHandY = py + ph * lerpNum(0.78, 0.86, c);
    const rHandX = px + pw * lerpNum(0.64 + preset.lean * 1.4, 0.66, c);
    const rHandY = py + ph * lerpNum(0.78, 0.86, c);

    ctx.strokeStyle = '#3b475c';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lShoulderX, lShoulderY);
    ctx.lineTo(lHandX, lHandY);
    ctx.moveTo(rShoulderX, rShoulderY);
    ctx.lineTo(rHandX, rHandY);
    ctx.stroke();

    ctx.fillStyle = hasGloves ? '#60a5fa' : '#d6a58a';
    ctx.beginPath();
    ctx.arc(lHandX, lHandY, 10, 0, Math.PI * 2);
    ctx.arc(rHandX, rHandY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Cabeza, mascarilla y cofia interpoladas
    const headCx = px + pw * (0.50 + lean);
    const headCy = py + ph * lerpNum(0.17, 0.34, c);
    const headR = pw * lerpNum(0.16, 0.17, c);

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
    ctx.fill();

    if (hasMask && c < 0.85) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - c * 1.25);
      ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.roundRect(headCx - headR * 0.65, headCy + headR * 0.08, headR * 1.3, headR * 0.65, 5);
      ctx.fill();
      ctx.restore();
    }

    // Cofia o cabello: se expande suavemente desde casquete superior (c=0) hasta círculo completo (c=1)
    const halfSpan = (Math.PI / 2) * (1 + c);
    const startAngle = -Math.PI / 2 - halfSpan;
    const endAngle = -Math.PI / 2 + halfSpan;

    ctx.fillStyle = hasHairnet ? '#f1f5f9' : '#334155';
    ctx.beginPath();
    ctx.arc(headCx, headCy, headR * 1.05, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = hasHairnet ? '#94a3b8' : '#ef4444';
    ctx.lineWidth = hasHairnet ? 1.5 : 2;
    ctx.stroke();
  }
}
