import type { Point2D, ROIZone } from './types';

export type SimulationPerspective = 'frontal' | 'cenital' | 'lateral_izq' | 'lateral_der';

export interface GridSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PerspectivePreset {
  id: SimulationPerspective;
  label: string;
  shortLabel: string;
  angleInfo: string;
  description: string;
  cenitalWeight: number; // 0 = vista angular, 1 = vista cenital 90°
  lean: number; // inclinación visual del operario
  skirtDepth: number; // profundidad visual del borde frontal de la mesa
  gridLines: GridSegment[];
  tableQuad: [Point2D, Point2D, Point2D, Point2D];
  cuttingBoardQuad: [Point2D, Point2D, Point2D, Point2D];
  sinkQuad: [Point2D, Point2D, Point2D, Point2D];
  rois: ROIZone[];
  knifeBox: [number, number, number, number];
  knifePoint: Point2D;
  dirtyZonePolygon: Point2D[];
  dirtyZoneBox: [number, number, number, number];
  dirtyZonePoint: Point2D;
  operatorBase: {
    x: number;
    y: number;
    w: number;
    h: number;
    faceOffset: [number, number, number, number];
    hairnetOffset: [number, number, number, number];
    maskOffset: [number, number, number, number];
    apronOffset: [number, number, number, number];
    glovesOffset: [number, number, number, number];
    groundOffset: Point2D;
  };
}

function buildGridLines(mode: SimulationPerspective): GridSegment[] {
  const lines: GridSegment[] = [];
  const vCount = 15;
  const hCount = 10;

  for (let i = 0; i < vCount; i++) {
    const ratio = i / (vCount - 1);
    if (mode === 'cenital') {
      lines.push({ x1: ratio, y1: 0, x2: ratio, y2: 1 });
    } else if (mode === 'frontal') {
      const u = -0.1 + ratio * 1.2;
      lines.push({ x1: u, y1: 0.38, x2: u * 1.35 - 0.175, y2: 1 });
    } else if (mode === 'lateral_izq') {
      const u = -0.2 + ratio * 1.4;
      lines.push({ x1: u, y1: 0.32, x2: u + 0.18, y2: 1 });
    } else {
      const u = -0.2 + ratio * 1.4;
      lines.push({ x1: u, y1: 0.32, x2: u - 0.18, y2: 1 });
    }
  }

  for (let j = 0; j < hCount; j++) {
    const ratio = j / (hCount - 1);
    if (mode === 'cenital') {
      lines.push({ x1: 0, y1: ratio, x2: 1, y2: ratio });
    } else if (mode === 'frontal') {
      const y = 0.38 + ratio * 0.62;
      lines.push({ x1: 0, y1: y, x2: 1, y2: y });
    } else if (mode === 'lateral_izq') {
      const y = 0.32 + ratio * 0.68;
      lines.push({ x1: 0, y1: y, x2: 1, y2: y - 0.05 });
    } else {
      const y = 0.32 + ratio * 0.68;
      lines.push({ x1: 0, y1: y - 0.05, x2: 1, y2: y });
    }
  }

  return lines;
}

