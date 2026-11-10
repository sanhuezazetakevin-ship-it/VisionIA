import type { Camera, BEVCalibration, ROIZone, SanitaryRule, Incident, ReportConfig, Point2D } from './types';
import { generateDedupKey, generateAuditChainHash } from './sha256';

export const API_BASE_URL = 'http://localhost:8000/api/v1';
export const WS_BASE_URL = 'ws://localhost:8000/ws/v1';

export const INITIAL_CAMERAS: Camera[] = [
  {
    id: 'CAM-01',
    name: 'Mesa #1 (Cámara Activa)',
    stream_url: 'usb://dev/video0@1080p30',
    fps_target: 30,
    current_fps: 30.0,
    is_active: true,
    type: 'USB',
    resolution: '1920x1080',
    created_at: '2026-11-01T08:00:00Z',
  },
  {
    id: 'CAM-02',
    name: 'Línea de Envasado & Almacén Frío',
    stream_url: 'rtsp://admin:pwd@192.168.1.120:554/h264',
    fps_target: 30,
    current_fps: 29.8,
    is_active: true,
    type: 'RTSP',
    resolution: '1920x1080',
    created_at: '2026-11-01T08:00:00Z',
  },
  {
    id: 'CAM-03',
    name: 'Estación Central de Lavado y Sinks',
    stream_url: 'rtsp://admin:pwd@192.168.1.125:554/h264',
    fps_target: 30,
    current_fps: 30.0,
    is_active: true,
    type: 'RTSP',
    resolution: '1920x1080',
    created_at: '2026-11-01T08:00:00Z',
  }
];

export const INITIAL_RULES: SanitaryRule[] = [
  {
    id: 'rule-01',
    code: 'RULE-EPP-001',
    description: 'Operador en mesa sin cofia capilar',
    condition: 'Operador activo en mesa sin cofia detectada',
    min_duration_sec: 3.0,
    severity: 'CRÍTICA',
    action_target: 'Sirena 105 dB + Alerta Roja HUD + Relé 24V',
    relay_pin: 1,
    relay_active: true,
    sound_siren: true,
  },
  {
    id: 'rule-02',
    code: 'RULE-EPP-002',
    description: 'Manos sobre alimentos o tabla sin guantes de nitrilo',
    condition: 'Interacción manual en superficie sin guantes sanitarios',
    min_duration_sec: 2.0,
    severity: 'ADVERTENCIA',
    action_target: 'Recuadro Ámbar en Canvas + Registro BD',
    relay_pin: 2,
    relay_active: false,
    sound_siren: false,
  },
  {
    id: 'rule-03',
    code: 'RULE-EPP-003',
    description: 'Operador en zona de trabajo sin mascarilla sanitaria',
    condition: 'Rostro descubierto o mascarilla bajo la barbilla',
    min_duration_sec: 4.0,
    severity: 'ADVERTENCIA',
    action_target: 'Aviso Supervisor + Registro BD',
    relay_pin: 3,
    relay_active: false,
    sound_siren: false,
  },
  {
    id: 'rule-04',
    code: 'RULE-HYG-001',
    description: 'Mesa con residuos/manchas acumuladas sin limpiar',
    condition: 'YOLO-Seg dirty_zone persiste en mesa > 5 min',
    min_duration_sec: 300.0,
    severity: 'ADVERTENCIA',
    action_target: 'Ticket Limpieza Automático + Bitácora HACCP',
    relay_pin: 4,
    relay_active: false,
    sound_siren: false,
  },
  {
    id: 'rule-05',
    code: 'RULE-HYG-002',
    description: 'Herramienta o cuchillo sucio abandonado sin lavar',
    condition: 'YOLO dirty_tool estático fuera de lavadero > 2 min',
    min_duration_sec: 120.0,
    severity: 'CRÍTICA',
    action_target: 'Alerta Desinfección Inmediata + Relé Lavavajillas',
    relay_pin: 1,
    relay_active: true,
    sound_siren: true,
  }
];

