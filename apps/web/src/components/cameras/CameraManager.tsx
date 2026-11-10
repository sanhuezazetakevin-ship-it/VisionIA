import React, { useState } from 'react';
import type { Camera, Telemetry } from '../../lib/types';
import { Video, RefreshCw, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

interface CameraManagerProps {
  cameras: Camera[];
  activeCameraId: string;
  onSelectCamera: (id: string) => void;
  telemetry: Telemetry;
}

export const CameraManager: React.FC<CameraManagerProps> = ({
  cameras,
  activeCameraId,
  onSelectCamera,
}) => {
  const [isSimulatingReconnection, setIsSimulatingReconnection] = useState(false);
  const [reconnectNotice, setReconnectNotice] = useState<string | null>(null);

  const handleTestHotPlug = () => {
    setIsSimulatingReconnection(true);
    setReconnectNotice('Simulando corte de conexión física USB/RTSP...');

    setTimeout(() => {
      setReconnectNotice('Hilo de ingesta OpenCV reconectando automáticamente (Sección 15: < 3s)...');

      setTimeout(() => {
        setIsSimulatingReconnection(false);
        setReconnectNotice('✅ Flujo de video restablecido exitosamente en 1.8 segundos. Buffer circular en RAM reiniciado.');
        setTimeout(() => setReconnectNotice(null), 5000);
      }, 1800);
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#0b121e] border border-slate-800 rounded-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100 font-mono tracking-wide">
              M02. INGESTA & GESTIÓN DE CÁMARAS (USB / RTSP)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Captura multihilo OpenCV, buffer circular efímero en RAM y reconexión en caliente en &lt; 3s.
          </p>
        </div>

        <button
          onClick={handleTestHotPlug}
          disabled={isSimulatingReconnection}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSimulatingReconnection ? 'animate-spin' : ''}`} />
          <span>Prueba Desconexión y Reconexión Rápida</span>
        </button>
      </div>

      {reconnectNotice && (
        <div className={`p-3 rounded-lg text-xs font-mono flex items-center gap-2 border ${
          isSimulatingReconnection 
            ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 animate-pulse' 
            : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
        }`}>
          {isSimulatingReconnection ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{reconnectNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cameras.map(cam => {
          const isSelected = cam.id === activeCameraId;
          return (
            <div
              key={cam.id}
              onClick={() => onSelectCamera(cam.id)}
              className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                isSelected 
                  ? 'bg-slate-900/90 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-cyan-400">{cam.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                    cam.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {cam.is_active ? 'EN VIVO' : 'OFFLINE'}
                  </span>
                </div>

                <div className="text-sm font-semibold text-slate-100 mb-1">{cam.name}</div>
                <div className="text-xs font-mono text-slate-400 truncate mb-3" title={cam.stream_url}>
                  {cam.stream_url}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs font-mono space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Protocolo:</span>
                  <span className="text-slate-200 font-bold">{cam.type} (30 FPS)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Resolución:</span>
                  <span className="text-slate-200">{cam.resolution}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Scheduler:</span>
                  <span className="text-cyan-400 font-bold">Latest Frame Wins</span>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 py-1 bg-cyan-950/40 text-cyan-300 text-center text-[11px] font-mono font-bold rounded border border-cyan-800">
                  CÁMARA TRANSMITIENDO AL VISOR HUD
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 space-y-2">
        <div className="font-bold text-cyan-400 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>POLÍTICAS DE INGESTA INDUSTRIAL NO NEGOCIABLES:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
          <li><strong>Prohibición estricta de subida manual:</strong> La plataforma rechaza la subida de archivos estáticos (PDF, MP4, JPG). Solo procesa flujos continuos en vivo.</li>
          <li><strong>Fotogramas Efímeros en RAM:</strong> Los cuadros decodificados residen en memoria volátil sin tocar disco secundario, destruyéndose de inmediato tras la inferencia salvo incidentes confirmados.</li>
          <li><strong>Scheduler Unitario:</strong> Cola de tamaño = 1. Si la inferencia está procesando el marco actual, el marco previo es descartado, anulando el lag acumulativo (&lt; 180 ms).</li>
        </ul>
      </div>
    </div>
  );
};