export const SIMULATION_PERSPECTIVES: Record<SimulationPerspective, PerspectivePreset> = {
  frontal: {
    id: 'frontal',
    label: 'Frontal Elevada (45°)',
    shortLabel: 'Frontal',
    angleInfo: 'Elevación 45° · Vista estándar',
    description: 'Cámara montada al frente sobre la línea de preparación.',
    cenitalWeight: 0,
    lean: 0,
    skirtDepth: 0.045,
    gridLines: buildGridLines('frontal'),
    tableQuad: [
      { x: 0.18, y: 0.44 },
      { x: 0.82, y: 0.45 },
      { x: 0.90, y: 0.85 },
      { x: 0.10, y: 0.84 },
    ],
    cuttingBoardQuad: [
      { x: 0.23, y: 0.54 },
      { x: 0.46, y: 0.55 },
      { x: 0.44, y: 0.76 },
      { x: 0.21, y: 0.74 },
    ],
    sinkQuad: [
      { x: 0.83, y: 0.34 },
      { x: 0.96, y: 0.36 },
      { x: 0.95, y: 0.68 },
      { x: 0.82, y: 0.66 },
    ],
    rois: [
      {
        id: 'roi-prep-table',
        camera_id: 'CAM-01',
        name: 'Mesa de Preparación',
        zone_type: 'prep_table',
        color: '#60a5fa',
        risk_level: 'HIGH',
        polygon_coords: [
          { x: 0.18, y: 0.44 },
          { x: 0.82, y: 0.45 },
          { x: 0.90, y: 0.85 },
          { x: 0.10, y: 0.84 },
        ],
      },
      {
        id: 'roi-cutting',
        camera_id: 'CAM-01',
        name: 'Zona de Corte',
        zone_type: 'cutting_station',
        color: '#93c5fd',
        risk_level: 'HIGH',
        polygon_coords: [
          { x: 0.22, y: 0.52 },
          { x: 0.47, y: 0.53 },
          { x: 0.45, y: 0.77 },
          { x: 0.20, y: 0.75 },
        ],
      },
      {
        id: 'roi-sink',
        camera_id: 'CAM-01',
        name: 'Lavadero',
        zone_type: 'sink',
        color: '#34d399',
        risk_level: 'MEDIUM',
        polygon_coords: [
          { x: 0.83, y: 0.32 },
          { x: 0.97, y: 0.34 },
          { x: 0.96, y: 0.70 },
          { x: 0.82, y: 0.68 },
        ],
      },
    ],
    knifeBox: [0.31, 0.65, 0.10, 0.05],
    knifePoint: { x: 0.36, y: 0.67 },
    dirtyZonePolygon: [
      { x: 0.56, y: 0.61 },
      { x: 0.63, y: 0.59 },
      { x: 0.71, y: 0.63 },
      { x: 0.72, y: 0.71 },
      { x: 0.64, y: 0.73 },
      { x: 0.56, y: 0.68 },
    ],
    dirtyZoneBox: [0.56, 0.59, 0.16, 0.14],
    dirtyZonePoint: { x: 0.64, y: 0.66 },
    operatorBase: {
      x: 0.35,
      y: 0.24,
      w: 0.22,
      h: 0.54,
      faceOffset: [0.06, 0.03, 0.10, 0.12],
      hairnetOffset: [0.055, 0.005, 0.11, 0.065],
      maskOffset: [0.075, 0.09, 0.07, 0.05],
      apronOffset: [0.04, 0.19, 0.14, 0.30],
      glovesOffset: [0.05, 0.40, 0.12, 0.08],
      groundOffset: { x: 0.11, y: 0.52 },
    },
  },

  cenital: {
    id: 'cenital',
    label: 'Cenital Aérea (90°)',
    shortLabel: 'Cenital',
    angleInfo: 'Perpendicular 90° · Planta',
    description: 'Vista superior directa alineada con la proyección métrica BEV.',
    cenitalWeight: 1,
    lean: 0,
    skirtDepth: 0,
    gridLines: buildGridLines('cenital'),
    tableQuad: [
      { x: 0.14, y: 0.24 },
      { x: 0.76, y: 0.24 },
      { x: 0.76, y: 0.78 },
      { x: 0.14, y: 0.78 },
    ],
    cuttingBoardQuad: [
      { x: 0.21, y: 0.36 },
      { x: 0.43, y: 0.36 },
      { x: 0.43, y: 0.66 },
      { x: 0.21, y: 0.66 },
    ],
    sinkQuad: [
      { x: 0.79, y: 0.24 },
      { x: 0.94, y: 0.24 },
      { x: 0.94, y: 0.74 },
      { x: 0.79, y: 0.74 },
    ],
    rois: [
      {
        id: 'roi-prep-table',
        camera_id: 'CAM-01',
        name: 'Mesa de Preparación',
        zone_type: 'prep_table',
        color: '#60a5fa',
        risk_level: 'HIGH',
        polygon_coords: [
          { x: 0.14, y: 0.24 },
          { x: 0.76, y: 0.24 },
          { x: 0.76, y: 0.78 },
          { x: 0.14, y: 0.78 },
        ],
      },
      {
        id: 'roi-cutting',
        camera_id: 'CAM-01',
        name: 'Zona de Corte',
        zone_type: 'cutting_station',
        color: '#93c5fd',
        risk_level: 'HIGH',
        polygon_coords: [
          { x: 0.20, y: 0.35 },
          { x: 0.44, y: 0.35 },
          { x: 0.44, y: 0.67 },
          { x: 0.20, y: 0.67 },
        ],
      },
      {
        id: 'roi-sink',
        camera_id: 'CAM-01',
        name: 'Lavadero',
        zone_type: 'sink',
        color: '#34d399',
        risk_level: 'MEDIUM',
        polygon_coords: [
          { x: 0.79, y: 0.24 },
          { x: 0.94, y: 0.24 },
          { x: 0.94, y: 0.74 },
          { x: 0.79, y: 0.74 },
        ],
      },
    ],
    knifeBox: [0.33, 0.50, 0.08, 0.06],
    knifePoint: { x: 0.37, y: 0.53 },
    dirtyZonePolygon: [
      { x: 0.54, y: 0.42 },
      { x: 0.62, y: 0.39 },
      { x: 0.69, y: 0.44 },
      { x: 0.68, y: 0.55 },
      { x: 0.60, y: 0.58 },
      { x: 0.53, y: 0.51 },
    ],
    dirtyZoneBox: [0.53, 0.39, 0.16, 0.19],
    dirtyZonePoint: { x: 0.61, y: 0.48 },
    operatorBase: {
      x: 0.26,
      y: 0.10,
      w: 0.20,
      h: 0.36,
      faceOffset: [0.055, 0.03, 0.09, 0.12],
      hairnetOffset: [0.05, 0.02, 0.10, 0.11],
      maskOffset: [0.065, 0.11, 0.07, 0.05],
      apronOffset: [0.02, 0.08, 0.16, 0.18],
      glovesOffset: [0.04, 0.26, 0.12, 0.09],
      groundOffset: { x: 0.10, y: 0.31 },
    },
  },

  lateral_izq: {
    id: 'lateral_izq',
    label: 'Lateral Izquierda (35°)',
    shortLabel: 'Lateral Izq.',
    angleInfo: 'Oblicua izquierda 35°',
    description: 'Cámara en extremo izquierdo enfocando hacia el lavadero.',
    cenitalWeight: 0,
    lean: 0.06,
    skirtDepth: 0.045,
    gridLines: buildGridLines('lateral_izq'),
    tableQuad: [
      { x: 0.08, y: 0.52 },
      { x: 0.72, y: 0.36 },
      { x: 0.88, y: 0.62 },
      { x: 0.26, y: 0.88 },
    ],
    cuttingBoardQuad: [
      { x: 0.19, y: 0.56 },
      { x: 0.40, y: 0.50 },
      { x: 0.49, y: 0.70 },
      { x: 0.27, y: 0.78 },
    ],
    sinkQuad: [
      { x: 0.75, y: 0.32 },
      { x: 0.91, y: 0.29 },
      { x: 0.96, y: 0.50 },
      { x: 0.82, y: 0.55 },
    ],
    rois: [
      {
        id: 'roi-prep-table',
        camera_id: 'CAM-01',
        name: 'Mesa de Preparación',
        zone_type: 'prep_table',
        color: '#60a5fa',
        risk_level: 'HIGH',
        polygon_coords: [
          { x: 0.08, y: 0.52 },
          { x: 0.72, y: 0.36 },
          { x: 0.88, y: 0.62 },
          { x: 0.26, y: 0.88 },
        ],
      },
      {
        id: 'roi-cutting',
        camera_id: 'CAM-01',
        name: 'Zona de Corte',
        zone_type: 'cutting_station',
        color: '#93c5fd',
        risk_level: 'HIGH',
        polygon_coords: [
          { x: 0.18, y: 0.55 },
          { x: 0.41, y: 0.49 },
          { x: 0.50, y: 0.71 },
          { x: 0.26, y: 0.79 },
        ],
      },
      {
        id: 'roi-sink',
        camera_id: 'CAM-01',
        name: 'Lavadero',
        zone_type: 'sink',
        color: '#34d399',
        risk_level: 'MEDIUM',
        polygon_coords: [
          { x: 0.74, y: 0.31 },
          { x: 0.92, y: 0.28 },
          { x: 0.97, y: 0.51 },
          { x: 0.81, y: 0.56 },
        ],
      },
    ],
    knifeBox: [0.30, 0.61, 0.10, 0.05],
    knifePoint: { x: 0.35, y: 0.64 },
    dirtyZonePolygon: [
      { x: 0.53, y: 0.48 },
      { x: 0.61, y: 0.45 },
      { x: 0.68, y: 0.49 },
      { x: 0.69, y: 0.56 },
      { x: 0.60, y: 0.59 },
      { x: 0.52, y: 0.54 },
    ],
    dirtyZoneBox: [0.52, 0.45, 0.17, 0.14],
    dirtyZonePoint: { x: 0.60, y: 0.52 },
    operatorBase: {
      x: 0.22,
      y: 0.20,
      w: 0.21,
      h: 0.50,
      faceOffset: [0.06, 0.03, 0.09, 0.11],
      hairnetOffset: [0.055, 0.005, 0.10, 0.06],
      maskOffset: [0.07, 0.085, 0.07, 0.045],
      apronOffset: [0.04, 0.18, 0.13, 0.26],
      glovesOffset: [0.07, 0.37, 0.11, 0.08],
      groundOffset: { x: 0.12, y: 0.46 },
    },
  },

  lateral_der: {
    id: 'lateral_der',
    label: 'Lateral Derecha (35°)',
    shortLabel: 'Lateral Der.',
    angleInfo: 'Oblicua derecha 35°',
    description: 'Cámara sobre el lavadero enfocando hacia la zona de corte.',
    cenitalWeight: 0,
    lean: -0.06,
    skirtDepth: 0.045,
    gridLines: buildGridLines('lateral_der'),
    tableQuad: [
      { x: 0.24, y: 0.36 },
      { x: 0.74, y: 0.47 },
      { x: 0.62, y: 0.84 },
      { x: 0.09, y: 0.63 },
    ],
    cuttingBoardQuad: [
      { x: 0.21, y: 0.45 },
      { x: 0.41, y: 0.50 },
      { x: 0.34, y: 0.70 },
      { x: 0.14, y: 0.63 },
    ],
    sinkQuad: [
      { x: 0.73, y: 0.44 },
      { x: 0.94, y: 0.53 },
      { x: 0.85, y: 0.86 },
      { x: 0.65, y: 0.75 },
    ],
    rois: [
      {
        id: 'roi-prep-table',
        camera_id: 'CAM-01',
        name: 'Mesa de Preparación',
        zone_type: 'prep_table',
        color: '#60a5fa',
        risk_level: 'HIGH',
        polygon_coords: [
          { x: 0.24, y: 0.36 },
          { x: 0.74, y: 0.47 },
          { x: 0.62, y: 0.84 },
          { x: 0.09, y: 0.63 },
        ],
      },
      {
        id: 'roi-cutting',
        camera_id: 'CAM-01',
        name: 'Zona de Corte',
        zone_type: 'cutting_station',
        color: '#93c5fd',
        risk_level: 'HIGH',
        polygon_coords: [
          { x: 0.20, y: 0.44 },
          { x: 0.42, y: 0.49 },
          { x: 0.35, y: 0.71 },
          { x: 0.13, y: 0.64 },
        ],
      },
      {
        id: 'roi-sink',
        camera_id: 'CAM-01',
        name: 'Lavadero',
        zone_type: 'sink',
        color: '#34d399',
        risk_level: 'MEDIUM',
        polygon_coords: [
          { x: 0.73, y: 0.43 },
          { x: 0.95, y: 0.52 },
          { x: 0.86, y: 0.87 },
          { x: 0.64, y: 0.76 },
        ],
      },
    ],
    knifeBox: [0.24, 0.56, 0.09, 0.05],
    knifePoint: { x: 0.28, y: 0.58 },
    dirtyZonePolygon: [
      { x: 0.46, y: 0.55 },
      { x: 0.54, y: 0.54 },
      { x: 0.61, y: 0.59 },
      { x: 0.59, y: 0.68 },
      { x: 0.50, y: 0.69 },
      { x: 0.44, y: 0.62 },
    ],
    dirtyZoneBox: [0.44, 0.54, 0.17, 0.15],
    dirtyZonePoint: { x: 0.52, y: 0.61 },
    operatorBase: {
      x: 0.26,
      y: 0.18,
      w: 0.20,
      h: 0.48,
      faceOffset: [0.055, 0.03, 0.09, 0.11],
      hairnetOffset: [0.05, 0.005, 0.10, 0.06],
      maskOffset: [0.065, 0.085, 0.07, 0.045],
      apronOffset: [0.035, 0.17, 0.13, 0.25],
      glovesOffset: [0.04, 0.36, 0.11, 0.08],
      groundOffset: { x: 0.10, y: 0.44 },
    },
  },
};

