from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # One .env at the repo root for the whole project; real env vars win over it.
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str = f"sqlite:///{ROOT / 'backend' / 'coinvoy.db'}"
    # Public origin the browser uses (the Vite dev server in dev). Builds the Google redirect URI.
    app_url: str = "http://localhost:5173"
    cookie_secure: bool = False  # true on HTTPS (production)
    session_ttl_days: int = 7
    google_client_id: str = ""
    google_client_secret: str = ""
    demo_enabled: bool = True

    # Any OpenAI-compatible provider (see .env.example). Per-route models fall back to llm_model.
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_model_snap: str = ""
    llm_model_tanya: str = ""
    llm_model_lender: str = ""
    llm_model_bm: str = ""
    llm_timeout_s: float = 60

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key and self.llm_model)


settings = Settings()
