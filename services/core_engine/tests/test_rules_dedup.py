import time
from app.rules.hasher import calculate_dedup_key, calculate_chain_hash, GENESIS_HASH
from app.rules.engine import SanitaryRulesEngine


def test_dedup_key_sha256_format():
    """Prueba Sección 10.2: DedupKey = SHA256(ruleId + cameraId + trackId + roiId)."""
    key = calculate_dedup_key("rule-01", "CAM-01", 101, "roi-prep-table")
    assert isinstance(key, str)
    assert len(key) == 64  # Longitud estándar SHA-256 en hexadecimal
    
    # Determinismo
    key2 = calculate_dedup_key("rule-01", "CAM-01", 101, "roi-prep-table")
    assert key == key2


def test_audit_chain_hashing():
    """Prueba Sección 11: Encadenamiento criptográfico forense inmutable."""
    incident = {
        "rule_code": "RULE-EPP-001",
        "camera_id": "CAM-01",
        "track_id": 101,
        "started_at": "2026-11-09T18:00:00Z",
        "severity": "CRÍTICA"
    }
    block1_hash = calculate_chain_hash(GENESIS_HASH, incident)
    assert len(block1_hash) == 64
    assert block1_hash != GENESIS_HASH

    # Bloque 2 encadenado
    incident2 = {
        "rule_code": "RULE-EPP-002",
        "camera_id": "CAM-01",
        "track_id": 102,
        "started_at": "2026-11-09T18:05:00Z",
        "severity": "ADVERTENCIA"
    }
    block2_hash = calculate_chain_hash(block1_hash, incident2)
    assert len(block2_hash) == 64
    assert block2_hash != block1_hash


def test_debounce_and_zero_duplicate_incidents():
    """Prueba Sección 15: Exposición continua sin emitir alertas duplicadas en BD."""
    engine = SanitaryRulesEngine()
    
    # Detección: Operario sin cofia (infracción de RULE-EPP-001, umbral 3.0s)
    breaching_dets = [{"class_name": "operator", "track_id": 105}]

    # 1. Al inicio (t = 0), debe iniciar temporizador pero no disparar incidente
    t0 = time.time()
    v1, inc1, r1 = engine.evaluate_frame("CAM-01", breaching_dets, ["roi-prep-table"])
    assert len(inc1) == 0
    assert r1 is False

    # 2. Simulamos que transcurrieron 3.5 segundos (superó el umbral de 3.0s)
    engine.active_timers["RULE-EPP-001:CAM-01:105"]["start"] = t0 - 3.5
    v2, inc2, r2 = engine.evaluate_frame("CAM-01", breaching_dets, ["roi-prep-table"])
    
    assert len(inc2) == 1
    assert inc2[0]["rule_code"] == "RULE-EPP-001"
    assert inc2[0]["severity"] == "CRÍTICA"
    assert r2 is True  # Dispara relé 24V

    # 3. Al siguiente frame continuo (infracción aún activa), NO debe duplicar en BD
    v3, inc3, r3 = engine.evaluate_frame("CAM-01", breaching_dets, ["roi-prep-table"])
    assert len(inc3) == 0  # Cero duplicados gracias al filtro SHA-256
    assert len(engine.incidents) == 1
