import time
from typing import List, Dict, Any, Tuple, Optional
from app.rules.hasher import calculate_dedup_key, calculate_chain_hash, GENESIS_HASH


class SanitaryRulesEngine:
    """
    Motor de Reglas Higiénico-Sanitarias HACCP y Filtro Antirrebote Temporal
    conforme a la Sección 6 (M05) y Sección 10.1.
    """

    DEFAULT_RULES = [
        {
            "id": "rule-01",
            "code": "RULE-EPP-001",
            "description": "Operador en mesa sin cofia capilar",
            "condition": "Operador en mesa sin cofia detectada",
            "min_duration_sec": 3.0,
            "severity": "CRÍTICA",
            "action_target": "Sirena 105 dB + Alerta Roja HUD + Relé 24V",
            "relay_pin": 1,
            "relay_active": True,
            "sound_siren": True
        },
        {
            "id": "rule-02",
            "code": "RULE-EPP-002",
            "description": "Manos sobre alimentos o tabla sin guantes de nitrilo",
            "condition": "Interacción manual en superficie sin guantes",
            "min_duration_sec": 2.0,
            "severity": "ADVERTENCIA",
            "action_target": "Recuadro Ámbar en Canvas + Registro BD",
            "relay_pin": 2,
            "relay_active": False,
            "sound_siren": False
        },
        {
            "id": "rule-03",
            "code": "RULE-EPP-003",
            "description": "Operador en zona de trabajo sin mascarilla sanitaria",
            "condition": "Rostro descubierto en zona de alimentos",
            "min_duration_sec": 4.0,
            "severity": "ADVERTENCIA",
            "action_target": "Aviso Supervisor + Registro BD",
            "relay_pin": 3,
            "relay_active": False,
            "sound_siren": False
        },
        {
            "id": "rule-04",
            "code": "RULE-HYG-001",
            "description": "Mesa con residuos/manchas acumuladas sin limpiar",
            "condition": "YOLO-Seg dirty_zone persiste en mesa > 5 min",
            "min_duration_sec": 300.0,
            "severity": "ADVERTENCIA",
            "action_target": "Ticket Limpieza Automático + Bitácora",
            "relay_pin": 4,
            "relay_active": False,
            "sound_siren": False
        },
        {
            "id": "rule-05",
            "code": "RULE-HYG-002",
            "description": "Herramienta o cuchillo sucio abandonado sin lavar",
            "condition": "YOLO dirty_tool estático en mesa > 2 min",
            "min_duration_sec": 120.0,
            "severity": "CRÍTICA",
            "action_target": "Alerta Desinfección Inmediata + Relé Lavavajillas",
            "relay_pin": 1,
            "relay_active": True,
            "sound_siren": True
        }
    ]

    def __init__(self, rules_config: Optional[List[Dict[str, Any]]] = None):
        self.rules: Dict[str, Dict[str, Any]] = {}
        for r in (rules_config or self.DEFAULT_RULES):
            self.rules[r["code"]] = dict(r)

        # Estado en memoria volátil de temporizadores antirrebote
        self.active_timers: Dict[str, Dict[str, Any]] = {}
        # Claves de deduplicación activas
        self.active_dedup_keys: set = set()
        # Caja negra de incidentes confirmados encadenados
        self.incidents: List[Dict[str, Any]] = []
        self.last_chain_hash: str = GENESIS_HASH

    def update_rule(self, rule_id: str, updates: Dict[str, Any]) -> bool:
        for code, r in self.rules.items():
            if r["id"] == rule_id or code == rule_id:
                r.update(updates)
                return True
        return False

    def evaluate_frame(
        self,
        camera_id: str,
        detections: List[Dict[str, Any]],
        containing_rois: List[str]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], bool]:
        """
        Evalúa el conjunto de detecciones en el marco actual contra las reglas sanitarias.
        Retorna:
        - active_violations: lista de violaciones en conteo antirrebote
        - new_confirmed_incidents: incidentes que superaron el tiempo de persistencia
        - relay_24v_triggered: True si se debe conmutar el relé de sirena
        """
        now = time.time()
        active_violations = []
        new_confirmed_incidents = []
        relay_triggered = False

        # Extraer elementos presentes
        operator_present = any(d["class_name"] == "operator" for d in detections)
        has_hairnet = any(d["class_name"] == "hairnet" for d in detections)
        has_gloves = any(d["class_name"] == "gloves" for d in detections)
        has_mask = any(d["class_name"] == "mask" for d in detections)
        has_dirty_zone = any(d["class_name"] == "dirty_zone" for d in detections)

        # Identificar track_id del operador
        op_track_id = 101
        for d in detections:
            if d["class_name"] == "operator":
                op_track_id = d.get("track_id", 101)
                break

        # Regla 1: RULE-EPP-001 (Sin cofia en mesa)
        r1 = self.rules.get("RULE-EPP-001")
        if r1 and operator_present:
            is_breaching = not has_hairnet
            key = f"RULE-EPP-001:{camera_id}:{op_track_id}"
            viol, inc, trig = self._process_timer(
                timer_key=key,
                is_breaching=is_breaching,
                rule=r1,
                camera_id=camera_id,
                track_id=op_track_id,
                roi_id="roi-prep-table",
                now=now
            )
            if viol:
                active_violations.append(viol)
            if inc:
                new_confirmed_incidents.append(inc)
            if trig:
                relay_triggered = True

        # Regla 2: RULE-EPP-002 (Sin guantes)
        r2 = self.rules.get("RULE-EPP-002")
        if r2 and operator_present:
            is_breaching = not has_gloves
            key = f"RULE-EPP-002:{camera_id}:{op_track_id}"
            viol, inc, _ = self._process_timer(
                timer_key=key,
                is_breaching=is_breaching,
                rule=r2,
                camera_id=camera_id,
                track_id=op_track_id,
                roi_id="roi-prep-table",
                now=now
            )
            if viol:
                active_violations.append(viol)
            if inc:
                new_confirmed_incidents.append(inc)

        # Regla 3: RULE-EPP-003 (Sin mascarilla)
        r3 = self.rules.get("RULE-EPP-003")
        if r3 and operator_present:
            is_breaching = not has_mask
            key = f"RULE-EPP-003:{camera_id}:{op_track_id}"
            viol, inc, _ = self._process_timer(
                timer_key=key,
                is_breaching=is_breaching,
                rule=r3,
                camera_id=camera_id,
                track_id=op_track_id,
                roi_id="roi-prep-table",
                now=now
            )
            if viol:
                active_violations.append(viol)
            if inc:
                new_confirmed_incidents.append(inc)

        return active_violations, new_confirmed_incidents, relay_triggered

    def _process_timer(
        self,
        timer_key: str,
        is_breaching: bool,
        rule: Dict[str, Any],
        camera_id: str,
        track_id: int,
        roi_id: str,
        now: float
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], bool]:
        if not is_breaching:
            if timer_key in self.active_timers:
                del self.active_timers[timer_key]
            return None, None, False

        if timer_key not in self.active_timers:
            self.active_timers[timer_key] = {
                "start": now,
                "triggered": False
            }

        elapsed = now - self.active_timers[timer_key]["start"]
        target = float(rule["min_duration_sec"])
        is_trig = elapsed >= target

        violation_status = {
            "ruleCode": rule["code"],
            "elapsedSec": round(min(target, elapsed), 1),
            "targetSec": target,
            "severity": rule["severity"],
            "trackId": track_id,
            "isTriggered": is_trig
        }

        confirmed_incident = None
        relay_signal = False

        if is_trig:
            if rule.get("relay_active") and rule["severity"] == "CRÍTICA":
                relay_signal = True

            if not self.active_timers[timer_key]["triggered"]:
                self.active_timers[timer_key]["triggered"] = True
                
                # Deduplicación por hash SHA-256 en memoria
                dedup_key = calculate_dedup_key(rule["id"], camera_id, track_id, roi_id)
                if dedup_key not in self.active_dedup_keys:
                    self.active_dedup_keys.add(dedup_key)

                    incident_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
                    incident_dict = {
                        "id": f"INC-{int(now * 1000) % 1000000:06d}",
                        "camera_id": camera_id,
                        "camera_name": "Mesa #1",
                        "rule_id": rule["id"],
                        "rule_code": rule["code"],
                        "rule_description": rule["description"],
                        "roi_id": roi_id,
                        "roi_name": "Mesa de Cocina",
                        "severity": rule["severity"],
                        "track_id": track_id,
                        "started_at": incident_time,
                        "resolved_at": None,
                        "duration_sec": round(target, 1),
                        "snapshot_key": f"snaps/{int(now)}_trk{track_id}_anon.jpg",
                        "dedup_hash": dedup_key,
                        "prev_hash": self.last_chain_hash,
                        "haccp_verified": True
                    }

                    chain_hash = calculate_chain_hash(self.last_chain_hash, incident_dict)
                    incident_dict["current_hash"] = chain_hash
                    self.last_chain_hash = chain_hash

                    self.incidents.insert(0, incident_dict)
                    confirmed_incident = incident_dict

        return violation_status, confirmed_incident, relay_signal
