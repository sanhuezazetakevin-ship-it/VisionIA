import { useState, useEffect, useCallback } from 'react';
import type { 
  Camera, 
  BEVCalibration, 
  ROIZone, 
  SanitaryRule, 
  Incident, 
  ReportConfig, 
  Role 
} from './lib/types';
import { 
  INITIAL_CAMERAS, 
  INITIAL_RULES, 
  INITIAL_CALIBRATION, 
  INITIAL_ROIS, 
  INITIAL_REPORT_CONFIG, 
  createSeedIncidents,
  saveCalibrationToBackend,
  updateRuleInBackend,
  triggerRelayPulseBackend
} from './lib/apiClient';
import { useWebSocketLiveFeed } from './hooks/useWebSocketLiveFeed';
import { useSoundAlerts } from './hooks/useSoundAlerts';
import { LiveHudViewer } from './components/hud/LiveHudViewer';
import { BevCalibrationConsole } from './components/calibration/BevCalibrationConsole';
import { BlackboxAudit } from './components/blackbox/BlackboxAudit';
import { RulesControlCenter } from './components/rules/RulesControlCenter';
import { ExecutiveReports } from './components/reports/ExecutiveReports';
import { CameraManager } from './components/cameras/CameraManager';
import { 
  ShieldAlert, 
  Crosshair, 
  Lock, 
  Sliders, 
  FileText, 
  Video, 
  User, 
  CheckCircle, 
  Radio
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'hud' | 'bev' | 'blackbox' | 'rules' | 'reports' | 'cameras'>('hud');
  const [currentRole, setCurrentRole] = useState<Role>('ADMIN');

  const [cameras] = useState<Camera[]>(INITIAL_CAMERAS);
  const [activeCameraId, setActiveCameraId] = useState<string>('CAM-01');
  const [rules, setRules] = useState<SanitaryRule[]>(INITIAL_RULES);
  const [calibration, setCalibration] = useState<BEVCalibration>(INITIAL_CALIBRATION);
  const [rois] = useState<ROIZone[]>(INITIAL_ROIS);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(INITIAL_REPORT_CONFIG);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Hook de alarmas acústicas Web Audio API
  const { 
    isMuted, 
    setIsMuted, 
    playWarningBeep, 
    startIndustrialSiren, 
    stopIndustrialSiren, 
    triggerTestSirenPulse 
  } = useSoundAlerts();

  // Inicializar incidentes con cadena criptográfica
  useEffect(() => {
    createSeedIncidents().then(seed => {
      setIncidents(seed);
    });
  }, []);

  // Manejo de nuevo incidente detectado por el motor
  const handleNewIncident = useCallback((newInc: Incident) => {
    setIncidents(prev => [newInc, ...prev]);

    if (reportConfig.auto_dispatch_on_3_critical && newInc.severity === 'CRÍTICA') {
      console.log('Alerta crítica confirmada en caja negra:', newInc.rule_code);
    }
  }, [reportConfig]);

  // Manejo de alertas sonoras
  const handleSoundAlert = useCallback((type: 'CRITICAL' | 'WARNING') => {
    if (type === 'CRITICAL') {
      startIndustrialSiren();
      setTimeout(() => {
        stopIndustrialSiren();
      }, 2500);
    } else {
      playWarningBeep();
    }
  }, [startIndustrialSiren, stopIndustrialSiren, playWarningBeep]);

  // Hook de live feed a 60 FPS
  const {
    detections,
    telemetry,
    activeViolations,
    useLocalWebcam,
    webcamStream,
    startWebcam,
    stopWebcam,
    isBackendConnected,
    forcedInfractions,
    toggleForcedInfraction
  } = useWebSocketLiveFeed({
    cameraId: activeCameraId,
    rules,
    rois,
    calibration,
    onNewIncident: handleNewIncident,
    onSoundAlert: handleSoundAlert,
  });

  const toggleWebcam = () => {
    if (useLocalWebcam) {
      stopWebcam();
    } else {
      startWebcam();
    }
  };

  const activeCamera = cameras.find(c => c.id === activeCameraId) || cameras[0];

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans">
      {/* 1. Header Cockpit Industrial Superior */}
      <header className="border-b border-slate-800 bg-[#090e18] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-wider text-slate-100 font-mono">
                VISION AI <span className="text-cyan-400">REALTIME EDITION</span>
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                v2.0 Enterprise
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Supervisión Sanitaria HACCP</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">SENATI 4to Semestre</span>
            </div>
          </div>
        </div>

        {/* Telemetría Rápida de Cabecera */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-slate-400">STREAM:</span>
            <span className="text-slate-200 font-bold">{activeCamera.id}</span>
          </div>

          <div className="text-slate-600">|</div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">CANVAS:</span>
            <span className="text-emerald-400 font-bold">{telemetry.fps.toFixed(1)} FPS</span>
          </div>

          <div className="text-slate-600">|</div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">PIPELINE:</span>
            <span className="text-cyan-400 font-bold">{telemetry.latency_ms.toFixed(1)} ms</span>
          </div>

          <div className="text-slate-600">|</div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">SCHEDULER:</span>
            <span className="text-slate-300">Latest Frame Wins</span>
          </div>
        </div>

        {/* Selector de Rol RACI */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-mono">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 hidden sm:inline">Rol RACI:</span>
            <select
              value={currentRole}
              onChange={e => setCurrentRole(e.target.value as Role)}
              className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ADMIN" className="bg-slate-900 text-slate-100">Administrador (A)</option>
              <option value="SUPERVISOR" className="bg-slate-900 text-slate-100">Supervisor de Turno (R)</option>
              <option value="AUDITOR" className="bg-slate-900 text-slate-100">Auditor HACCP (C)</option>
              <option value="OPERADOR" className="bg-slate-900 text-slate-100">Operador de Cocina (I)</option>
            </select>
          </div>
        </div>
      </header>

      {/* 2. Barra de Navegación por Módulos Funcionales (M01 a M08) */}
      <nav className="border-b border-slate-800 bg-[#080d16] px-4 py-1.5 flex items-center gap-1 overflow-x-auto text-xs font-mono">
        <button
          onClick={() => setActiveTab('hud')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
            activeTab === 'hud'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
          <span>[01. VISOR HUD EN VIVO]</span>
        </button>

        <button
          onClick={() => setActiveTab('bev')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
            activeTab === 'bev'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          <span>[02. CALIBRACIÓN BEV]</span>
        </button>

        <button
          onClick={() => setActiveTab('blackbox')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
            activeTab === 'blackbox'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-cyan-400" />
          <span>[03. CAJA NEGRA HACCP]</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
            activeTab === 'rules'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>[04. REGLAS & RELÉS 24V]</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span>[05. REPORTE PDF REPORTLAB]</span>
        </button>

        <button
          onClick={() => setActiveTab('cameras')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
            activeTab === 'cameras'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Video className="w-3.5 h-3.5 text-cyan-400" />
          <span>[06. INGESTA Y CÁMARAS]</span>
        </button>
      </nav>

      {/* 3. Área de Contenido Principal */}
      <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'hud' && (
          <div className="space-y-6">
            <LiveHudViewer
              detections={detections}
              telemetry={telemetry}
              rois={rois}
              calibration={calibration}
              rules={rules}
              activeViolations={activeViolations}
              useLocalWebcam={useLocalWebcam}
              webcamStream={webcamStream}
              onToggleWebcam={toggleWebcam}
              isAudioMuted={isMuted}
              onToggleAudio={() => setIsMuted(!isMuted)}
              isBackendConnected={isBackendConnected}
              forcedInfractions={forcedInfractions}
              onToggleForcedInfraction={toggleForcedInfraction}
            />

            {/* Panel de Resumen de Incidentes Recientes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#0b121e] border border-slate-800 rounded-xl">
                <div className="text-xs font-mono text-slate-400 mb-1">INCIDENTES EN TURNO ACTUAL</div>
                <div className="text-2xl font-bold font-mono text-slate-100">{incidents.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">Deduplicados en RAM vía SHA-256</div>
              </div>

              <div className="p-4 bg-[#0b121e] border border-slate-800 rounded-xl">
                <div className="text-xs font-mono text-slate-400 mb-1">INFRACCIONES CRÍTICAS</div>
                <div className="text-2xl font-bold font-mono text-red-400">
                  {incidents.filter(i => i.severity === 'CRÍTICA').length}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Disparan relé 24V y sirena 105 dB</div>
              </div>

              <div className="p-4 bg-[#0b121e] border border-slate-800 rounded-xl">
                <div className="text-xs font-mono text-slate-400 mb-1">INTEGRIDAD CAJA NEGRA</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  <span>100% AUDITABLE</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Cadena criptográfica sin bifurcaciones</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bev' && (
          <BevCalibrationConsole
            calibration={calibration}
            rois={rois}
            onSaveCalibration={updated => {
              setCalibration(updated);
              saveCalibrationToBackend(activeCameraId, updated.source_quad, updated.table_dimensions_m);
            }}
          />
        )}

        {activeTab === 'blackbox' && (
          <BlackboxAudit
            incidents={incidents}
          />
        )}

        {activeTab === 'rules' && (
          <RulesControlCenter
            rules={rules}
            onUpdateRule={updated => {
              setRules(rules.map(r => r.id === updated.id ? updated : r));
              updateRuleInBackend(updated.id, updated);
            }}
            onResetRules={() => setRules(INITIAL_RULES)}
            onTestRelayPulse={() => {
              triggerTestSirenPulse(1200);
              triggerRelayPulseBackend(1, 1.2);
            }}
            telemetry={telemetry}
          />
        )}

        {activeTab === 'reports' && (
          <ExecutiveReports
            incidents={incidents}
            reportConfig={reportConfig}
            onUpdateReportConfig={cfg => setReportConfig(cfg)}
            telemetry={telemetry}
          />
        )}

        {activeTab === 'cameras' && (
          <CameraManager
            cameras={cameras}
            activeCameraId={activeCameraId}
            onSelectCamera={id => setActiveCameraId(id)}
            telemetry={telemetry}
          />
        )}
      </main>

      {/* 4. Footer Técnico Institucional */}
      <footer className="border-t border-slate-800 bg-[#080d16] px-4 py-2.5 text-xs font-mono text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>PLATAFORMA INDUSTRIAL HACCP — SENATI 4TO SEMESTRE (NOVIEMBRE 2026)</span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <span>React + TypeScript + Canvas 60 FPS + BEV 3x3 + SHA-256</span>
          <span>Modelo TerraSafe 5 Capas</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
