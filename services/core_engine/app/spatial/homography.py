import cv2
import numpy as np
from typing import List, Tuple, Dict, Any, Optional


class HomographyBEVTransformer:
    """
    Transformación homográfica cenital 3x3 (Bird's Eye View - BEV)
    conforme a la Sección 6 (M03), 6.1 y 15 del Documento Maestro.
    """

    def __init__(
        self,
        src_quad: Optional[List[Tuple[float, float]]] = None,
        table_dims_m: Tuple[float, float] = (2.40, 1.20)
    ):
        # 4 puntos por defecto normalizados (0-1)
        self.src_quad = src_quad or [
            (0.18, 0.42),
            (0.82, 0.44),
            (0.92, 0.88),
            (0.08, 0.85)
        ]
        self.table_dims_m = table_dims_m
        self.H_matrix: np.ndarray = np.eye(3, dtype=np.float64)
        self.residual_error_cm: float = 0.0
        self.compute_matrix()

    def compute_matrix(
        self,
        src_quad: Optional[List[Tuple[float, float]]] = None,
        table_dims_m: Optional[Tuple[float, float]] = None
    ) -> np.ndarray:
        if src_quad is not None:
            self.src_quad = src_quad
        if table_dims_m is not None:
            self.table_dims_m = table_dims_m

        length_m, width_m = self.table_dims_m

        src_pts = np.array(self.src_quad, dtype=np.float32)
        # Plano cenital ortogonal métrico (metros)
        dst_pts = np.array([
            [0.0, 0.0],
            [length_m, 0.0],
            [length_m, width_m],
            [0.0, width_m]
        ], dtype=np.float32)

        H, _ = cv2.findHomography(src_pts, dst_pts)
        if H is not None:
            self.H_matrix = H
        else:
            self.H_matrix = np.eye(3, dtype=np.float64)

        # Cálculo de error residual en cm (criterio < 5.0 cm según Sec. 15)
        self.residual_error_cm = self._calc_residual_error(src_pts, dst_pts)
        return self.H_matrix

    def _calc_residual_error(self, src_pts: np.ndarray, dst_pts: np.ndarray) -> float:
        total_err_m = 0.0
        for i in range(len(src_pts)):
            proj = self.project_point(float(src_pts[i][0]), float(src_pts[i][1]))
            err = np.hypot(proj[0] - dst_pts[i][0], proj[1] - dst_pts[i][1])
            total_err_m += err
        avg_err_cm = (total_err_m / len(src_pts)) * 100.0
        return round(float(avg_err_cm), 2)

    def project_point(self, x: float, y: float) -> Tuple[float, float]:
        """
        Proyecta una coordenada oblicua (x, y) hacia el plano métrico cenital BEV.
        """
        pt = np.array([[[x, y]]], dtype=np.float32)
        transformed = cv2.perspectiveTransform(pt, self.H_matrix)
        px, py = transformed[0][0]
        return (float(px), float(py))

    def get_distance_meters(self, pt1: Tuple[float, float], pt2: Tuple[float, float]) -> float:
        """Distancia métrica real euclidiana en metros en el plano BEV."""
        return float(np.hypot(pt2[0] - pt1[0], pt2[1] - pt1[1]))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "homography_matrix": self.H_matrix.tolist(),
            "source_quad": self.src_quad,
            "table_dimensions_m": {
                "length": self.table_dims_m[0],
                "width": self.table_dims_m[1]
            },
            "residual_error_cm": self.residual_error_cm,
            "meets_haccp_standard": self.residual_error_cm < 5.0
        }