export const INITIAL_CALIBRATION: BEVCalibration = {
  id: 'bev-cam01',
  camera_id: 'CAM-01',
  scale_m: 1.0,
  source_quad: [
    { x: 0.18, y: 0.42 },
    { x: 0.82, y: 0.44 },
    { x: 0.92, y: 0.88 },
    { x: 0.08, y: 0.85 }
  ],
  table_dimensions_m: {
    width: 1.20,
    length: 2.40
  },
  residual_error_cm: 2.4,
  updated_at: '2026-11-08T18:30:00Z',
  homography_matrix: [
    [1.84, -0.42, -0.15],
    [0.08, 2.15, -0.62],
    [0.02, 0.35, 1.0]
  ]
};

export const INITIAL_ROIS: ROIZone[] = [
  {
    id: 'roi-prep-table',
    camera_id: 'CAM-01',
    name: 'Mesa de Cocina',
    zone_type: 'prep_table',
    color: '#06b6d4',
    risk_level: 'HIGH',
    polygon_coords: [
      { x: 0.20, y: 0.45 },
      { x: 0.80, y: 0.47 },
      { x: 0.90, y: 0.84 },
      { x: 0.10, y: 0.82 }
    ]
  },
  {
    id: 'roi-cutting',
    camera_id: 'CAM-01',
    name: 'Estación de Picado y Corte',
    zone_type: 'cutting_station',
    color: '#3b82f6',
    risk_level: 'HIGH',
    polygon_coords: [
      { x: 0.25, y: 0.52 },
      { x: 0.48, y: 0.53 },
      { x: 0.45, y: 0.78 },
      { x: 0.22, y: 0.76 }
    ]
  },
  {
    id: 'roi-sink',
    camera_id: 'CAM-01',
    name: 'Lavadero y Desinfección de Utensilios',
    zone_type: 'sink',
    color: '#10b981',
    risk_level: 'MEDIUM',
    polygon_coords: [
      { x: 0.84, y: 0.30 },
      { x: 0.98, y: 0.32 },
      { x: 0.97, y: 0.70 },
      { x: 0.83, y: 0.68 }
    ]
  }
];

export const INITIAL_REPORT_CONFIG: ReportConfig = {
  smtp_recipient: 'auditoria.haccp@senati-industrial.edu.pe',
  shift_name: 'Turno Matutino - Cocina Planta 2',
  plant_zone: 'Planta Industrial Lima Este',
  auto_dispatch_on_3_critical: true,
  last_dispatched_at: null
};

// ============================================================================
// CLIENTE HTTP REST CONEXIÓN A FASTAPI CON FALLBACK LOCAL TRANSPARENTE
// ============================================================================

export async function checkBackendHealth(): Promise<{ online: boolean; details?: any }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch('http://localhost:8000/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return { online: true, details: data };
    }
  } catch (e) {
    // Backend offline
  }
  return { online: false };
}

export async function saveCalibrationToBackend(
  cameraId: string,
  quad: Point2D[],
  tableDims: { length: number; width: number }
): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/cameras/${cameraId}/calibrate-bev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_quad: quad.map(p => [p.x, p.y]),
        table_dimensions_m: tableDims
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend REST inaccesible, usando estado local.');
  }
  return null;
}

export async function updateRuleInBackend(ruleId: string, updates: Partial<SanitaryRule>): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        min_duration_sec: updates.min_duration_sec,
        relay_active: updates.relay_active,
        sound_siren: updates.sound_siren
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend REST inaccesible, usando estado local.');
  }
  return null;
}

export async function triggerBackendReport(recipient: string, plantZone: string, shiftName: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_email: recipient,
        plant_zone: plantZone,
        shift_name: shiftName
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend REST inaccesible, simulando despacho.');
  }
  return null;
}

