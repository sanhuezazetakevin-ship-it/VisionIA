# VISION AI Realtime Edition (v2.0 Enterprise)
## Plataforma Enterprise de Visión Computacional en Tiempo Real para Cocinas (HACCP)
**Carrera de Ingeniería de Software con Inteligencia Artificial — SENATI (4to Semestre)**  
*Documento Maestro de Ingeniería, Especificación Técnica y Guía Operativa — Noviembre 2026*

---

## 1. Resumen Ejecutivo y Restricciones No Negociables
**VISION AI Realtime Edition** es una plataforma de supervisión higiénico-sanitaria en tiempo real diseñada bajo el estándar internacional **HACCP (Hazard Analysis and Critical Control Points)** para cocinas y áreas de manipulación de alimentos. La solución correlaciona detecciones visuales de alta velocidad (YOLOv9 y YOLO-Seg), corrección métrica cenital mediante homografía 3x3 (BEV), filtros antirrebote temporales (2 a 4 s), deduplicación criptográfica SHA-256 y transmisión a 60 FPS hacia un visor HUD en Canvas HTML5, con un tiempo de reacción total **inferior a 800 ms**.

### Principios y Restricciones No Negociables:
1. **Sin Carga Manual:** Prohibición estricta de interfaces para subida de archivos estáticos (`.pdf`, `.mp4`, `.jpg`). Todo el procesamiento se alimenta en vivo desde webcams USB 1080p o flujos RTSP/WebRTC.
2. **Fotogramas Efímeros en RAM:** Los cuadros decodificados residen exclusivamente en memoria volátil (RAM) y se destruyen de inmediato tras la inferencia. Solo se almacenan evidencias visuales asociadas a incidentes confirmados.
3. **Sin Reconocimiento Biométrico:** Prohibición explícita de identificación facial o biométrica de trabajadores. Se aplica desenfoque Gaussiano profundo y enmascaramiento facial destructivo e irreversible en memoria RAM antes de emitir el frame al cliente.
4. **Gobernanza No Punitiva:** La plataforma supervisa la inocuidad sanitaria del proceso, el estado de la mesa y las herramientas de cocina; no mide rendimientos disciplinarios individuales, velocidad laboral ni descansos.

---

## 2. Arquitectura Empresarial: Modelo TerraSafe (5 Capas)

