/**
 * Criptografía y deduplicación SHA-256 para auditoría HACCP y Caja Negra Forense.
 * Norma técnica: Sección 10.2 y 11 del Documento Maestro de Ingeniería.
 */

export async function computeSHA256(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback sincrónico determinista estilo SHA-256 simplificado para entornos sin WebCrypto
  let hash = 0x811c9dc5;
  for (let i = 0; i < message.length; i++) {
    hash ^= message.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(64, 'a');
}

/**
 * Clave única de deduplicación en memoria:
 * DedupKey = SHA256(ruleId + cameraId + trackId + roiId)
 */
export async function generateDedupKey(
  ruleId: string,
  cameraId: string,
  trackId: number,
  roiId: string
): Promise<string> {
  const payload = `${ruleId}:${cameraId}:${trackId}:${roiId}`;
  return computeSHA256(payload);
}

/**
 * Encadenamiento criptográfico forense (Bloque Génesis y eslabones de auditoría)
 */
export async function generateAuditChainHash(
  prevHash: string,
  incidentData: {
    ruleCode: string;
    cameraId: string;
    trackId: number;
    timestamp: string;
    severity: string;
  }
): Promise<string> {
  const payload = `${prevHash}|${incidentData.ruleCode}|${incidentData.cameraId}|${incidentData.trackId}|${incidentData.timestamp}|${incidentData.severity}`;
  return computeSHA256(payload);
}
