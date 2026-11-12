export type Role = 'ADMIN' | 'SUPERVISOR' | 'AUDITOR' | 'OPERADOR';

export interface Point2D {
  x: number;
  y: number;
}

export interface Camera {
  id: string;
  name: string;
  stream_url: string;
  fps_target: number;
  current_fps: number;
  is_active: boolean;
  type: 'USB' | 'RTSP';
  resolution: string;
  created_at: string;
}

export interface BEVCalibration {
  id: string;
  camera_id: string;
  homography_matrix: number[][]; // 3x3 matrix
  scale_m: number;
  source_quad: [Point2D, Point2D, Point2D, Point2D];
  table_dimensions_m: {
    width: number;
    length: number;
  };
  residual_error_cm: number;
  updated_at: string;
}

export interface ROIZone {
  id: string;
  camera_id: string;
  name: string;
  zone_type: 'prep_table' | 'sink' | 'cutting_station' | 'disinfection';
  polygon_coords: Point2D[];
  color: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export type Severity = 'CRÍTICA' | 'ADVERTENCIA';

export interface SanitaryRule {
  id: string;
  code: 'RULE-EPP-001' | 'RULE-EPP-002' | 'RULE-EPP-003' | 'RULE-HYG-001' | 'RULE-HYG-002';
  description: string;
  condition: string;
  min_duration_sec: number;
  severity: Severity;
  action_target: string;
  relay_pin: number;
  relay_active: boolean;
  sound_siren: boolean;
}

export interface Detection {
  id: string;
  track_id: number;
  class_name: 'operator' | 'hairnet' | 'mask' | 'gloves' | 'apron' | 'dirty_zone' | 'dirty_tool';
  label_es: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, w, h] in normalized 0-1
  mask_polygon?: Point2D[]; // For YOLO-Seg
  ground_point: Point2D; // Punto de apoyo en suelo/mesa
  bev_point?: Point2D; // Coordenada métrica proyectada (x, y en metros)
  is_violation?: boolean;
  violation_code?: string;
  duration_active_sec?: number;
  face_box?: [number, number, number, number]; // Para anonimización en origen
}

export interface Incident {
  id: string;
  camera_id: string;
  camera_name: string;
  rule_id: string;
  rule_code: string;
  rule_description: string;
  roi_id: string;
  roi_name: string;
  severity: Severity;
  track_id: number;
  started_at: string;
  resolved_at: string | null;
  corrective_note?: string;
  resolved_by?: string;
  duration_sec: number;
  snapshot_key: string;
  anonymized_snapshot_data?: string;
  dedup_hash: string;
  prev_hash: string;
  current_hash: string;
  haccp_verified: boolean;
}

export interface SanitizationLog {
  id: string;
  camera_id: string;
  camera_name: string;
  performed_at: string;
  performed_by: string;
  note: string;
}

export interface Telemetry {
  fps: number;
  latency_ms: number;
  ingest_ms: number;
  inference_ms: number;
  bev_ms: number;
  queue_size: number; // Max 1 ('Latest Frame Wins')
  ram_buffer_mb: number;
  dropped_frames: number;
  relay_24v_active: boolean;
  siren_105db_active: boolean;
}

export interface ReportConfig {
  smtp_recipient: string;
  shift_name: string;
  plant_zone: string;
  auto_dispatch_on_3_critical: boolean;
  last_dispatched_at: string | null;
}