export async function triggerRelayPulseBackend(pin = 1, durationSec = 1.2): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/actuators/test-relay?pin=${pin}&duration_sec=${durationSec}`, {
      method: 'POST'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend REST inaccesible, simulando pulso relé.');
  }
  return null;
}

// Generador de incidentes de prueba con hashes SHA-256 encadenados
export async function createSeedIncidents(): Promise<Incident[]> {
  const genesisHash = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
  
  const incident1Started = '2026-11-08T18:14:20Z';
  const dedupKey1 = await generateDedupKey('rule-01', 'CAM-01', 104, 'roi-prep-table');
  const chainHash1 = await generateAuditChainHash(genesisHash, {
    ruleCode: 'RULE-EPP-001',
    cameraId: 'CAM-01',
    trackId: 104,
    timestamp: incident1Started,
    severity: 'CRÍTICA'
  });

  const incident2Started = '2026-11-08T18:45:10Z';
  const dedupKey2 = await generateDedupKey('rule-02', 'CAM-01', 108, 'roi-prep-table');
  const chainHash2 = await generateAuditChainHash(chainHash1, {
    ruleCode: 'RULE-EPP-002',
    cameraId: 'CAM-01',
    trackId: 108,
    timestamp: incident2Started,
    severity: 'ADVERTENCIA'
  });

  const incident3Started = '2026-11-08T19:20:05Z';
  const dedupKey3 = await generateDedupKey('rule-05', 'CAM-01', 112, 'roi-sink');
  const chainHash3 = await generateAuditChainHash(chainHash2, {
    ruleCode: 'RULE-HYG-002',
    cameraId: 'CAM-01',
    trackId: 112,
    timestamp: incident3Started,
    severity: 'CRÍTICA'
  });

  return [
    {
      id: 'INC-2026-0001',
      camera_id: 'CAM-01',
      camera_name: 'Mesa #1',
      rule_id: 'rule-01',
      rule_code: 'RULE-EPP-001',
      rule_description: 'Operador en mesa sin cofia capilar',
      roi_id: 'roi-prep-table',
      roi_name: 'Mesa de Cocina',
      severity: 'CRÍTICA',
      track_id: 104,
      started_at: incident1Started,
      resolved_at: '2026-11-08T18:14:38Z',
      duration_sec: 18.0,
      snapshot_key: 'snaps/20261108_181420_trk104_anon.jpg',
      dedup_hash: dedupKey1,
      prev_hash: genesisHash,
      current_hash: chainHash1,
      haccp_verified: true,
    },
    {
      id: 'INC-2026-0002',
      camera_id: 'CAM-01',
      camera_name: 'Mesa #1',
      rule_id: 'rule-02',
      rule_code: 'RULE-EPP-002',
      rule_description: 'Manos sobre alimentos o tabla sin guantes de nitrilo',
      roi_id: 'roi-prep-table',
      roi_name: 'Estación de Picado y Corte',
      severity: 'ADVERTENCIA',
      track_id: 108,
      started_at: incident2Started,
      resolved_at: '2026-11-08T18:46:02Z',
      duration_sec: 52.0,
      snapshot_key: 'snaps/20261108_184510_trk108_anon.jpg',
      dedup_hash: dedupKey2,
      prev_hash: chainHash1,
      current_hash: chainHash2,
      haccp_verified: true,
    },
    {
      id: 'INC-2026-0003',
      camera_id: 'CAM-01',
      camera_name: 'Mesa #1',
      rule_id: 'rule-05',
      rule_code: 'RULE-HYG-002',
      rule_description: 'Herramienta o cuchillo sucio abandonado sin lavar',
      roi_id: 'roi-sink',
      roi_name: 'Lavadero y Desinfección',
      severity: 'CRÍTICA',
      track_id: 112,
      started_at: incident3Started,
      resolved_at: null,
      duration_sec: 145.0,
      snapshot_key: 'snaps/20261108_192005_trk112_anon.jpg',
      dedup_hash: dedupKey3,
      prev_hash: chainHash2,
      current_hash: chainHash3,
      haccp_verified: true,
    }
  ];
}
