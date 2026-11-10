from app.reporter.reportlab_compiler import compile_haccp_pdf_report


def test_reportlab_pdf_generation():
    """Prueba Sección 2.1 y 6 (M07): Compilación de informe PDF con ReportLab."""
    mock_incidents = [
        {
            "id": "INC-000001",
            "camera_id": "CAM-01",
            "rule_code": "RULE-EPP-001",
            "rule_description": "Operador en mesa sin cofia capilar",
            "roi_name": "Mesa de Cocina",
            "severity": "CRÍTICA",
            "duration_sec": 4.2,
            "dedup_hash": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
            "current_hash": "b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1"
        }
    ]

    pdf_bytes = compile_haccp_pdf_report(
        incidents=mock_incidents,
        recipient_email="auditoria.haccp@senati-industrial.edu.pe",
        plant_zone="Cocina Principal",
        shift_name="Turno Matutino"
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    # Todo PDF válido comienza con la firma %PDF
    assert pdf_bytes.startswith(b"%PDF")
