import { useState, useEffect, useCallback } from 'react';
import type {
  Camera,
  BEVCalibration,
  ROIZone,
  SanitaryRule,
  Incident,
  ReportConfig,
  Role,
  SanitizationLog,
} from './lib/types';
import {
  INITIAL_CAMERAS,
  INITIAL_RULES,
  INITIAL_CALIBRATION,
  INITIAL_ROIS,
  INITIAL_REPORT_CONFIG,
  INITIAL_SANITIZATION_LOGS,
  createSeedIncidents,
  saveCalibrationToBackend,
  updateRuleInBackend,
  triggerRelayPulseBackend,
} from './lib/apiClient';
import { ROLE_PERMISSIONS } from './lib/permissions';
import {
  SIMULATION_PERSPECTIVES,
  type SimulationPerspective,
} from './lib/simulationPerspectives';
import { useWebSocketLiveFeed } from './hooks/useWebSocketLiveFeed';
import { useSoundAlerts } from './hooks/useSoundAlerts';
import { LiveHudViewer } from './components/hud/LiveHudViewer';
import { BevCalibrationConsole } from './components/calibration/BevCalibrationConsole';
import { BlackboxAudit } from './components/blackbox/BlackboxAudit';
import { RulesControlCenter } from './components/rules/RulesControlCenter';
import { ExecutiveReports } from './components/reports/ExecutiveReports';
import { CameraManager } from './components/cameras/CameraManager';
import {
  Monitor,
  Crosshair,
  FileCheck2,
  Sliders,
  FileText,
  Video,
  User,
  CheckCircle2,
  ShieldCheck,
  Menu,
  X,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

type NavTab = 'hud' | 'bev' | 'blackbox' | 'rules' | 'reports' | 'cameras';

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  subtitle: string;
  icon: typeof Monitor;
}[] = [
  {
    id: 'hud',
    label: 'Monitor en Vivo',
    subtitle: 'Supervisión visual y simulación por perspectiva',
    icon: Monitor,
  },
  {
    id: 'bev',
    label: 'Calibración Espacial',
    subtitle: 'Ajuste homográfico de mesa y escala métrica',
    icon: Crosshair,
  },
  {
    id: 'blackbox',
    label: 'Registro de Incidentes',
    subtitle: 'Bitácora inmutable y verificación SHA-256',
    icon: FileCheck2,
  },
  {
    id: 'rules',
    label: 'Reglas y Relés',
    subtitle: 'Umbrales de cumplimiento y salidas de 24V',
    icon: Sliders,
  },
  {
    id: 'reports',
    label: 'Reportes PDF',
    subtitle: 'Generación de informes y despacho por correo',
    icon: FileText,
  },
  {
    id: 'cameras',
    label: 'Cámaras',
    subtitle: 'Fuentes de video USB / RTSP y reconexión',
    icon: Video,
  },
];

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('hud');
  const [currentRole, setCurrentRole] = useState<Role>('SUPERVISOR');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [cameras] = useState<Camera[]>(INITIAL_CAMERAS);
  const [activeCameraId, setActiveCameraId] = useState<string>('CAM-01');
  const [rules, setRules] = useState<SanitaryRule[]>(INITIAL_RULES);
  const [calibration, setCalibration] = useState<BEVCalibration>(INITIAL_CALIBRATION);
  const [rois] = useState<ROIZone[]>(INITIAL_ROIS);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(INITIAL_REPORT_CONFIG);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sanitizationLogs, setSanitizationLogs] = useState<SanitizationLog[]>(
    INITIAL_SANITIZATION_LOGS
  );
  const [simulationPerspective, setSimulationPerspective] =
    useState<SimulationPerspective>('frontal');

  const [alertsPausedUntil, setAlertsPausedUntil] = useState<number | null>(null);
  const [alertsPausedRemainingSec, setAlertsPausedRemainingSec] = useState<number>(0);
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());

  const permissions = ROLE_PERMISSIONS[currentRole];
  const visibleNavItems = NAV_ITEMS.filter(item => permissions.allowedTabs.includes(item.id));

  const {
    isMuted,
    setIsMuted,
    playWarningBeep,
    startIndustrialSiren,
    stopIndustrialSiren,
    triggerTestSirenPulse,
  } = useSoundAlerts();

  useEffect(() => {
    createSeedIncidents().then(seed => {
      setIncidents(seed);
    });
  }, []);

  // Temporizador para pausa de alertas y tiempo desde última sanitización
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNowTickMs(now);
      if (alertsPausedUntil) {
        const remaining = Math.max(0, Math.ceil((alertsPausedUntil - now) / 1000));
        setAlertsPausedRemainingSec(remaining);
        if (remaining <= 0) {
          setAlertsPausedUntil(null);
        }
      } else {
        setAlertsPausedRemainingSec(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [alertsPausedUntil]);

  // Redirigir al monitor si el rol seleccionado no tiene acceso a la pestaña actual
  const handleChangeRole = (nextRole: Role) => {
    setCurrentRole(nextRole);
    const nextAllowed = ROLE_PERMISSIONS[nextRole].allowedTabs;
    if (!nextAllowed.includes(activeTab)) {
      setActiveTab('hud');
    }
  };

  const handlePauseAlerts = (minutes: number) => {
    const until = Date.now() + minutes * 60 * 1000;
    setAlertsPausedUntil(until);
    setAlertsPausedRemainingSec(minutes * 60);
    stopIndustrialSiren();
  };

  const handleResumeAlerts = () => {
    setAlertsPausedUntil(null);
    setAlertsPausedRemainingSec(0);
  };

  const handleResolveIncident = useCallback(
    (incidentId: string, note: string) => {
      const resolvedAt = new Date().toISOString();
      setIncidents(prev =>
        prev.map(inc =>
          inc.id === incidentId
            ? {
                ...inc,
                resolved_at: resolvedAt,
                corrective_note: note,
                resolved_by: permissions.label,
              }
            : inc
        )
      );
    },
    [permissions.label]
  );

  const handleConfirmSanitization = () => {
    const cam = cameras.find(c => c.id === activeCameraId) || cameras[0];
    const newLog: SanitizationLog = {
      id: `SAN-${String(sanitizationLogs.length + 1).padStart(3, '0')}`,
      camera_id: cam.id,
      camera_name: cam.name,
      performed_at: new Date().toISOString(),
      performed_by: permissions.label,
      note: 'Sanitización verificada en estación',
    };
    setSanitizationLogs(prev => [newLog, ...prev]);
  };

  const handleNewIncident = useCallback(
    (newInc: Incident) => {
      setIncidents(prev => [newInc, ...prev]);

      if (reportConfig.auto_dispatch_on_3_critical && newInc.severity === 'CRÍTICA') {
        console.log('Alerta crítica registrada:', newInc.rule_code);
      }
    },
    [reportConfig]
  );

  const handleSoundAlert = useCallback(
    (type: 'CRITICAL' | 'WARNING') => {
      if (type === 'CRITICAL') {
        startIndustrialSiren();
        setTimeout(() => {
          stopIndustrialSiren();
        }, 2500);
      } else {
        playWarningBeep();
      }
    },
    [startIndustrialSiren, stopIndustrialSiren, playWarningBeep]
  );

  const {
    detections,
    scenePreset,
    telemetry,
    activeViolations,
    useLocalWebcam,
    webcamStream,
    startWebcam,
    stopWebcam,
    isBackendConnected,
    forcedInfractions,
    toggleForcedInfraction,
  } = useWebSocketLiveFeed({
    cameraId: activeCameraId,
    rules,
    rois,
    calibration,
    perspective: simulationPerspective,
    alertsPaused: alertsPausedRemainingSec > 0,
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
  const currentNav = NAV_ITEMS.find(item => item.id === activeTab) || NAV_ITEMS[0];
  const pendingCount = incidents.filter(i => i.resolved_at === null).length;
  const criticalCount = incidents.filter(i => i.severity === 'CRÍTICA').length;
  const activePerspectiveInfo = SIMULATION_PERSPECTIVES[simulationPerspective];

  const latestSanitization = sanitizationLogs[0];
  const minutesSinceSanitization = latestSanitization
    ? Math.max(0, Math.floor((nowTickMs - new Date(latestSanitization.performed_at).getTime()) / 60000))
    : 0;
  const sanitizationStatus =
    minutesSinceSanitization >= 120
      ? { label: 'Vencida', tone: 'text-red-400' }
      : minutesSinceSanitization >= 90
        ? { label: 'Próxima', tone: 'text-amber-300' }
        : { label: 'Al día', tone: 'text-emerald-400' };

  const handleSelectNav = (id: NavTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0d1015] text-slate-100 flex font-sans">
      {/* Backdrop móvil */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Columna de Menú Izquierda (hasta abajo) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#131720] border-r border-[#232936] flex flex-col justify-between transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-14 px-4 border-b border-[#232936] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-[#1e2636] border border-[#2f3b52] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-100 leading-tight">
                  Control HACCP
                </h1>
                <p className="text-[11px] text-slate-400 leading-tight">Supervisión Sanitaria</p>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-200"
              aria-label="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Navegación
            </div>
            {visibleNavItems.map(item => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectNav(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-xs font-medium transition text-left ${
                    isSelected
                      ? 'bg-[#1c2333] text-slate-100 border-l-2 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#181d29] border-l-2 border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-blue-400' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'blackbox' && pendingCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 text-[10px] font-mono tabular-nums">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Pie fijo de la columna izquierda */}
        <div className="p-3 border-t border-[#232936] space-y-3 bg-[#11151d]">
          <div>
            <label className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Rol operativo</span>
            </label>
            <select
              value={currentRole}
              onChange={e => handleChangeRole(e.target.value as Role)}
              className="w-full bg-[#171c26] border border-[#283040] rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ADMIN">Administrador</option>
              <option value="SUPERVISOR">Supervisor de Turno</option>
              <option value="AUDITOR">Auditor HACCP</option>
              <option value="OPERADOR">Operador</option>
            </select>
          </div>

          <div className="pt-2 border-t border-[#232936] flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-mono">{activeCamera.id}</span>
            <span>{isBackendConnected ? 'Servidor conectado' : 'Modo local'}</span>
          </div>
        </div>
      </aside>

      {/* Área derecha principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[#232936] bg-[#131720] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded bg-[#1a202c] border border-[#283040] text-slate-300"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100 truncate">
                {currentNav.label}
              </h2>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                {currentNav.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono tabular-nums bg-[#0f131b] px-3 py-1.5 rounded-md border border-[#232936]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Estación:</span>
              <span className="text-slate-200 font-semibold">{activeCamera.id}</span>
            </div>
            <span className="text-slate-700 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-slate-500">Frecuencia:</span>
              <span className="text-slate-200">{telemetry.fps.toFixed(1)} FPS</span>
            </div>
            <span className="text-slate-700 hidden md:inline">|</span>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-slate-500">Latencia:</span>
              <span className="text-slate-200">{telemetry.latency_ms.toFixed(1)} ms</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1480px] w-full mx-auto">
          {activeTab === 'hud' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-9">
                <LiveHudViewer
                  cameras={cameras}
                  activeCameraId={activeCameraId}
                  onSelectCamera={setActiveCameraId}
                  canSwitchCamera={permissions.canSwitchCamera}
                  detections={detections}
                  scenePreset={scenePreset}
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
                  perspective={simulationPerspective}
                  onChangePerspective={setSimulationPerspective}
                  alertsPausedRemainingSec={alertsPausedRemainingSec}
                  canPauseAlerts={permissions.canPauseAlerts}
                  onPauseAlerts={handlePauseAlerts}
                  onResumeAlerts={handleResumeAlerts}
                  forcedInfractions={forcedInfractions}
                  onToggleForcedInfraction={toggleForcedInfraction}
                />
              </div>

              {/* Panel lateral operativo para el supervisor */}
              <div className="xl:col-span-3 flex flex-col gap-3.5">
                {/* Indicadores compactos */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-[#171c26] border border-[#262d3b] rounded-lg">
                    <div className="text-[11px] font-medium text-slate-400">Pendientes</div>
                    <div className="text-xl font-semibold font-mono tabular-nums text-amber-300 mt-0.5">
                      {pendingCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">de {incidents.length} totales</div>
                  </div>

                  <div className="p-3.5 bg-[#171c26] border border-[#262d3b] rounded-lg">
                    <div className="text-[11px] font-medium text-slate-400">Críticas</div>
                    <div className="text-xl font-semibold font-mono tabular-nums text-red-400 mt-0.5">
                      {criticalCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Relé y alarma</div>
                  </div>
                </div>

                {/* Últimos incidentes del turno */}
                <div className="p-3.5 bg-[#171c26] border border-[#262d3b] rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">Últimos incidentes</span>
                    {permissions.allowedTabs.includes('blackbox') && (
                      <button
                        onClick={() => setActiveTab('blackbox')}
                        className="text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        Ver todos
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {incidents.slice(0, 3).map(inc => {
                      const isResolved = inc.resolved_at !== null;
                      return (
                        <div
                          key={inc.id}
                          className="p-2.5 rounded-md bg-[#131720] border border-[#232936] text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-semibold text-slate-200">
                              {inc.rule_code}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                isResolved
                                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                                  : 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                              }`}
                            >
                              {isResolved ? 'Resuelta' : 'Pendiente'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">
                            {inc.rule_description}
                          </div>
                          {!isResolved && permissions.canResolveIncidents && (
                            <button
                              onClick={() =>
                                handleResolveIncident(inc.id, 'Atendido desde monitor de turno')
                              }
                              className="w-full mt-1 py-1 rounded bg-[#1e2738] hover:bg-[#253147] text-blue-300 border border-[#2e3d57] text-[11px] font-medium transition flex items-center justify-center gap-1"
                            >
                              <CheckSquare className="w-3 h-3" />
                              <span>Marcar atendida</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Control de sanitización periódica */}
                <div className="p-3.5 bg-[#171c26] border border-[#262d3b] rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      Sanitización (cada 2h)
                    </span>
                    <span className={`text-[11px] font-semibold ${sanitizationStatus.tone}`}>
                      {sanitizationStatus.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Última limpieza:</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      hace {minutesSinceSanitization} min
                    </span>
                  </div>

                  {permissions.canLogSanitization && (
                    <button
                      onClick={handleConfirmSanitization}
                      className="w-full py-1.5 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition"
                    >
                      Confirmar limpieza
                    </button>
                  )}
                </div>

                {/* Resumen de integridad y perspectiva */}
                <div className="p-3.5 bg-[#171c26] border border-[#262d3b] rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Bitácora SHA-256</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Íntegra
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#232936]">
                    <div className="text-[11px] text-slate-400">Perspectiva</div>
                    <div className="text-xs text-blue-400 font-medium mt-0.5">
                      {activePerspectiveInfo.label}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bev' && (
            <BevCalibrationConsole
              calibration={calibration}
              rois={rois}
              canEditCalibration={permissions.canEditCalibration}
              onSaveCalibration={updated => {
                setCalibration(updated);
                saveCalibrationToBackend(
                  activeCameraId,
                  updated.source_quad,
                  updated.table_dimensions_m
                );
              }}
            />
          )}

          {activeTab === 'blackbox' && (
            <BlackboxAudit
              incidents={incidents}
              canResolveIncidents={permissions.canResolveIncidents}
              onResolveIncident={handleResolveIncident}
            />
          )}

          {activeTab === 'rules' && (
            <RulesControlCenter
              rules={rules}
              canEditRules={permissions.canEditRules}
              canTestRelay={permissions.canTestRelay}
              onUpdateRule={updated => {
                setRules(rules.map(r => (r.id === updated.id ? updated : r)));
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
              sanitizationLogs={sanitizationLogs}
              canEditReportConfig={permissions.canEditReportConfig}
              onUpdateReportConfig={cfg => setReportConfig(cfg)}
              telemetry={telemetry}
            />
          )}

          {activeTab === 'cameras' && (
            <CameraManager
              cameras={cameras}
              activeCameraId={activeCameraId}
              onSelectCamera={id => {
                if (permissions.canSwitchCamera) {
                  setActiveCameraId(id);
                }
              }}
              telemetry={telemetry}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
