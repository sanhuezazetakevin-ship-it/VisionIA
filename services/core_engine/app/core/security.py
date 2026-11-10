import cv2
import numpy as np
from typing import List, Tuple


def apply_destructive_face_anonymization(
    frame_bgr: np.ndarray,
    face_boxes: List[Tuple[int, int, int, int]]
) -> np.ndarray:
    """
    Aplica desenfoque Gaussiano profundo y enmascaramiento destructivo en RAM
    conforme a la Sección 1 y 11 del Documento Maestro (Sin Reconocimiento Biométrico).
    face_boxes: lista de tuplas (x1, y1, x2, y2) en coordenadas de píxeles.
    """
    if frame_bgr is None or len(face_boxes) == 0:
        return frame_bgr

    h, w = frame_bgr.shape[:2]

    for (x1, y1, x2, y2) in face_boxes:
        # Clamping de coordenadas a los límites del cuadro
        x1 = max(0, min(w - 1, x1))
        y1 = max(0, min(h - 1, y1))
        x2 = max(0, min(w, x2))
        y2 = max(0, min(h, y2))

        if x2 <= x1 or y2 <= y1:
            continue

        roi = frame_bgr[y1:y2, x1:x2]
        if roi.size == 0:
            continue

        # 1. Reducción de resolución profunda (mosaico)
        roi_h, roi_w = roi.shape[:2]
        small_w = max(1, roi_w // 16)
        small_h = max(1, roi_h // 16)
        pixelated = cv2.resize(roi, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
        upscaled = cv2.resize(pixelated, (roi_w, roi_h), interpolation=cv2.INTER_NEAREST)

        # 2. Desenfoque Gaussiano profundo irreversible
        kernel_size = 51 if roi_w >= 51 else (roi_w // 2 * 2 + 1)
        kernel_size = max(3, kernel_size)
        blurred = cv2.GaussianBlur(upscaled, (kernel_size, kernel_size), 30.0)

        # Reemplazo destructivo en memoria
        frame_bgr[y1:y2, x1:x2] = blurred

    return frame_bgr
