import cv2
import numpy as np
from typing import Tuple, Dict, Any


def letterbox(
    im: np.ndarray,
    new_shape: Tuple[int, int] = (640, 640),
    color: Tuple[int, int, int] = (114, 114, 114)
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Redimensiona y aplica padding proporcional (Letterbox) a 640x640
    conforme a la Sección 4.3 y 5.1 del Documento Maestro.
    """
    shape = im.shape[:2]  # altura, anchura actual
    if isinstance(new_shape, int):
        new_shape = (new_shape, new_shape)

    # Ratio de escala (nuevo / antiguo)
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])

    # Nuevas dimensiones sin distorsión
    new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]  # padding total

    dw /= 2  # dividir padding a ambos lados
    dh /= 2

    if shape[::-1] != new_unpad:  # redimensionar
        im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)

    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))

    im_padded = cv2.copyMakeBorder(
        im, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color
    )

    metadata = {
        "ratio": r,
        "pad": (dw, dh),
        "orig_shape": shape,
        "new_shape": new_shape
    }

    return im_padded, metadata


def bgr_to_rgb(image_bgr: np.ndarray) -> np.ndarray:
    """Conversión de espacio de color BGR a RGB en RAM."""
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
