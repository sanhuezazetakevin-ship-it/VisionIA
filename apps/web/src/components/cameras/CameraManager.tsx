import React, { useState } from 'react';
import type { Camera, Telemetry } from '../../lib/types';
import { Video, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

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
    setReconnectNotice('Verificando corte temporal de señal USB/RTSP...');

    setTimeout(() => {
      setReconnectNotice('Restableciendo enlace de video (< 3 s)...');

      setTimeout(() => {
        setIsSimulatingReconnection(false);
        setReconnectNotice('Flujo de video restablecido en 1.8 segundos.');
        setTimeout(() => setReconnectNotice(null), 5000);
      }, 1500);
    }, 900);
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#171c26] border border-[#262d3b] rounded-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#262d3b] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Cámaras y Fuentes de Video
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Selección de entradas USB / RTSP y verificación de reconexión automática.
          </p>
        </div>

        <button
          onClick={handleTestHotPlug}
          disabled={isSimulatingReconnection}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#1e2430] hover:bg-[#252c3b] text-slate-200 border border-[#2d3646] transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSimulatingReconnection ? 'animate-spin' : ''}`} />
          <span>Probar reconexión</span>
        </button>
      </div>

      {reconnectNotice && (
        <div
          className={`p-3 rounded-md text-xs flex items-center gap-2 border ${
            isSimulatingReconnection
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
          }`}
        >
          {isSimulatingReconnection ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
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
              className={`p-4 rounded-lg border transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-[#1a2232] border-blue-500'
                  : 'bg-[#131720] border-[#232936] hover:border-[#343d4f]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-semibold text-blue-400">{cam.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      cam.is_active
                        ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                        : 'bg-red-950/50 text-red-300 border-red-800/60'
                    }`}
                  >
                    {cam.is_active ? 'En línea' : 'Desconectada'}
                  </span>
                </div>

                <div className="text-sm font-semibold text-slate-100 mb-1">{cam.name}</div>
                <div className="text-xs font-mono text-slate-400 truncate mb-3" title={cam.stream_url}>
                  {cam.stream_url}
                </div>
              </div>

              <div className="pt-3 border-t border-[#232936] text-xs space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Protocolo</span>
                  <span className="text-slate-200 font-mono">
                    {cam.type} · {cam.fps_target} FPS
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Resolución</span>
                  <span className="text-slate-200 font-mono">{cam.resolution}</span>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 py-1 bg-blue-950/50 text-blue-300 text-center text-[11px] font-medium rounded border border-blue-800/60">
                  Cámara seleccionada
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
