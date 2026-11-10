from pydantic import BaseModel, Field
from typing import List, Tuple, Optional, Dict, Any


class CameraSchema(BaseModel):
    id: str
    name: str
    stream_url: str
    fps_target: int = 30
    current_fps: float = 30.0
    is_active: bool = True
    type: str = "USB"
    resolution: str = "1920x1080"
    created_at: str


class TableDimensionsSchema(BaseModel):
    length: float = 2.40
    width: float = 1.20


class CalibrateBEVRequest(BaseModel):
    source_quad: List[Tuple[float, float]] = Field(
        ..., min_length=4, max_length=4,
        description="4 esquinas normalizadas de la mesa (x, y) en 0.0 - 1.0"
    )
    table_dimensions_m: Optional[TableDimensionsSchema] = None


class BEVCalibrationSchema(BaseModel):
    id: str
    camera_id: str
    homography_matrix: List[List[float]]
    scale_m: float = 1.0
    source_quad: List[Tuple[float, float]]
    table_dimensions_m: TableDimensionsSchema
    residual_error_cm: float
    meets_haccp_standard: bool
    updated_at: str


class ROIZoneSchema(BaseModel):
    id: str
    camera_id: str
    name: str
    zone_type: str
    polygon_coords: List[Tuple[float, float]]
    color: str = "#06b6d4"
    risk_level: str = "HIGH"


class SanitaryRuleSchema(BaseModel):
    id: str
    code: str
    description: str
    condition: str
    min_duration_sec: float
    severity: str
    action_target: str
    relay_pin: int
    relay_active: bool
    sound_siren: bool


class UpdateRuleRequest(BaseModel):
    min_duration_sec: Optional[float] = None
    relay_active: Optional[bool] = None
    sound_siren: Optional[bool] = None


class IncidentSchema(BaseModel):
    id: str
    camera_id: str
    camera_name: str
    rule_id: str
    rule_code: str
    rule_description: str
    roi_id: str
    roi_name: str
    severity: str
    track_id: int
    started_at: str
    resolved_at: Optional[str] = None
    duration_sec: float
    snapshot_key: str
    dedup_hash: str
    prev_hash: str
    current_hash: str
    haccp_verified: bool = True


class ReportTriggerRequest(BaseModel):
    recipient_email: str
    plant_zone: Optional[str] = "Cocina Principal"
    shift_name: Optional[str] = "Turno Operativo"


class TelemetrySchema(BaseModel):
    fps: float
    latency_ms: float
    ingest_ms: float
    inference_ms: float
    bev_ms: float
    queue_size: int
    ram_buffer_mb: float
    dropped_frames: int
    relay_24v_active: bool
    siren_105db_active: bool
