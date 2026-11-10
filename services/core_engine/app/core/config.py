from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "VISION AI Realtime Edition"
    VERSION: str = "2.0.0-Enterprise"
    DESCRIPTION: str = "Supervisión, Prevención y Auditoría Sanitaria para Cocinas (HACCP) - SENATI 4to Semestre"
    API_V1_STR: str = "/api/v1"
    
    # Red y Servidor
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ]

    # Scheduler 'Latest Frame Wins'
    QUEUE_SIZE: int = 1
    MAX_LATENCY_MS: float = 180.0
    TARGET_FPS: float = 60.0

    # SMTP Institucional
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "auditoria.haccp@senati-industrial.edu.pe"
    SMTP_PASSWORD: str = "app-password-demo"
    DEFAULT_ADMIN_EMAIL: str = "auditoria.haccp@senati-industrial.edu.pe"

    # Restricciones No Negociables
    ENFORCE_EPHEMERAL_RAM: bool = True
    ANONYMIZE_FACES_AT_SOURCE: bool = True
    NON_PUNITIVE_GOVERNANCE: bool = True

    # Actuadores
    RELAY_ENABLED: bool = True
    SIREN_DECIBELS: int = 105

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="allow")


settings = Settings()
