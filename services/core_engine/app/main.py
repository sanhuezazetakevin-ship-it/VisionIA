import contextlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.endpoints import router as api_router
from app.api.v1.websockets import ws_router


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialización del motor
    print(f"[*] VISION AI Realtime Edition (v{settings.VERSION}) iniciando...")
    print(f"[*] Scheduler 'Latest Frame Wins' (queue_size={settings.QUEUE_SIZE}) activo.")
    print(f"[*] Anonimización facial destructiva en RAM habilitada.")
    print(f"[*] Gobernanza no punitiva activada.")
    yield
    # Limpieza
    print("[*] VISION AI Core Engine apagado de forma segura.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan
)

# Configuración de CORS para el Frontend React (local y Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montaje de rutas REST y WebSockets
app.include_router(api_router, prefix=settings.API_V1_STR, tags=["REST API"])
app.include_router(ws_router, prefix="/ws/v1", tags=["WebSockets"])


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ONLINE",
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "scheduler": "Latest Frame Wins",
        "haccp_standard": "Compliant",
        "biometrics": "Disabled (Anonymized at source)"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
