import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ONLINE"
    assert data["scheduler"] == "Latest Frame Wins"


def test_get_cameras():
    res = client.get("/api/v1/cameras")
    assert res.status_code == 200
    cameras = res.json()
    assert len(cameras) >= 1
    assert cameras[0]["id"] == "CAM-01"


def test_calibrate_bev_endpoint():
    payload = {
        "source_quad": [
            [0.18, 0.42],
            [0.82, 0.44],
            [0.92, 0.88],
            [0.08, 0.85]
        ],
        "table_dimensions_m": {
            "length": 2.40,
            "width": 1.20
        }
    }
    res = client.post("/api/v1/cameras/CAM-01/calibrate-bev", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "homography_matrix" in data
    assert data["residual_error_cm"] < 5.0
    assert data["meets_haccp_standard"] is True


def test_get_rules_and_update():
    res = client.get("/api/v1/rules")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 5

    # Actualizar regla
    update_res = client.put("/api/v1/rules/rule-01", json={"min_duration_sec": 3.5})
    assert update_res.status_code == 200
    updated_rule = update_res.json()
    assert updated_rule["min_duration_sec"] == 3.5


def test_trigger_report_endpoint():
    payload = {
        "recipient_email": "auditoria.haccp@senati-industrial.edu.pe",
        "plant_zone": "Cocina",
        "shift_name": "Turno 1"
    }
    res = client.post("/api/v1/reports/trigger", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "dispatch_details" in data


def test_download_latest_report():
    res = client.get("/api/v1/reports/download-latest")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")


def test_actuator_test_relay():
    res = client.post("/api/v1/actuators/test-relay?pin=1&duration_sec=1.5")
    assert res.status_code == 200
    data = res.json()
    assert data["relay_pin"] == 1
    assert data["status"] == "ENERGIZED_PULSE_ACTIVE"
