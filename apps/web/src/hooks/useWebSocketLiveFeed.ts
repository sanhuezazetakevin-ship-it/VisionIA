import { useState, useEffect, useRef, useCallback } from 'react';
import type { Detection, Telemetry, SanitaryRule, Incident, ROIZone, BEVCalibration } from '../lib/types';
import { projectPointBEV, solveHomographyMatrix } from '../lib/homographyMath';
import { WS_BASE_URL } from '../lib/apiClient';
import { generateDedupKey, generateAuditChainHash } from '../lib/sha256';
import {
  SIMULATION_PERSPECTIVES,
  interpolatePerspectivePreset,
  type PerspectivePreset,
  type SimulationPerspective,
} from '../lib/simulationPerspectives';

interface UseWebSocketLiveFeedProps {
  cameraId: string;
  rules: SanitaryRule[];
  rois: ROIZone[];
  calibration: BEVCalibration;
  perspective: SimulationPerspective;
  alertsPaused?: boolean;
  onNewIncident: (incident: Incident) => void;
  onSoundAlert: (type: 'CRITICAL' | 'WARNING') => void;
}

const PERSPECTIVE_TRANSITION_MS = 520;

export function useWebSocketLiveFeed({
  cameraId,
  rules,
  calibration,
  perspective,
  alertsPaused = false,
  onNewIncident,
  onSoundAlert,
}: UseWebSocketLiveFeedProps) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [scenePreset, setScenePreset] = useState<PerspectivePreset>(
    () => SIMULATION_PERSPECTIVES[perspective]
  );
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [activeViolations, setActiveViolations] = useState<
    {
      ruleCode: string;
      elapsedSec: number;
      targetSec: number;
      severity: 'CRÍTICA' | 'ADVERTENCIA';
      trackId: number;
      isTriggered: boolean;
    }[]
  >([]);

  const [telemetry, setTelemetry] = useState<Telemetry>({
    fps: 60.0,
    latency_ms: 21.4,
    ingest_ms: 12.1,
    inference_ms: 19.3,
    bev_ms: 3.2,
    queue_size: 1,
    ram_buffer_mb: 28.4,
    dropped_frames: 0,
    relay_24v_active: false,
    siren_105db_active: false,
  });

  const [useLocalWebcam, setUseLocalWebcam] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  const [forcedInfractions, setForcedInfractions] = useState<{
    withoutHairnet: boolean;
    withoutGloves: boolean;
    withoutMask: boolean;
    hasDirtyZone: boolean;
  }>({
    withoutHairnet: false,
    withoutGloves: false,
    withoutMask: false,
    hasDirtyZone: true,
  });

  const toggleForcedInfraction = useCallback((type: 'hairnet' | 'gloves' | 'mask' | 'dirtyZone') => {
    setForcedInfractions(prev => {
      if (type === 'hairnet') return { ...prev, withoutHairnet: !prev.withoutHairnet };
      if (type === 'gloves') return { ...prev, withoutGloves: !prev.withoutGloves };
      if (type === 'mask') return { ...prev, withoutMask: !prev.withoutMask };
      if (type === 'dirtyZone') return { ...prev, hasDirtyZone: !prev.hasDirtyZone };
      return prev;
    });
  }, []);

  const transitionRef = useRef<{
    from: PerspectivePreset;
    to: PerspectivePreset;
    current: PerspectivePreset;
    startTime: number;
  }>({
    from: SIMULATION_PERSPECTIVES[perspective],
    to: SIMULATION_PERSPECTIVES[perspective],
    current: SIMULATION_PERSPECTIVES[perspective],
    startTime: 0,
  });

  useEffect(() => {
    const target = SIMULATION_PERSPECTIVES[perspective];
    if (isBackendConnected) {
      transitionRef.current = {
        from: target,
        to: target,
        current: target,
        startTime: 0,
      };
      setScenePreset(target);
      return;
    }
    if (transitionRef.current.to.id !== target.id) {
      transitionRef.current = {
        from: transitionRef.current.current,
        to: target,
        current: transitionRef.current.current,
        startTime: performance.now(),
      };
    }
  }, [perspective, isBackendConnected]);

  const frameCountRef = useRef(0);
  const debounceTimersRef = useRef<{ [key: string]: { start: number; triggered: boolean } }>({});
  const activeDedupKeysRef = useRef<Set<string>>(new Set());
  const lastChainHashRef = useRef('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f');
  const wsRef = useRef<WebSocket | null>(null);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: { ideal: 30 } },
        audio: false,
      });
      setWebcamStream(stream);
      setUseLocalWebcam(true);
    } catch (err) {
      console.warn('Error al iniciar webcam local:', err);
      alert('No se pudo acceder a la cámara web. Asegúrate de otorgar permisos en el navegador.');
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    setUseLocalWebcam(false);
  }, [webcamStream]);

  // Conexión WebSocket al backend FastAPI si está disponible
  useEffect(() => {
    let isMounted = true;
    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectWebSocket = () => {
      try {
        socket = new WebSocket(`${WS_BASE_URL}/live-feed/${cameraId}`);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isMounted) setIsBackendConnected(true);
        };

        socket.onmessage = event => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'FRAME_TELEMETRY') {
              if (data.telemetry) setTelemetry(data.telemetry);
              if (data.detections) setDetections(data.detections);
              if (data.active_violations) setActiveViolations(data.active_violations);
              if (data.new_incidents && data.new_incidents.length > 0) {
                data.new_incidents.forEach((inc: Incident) => {
                  onNewIncident(inc);
                  onSoundAlert(inc.severity === 'CRÍTICA' ? 'CRITICAL' : 'WARNING');
                });
              }
            }
          } catch {
            // Ignorar paquete malformado
          }
        };

        socket.onerror = () => {
          if (isMounted) setIsBackendConnected(false);
        };

        socket.onclose = () => {
          if (isMounted) {
            setIsBackendConnected(false);
            reconnectTimeout = setTimeout(connectWebSocket, 3000);
          }
        };
      } catch {
        if (isMounted) {
          setIsBackendConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [cameraId, onNewIncident, onSoundAlert]);

  // Bucle de simulación en modo local con transición suave entre perspectivas
  useEffect(() => {
    if (isBackendConnected) return;

    let animationFrameId: number;
    let lastSecond = performance.now();
    let framesThisSecond = 0;

    const pipelineLoop = (time: number) => {
      framesThisSecond++;
      if (time - lastSecond >= 1000) {
        const actualFps = Math.min(60, framesThisSecond);
        framesThisSecond = 0;
        lastSecond = time;

        const jitter = (Math.random() - 0.5) * 3;
        const baseLatency = 20 + jitter;

        setTelemetry(prev => ({
          ...prev,
          fps: Math.round(actualFps * 10) / 10,
          latency_ms: Math.max(16, Math.round(baseLatency * 10) / 10),
          ingest_ms: Math.round((11 + Math.random() * 2) * 10) / 10,
          inference_ms: Math.round((18 + Math.random() * 3) * 10) / 10,
          bev_ms: Math.round((3 + Math.random()) * 10) / 10,
          queue_size: 1,
        }));
      }

      // Calcular interpolación de perspectiva para este frame
      const tr = transitionRef.current;
      const elapsed = tr.startTime > 0 ? time - tr.startTime : PERSPECTIVE_TRANSITION_MS;
      const progress = Math.min(1, elapsed / PERSPECTIVE_TRANSITION_MS);
      const activePreset =
        progress >= 1
          ? tr.to
          : interpolatePerspectivePreset(tr.from, tr.to, progress);
      tr.current = activePreset;
      setScenePreset(activePreset);

      const { length, width } = calibration.table_dimensions_m;
      const H =
        progress >= 1 && activePreset.id === 'frontal'
          ? calibration.homography_matrix
          : solveHomographyMatrix(activePreset.tableQuad, [
              { x: 0, y: 0 },
              { x: length, y: 0 },
              { x: length, y: width },
              { x: 0, y: width },
            ]);

      frameCountRef.current++;
      const t = frameCountRef.current / 60;

      const swayX = Math.sin(t * 0.45) * 0.035;
      const swayY = Math.cos(t * 0.35) * 0.012;

      const base = activePreset.operatorBase;
      const opX = base.x + swayX;
      const opY = base.y + swayY;

      const cycleTime = t % 18;
      const isWithoutHairnet = forcedInfractions.withoutHairnet || (cycleTime > 5 && cycleTime < 13);
      const isWithoutGloves = forcedInfractions.withoutGloves || (cycleTime > 8 && cycleTime < 16);
      const isWithoutMask = forcedInfractions.withoutMask;
      const hasDirtyZone = forcedInfractions.hasDirtyZone;

      const opGround = {
        x: opX + base.groundOffset.x,
        y: opY + base.groundOffset.y,
      };
      const opBev = projectPointBEV(H, opGround);

      const currentDetections: Detection[] = [
        {
          id: 'det-op-101',
          track_id: 101,
          class_name: 'operator',
          label_es: 'Operario',
          confidence: 0.94,
          bbox: [opX, opY, base.w, base.h],
          ground_point: opGround,
          bev_point: opBev,
          face_box: [
            opX + base.faceOffset[0],
            opY + base.faceOffset[1],
            base.faceOffset[2],
            base.faceOffset[3],
          ],
          is_violation: isWithoutHairnet || isWithoutGloves || isWithoutMask,
          violation_code: isWithoutHairnet
            ? 'RULE-EPP-001'
            : isWithoutGloves
              ? 'RULE-EPP-002'
              : isWithoutMask
                ? 'RULE-EPP-003'
                : undefined,
        },
        {
          id: 'det-apron-101',
          track_id: 101,
          class_name: 'apron',
          label_es: 'Mandil sanitario',
          confidence: 0.91,
          bbox: [
            opX + base.apronOffset[0],
            opY + base.apronOffset[1],
            base.apronOffset[2],
            base.apronOffset[3],
          ],
          ground_point: opGround,
          is_violation: false,
        },
        {
          id: 'det-tool-01',
          track_id: 301,
          class_name: 'dirty_tool',
          label_es: 'Utensilio de corte',
          confidence: 0.88,
          bbox: activePreset.knifeBox,
          ground_point: activePreset.knifePoint,
          bev_point: projectPointBEV(H, activePreset.knifePoint),
          is_violation: false,
        },
      ];

      if (!isWithoutMask) {
        currentDetections.push({
          id: 'det-mask-101',
          track_id: 101,
          class_name: 'mask',
          label_es: 'Mascarilla',
          confidence: 0.89,
          bbox: [
            opX + base.maskOffset[0],
            opY + base.maskOffset[1],
            base.maskOffset[2],
            base.maskOffset[3],
          ],
          ground_point: opGround,
          is_violation: false,
        });
      }

      if (hasDirtyZone) {
        currentDetections.push({
          id: 'det-dirty-zone-01',
          track_id: 201,
          class_name: 'dirty_zone',
          label_es: 'Residuo en superficie',
          confidence: 0.86,
          bbox: activePreset.dirtyZoneBox,
          mask_polygon: activePreset.dirtyZonePolygon,
          ground_point: activePreset.dirtyZonePoint,
          bev_point: projectPointBEV(H, activePreset.dirtyZonePoint),
          is_violation: true,
          violation_code: 'RULE-HYG-001',
        });
      }

      if (!isWithoutHairnet) {
        currentDetections.push({
          id: 'det-hairnet-101',
          track_id: 101,
          class_name: 'hairnet',
          label_es: 'Cofia sanitaria',
          confidence: 0.96,
          bbox: [
            opX + base.hairnetOffset[0],
            opY + base.hairnetOffset[1],
            base.hairnetOffset[2],
            base.hairnetOffset[3],
          ],
          ground_point: opGround,
          is_violation: false,
        });
      }

      if (!isWithoutGloves) {
        currentDetections.push({
          id: 'det-gloves-101',
          track_id: 101,
          class_name: 'gloves',
          label_es: 'Guantes de nitrilo',
          confidence: 0.92,
          bbox: [
            opX + base.glovesOffset[0],
            opY + base.glovesOffset[1],
            base.glovesOffset[2],
            base.glovesOffset[3],
          ],
          ground_point: opGround,
          is_violation: false,
        });
      }

      setDetections(currentDetections);

      const nowMs = performance.now();
      const currentActiveViolations: {
        ruleCode: string;
        elapsedSec: number;
        targetSec: number;
        severity: 'CRÍTICA' | 'ADVERTENCIA';
        trackId: number;
        isTriggered: boolean;
      }[] = [];

      let hasCriticalAlarm = false;

      const ruleEpp001 = rules.find(r => r.code === 'RULE-EPP-001');
      if (ruleEpp001 && !alertsPaused) {
        const timerKey = 'RULE-EPP-001:101';
        if (isWithoutHairnet) {
          if (!debounceTimersRef.current[timerKey]) {
            debounceTimersRef.current[timerKey] = { start: nowMs, triggered: false };
          }
          const elapsedSec = (nowMs - debounceTimersRef.current[timerKey].start) / 1000;
          const isTriggered = elapsedSec >= ruleEpp001.min_duration_sec;

          currentActiveViolations.push({
            ruleCode: 'RULE-EPP-001',
            elapsedSec: Math.min(ruleEpp001.min_duration_sec, Math.round(elapsedSec * 10) / 10),
            targetSec: ruleEpp001.min_duration_sec,
            severity: 'CRÍTICA',
            trackId: 101,
            isTriggered,
          });

          if (isTriggered) {
            hasCriticalAlarm = true;
            if (!debounceTimersRef.current[timerKey].triggered) {
              debounceTimersRef.current[timerKey].triggered = true;
              onSoundAlert('CRITICAL');

              (async () => {
                const dedupKey = await generateDedupKey('rule-01', cameraId, 101, 'roi-prep-table');
                if (!activeDedupKeysRef.current.has(dedupKey)) {
                  activeDedupKeysRef.current.add(dedupKey);
                  const incidentTime = new Date().toISOString();
                  const chainHash = await generateAuditChainHash(lastChainHashRef.current, {
                    ruleCode: 'RULE-EPP-001',
                    cameraId,
                    trackId: 101,
                    timestamp: incidentTime,
                    severity: 'CRÍTICA',
                  });
                  lastChainHashRef.current = chainHash;

                  const newInc: Incident = {
                    id: `INC-${Date.now().toString().slice(-6)}`,
                    camera_id: cameraId,
                    camera_name: 'Mesa #1',
                    rule_id: 'rule-01',
                    rule_code: 'RULE-EPP-001',
                    rule_description: ruleEpp001.description,
                    roi_id: 'roi-prep-table',
                    roi_name: 'Mesa de Preparación',
                    severity: 'CRÍTICA',
                    track_id: 101,
                    started_at: incidentTime,
                    resolved_at: null,
                    duration_sec: 3.5,
                    snapshot_key: `snaps/${Date.now()}_trk101.jpg`,
                    dedup_hash: dedupKey,
                    prev_hash: lastChainHashRef.current,
                    current_hash: chainHash,
                    haccp_verified: true,
                  };
                  onNewIncident(newInc);
                }
              })();
            }
          }
        } else {
          delete debounceTimersRef.current[timerKey];
        }
      }

      const ruleEpp002 = rules.find(r => r.code === 'RULE-EPP-002');
      if (ruleEpp002 && !alertsPaused) {
        const timerKey = 'RULE-EPP-002:101';
        if (isWithoutGloves) {
          if (!debounceTimersRef.current[timerKey]) {
            debounceTimersRef.current[timerKey] = { start: nowMs, triggered: false };
          }
          const elapsedSec = (nowMs - debounceTimersRef.current[timerKey].start) / 1000;
          const isTriggered = elapsedSec >= ruleEpp002.min_duration_sec;

          currentActiveViolations.push({
            ruleCode: 'RULE-EPP-002',
            elapsedSec: Math.min(ruleEpp002.min_duration_sec, Math.round(elapsedSec * 10) / 10),
            targetSec: ruleEpp002.min_duration_sec,
            severity: 'ADVERTENCIA',
            trackId: 101,
            isTriggered,
          });

          if (isTriggered && !debounceTimersRef.current[timerKey].triggered) {
            debounceTimersRef.current[timerKey].triggered = true;
            onSoundAlert('WARNING');
          }
        } else {
          delete debounceTimersRef.current[timerKey];
        }
      }

      if (alertsPaused) {
        debounceTimersRef.current = {};
      }

      setActiveViolations(currentActiveViolations);

      setTelemetry(prev => ({
        ...prev,
        relay_24v_active: hasCriticalAlarm,
        siren_105db_active: hasCriticalAlarm,
      }));

      animationFrameId = requestAnimationFrame(pipelineLoop);
    };

    animationFrameId = requestAnimationFrame(pipelineLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    cameraId,
    rules,
    calibration.homography_matrix,
    calibration.table_dimensions_m,
    onNewIncident,
    onSoundAlert,
    isBackendConnected,
    forcedInfractions,
    alertsPaused,
  ]);

  return {
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
  };
}
