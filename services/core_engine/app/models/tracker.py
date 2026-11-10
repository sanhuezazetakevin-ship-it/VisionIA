import numpy as np
from typing import List, Dict, Any, Tuple


class KalmanBoxTracker:
    """
    Filtro de Kalman 2D para seguimiento individual de cajas delimitadoras
    conforme a BoT-SORT (Sección 3 y 5.1).
    Estado: [x_center, y_center, aspect_ratio, height, vx, vy, va, vh]^T
    """
    count = 100

    def __init__(self, bbox: Tuple[float, float, float, float], class_name: str):
        self.track_id = KalmanBoxTracker.count
        KalmanBoxTracker.count += 1
        
        # bbox normalizado [x, y, w, h]
        x, y, w, h = bbox
        self.x = x + w / 2.0
        self.y = y + h / 2.0
        self.w = w
        self.h = h
        self.vx = 0.0
        self.vy = 0.0
        self.class_name = class_name
        self.time_since_update = 0
        self.hits = 1
        self.hit_streak = 1
        self.age = 0

    def update(self, bbox: Tuple[float, float, float, float]):
        self.time_since_update = 0
        self.hits += 1
        self.hit_streak += 1
        x, y, w, h = bbox
        new_x = x + w / 2.0
        new_y = y + h / 2.0
        
        # Estimación de velocidad con suavizado exponencial (filtro alfa-beta)
        alpha = 0.6
        self.vx = alpha * (new_x - self.x) + (1 - alpha) * self.vx
        self.vy = alpha * (new_y - self.y) + (1 - alpha) * self.vy
        self.x = new_x
        self.y = new_y
        self.w = w
        self.h = h

    def predict(self) -> Tuple[float, float, float, float]:
        self.x += self.vx
        self.y += self.vy
        self.age += 1
        if self.time_since_update > 0:
            self.hit_streak = 0
        self.time_since_update += 1
        
        # Retorna [x, y, w, h]
        x = self.x - self.w / 2.0
        y = self.y - self.h / 2.0
        return (x, y, self.w, self.h)

    def get_state(self) -> Tuple[float, float, float, float]:
        x = self.x - self.w / 2.0
        y = self.y - self.h / 2.0
        return (x, y, self.w, self.h)


def calculate_iou(boxA: Tuple[float, float, float, float], boxB: Tuple[float, float, float, float]) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
    yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = boxA[2] * boxA[3]
    boxBArea = boxB[2] * boxB[3]

    union = boxAArea + boxBArea - interArea
    if union <= 0:
        return 0.0
    return interArea / union


class BoTSORTTracker:
    """
    Seguimiento multi-objeto (BoT-SORT) con persistencia temporal ante oclusiones.
    """

    def __init__(self, max_age: int = 30, min_hits: int = 2, iou_threshold: float = 0.3):
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.trackers: List[KalmanBoxTracker] = []

    def update(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # 1. Predicción de cada tracker existente
        for trk in self.trackers:
            trk.predict()

        matched_tracks = set()
        matched_dets = set()
        results = []

        # 2. Emparejamiento por IoU
        for d_idx, det in enumerate(detections):
            best_iou = 0.0
            best_trk_idx = -1
            det_box = tuple(det["bbox"])

            for t_idx, trk in enumerate(self.trackers):
                if t_idx in matched_tracks:
                    continue
                if trk.class_name != det["class_name"]:
                    continue
                trk_box = trk.get_state()
                iou = calculate_iou(det_box, trk_box)
                if iou > best_iou:
                    best_iou = iou
                    best_trk_idx = t_idx

            if best_iou >= self.iou_threshold and best_trk_idx != -1:
                self.trackers[best_trk_idx].update(det_box)
                matched_tracks.add(best_trk_idx)
                matched_dets.add(d_idx)
                det_copy = dict(det)
                det_copy["track_id"] = self.trackers[best_trk_idx].track_id
                results.append(det_copy)

        # 3. Crear nuevos trackers para detecciones no emparejadas
        for d_idx, det in enumerate(detections):
            if d_idx not in matched_dets:
                new_trk = KalmanBoxTracker(tuple(det["bbox"]), det["class_name"])
                self.trackers.append(new_trk)
                det_copy = dict(det)
                det_copy["track_id"] = new_trk.track_id
                results.append(det_copy)

        # 4. Eliminar trackers que exceden max_age
        self.trackers = [t for t in self.trackers if t.time_since_update <= self.max_age]

        return results
