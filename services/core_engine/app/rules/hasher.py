import hashlib
from typing import Dict, Any

GENESIS_HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"


def calculate_dedup_key(
    rule_id: str,
    camera_id: str,
    track_id: int,
    roi_id: str
) -> str:
    """
    Fórmula de Deduplicación en Memoria conforme a la Sección 10.2:
    DedupKey = SHA256(ruleId + cameraId + trackId + roiId)
    """
    payload = f"{rule_id}:{camera_id}:{track_id}:{roi_id}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def calculate_chain_hash(prev_hash: str, incident_data: Dict[str, Any]) -> str:
    """
    Encadenamiento criptográfico forense inmutable (Sección 11).
    """
    rule_code = incident_data.get("rule_code", "")
    camera_id = incident_data.get("camera_id", "")
    track_id = incident_data.get("track_id", 0)
    started_at = incident_data.get("started_at", "")
    severity = incident_data.get("severity", "")

    payload = f"{prev_hash}|{rule_code}|{camera_id}|{track_id}|{started_at}|{severity}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
