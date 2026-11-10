from shapely.geometry import Polygon, Point
from typing import List, Tuple, Dict, Any, Optional


class ROICollisionManager:
    """
    Gestión y colisión espacial de Zonas de Interés (ROIs)
    utilizando polígonos métricos Shapely (Sección 5 y 6.1).
    """

    def __init__(self, rois_config: Optional[List[Dict[str, Any]]] = None):
        self.rois: Dict[str, Dict[str, Any]] = {}
        if rois_config:
            for roi in rois_config:
                self.add_roi(roi)
        else:
            self._init_default_kitchen_rois()

    def _init_default_kitchen_rois(self):
        """Inicializa las zonas principales de la cocina: Mesa y Lavadero."""
        default_rois = [
            {
                "id": "roi-prep-table",
                "name": "Mesa de Cocina",
                "zone_type": "prep_table",
                "polygon_coords": [
                    (0.20, 0.45),
                    (0.80, 0.47),
                    (0.90, 0.84),
                    (0.10, 0.82)
                ]
            },
            {
                "id": "roi-cutting",
                "name": "Estación de Picado y Corte",
                "zone_type": "cutting_station",
                "polygon_coords": [
                    (0.25, 0.52),
                    (0.48, 0.53),
                    (0.45, 0.78),
                    (0.22, 0.76)
                ]
            },
            {
                "id": "roi-sink",
                "name": "Lavadero y Desinfección",
                "zone_type": "sink",
                "polygon_coords": [
                    (0.84, 0.30),
                    (0.98, 0.32),
                    (0.97, 0.70),
                    (0.83, 0.68)
                ]
            }
        ]
        for r in default_rois:
            self.add_roi(r)

    def add_roi(self, roi_dict: Dict[str, Any]):
        coords = roi_dict["polygon_coords"]
        poly = Polygon(coords)
        self.rois[roi_dict["id"]] = {
            "id": roi_dict["id"],
            "name": roi_dict["name"],
            "zone_type": roi_dict.get("zone_type", "prep_table"),
            "coords": coords,
            "polygon": poly
        }

    def is_inside(self, roi_id: str, point: Tuple[float, float]) -> bool:
        """Determina si una coordenada se encuentra dentro de la zona ROI."""
        if roi_id not in self.rois:
            return False
        pt = Point(point[0], point[1])
        return self.rois[roi_id]["polygon"].contains(pt)

    def get_containing_rois(self, point: Tuple[float, float]) -> List[str]:
        """Retorna la lista de IDs de ROIs que contienen el punto especificado."""
        pt = Point(point[0], point[1])
        containing = []
        for roi_id, roi in self.rois.items():
            if roi["polygon"].contains(pt):
                containing.append(roi_id)
        return containing