| Capa | Nombre | Responsabilidad Técnica | Tecnologías / Componentes |
| :--- | :--- | :--- | :--- |
| **CAPA 1** | **Física** | Captura continua de video USB / RTSP a 30 FPS sin freeze | Cámaras IP67, Webcams 1080p, Jetson / NUC |
| **CAPA 2** | **Ingesta** | Decodificación hardware, buffer circular RAM, *Latest Frame Wins* (`queue_size = 1`) | OpenCV multihilo, Conversor BGR a RGB en RAM |
| **CAPA 3** | **IA & Visión** | Inferencia dual YOLOv9 (EPP) y YOLO-Seg (cosas de cocina / suciedad) + BoT-SORT | PyTorch / ONNX Runtime, Filtro de Kalman 2D |
| **CAPA 4** | **Espacial (BEV)** | Transformación homográfica cenital 3x3 (*Bird's Eye View*) y colisiones métricas | Matriz Homográfica $H_{3\times3}$ DLT, Polígonos Shapely |
| **CAPA 5** | **Actuación** | Render Canvas 60 FPS, sirena 105 dB, relés 24V y despacho de reportes ReportLab | Canvas HTML5, Web Audio API, Relés optoaislados, FastAPI |

### Pipeline Extremo a Extremo (< 800 ms):
$$\text{Cámara USB/RTSP (<15 ms)} \rightarrow \text{RAM & Letterbox (<5 ms)} \rightarrow \text{Inferencia Dual YOLO (18-25 ms)} \rightarrow \text{NMS & BoT-SORT (<11 ms)} \rightarrow \text{Homografía BEV (<4 ms)} \rightarrow \text{Motor Reglas & Hash SHA-256 (<5 ms)} \rightarrow \text{WebSocket HUD 60 FPS (<10 ms)} + \text{Relé 24V / Sirena (<5 ms)}$$

---

## 3. Matriz de Reglas de Negocio, Filtro Antirrebote y Deduplicación

| Código Regla | Condición Espaciotemporal | Severidad | Tiempo Mín. (Debounce) | Acción Operativa |
| :--- | :--- | :--- | :--- | :--- |
| **RULE-EPP-001** | Operador en mesa sin cofia capilar sanitaria | **CRÍTICA** | **3.0 s** | Sirena 105 dB + Alerta Roja HUD + Relé 24V Pin #1 |
| **RULE-EPP-002** | Manos sobre alimentos o tabla de picar sin guantes | **ADVERTENCIA** | **2.0 s** | Recuadro Ámbar en Canvas + Registro en BD |
| **RULE-EPP-003** | Operador en zona de trabajo sin mascarilla | **ADVERTENCIA** | **4.0 s** | Aviso Supervisor en HUD + Registro en BD |
| **RULE-HYG-001** | Mesa con residuos grasos o manchas sin limpiar | **ADVERTENCIA** | **300.0 s (5 min)** | Ticket Limpieza Automático + Bitácora HACCP |
| **RULE-HYG-002** | Herramienta o cuchillo de cocina sucio en mesa | **CRÍTICA** | **120.0 s (2 min)** | Alerta Desinfección Inmediata + Relé Lavavajillas |

### Deduplicación Criptográfica en Memoria (Sección 10.2):
$$\text{DedupKey} = \text{SHA256}(\text{ruleId} + \text{cameraId} + \text{trackId} + \text{roiId})$$
*Ante una infracción continua (ej. operario sin cofia por 60 s), se actualiza la duración del incidente existente sin duplicar eventos en la base de datos ni saturar la sirena.*

---

## 4. Estructura del Repositorio

```text
vision-ai-enterprise/
├── apps/
│   └── web/                                  # FRONTEND (React 19 + TypeScript + Canvas 60 FPS + Tailwind)
│       ├── index.html                        # Cockpit Shell Industrial
│       ├── package.json                      # Dependencias de UI, Canvas, jsPDF
│       ├── tailwind.config.js                # Tema industrial oscuro, colores de alerta y fuentes mono
│       ├── tsconfig.json / tsconfig.app.json # Configuración TypeScript
│       └── src/
│           ├── components/
│           │   ├── hud/LiveHudViewer.tsx     # M01: Visor Canvas 60 FPS + YOLO Boxes + YOLO-Seg + Blur
│           │   ├── calibration/BevCalibrationConsole.tsx # M03: Calibración interactiva 4 puntos en mesa
│           │   ├── blackbox/BlackboxAudit.tsx# M06: Caja Negra HACCP con hash encadenado SHA-256
│           │   ├── rules/RulesControlCenter.tsx # M05/M08: Matriz de reglas, tiempos y banco de relés 24V
│           │   ├── reports/ExecutiveReports.tsx # M07: Compilador ReportLab PDF y despacho SMTP
│           │   └── cameras/CameraManager.tsx # M02: Ingesta multihilo y prueba de reconexión < 3s
│           ├── hooks/
│           │   ├── useWebSocketLiveFeed.ts   # Scheduler unitario y simulación de pipeline a 60 FPS
│           │   └── useSoundAlerts.ts         # M08: Sirena 105 dB sintetizada vía Web Audio API
│           ├── lib/
│           │   ├── types.ts                  # Modelos TypeScript
│           │   ├── apiClient.ts              # Semillas y contratos de API REST (Sección 9)
│           │   ├── homographyMath.ts         # DLT Gaussian 8x8 Solver para matriz H 3x3
│           │   ├── sha256.ts                 # Criptografía SHA-256 en cliente
│           │   └── reportLabPdf.ts           # Compilador de informes PDF cliente estilo ReportLab
│           ├── App.tsx                       # Dashboard con pestañas y roles RACI
│           ├── main.tsx                      # Entrypoint React
│           └── index.css                     # Estilos industriales y scanline CRT
├── services/
│   └── core_engine/                          # BACKEND (Python 3.12 + FastAPI + OpenCV + ReportLab)
│       ├── app/
│       │   ├── core/
│       │   │   ├── config.py                 # Pydantic Settings, variables de entorno, CORS, SMTP
│       │   │   ├── scheduler.py              # Scheduler 'Latest Frame Wins' (queue_size = 1)
│       │   │   └── security.py               # Desenfoque facial destructivo en RAM
│       │   ├── vision/
│       │   │   ├── preprocessor.py           # Letterbox proporcional 640x640 y BGR -> RGB
│       │   │   └── capture.py                # Ingesta OpenCV multihilo con reconexión < 3s
│       │   ├── spatial/
│       │   │   ├── homography.py             # Homografía BEV 3x3 (Error residual < 5 cm verificado)
│       │   │   └── roi_collision.py          # Colisiones espaciales Shapely en mesa y lavadero
│       │   ├── models/
│       │   │   ├── detector.py               # Inferencia dual: YOLOv9 (EPP) y YOLO-Seg (cosas de cocina)
│       │   │   └── tracker.py                # Tracking BoT-SORT con filtro Kalman y persistencia
│       │   ├── rules/
│       │   │   ├── hasher.py                 # DedupKey SHA-256 y encadenamiento forense
│       │   │   └── engine.py                 # Matriz de reglas antirrebote temporal
│       │   ├── reporter/
│       │   │   ├── reportlab_compiler.py     # Generador de informes PDF con ReportLab oficial
│       │   │   └── smtp_dispatcher.py        # Despacho asíncrono SMTP con cola de reintento
│       │   ├── api/v1/
│       │   │   ├── schemas.py                # Esquemas Pydantic V2 de API
│       │   │   ├── endpoints.py              # Rutas REST (/cameras, /calibrate-bev, /rules, /incidents)
│       │   │   └── websockets.py             # WebSocket /ws/v1/live-feed/{camera_id} a 60 FPS
│       │   └── main.py                       # Servidor FastAPI
│       ├── tests/                            # Suite Pytest (14 pruebas automatizadas)
│       │   ├── test_api.py                   # Pruebas de endpoints REST
│       │   ├── test_homography.py            # Pruebas de cálculo de matriz 3x3 y error residual < 5cm
│       │   ├── test_reportlab.py             # Pruebas de compilación válida de PDF ReportLab
│       │   └── test_rules_dedup.py           # Pruebas de antirrebote y cero duplicados en BD
│       ├── requirements.txt                  # Dependencias Python
│       └── generate_desktop_pdf.py           # Script para generar el PDF detallado en el Escritorio
├── weights/                                  # Directorio para modelos (.pt / .onnx)
├── infra/                                    # docker-compose.yml con PostgreSQL 16 y relés
├── pytest.ini                                # Configuración Pytest en la raíz
└── package.json                              # Scripts unificados de ejecución
```

---

## 5. Requisitos e Instalación

### Requisitos Previos:
* **Node.js:** v18.0.0 o superior (recomendado v20+ / v24).
* **Python:** v3.11 o v3.12 (verificado en Python 3.12.10).

### Instalación de Dependencias:
1. **Frontend:**
   ```powershell
   cd apps/web
   npm install
   cd ../..
   ```
2. **Backend (Python):**
   ```powershell
   pip install -r services/core_engine/requirements.txt
   ```

---

## 6. Instrucciones de Puesta en Marcha

### A. Iniciar el Servidor Backend (FastAPI + OpenCV + ReportLab)
Desde la raíz del proyecto ejecuta:
```powershell
npm run dev:backend
```
*O directamente con Python:*
```powershell
python -m uvicorn app.main:app --app-dir services/core_engine --reload --port 8000
```
* **API REST & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)
* **WebSocket Live Feed:** `ws://localhost:8000/ws/v1/live-feed/CAM-01`