export const PERSPECTIVE_LIST: PerspectivePreset[] = [
  SIMULATION_PERSPECTIVES.frontal,
  SIMULATION_PERSPECTIVES.cenital,
  SIMULATION_PERSPECTIVES.lateral_izq,
  SIMULATION_PERSPECTIVES.lateral_der,
];

export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPoint(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function lerpQuad(
  a: [Point2D, Point2D, Point2D, Point2D],
  b: [Point2D, Point2D, Point2D, Point2D],
  t: number
): [Point2D, Point2D, Point2D, Point2D] {
  return [
    lerpPoint(a[0], b[0], t),
    lerpPoint(a[1], b[1], t),
    lerpPoint(a[2], b[2], t),
    lerpPoint(a[3], b[3], t),
  ];
}

function lerpBox(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number
): [number, number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
}

export function interpolatePerspectivePreset(
  from: PerspectivePreset,
  to: PerspectivePreset,
  rawT: number
): PerspectivePreset {
  if (rawT >= 1) return to;
  if (rawT <= 0) return from;
  const t = easeInOutCubic(rawT);

  return {
    ...to,
    cenitalWeight: lerp(from.cenitalWeight, to.cenitalWeight, t),
    lean: lerp(from.lean, to.lean, t),
    skirtDepth: lerp(from.skirtDepth, to.skirtDepth, t),
    gridLines: from.gridLines.map((line, i) => {
      const target = to.gridLines[i] || line;
      return {
        x1: lerp(line.x1, target.x1, t),
        y1: lerp(line.y1, target.y1, t),
        x2: lerp(line.x2, target.x2, t),
        y2: lerp(line.y2, target.y2, t),
      };
    }),
    tableQuad: lerpQuad(from.tableQuad, to.tableQuad, t),
    cuttingBoardQuad: lerpQuad(from.cuttingBoardQuad, to.cuttingBoardQuad, t),
    sinkQuad: lerpQuad(from.sinkQuad, to.sinkQuad, t),
    rois: to.rois.map((roi, idx) => {
      const prevRoi = from.rois[idx] || roi;
      return {
        ...roi,
        polygon_coords: roi.polygon_coords.map((pt, pIdx) =>
          lerpPoint(prevRoi.polygon_coords[pIdx] || pt, pt, t)
        ),
      };
    }),
    knifeBox: lerpBox(from.knifeBox, to.knifeBox, t),
    knifePoint: lerpPoint(from.knifePoint, to.knifePoint, t),
    dirtyZonePolygon: to.dirtyZonePolygon.map((pt, idx) =>
      lerpPoint(from.dirtyZonePolygon[idx] || pt, pt, t)
    ),
    dirtyZoneBox: lerpBox(from.dirtyZoneBox, to.dirtyZoneBox, t),
    dirtyZonePoint: lerpPoint(from.dirtyZonePoint, to.dirtyZonePoint, t),
    operatorBase: {
      x: lerp(from.operatorBase.x, to.operatorBase.x, t),
      y: lerp(from.operatorBase.y, to.operatorBase.y, t),
      w: lerp(from.operatorBase.w, to.operatorBase.w, t),
      h: lerp(from.operatorBase.h, to.operatorBase.h, t),
      faceOffset: lerpBox(from.operatorBase.faceOffset, to.operatorBase.faceOffset, t),
      hairnetOffset: lerpBox(from.operatorBase.hairnetOffset, to.operatorBase.hairnetOffset, t),
      maskOffset: lerpBox(from.operatorBase.maskOffset, to.operatorBase.maskOffset, t),
      apronOffset: lerpBox(from.operatorBase.apronOffset, to.operatorBase.apronOffset, t),
      glovesOffset: lerpBox(from.operatorBase.glovesOffset, to.operatorBase.glovesOffset, t),
      groundOffset: lerpPoint(from.operatorBase.groundOffset, to.operatorBase.groundOffset, t),
    },
  };
}
