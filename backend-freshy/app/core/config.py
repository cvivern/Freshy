from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str
    supabase_service_role_key: str

    # Roboflow
    roboflow_api_key: str
    roboflow_model_id: str = "fruit-b2sy0/1"
    roboflow_api_url: str = "https://detect.roboflow.com"

    # App
    app_name: str = "Freshy API"
    app_version: str = "0.1.0"
    debug: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


# Singleton — import this everywhere
settings = Settings()