---

### B. Iniciar el Cliente Frontend (React 19 + Canvas 60 FPS)
En otra terminal desde la raíz del proyecto ejecuta:
```powershell
npm run dev
```
* **Dashboard Cockpit:** [http://localhost:5173/](http://localhost:5173/)

---

### C. Ejecutar la Suite de Pruebas Automatizadas (14 Tests Verificados)
Para comprobar el funcionamiento del backend y los algoritmos:
```powershell
npm run test:backend
```
*O directamente con Pytest:*
```powershell
python -m pytest
```
**Resultado Verificado:**
```text
services\core_engine\tests\test_api.py .......                           [ 50%]
services\core_engine\tests\test_homography.py ...                        [ 71%]
services\core_engine\tests\test_reportlab.py .                           [ 78%]
services\core_engine\tests\test_rules_dedup.py ...                       [100%]
============================= 14 passed in 1.15s ==============================
```

---

## 7. Guía de Operación de los Módulos en el Frontend

1. **[01. VISOR HUD EN VIVO]:**
   * Visualiza el renderizado continuo a 60 FPS.
   * Alterna entre el **Simulador Cocina** y tu **Cámara Web USB Física en Vivo** mediante el botón de la cabecera del HUD.
   * Observa la anonimización destructiva en tiempo real sobre el rostro del operario.
   * Filtra capas visuales (YOLOv9 EPP Boxes, YOLO-Seg Suciedad, Polígonos ROI, Vectores BEV).
   * Alarma acústica integrada mediante Web Audio API con control de volumen/silencio.
2. **[02. CALIBRACIÓN BEV (BIRD'S EYE VIEW)]:**
   * Arrastra los 4 vértices $P_1, P_2, P_3, P_4$ sobre la mesa en la perspectiva oblicua de cámara.
   * Observa el cálculo en tiempo real de la **Matriz Homográfica 3x3** y la proyección cenital ortogonal métrica en escala 1:1.
   * Haz clic para proyectar el punto de prueba y verificar el error residual (&lt; 5 cm).
   * Guarda la calibración mediante `POST /api/v1/cameras/{id}/calibrate-bev`.
3. **[03. CAJA NEGRA HACCP]:**
   * Explora la bitácora forense inmutable de incidentes higiénicos.
   * Filtra por severidad (Crítica / Advertencia) o busca por código de regla o ID de incidente.
   * Abre el modal de **Snapshot** para inspeccionar la evidencia con anonimización facial en origen y validación de hash de bloque encadenado.
4. **[04. MATRIZ DE REGLAS & RELÉS 24V]:**
   * Modifica en caliente los umbrales de tiempo antirrebote (ej.: 3.0 s para cofia, 2.0 s para guantes).
   * Activa/desactiva relés asociados y sonido de sirena.
   * Utiliza el botón **"Test Pulso Relé 24V (Sirena 105 dB)"** para probar la activación del actuador optoaislado.
5. **[05. REPORTE PDF REPORTLAB]:**
   * Configura el correo institucional del Administrador/Auditor (`auditoria.haccp@senati-industrial.edu.pe`).
   * Descarga el informe ejecutivo en PDF compilado con el motor ReportLab.
   * Pulsa **"Forzar Despacho SMTP"** para simular la entrega asíncrona desatendida vía SMTP TLS (acuse 250 OK).
6. **[06. INGESTA Y CÁMARAS]:**
   * Monitorea el estado y salud de las fuentes de video (USB y RTSP).
   * Prueba el botón de **"Prueba Desconexión y Reconexión Rápida"** para validar la recuperación automática del stream en menos de 3 segundos (Sección 15).

---

## 8. Generación del Documento Detallado del Proyecto en PDF

El proyecto incluye un generador automatizado que compila un documento ejecutivo de ingeniería formal con encabezados SENATI, arquitectura de 5 capas, modelado matemático y resultados de pruebas.

Para regenerar o emitir este PDF en el Escritorio del usuario (`C:\Users\Gabriel\Desktop`), ejecuta:
```powershell
python services/core_engine/generate_desktop_pdf.py
```
El archivo generado se ubicará en:
`C:\Users\Gabriel\Desktop\VISION_AI_HACCP_Documentacion_Proyecto.pdf`
