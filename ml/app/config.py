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
    llm_daily_snap: int = 15  # images per rider per day
    llm_daily_tanya: int = 20  # turns
    llm_daily_lender: int = 5
    llm_daily_bm: int = 30  # low-confidence cost phrases
    llm_monthly_call_cap: int = 20_000  # all riders; past it, AI routes pause and manual entry stays
    # Named on the privacy page (PDPA cross-border disclosure, decisions.md A4). Update both when switching provider.
    llm_provider_name: str = ""  # e.g. "OpenRouter → Google Gemini"
    llm_region_note: str = ""  # e.g. "United States; checked 19 Oct 2026"
    bm_classifier_threshold: float = 0.7  # below it, a cost phrase goes to the LLM (architecture §6.6)
    demo_llm_cache: bool = False  # replay saved answers for the same image/prompt (FR-DEMO-2)

    # Contributions (FR-CAR-*). VERIFY each against the official source before the pitch (Idea v3 §9, PRD §10).
    isaraan_match_rate: float = 0.20  # government match on i-Saraan Plus contributions
    isaraan_match_cap_sen: int = 50_000  # per year
    perkeso_rate: float = 0.0125  # SKSPS for p-hailing, of earnings
    perkeso_deducted_at_source: bool = True  # platforms deduct it, so Coinvoy shows it instead of reserving it

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key and self.llm_model)


settings = Settings()
