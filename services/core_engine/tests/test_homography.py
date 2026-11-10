import pytest
import numpy as np
from app.spatial.homography import HomographyBEVTransformer


def test_homography_computation():
    transformer = HomographyBEVTransformer()
    matrix = transformer.compute_matrix()

    assert matrix.shape == (3, 3)
    # Debe ser una matriz con valores reales no vacíos
    assert not np.isnan(matrix).any()


def test_homography_residual_error_under_5cm():
    """Prueba Sección 15: Error residual menor a 5 cm."""
    transformer = HomographyBEVTransformer()
    assert transformer.residual_error_cm < 5.0
    assert transformer.to_dict()["meets_haccp_standard"] is True


def test_project_point_and_distance():
    transformer = HomographyBEVTransformer()
    # Punto en esquina noroeste debe proyectar cercano al origen (0, 0)
    px, py = transformer.project_point(0.18, 0.42)
    assert abs(px - 0.0) < 0.1
    assert abs(py - 0.0) < 0.1

    # Distancia euclidiana métrica
    dist = transformer.get_distance_meters((0.0, 0.0), (1.5, 2.0))
    assert pytest.approx(dist, 0.01) == 2.5
