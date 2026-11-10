import time
from queue import Queue, Empty, Full
from typing import Optional, Any, Dict


class LatestFrameWinsScheduler:
    """
    Scheduler 'Latest Frame Wins' conforme a la Sección 5.2 del Documento Maestro.
    Cola unitaria (capacity = 1) para descartar frames atrasados de inmediato,
    eliminando el lag acumulativo y manteniendo latencias < 180 ms.
    """

    def __init__(self, queue_size: int = 1):
        self.queue_size = queue_size
        self._queue: Queue = Queue(maxsize=queue_size)
        self.dropped_frames: int = 0
        self.processed_frames: int = 0
        self.last_latency_ms: float = 0.0
        self.last_processed_timestamp: float = time.time()

    def push(self, frame_packet: Any) -> bool:
        """
        Inserta el marco más reciente. Si la cola ya contiene un marco sin procesar,
        lo descarta instantáneamente (Latest Frame Wins) e inserta el nuevo.
        """
        try:
            self._queue.put_nowait(frame_packet)
            return True
        except Full:
            # Descartar marco rezagado
            try:
                self._queue.get_nowait()
                self.dropped_frames += 1
            except Empty:
                pass

            # Insertar el marco nuevo
            try:
                self._queue.put_nowait(frame_packet)
                return True
            except Full:
                self.dropped_frames += 1
                return False

    def pop(self, timeout: Optional[float] = 0.05) -> Optional[Any]:
        """
        Obtiene el último marco para procesar en el motor de inferencia.
        """
        try:
            packet = self._queue.get(timeout=timeout)
            self.processed_frames += 1
            now = time.time()
            if isinstance(packet, dict) and "timestamp" in packet:
                self.last_latency_ms = (now - packet["timestamp"]) * 1000.0
            self.last_processed_timestamp = now
            return packet
        except Empty:
            return None

    def get_telemetry(self) -> Dict[str, Any]:
        return {
            "queue_size": self._queue.qsize(),
            "max_queue_size": self.queue_size,
            "dropped_frames": self.dropped_frames,
            "processed_frames": self.processed_frames,
            "latency_ms": round(self.last_latency_ms, 2),
            "policy": "Latest Frame Wins"
        }
